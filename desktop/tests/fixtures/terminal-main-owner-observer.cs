using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

// Probe only: fixed self-hosted fixtures, no product bridge or arbitrary shell.
// Every live fixture has a 12-second natural deadline. Authority is a held
// handle verified against the owned Job, never a recorded PID or process name.
internal static class TerminalMainOwnerObserver {
    const uint Suspended=4, Extended=0x80000, NoWindow=0x8000000, Detached=8;
    const uint KillOnClose=0x2000, Query=0x1000, Synchronize=0x100000;
    static readonly IntPtr JobListAttribute=new IntPtr(0x2000d);
    [StructLayout(LayoutKind.Sequential)] struct Startup {
        public uint cb; public IntPtr reserved,desktop,title;
        public uint x,y,xSize,ySize,xChars,yChars,fill,flags;
        public ushort show,reservedBytes; public IntPtr reservedData,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)] struct StartupEx { public Startup startup; public IntPtr attributes; }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
        public long processTime,jobTime; public uint flags;
        public UIntPtr minWorking,maxWorking; public uint active;
        public UIntPtr affinity; public uint priority,scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong a,b,c,d,e,f; }
    [StructLayout(LayoutKind.Sequential)] struct Limits {
        public BasicLimits basic; public IoCounters io;
        public UIntPtr processMemory,jobMemory,peakProcess,peakJob;
    }
    [StructLayout(LayoutKind.Sequential)] struct Accounting {
        public long user,kernel,periodUser,periodKernel;
        public uint faults,total,active,terminated;
    }
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct OsVersion {
        public uint size,major,minor,build,platform;
        [MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)] public string servicePack;
    }
    [DllImport("ntdll.dll",CharSet=CharSet.Unicode)] static extern int RtlGetVersion(ref OsVersion version);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObjectW(IntPtr attributes,string name);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref Limits info,uint size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,IntPtr info,uint size,out uint returned);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool result);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetHandleInformation(IntPtr handle,out uint flags);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,uint flags,ref UIntPtr bytes);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,UIntPtr size,IntPtr previous,IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string app,StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inherit,uint flags,IntPtr environment,string cwd,ref StartupEx startup,out ProcessInfo info);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint rights,bool inherit,uint pid);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool QueryFullProcessImageNameW(IntPtr process,uint flags,StringBuilder path,ref uint size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out long created,out long exited,out long kernel,out long user);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint GetProcessId(IntPtr process);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint exitCode);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint exitCode);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    static void Require(bool ok,string code) { if(!ok)throw new Exception(code+":"+Marshal.GetLastWin32Error()); }
    static string Quote(string value) {
        // These are fixed mode tokens and an absolute generated directory;
        // refuse ambiguous quoting rather than accepting arbitrary commands.
        if(value.IndexOf('"')>=0 || value.EndsWith("\\"))throw new Exception("FIXTURE_ARGUMENT_REFUSED");
        return "\""+value+"\"";
    }
    static IntPtr NewJob() {
        IntPtr job=CreateJobObjectW(IntPtr.Zero,null);Require(job!=IntPtr.Zero,"CREATE_JOB");
        try {
            var limits=new Limits();limits.basic.flags=KillOnClose;
            Require(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(Limits))),"SET_LIMITS");
            uint flags;Require(GetHandleInformation(job,out flags) && (flags&1)==0,"INHERITABLE_JOB");
            return job;
        } catch { CloseHandle(job);throw; }
    }
    static ProcessInfo Spawn(string exe,string application,string directory,IntPtr[] jobs,bool suspended,bool detached) {
        var command=new StringBuilder(Quote(exe)+" "+Quote(application));
        var startup=new StartupEx();startup.startup.cb=(uint)Marshal.SizeOf(typeof(Startup));
        IntPtr list=IntPtr.Zero,values=IntPtr.Zero;bool initialized=false;
        try {
            uint flags=detached?Detached:NoWindow;if(suspended)flags|=Suspended;
            if(jobs!=null){
                UIntPtr bytes=UIntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref bytes);
                Require(bytes.ToUInt64()>0 && bytes.ToUInt64()<65536,"ATTRIBUTE_SIZE");
                list=Marshal.AllocHGlobal((int)bytes.ToUInt64());
                Require(InitializeProcThreadAttributeList(list,1,0,ref bytes),"ATTRIBUTE_INIT");initialized=true;
                values=Marshal.AllocHGlobal(jobs.Length*IntPtr.Size);
                for(int i=0;i<jobs.Length;i++)Marshal.WriteIntPtr(values,i*IntPtr.Size,jobs[i]);
                Require(UpdateProcThreadAttribute(list,0,JobListAttribute,values,(UIntPtr)(jobs.Length*IntPtr.Size),IntPtr.Zero,IntPtr.Zero),"ATTRIBUTE_UPDATE");
                startup.startup.cb=(uint)Marshal.SizeOf(typeof(StartupEx));startup.attributes=list;flags|=Extended;
            }
            ProcessInfo child;
            Require(CreateProcessW(exe,command,IntPtr.Zero,IntPtr.Zero,false,flags,IntPtr.Zero,directory,ref startup,out child),"CREATE_PROCESS");
            return child;
        } finally {
            if(initialized)DeleteProcThreadAttributeList(list);
            if(values!=IntPtr.Zero)Marshal.FreeHGlobal(values);
            if(list!=IntPtr.Zero)Marshal.FreeHGlobal(list);
        }
    }
    sealed class Held {
        public IntPtr handle;public uint pid;public string image,created;
        public object Observe() {
            uint wait=WaitForSingleObject(handle,0),code;
            Require(wait==0||wait==258,"EXIT_UNKNOWN");Require(GetExitCodeProcess(handle,out code),"EXIT_CODE_UNKNOWN");
            return new Dictionary<string,object>{{"pid",pid},{"image",image},{"createdFileTime",created},{"alive",wait==258},{"exitCode",code}};
        }
    }
    static readonly JavaScriptSerializer Json=new JavaScriptSerializer{MaxJsonLength=262144,RecursionLimit=32};
    static Dictionary<string,object> Map(object value) {var map=value as Dictionary<string,object>;Require(map!=null,"OBJECT_REFUSED");return map;}
    static object[] Array(object value) {var array=value as object[];Require(array!=null,"ARRAY_REFUSED");return array;}
    static uint Pid(object value) {uint n;Require(uint.TryParse(Convert.ToString(value),out n)&&n>0,"PID_REFUSED");return n;}
    static bool Member(IntPtr process,IntPtr job) {bool yes;Require(IsProcessInJob(process,job,out yes),"MEMBERSHIP_UNKNOWN");return yes;}
    static uint Active(IntPtr job) {
        int size=Marshal.SizeOf(typeof(Accounting));IntPtr bytes=Marshal.AllocHGlobal(size);
        try {uint returned;Require(QueryInformationJobObject(job,1,bytes,(uint)size,out returned),"ACCOUNTING_UNKNOWN");return ((Accounting)Marshal.PtrToStructure(bytes,typeof(Accounting))).active;}
        finally {Marshal.FreeHGlobal(bytes);}
    }
    static Held Identity(IntPtr handle,uint pid) {
        long created,exited,kernel,user;Require(GetProcessTimes(handle,out created,out exited,out kernel,out user),"IDENTITY_TIME_UNKNOWN");
        var image=new StringBuilder(32768);uint size=32768;Require(QueryFullProcessImageNameW(handle,0,image,ref size),"IDENTITY_IMAGE_UNKNOWN");
        Require(GetProcessId(handle)==pid,"HELD_PID_MISMATCH");return new Held{handle=handle,pid=pid,image=image.ToString(),created=created.ToString()};
    }
    static List<Held> Hold(IntPtr job,string electron,string fixture,long minimumCreation) {
        var held=new List<Held>();IntPtr buffer=Marshal.AllocHGlobal(8192);
        try {
            uint returned;Require(QueryInformationJobObject(job,3,buffer,8192,out returned),"JOB_IDENTITIES_UNKNOWN");
            int assigned=Marshal.ReadInt32(buffer),count=Marshal.ReadInt32(buffer,4);Require(assigned==count&&count>=11&&count<=64,"JOB_SET_REFUSED");
            for(int i=0;i<count;i++){
                long value=Marshal.ReadIntPtr(buffer,8+i*IntPtr.Size).ToInt64();Require(value>0&&value<=uint.MaxValue,"JOB_PID_REFUSED");
                IntPtr process=OpenProcess(Query|Synchronize,false,(uint)value);Require(process!=IntPtr.Zero,"OPEN_OWNED_PROCESS_FAILED");
                try {
                    Require(Member(process,job)&&WaitForSingleObject(process,0)==258,"NOT_LIVE_OWNED_MEMBER");
                    var p=Identity(process,(uint)value);Require(long.Parse(p.created)>=minimumCreation,"CREATION_REFUSED");
                    string conhost=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe");
                    Require(string.Equals(p.image,electron,StringComparison.OrdinalIgnoreCase)||string.Equals(p.image,fixture,StringComparison.OrdinalIgnoreCase)||string.Equals(p.image,conhost,StringComparison.OrdinalIgnoreCase),"UNEXPECTED_SAFETY_MEMBER");
                    held.Add(p);process=IntPtr.Zero;
                } finally {if(process!=IntPtr.Zero)CloseHandle(process);}
            }
            return held;
        }catch {foreach(var p in held)CloseHandle(p.handle);throw;}
        finally {Marshal.FreeHGlobal(buffer);}
    }
    static object[] Observe(List<Held> held) {var rows=new List<object>();foreach(var p in held)rows.Add(p.Observe());return rows.ToArray();}
    static Held Find(List<Held> held,uint pid) {var values=held.FindAll(p=>p.pid==pid);Require(values.Count==1,"READY_MEMBER_UNKNOWN");return values[0];}
    static bool AllExited(List<Held> held,List<uint> pids) {foreach(uint pid in pids)if(WaitForSingleObject(Find(held,pid).handle,0)!=0)return false;return true;}
    static List<uint> ValidateGroups(Dictionary<string,object> ready,List<Held> held,bool negative,string electron,string fixture,out List<uint> canaries) {
        var groups=Array(ready["groups"]);Require(groups.Length==2,"GROUP_COUNT_REFUSED");var required=new List<uint>();canaries=new List<uint>();
        foreach(var raw in groups){
            var group=Map(raw);uint host=Pid(group["hostPid"]);Require(string.Equals(Find(held,host).image,electron,StringComparison.OrdinalIgnoreCase),"HOST_IMAGE_REFUSED");
            var fixedPids=Map(group["fixturePids"]);var own=new List<uint>{host};
            foreach(string key in new[]{"root","branch","grandchild","detached"}){
                uint pid=Pid(fixedPids[key]);Require(!own.Contains(pid)&&string.Equals(Find(held,pid).image,fixture,StringComparison.OrdinalIgnoreCase),"FIXTURE_IDENTITY_REFUSED");own.Add(pid);if(key!="root")canaries.Add(pid);
            }
            var ids=new List<uint>();foreach(var rawPid in Array(group["requiredPids"]))ids.Add(Pid(rawPid));
            Require(ids.Count>=5&&ids.Count<=9&&new HashSet<uint>(ids).Count==ids.Count,"REQUIRED_SET_REFUSED");foreach(uint pid in own)Require(ids.Contains(pid),"REQUIRED_FIXTURE_MISSING");
            foreach(uint pid in ids){Find(held,pid);Require(!required.Contains(pid),"OVERLAPPING_GROUPS");required.Add(pid);}
            if(!negative){
                var captured=Map(group["captured"]);Require((bool)captured["killOnClose"]&&!(bool)captured["breakaway"]&&!(bool)captured["inheritable"],"GUARD_LIMITS_REFUSED");
                var members=Array(captured["held"]);Require(members.Length==ids.Count&&Convert.ToInt32(captured["active"])==ids.Count,"CAPTURE_SET_REFUSED");
                var seen=new HashSet<uint>();foreach(var rawMember in members){var identity=Map(rawMember);uint pid=Pid(identity["pid"]);var live=Find(held,pid);Require(ids.Contains(pid)&&seen.Add(pid)&&(bool)identity["alive"]&&Convert.ToString(identity["image"])==live.image&&Convert.ToString(identity["createdFileTime"])==live.created,"GUARD_HELD_IDENTITY_REFUSED");}
            }
        }
        Require(canaries.Count==6&&new HashSet<uint>(canaries).Count==6,"CANARY_SET_REFUSED");return required;
    }
    static int Main(string[] args) {
        if(args.Length!=5)return 2;
        foreach(string path in new[]{args[0],args[1],args[2],args[3]})if(!Path.IsPathRooted(path))return 2;
        bool negative=args[4]=="negative";if(!negative&&args[4]!="positive")return 2;
        string electron=Path.GetFullPath(args[0]),application=Path.GetFullPath(args[1]),directory=Path.GetFullPath(args[2]),fixture=Path.GetFullPath(args[3]);
        IntPtr safety=IntPtr.Zero;ProcessInfo main=new ProcessInfo();var held=new List<Held>();var age=Stopwatch.StartNew();
        var result=new Dictionary<string,object>{{"status","FAILED"},{"guardEnabled",!negative}};int code=1;
        try {
            var os=new OsVersion();os.size=(uint)Marshal.SizeOf(typeof(OsVersion));Require(RtlGetVersion(ref os)==0,"OS_VERSION_UNKNOWN");result["os"]=os.major+"."+os.minor+"."+os.build;
            Require(!File.Exists(Path.Combine(directory,"owner-ready.json")),"STALE_READY_FILE");
            safety=NewJob();main=Spawn(electron,application,directory,new[]{safety},true,false);
            Require(Member(main.process,safety),"MAIN_SAFETY_NOT_ATOMIC");var mainIdentity=Identity(main.process,main.pid);
            result["main"]=mainIdentity.Observe();Require(ResumeThread(main.thread)!=uint.MaxValue,"MAIN_RESUME_FAILED");
            string readyPath=Path.Combine(directory,"owner-ready.json");
            while(!File.Exists(readyPath)&&age.ElapsedMilliseconds<6000&&WaitForSingleObject(main.process,0)==258)Thread.Sleep(10);
            Require(File.Exists(readyPath)&&age.ElapsedMilliseconds<6000,"READY_DEADLINE");
            Require(new FileInfo(readyPath).Length<=262144,"READY_BUDGET");var ready=Map(Json.DeserializeObject(File.ReadAllText(readyPath,new UTF8Encoding(false,true))));
            Require(Pid(ready["mainPid"])==main.pid&&(bool)ready["guardEnabled"]==!negative,"READY_IDENTITY_REFUSED");result["ready"]=ready;
            held=Hold(safety,electron,fixture,long.Parse(mainIdentity.created));result["held"]=Observe(held);
            List<uint> canaries;var required=ValidateGroups(ready,held,negative,electron,fixture,out canaries);
            Require(!required.Contains(main.pid),"MAIN_IN_CHILD_SET");result["groups"]=ready["groups"];result["requiredPids"]=required;result["canaryPids"]=canaries;result["before"]=Observe(held);
            foreach(var p in held)Require(WaitForSingleObject(p.handle,0)==258,"MEMBER_EXIT_BEFORE_KILL");
            var observation=Stopwatch.StartNew();Require(TerminateProcess(main.process,101),"MAIN_TERMINATION_FAILED");result["mainTerminationCode"]=101;
            Require(WaitForSingleObject(main.process,1000)==0,"MAIN_EXIT_UNOBSERVED");result["mainExitObserved"]=true;result["mainExit"]=mainIdentity.Observe();
            uint mainCode;Require(GetExitCodeProcess(main.process,out mainCode)&&mainCode==101,"MAIN_EXIT_NOT_CAUSAL");
            if(negative){while(observation.ElapsedMilliseconds<2000)Thread.Sleep(5);}
            else {while(!AllExited(held,required)&&observation.ElapsedMilliseconds<3000)Thread.Sleep(5);}
            result["after"]=Observe(held);result["observeMs"]=observation.ElapsedMilliseconds;result["fixtureAgeMs"]=age.ElapsedMilliseconds;result["safetyJobStillOpenAtObservation"]=true;
            Require(age.ElapsedMilliseconds<6000,"NATURAL_DEADLINE_COULD_MASK_RESULT");
            if(negative){foreach(uint pid in canaries)Require(WaitForSingleObject(Find(held,pid).handle,0)==258,"NEGATIVE_CANARY_NOT_LIVE");result["status"]="EXPECTED_OWNED_FAMILY_SURVIVED";}
            else {Require(AllExited(held,required)&&observation.ElapsedMilliseconds<3000,"MAIN_LOSS_LEFT_OWNED_DESCENDANTS");result["status"]="MAIN_OWNER_LOSS_PASSED";code=0;}
        }catch(Exception error){result["status"]="FAILED";result["error"]=error.Message;}
        finally {
            try {
                if(safety!=IntPtr.Zero){Require(TerminateJobObject(safety,98),"SAFETY_STOP_FAILED");var timer=Stopwatch.StartNew();
                    while(timer.ElapsedMilliseconds<3000){bool gone=true;foreach(var p in held)gone&=WaitForSingleObject(p.handle,0)==0;if(gone&&Active(safety)==0)break;Thread.Sleep(5);}
                    Require(Active(safety)==0,"SAFETY_ACCOUNTING_NOT_EMPTY");foreach(var p in held)Require(WaitForSingleObject(p.handle,0)==0,"SAFETY_EXIT_UNVERIFIED");
                    result["cleanup"]=new Dictionary<string,object>{{"verified",true},{"active",0},{"held",Observe(held)}};
                }
            }catch(Exception error){result["status"]="FAILED";result["cleanupError"]=error.Message;code=1;}
            foreach(var p in held)CloseHandle(p.handle);if(main.thread!=IntPtr.Zero)CloseHandle(main.thread);if(main.process!=IntPtr.Zero)CloseHandle(main.process);if(safety!=IntPtr.Zero)CloseHandle(safety);
            File.WriteAllText(Path.Combine(directory,"observer-result.json"),Json.Serialize(result),new UTF8Encoding(false));Console.WriteLine(Json.Serialize(result));
        }
        return code;
    }
}
