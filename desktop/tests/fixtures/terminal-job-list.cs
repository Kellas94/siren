using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Probe only: fixed self-hosted fixtures, no product bridge or arbitrary shell.
// Every live fixture has a 12-second natural deadline. Authority is a held
// handle verified against the owned Job, never a recorded PID or process name.
internal static class TerminalJobListProbe {
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
    static ProcessInfo Spawn(string mode,string directory,IntPtr[] jobs,bool suspended,bool detached) {
        string exe=Assembly.GetExecutingAssembly().Location;
        var command=new StringBuilder(Quote(exe)+" "+Quote(mode)+" "+Quote(directory));
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
    static void StartFixture(string mode,string directory,bool detached) {
        var child=Spawn(mode,directory,null,false,detached);
        CloseHandle(child.thread);CloseHandle(child.process);
    }
    static int Fixture(string mode,string directory) {
        if(mode=="root") { StartFixture("branch",directory,false);StartFixture("detached",directory,true); }
        else if(mode=="branch")StartFixture("grandchild",directory,false);
        else if(mode!="grandchild" && mode!="detached")return 2;
        File.WriteAllText(Path.Combine(directory,mode+".ready"),Process.GetCurrentProcess().Id.ToString());
        Thread.Sleep(12000);return 0;
    }
    static bool Member(IntPtr process,IntPtr job) { bool result;Require(IsProcessInJob(process,job,out result),"QUERY_MEMBERSHIP");return result; }
    static uint Active(IntPtr job) {
        int size=Marshal.SizeOf(typeof(Accounting));IntPtr bytes=Marshal.AllocHGlobal(size);
        try { uint returned;Require(QueryInformationJobObject(job,1,bytes,(uint)size,out returned),"QUERY_ACCOUNTING");return ((Accounting)Marshal.PtrToStructure(bytes,typeof(Accounting))).active; }
        finally {Marshal.FreeHGlobal(bytes);}
    }
    static List<IntPtr> HoldMembers(IntPtr job,IntPtr rootJob,int expectedFixtures=4) {
        IntPtr buffer=Marshal.AllocHGlobal(8192);var held=new List<IntPtr>();
        try {
            uint returned;Require(QueryInformationJobObject(job,3,buffer,8192,out returned),"QUERY_JOB_PIDS");
            int assigned=Marshal.ReadInt32(buffer),count=Marshal.ReadInt32(buffer,4);
            if(count<expectedFixtures || count>expectedFixtures*2 || assigned!=count) {
                var observed=new StringBuilder("EXPECTED_FOUR_OWNED_PROCESSES assigned="+assigned+" listed="+count);
                if(count>=0 && count<=512)for(int i=0;i<count;i++) {
                    long pid=Marshal.ReadIntPtr(buffer,8+i*IntPtr.Size).ToInt64();
                    IntPtr diagnostic=OpenProcess(Query,false,(uint)pid);
                    try {var image=new StringBuilder(32768);uint size=32768;
                        observed.Append("; "+pid+"="+(diagnostic!=IntPtr.Zero && QueryFullProcessImageNameW(diagnostic,0,image,ref size)?image.ToString():"UNKNOWN"));
                    }finally {if(diagnostic!=IntPtr.Zero)CloseHandle(diagnostic);}
                }
                throw new Exception(observed.ToString());
            }
            int fixtures=0,helpers=0;
            for(int i=0;i<count;i++) {
                long pid=Marshal.ReadIntPtr(buffer,8+i*IntPtr.Size).ToInt64();
                Require(pid>0 && pid<=uint.MaxValue,"PID_RANGE");
                IntPtr handle=OpenProcess(Query|Synchronize,false,(uint)pid);
                Require(handle!=IntPtr.Zero,"HOLD_PROCESS");held.Add(handle);
                Require(Member(handle,job) && Member(handle,rootJob),"DESCENDANT_MEMBERSHIP_REFUSED");
                Require(WaitForSingleObject(handle,0)==258,"DESCENDANT_ALREADY_EXITED");
                var image=new StringBuilder(32768);uint size=32768;
                Require(QueryFullProcessImageNameW(handle,0,image,ref size),"OWNED_IMAGE_UNKNOWN");
                if(string.Equals(image.ToString(),Assembly.GetExecutingAssembly().Location,StringComparison.OrdinalIgnoreCase))fixtures++;
                else if(string.Equals(image.ToString(),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe"),StringComparison.OrdinalIgnoreCase))helpers++;
                else throw new Exception("UNEXPECTED_OWNED_IMAGE:"+image.ToString());
            }
            Require(fixtures==expectedFixtures && fixtures+helpers==count,"FIXTURE_AND_HELPER_ACCOUNTING");
            return held;
        }catch {foreach(IntPtr handle in held)CloseHandle(handle);throw;}
        finally {Marshal.FreeHGlobal(buffer);}
    }
    static void WaitReady(string directory) {
        var timer=Stopwatch.StartNew();string[] modes={"root","branch","grandchild","detached"};
        while(timer.ElapsedMilliseconds<6000) {
            bool ready=true;foreach(string mode in modes)ready &= File.Exists(Path.Combine(directory,mode+".ready"));
            if(ready)return;Thread.Sleep(10);
        }
        throw new Exception("FIXTURE_READY_DEADLINE");
    }
    static void WaitEmpty(IntPtr job) {
        var timer=Stopwatch.StartNew();while(timer.ElapsedMilliseconds<3000){if(Active(job)==0)return;Thread.Sleep(10);}
        throw new Exception("JOB_NOT_EMPTY");
    }
    static void Exited(List<IntPtr> handles) {
        var timer=Stopwatch.StartNew();
        foreach(IntPtr handle in handles) {
            long remaining=3000-timer.ElapsedMilliseconds;Require(remaining>0,"OWNED_EXIT_GLOBAL_DEADLINE");
            Require(WaitForSingleObject(handle,(uint)remaining)==0,"OWNED_PROCESS_NOT_EXITED");
        }
    }
    static string ExitCodes(List<IntPtr> handles,uint? expected) {
        var codes=new List<string>();foreach(IntPtr handle in handles){uint code;
            Require(GetExitCodeProcess(handle,out code),"EXIT_CODE_UNKNOWN");
            if(expected.HasValue)Require(code==expected.Value,"STOP_EXIT_CODE_NOT_CAUSAL");
            codes.Add(code.ToString());
        }return "["+string.Join(",",codes.ToArray())+"]";
    }
    static string JsonString(string value) {return "\""+value.Replace("\\","\\\\").Replace("\"","\\\"")+"\"";}
    static string Observe(List<IntPtr> handles) {
        var entries=new List<string>();
        foreach(IntPtr handle in handles) {
            long created,exited,kernel,user;Require(GetProcessTimes(handle,out created,out exited,out kernel,out user),"IDENTITY_TIMES");
            var image=new StringBuilder(32768);uint size=32768;Require(QueryFullProcessImageNameW(handle,0,image,ref size),"IDENTITY_IMAGE");
            uint pid=GetProcessId(handle);Require(pid>0,"IDENTITY_PID");
            entries.Add("{\"pid\":"+pid+",\"createdFileTime\":"+JsonString(created.ToString())+",\"image\":"+JsonString(image.ToString())+"}");
        }
        return "["+string.Join(",",entries.ToArray())+"]";
    }
    static int PauseOwner(string directory) {
        IntPtr job=NewJob();ProcessInfo child=new ProcessInfo();
        try {
            child=Spawn("root",directory,new IntPtr[]{job},true,false);
            Require(Member(child.process,job),"OWNER_CHILD_UNCONTAINED");
            Require(ResumeThread(child.thread)!=uint.MaxValue,"OWNER_RESUME");
            WaitReady(directory);File.WriteAllText(Path.Combine(directory,"owner.ready"),"ready");
            Thread.Sleep(12000);return 0;
        }finally {
            // A forced owner exit skips this finally: the OS must close its
            // sole non-inherited Job handle and reap its descendants anyway.
            CloseHandle(job);
            if(child.thread!=IntPtr.Zero)CloseHandle(child.thread);
            if(child.process!=IntPtr.Zero)CloseHandle(child.process);
        }
    }
    static string OwnerLoss(string directory) {
        Directory.CreateDirectory(directory);IntPtr safety=NewJob();ProcessInfo owner=new ProcessInfo();
        var held=new List<IntPtr>();var timer=Stopwatch.StartNew();
        try {
            // Outer safety belongs to this supervisor and stays OPEN while
            // the nested owner's death is tested. No naked suspended fixture.
            owner=Spawn("pause-owner",directory,new IntPtr[]{safety},true,false);
            Require(Member(owner.process,safety),"OWNER_SAFETY_MEMBERSHIP");
            Require(ResumeThread(owner.thread)!=uint.MaxValue,"OWNER_START");
            while(!File.Exists(Path.Combine(directory,"owner.ready")) && timer.ElapsedMilliseconds<6000)Thread.Sleep(10);
            Require(File.Exists(Path.Combine(directory,"owner.ready")),"OWNER_READY_DEADLINE");
            // owner + four fixture descendants, plus every conhost helper.
            held=HoldMembers(safety,safety,5);string observations=Observe(held);
            var killed=Stopwatch.StartNew();
            Require(TerminateProcess(owner.process,88),"OWNED_OWNER_TERMINATE");
            Exited(held);WaitEmpty(safety);
            uint ownerCode;Require(GetExitCodeProcess(owner.process,out ownerCode) && ownerCode==88,"OWNER_EXIT_NOT_CAUSAL");
            Require(timer.ElapsedMilliseconds<10000,"OWNER_NATURAL_EXIT_COULD_MASK_RESULT");
            return "{\"passed\":true,\"elapsedMs\":"+killed.ElapsedMilliseconds+",\"fixtureAgeMs\":"+timer.ElapsedMilliseconds+",\"safetyJobStillOpen\":true,\"ownedProcesses\":"+held.Count+",\"held\":"+observations+"}";
        }finally {
            // Safety cleanup on any earlier failure, never used for success.
            TerminateJobObject(safety,98);
            foreach(IntPtr handle in held)CloseHandle(handle);
            if(owner.thread!=IntPtr.Zero)CloseHandle(owner.thread);
            if(owner.process!=IntPtr.Zero)CloseHandle(owner.process);
            CloseHandle(safety);
        }
    }
    static int Probe(bool negative,string directory) {
        IntPtr root=IntPtr.Zero,a=IntPtr.Zero,b=IntPtr.Zero;
        var roots=new List<ProcessInfo>();var heldA=new List<IntPtr>();var heldB=new List<IntPtr>();
        try {
            root=NewJob();a=NewJob();b=NewJob();
            string dirA=Path.Combine(directory,"A"),dirB=Path.Combine(directory,"B");
            Directory.CreateDirectory(dirA);Directory.CreateDirectory(dirB);
            // Negative omits session membership, retaining the outer safety
            // Job at creation even if the probe dies before its finally runs.
            // Exact same two-Job assertion for negative and positive cases.
            var fixtureAge=Stopwatch.StartNew();
            var first=Spawn("root",dirA,negative?new IntPtr[]{root}:new IntPtr[]{root,a},true,false);roots.Add(first);
            Require(Member(first.process,root) && Member(first.process,a),"ROOT_NOT_IN_BOTH_JOBS");
            Require(ResumeThread(first.thread)!=uint.MaxValue,"RESUME_A");
            var second=Spawn("root",dirB,new IntPtr[]{root,b},true,false);roots.Add(second);
            Require(Member(second.process,root) && Member(second.process,b),"ROOT_B_NOT_IN_BOTH_JOBS");
            Require(ResumeThread(second.thread)!=uint.MaxValue,"RESUME_B");
            WaitReady(dirA);WaitReady(dirB);heldA=HoldMembers(a,root);heldB=HoldMembers(b,root);
            Require(Active(root)==heldA.Count+heldB.Count,"ROOT_ACCOUNTING_ALL_MEMBERS");
            string observationsA=Observe(heldA),observationsB=Observe(heldB);
            // An invalid Job cannot create even a suspended fixture.
            bool refused=false;string invalidError="";
            try {
                var invalid=Spawn("root",dirA,new IntPtr[]{root,new IntPtr(-1)},true,false);
                TerminateProcess(invalid.process,99);CloseHandle(invalid.thread);CloseHandle(invalid.process);
            }catch(Exception error) {invalidError=error.Message;refused=error.Message.StartsWith("CREATE_PROCESS:") || error.Message.StartsWith("ATTRIBUTE_UPDATE:");}
            Require(refused,"INVALID_JOB_ACCEPTED");
            var stopTimer=Stopwatch.StartNew();
            Require(TerminateJobObject(a,77),"STOP_A");Exited(heldA);WaitEmpty(a);
            string exitCodesA=ExitCodes(heldA,77);
            long stopMs=stopTimer.ElapsedMilliseconds;Require(stopMs<10000,"STOP_DEADLINE");
            Require(Active(b)==heldB.Count,"STOP_NOT_ISOLATED");
            foreach(IntPtr handle in heldB)Require(WaitForSingleObject(handle,0)==258,"B_INTERRUPTED");
            // No TerminateJobObject call for B: last non-inherited handle closes.
            var closeTimer=Stopwatch.StartNew();
            Require(CloseHandle(b),"CLOSE_B");b=IntPtr.Zero;Exited(heldB);WaitEmpty(root);
            string exitCodesB=ExitCodes(heldB,null);
            long closeMs=closeTimer.ElapsedMilliseconds;Require(closeMs<10000,"CLOSE_DEADLINE");
            // Fail rather than letting the 12s fixture self-exit masquerade as
            // Stop/close success under an arbitrarily stalled test runner.
            long fixtureAgeMs=fixtureAge.ElapsedMilliseconds;Require(fixtureAgeMs<10000,"NATURAL_EXIT_COULD_MASK_RESULT");
            string ownerLoss=OwnerLoss(Path.Combine(directory,"owner-loss"));
            var os=new OsVersion();os.size=(uint)Marshal.SizeOf(typeof(OsVersion));Require(RtlGetVersion(ref os)==0,"OS_VERSION");
            Console.WriteLine("{\"status\":\"PREREQUISITE_PASSED\",\"os\":\""+os.major+"."+os.minor+"."+os.build+"\",\"sessionAProcesses\":4,\"sessionBProcesses\":4,\"sessionAHelpers\":"+(heldA.Count-4)+",\"sessionBHelpers\":"+(heldB.Count-4)+",\"beforeResumeMembership\":true,\"stopIsolated\":true,\"closeKillsOwnedProcesses\":true,\"invalidHandleRefused\":true,\"invalidHandleError\":"+JsonString(invalidError)+",\"jobsNonInheritable\":true,\"rootActiveProcesses\":0,\"stopMs\":"+stopMs+",\"closeMs\":"+closeMs+",\"fixtureAgeMs\":"+fixtureAgeMs+",\"exitCodesA\":"+exitCodesA+",\"exitCodesB\":"+exitCodesB+",\"ownerLoss\":"+ownerLoss+",\"heldA\":"+observationsA+",\"heldB\":"+observationsB+"}");
            return 0;
        } finally {
            // Only handles created/owned by this probe, including suspended RED.
            if(a!=IntPtr.Zero)TerminateJobObject(a,98);if(b!=IntPtr.Zero)TerminateJobObject(b,98);
            if(root!=IntPtr.Zero)TerminateJobObject(root,98);
            foreach(var child in roots){if(WaitForSingleObject(child.process,0)==258)TerminateProcess(child.process,98);WaitForSingleObject(child.process,3000);CloseHandle(child.thread);CloseHandle(child.process);}
            foreach(IntPtr handle in heldA)CloseHandle(handle);foreach(IntPtr handle in heldB)CloseHandle(handle);
            if(a!=IntPtr.Zero)CloseHandle(a);if(b!=IntPtr.Zero)CloseHandle(b);if(root!=IntPtr.Zero)CloseHandle(root);
        }
    }
    static int Main(string[] args) {
        try {
            if(args.Length!=2 || !Path.IsPathRooted(args[1]))return 2;
            if(args[0]=="positive" || args[0]=="negative")return Probe(args[0]=="negative",args[1]);
            if(args[0]=="pause-owner")return PauseOwner(args[1]);
            return Fixture(args[0],args[1]);
        }catch(Exception error){Console.Error.WriteLine(error.Message);return 1;}
    }
}
