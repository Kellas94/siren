using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

// Compiled with a mechanically derived partial copy of terminal-job-list.cs.
// Only the class/old entry names change in that copy. No arbitrary shell/input.
internal static partial class TerminalJobListProbe {
    [StructLayout(LayoutKind.Sequential)] struct ConsoleSize { public short x,y; }
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool CreatePipe(out IntPtr read,out IntPtr write,IntPtr attributes,uint size);
    [DllImport("kernel32.dll")] static extern int CreatePseudoConsole(ConsoleSize size,IntPtr input,IntPtr output,uint flags,out IntPtr console);
    [DllImport("kernel32.dll")] static extern void ClosePseudoConsole(IntPtr console);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenJobObjectW(uint rights,bool inherit,string name);
    static readonly JavaScriptSerializer ConptyJson=new JavaScriptSerializer{MaxJsonLength=262144,RecursionLimit=32};
    static readonly Dictionary<uint,bool[]> ConptyMembership=new Dictionary<uint,bool[]>();
    sealed class ConptyHeldIdentity { public uint pid;public long created;public string image; }
    static readonly Dictionary<IntPtr,ConptyHeldIdentity> ConptyIdentities=new Dictionary<IntPtr,ConptyHeldIdentity>();
    sealed class ConsoleLease {
        public IntPtr console,input,output;public ProcessInfo root;
        public void Close() {
            // This can block in the upstream OS API. Worker is owned by outer
            // safety before starting, so parent deadline cleanup never depends
            // on this finally completing or on a successful JS callback.
            if(console!=IntPtr.Zero){ClosePseudoConsole(console);console=IntPtr.Zero;}
            if(input!=IntPtr.Zero)CloseHandle(input);if(output!=IntPtr.Zero)CloseHandle(output);
            if(root.thread!=IntPtr.Zero)CloseHandle(root.thread);if(root.process!=IntPtr.Zero)CloseHandle(root.process);
        }
    }
    static IntPtr ConptyNamedJob(string name) {
        IntPtr job=CreateJobObjectW(IntPtr.Zero,name);int error=Marshal.GetLastWin32Error();
        Require(job!=IntPtr.Zero,"CONPTY_JOB_CREATE");
        try {Require(error!=183,"CONPTY_JOB_ALREADY_EXISTS");var limits=new Limits();limits.basic.flags=KillOnClose;
            Require(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(Limits))),"CONPTY_JOB_LIMITS");
            uint flags;Require(GetHandleInformation(job,out flags)&&(flags&1)==0,"CONPTY_JOB_INHERITABLE");return job;
        }catch{CloseHandle(job);throw;}
    }
    static ConsoleLease ConptyStart(string directory,IntPtr session,bool omitSession,out bool beforeResume) {
        var lease=new ConsoleLease();IntPtr read=IntPtr.Zero,write=IntPtr.Zero,list=IntPtr.Zero,jobValue=IntPtr.Zero;bool initialized=false;
        try {
            Require(CreatePipe(out read,out lease.input,IntPtr.Zero,65536),"CONPTY_INPUT_PIPE");
            Require(CreatePipe(out lease.output,out write,IntPtr.Zero,65536),"CONPTY_OUTPUT_PIPE");
            Require(CreatePseudoConsole(new ConsoleSize{x=80,y=24},read,write,0,out lease.console)==0,"CONPTY_CREATE");
            CloseHandle(read);read=IntPtr.Zero;CloseHandle(write);write=IntPtr.Zero;
            int count=omitSession?1:2;UIntPtr size=UIntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero,count,0,ref size);Require(size.ToUInt64()>0&&size.ToUInt64()<65536,"CONPTY_ATTRIBUTE_SIZE");
            list=Marshal.AllocHGlobal((int)size.ToUInt64());Require(InitializeProcThreadAttributeList(list,count,0,ref size),"CONPTY_ATTRIBUTE_INIT");initialized=true;
            Require(UpdateProcThreadAttribute(list,0,new IntPtr(0x20016),lease.console,(UIntPtr)IntPtr.Size,IntPtr.Zero,IntPtr.Zero),"CONPTY_ATTRIBUTE_CONSOLE");
            if(!omitSession){jobValue=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(jobValue,session);Require(UpdateProcThreadAttribute(list,0,JobListAttribute,jobValue,(UIntPtr)IntPtr.Size,IntPtr.Zero,IntPtr.Zero),"CONPTY_ATTRIBUTE_SESSION");}
            string exe=Assembly.GetExecutingAssembly().Location;var startup=new StartupEx();startup.startup.cb=(uint)Marshal.SizeOf(typeof(StartupEx));startup.attributes=list;
            var command=new StringBuilder(Quote(exe)+" "+Quote("root")+" "+Quote(directory));
            Require(CreateProcessW(exe,command,IntPtr.Zero,IntPtr.Zero,false,Extended|Suspended|0x400,IntPtr.Zero,directory,ref startup,out lease.root),"CONPTY_ROOT_CREATE");
            beforeResume=Member(lease.root.process,session);Require(beforeResume==!omitSession,"CONPTY_ROOT_MEMBERSHIP");
            Require(ResumeThread(lease.root.thread)!=uint.MaxValue,"CONPTY_ROOT_RESUME");return lease;
        }catch{lease.Close();throw;}
        finally{if(initialized)DeleteProcThreadAttributeList(list);if(list!=IntPtr.Zero)Marshal.FreeHGlobal(list);if(jobValue!=IntPtr.Zero)Marshal.FreeHGlobal(jobValue);if(read!=IntPtr.Zero)CloseHandle(read);if(write!=IntPtr.Zero)CloseHandle(write);}
    }
    static object[] ConptyStates(List<IntPtr> held,IntPtr a,IntPtr b,bool capture) {
        var rows=new List<object>();
        foreach(IntPtr handle in held){
            uint pid=GetProcessId(handle),code=0;Require(pid>0&&GetExitCodeProcess(handle,out code),"CONPTY_HELD_EXIT");
            uint wait=WaitForSingleObject(handle,0);Require(wait==0||wait==258,"CONPTY_HELD_WAIT");
            long created,exited,kernel,user;Require(GetProcessTimes(handle,out created,out exited,out kernel,out user),"CONPTY_HELD_TIME");
            // Query the image while the held process is live. Windows can refuse
            // that query after termination (original hosted cleanup error31).
            // Keep the actual handle and recheck PID/creation time on every read;
            // only the immutable image is cached, never wait/exit observations.
            if(capture){Require(wait==258,"CONPTY_CAPTURE_NOT_LIVE");var image=new StringBuilder(32768);uint length=32768;
                Require(QueryFullProcessImageNameW(handle,0,image,ref length),"CONPTY_HELD_IMAGE");
                ConptyIdentities.Add(handle,new ConptyHeldIdentity{pid=pid,created=created,image=image.ToString()});
                ConptyMembership.Add(pid,new[]{Member(handle,a),Member(handle,b)});}
            ConptyHeldIdentity identity;Require(ConptyIdentities.TryGetValue(handle,out identity)&&identity.pid==pid&&identity.created==created,"CONPTY_HELD_IDENTITY_CHANGED");
            var membership=ConptyMembership[pid];
            rows.Add(new Dictionary<string,object>{{"pid",pid},{"image",identity.image},{"createdFileTime",created.ToString()},{"alive",wait==258},{"exitCode",code},{"inA",membership[0]},{"inB",membership[1]}});
        }return rows.ToArray();
    }
    static uint[] ConptyFixtures(string directory) {
        var pids=new List<uint>();foreach(string mode in new[]{"root","branch","grandchild","detached"}){uint pid;Require(uint.TryParse(File.ReadAllText(Path.Combine(directory,mode+".ready")),out pid)&&pid>0,"CONPTY_FIXTURE_PID");pids.Add(pid);}return pids.ToArray();
    }
    static int ConptyWorker(string directory) {
        var config=ConptyJson.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(directory,"worker-config.json")));
        bool negative=(bool)config["negative"];var leases=new List<ConsoleLease>();var membership=new Dictionary<string,object>();var roots=new Dictionary<string,object>();
        try{
            foreach(string label in new[]{"A","B"}){
                string name=(string)config[label];Require(name.StartsWith("Local\\SIREN-CP-STUDY-",StringComparison.Ordinal)&&name.Length<128,"CONPTY_JOB_NAME");
                IntPtr session=OpenJobObjectW(5,false,name);Require(session!=IntPtr.Zero,"CONPTY_SESSION_OPEN");
                try{uint flags;Require(GetHandleInformation(session,out flags)&&(flags&1)==0,"CONPTY_OPEN_INHERITABLE");bool before;
                    var lease=ConptyStart(Path.Combine(directory,label),session,negative&&label=="A",out before);leases.Add(lease);membership[label]=before;roots[label]=lease.root.pid;
                }finally{CloseHandle(session);}
                WaitReady(Path.Combine(directory,label));
            }
            var ready=new Dictionary<string,object>{{"workerPid",Process.GetCurrentProcess().Id},{"pseudoConsoles",2},{"rootBeforeResume",membership},{"rootPids",roots}};
            string pending=Path.Combine(directory,"worker-ready.pending");File.WriteAllText(pending,ConptyJson.Serialize(ready),new UTF8Encoding(false));File.Move(pending,Path.Combine(directory,"worker-ready.json"));
            Thread.Sleep(8000);return 0;
        }finally{foreach(var lease in leases)lease.Close();}
    }
    static int ConptyStudy(bool negative,string directory) {
        IntPtr safety=IntPtr.Zero,a=IntPtr.Zero,b=IntPtr.Zero;var worker=new ProcessInfo();var held=new List<IntPtr>();var age=Stopwatch.StartNew();
        var result=new Dictionary<string,object>{{"status","FAILED"},{"negative",negative}};int code=1;
        try{
            var os=new OsVersion();os.size=(uint)Marshal.SizeOf(typeof(OsVersion));Require(RtlGetVersion(ref os)==0,"CONPTY_OS_VERSION");result["os"]=os.major+"."+os.minor+"."+os.build;
            string nameA="Local\\SIREN-CP-STUDY-"+Guid.NewGuid().ToString(),nameB="Local\\SIREN-CP-STUDY-"+Guid.NewGuid().ToString();
            safety=NewJob();a=ConptyNamedJob(nameA);b=ConptyNamedJob(nameB);
            Directory.CreateDirectory(Path.Combine(directory,"A"));Directory.CreateDirectory(Path.Combine(directory,"B"));
            File.WriteAllText(Path.Combine(directory,"worker-config.json"),ConptyJson.Serialize(new Dictionary<string,object>{{"A",nameA},{"B",nameB},{"negative",negative}}),new UTF8Encoding(false));
            worker=Spawn("conpty-worker",directory,new[]{safety},true,false);Require(Member(worker.process,safety),"CONPTY_WORKER_NOT_ATOMIC");Require(ResumeThread(worker.thread)!=uint.MaxValue,"CONPTY_WORKER_RESUME");
            string readyPath=Path.Combine(directory,"worker-ready.json");while(!File.Exists(readyPath)&&age.ElapsedMilliseconds<5000&&WaitForSingleObject(worker.process,0)==258)Thread.Sleep(5);
            Require(File.Exists(readyPath)&&age.ElapsedMilliseconds<5000&&new FileInfo(readyPath).Length<65536,"CONPTY_WORKER_DEADLINE");
            var ready=ConptyJson.Deserialize<Dictionary<string,object>>(File.ReadAllText(readyPath));Require(Convert.ToUInt32(ready["workerPid"])==worker.pid,"CONPTY_WORKER_IDENTITY");
            result["workerPid"]=worker.pid;result["pseudoConsoles"]=ready["pseudoConsoles"];result["rootBeforeResume"]=ready["rootBeforeResume"];result["rootPids"]=ready["rootPids"];
            var fixedA=ConptyFixtures(Path.Combine(directory,"A"));var fixedB=ConptyFixtures(Path.Combine(directory,"B"));result["fixturePids"]=new Dictionary<string,object>{{"A",fixedA},{"B",fixedB}};
            held=HoldMembers(safety,safety,9);Require(Active(safety)==held.Count,"CONPTY_HOST_SET_INCOMPLETE");result["hostActiveBefore"]=Active(safety);result["before"]=ConptyStates(held,a,b,true);
            var seen=new HashSet<uint>();foreach(IntPtr handle in held){uint pid=GetProcessId(handle);seen.Add(pid);Require(WaitForSingleObject(handle,0)==258,"CONPTY_EARLY_EXIT");}
            foreach(uint pid in fixedA)Require(seen.Contains(pid)&&ConptyMembership[pid][0]==!negative&&!ConptyMembership[pid][1],"CONPTY_A_SET");
            foreach(uint pid in fixedB)Require(seen.Contains(pid)&&!ConptyMembership[pid][0]&&ConptyMembership[pid][1],"CONPTY_B_SET");
            var stop=Stopwatch.StartNew();Require(TerminateJobObject(a,77),"CONPTY_STOP_A");
            if(negative){while(stop.ElapsedMilliseconds<2000)Thread.Sleep(5);}
            else {WaitEmpty(a);result["sessionActiveAfterStop"]=Active(a);var waits=new List<object>();result["stopWaits"]=waits;
                foreach(IntPtr handle in held)if(ConptyMembership[GetProcessId(handle)][0]){
                    // Empty Job accounting alone is not a process-handle signal.
                    // Use the ORIGINAL global Stop budget, never a new per-handle
                    // deadline, then retain exact77 and identity/cleanup gates.
                    long remaining=3000-stop.ElapsedMilliseconds;Require(remaining>0,"CONPTY_STOP_GLOBAL_DEADLINE");
                    uint beforeWait=WaitForSingleObject(handle,0),waited=WaitForSingleObject(handle,(uint)remaining);
                    waits.Add(new Dictionary<string,object>{{"pid",GetProcessId(handle)},{"initialWait",beforeWait},{"finalWait",waited},{"elapsedMs",stop.ElapsedMilliseconds}});
                    Require(waited==0,"CONPTY_A_SURVIVED");uint exit;Require(GetExitCodeProcess(handle,out exit)&&exit==77,"CONPTY_A_WRONG_EXIT");}}
            foreach(IntPtr handle in held){uint pid=GetProcessId(handle);if(ConptyMembership[pid][1]||negative&&Array.IndexOf(fixedA,pid)>=0)Require(WaitForSingleObject(handle,0)==258,"CONPTY_ISOLATION_FAILED");}
            result["after"]=ConptyStates(held,a,b,false);result["stopMs"]=stop.ElapsedMilliseconds;result["fixtureAgeMs"]=age.ElapsedMilliseconds;Require(age.ElapsedMilliseconds<6000&&stop.ElapsedMilliseconds<3000,"CONPTY_NATURAL_DEADLINE");
            result["status"]=negative?"EXPECTED_SESSION_ASSIGNMENT_REFUSED":"CONPTY_MEMBERSHIP_OBSERVED_TERMINAL_NOT_ADMITTED";code=negative?1:0;
        }catch(Exception error){result["status"]="FAILED";result["error"]=error.Message;}
        finally{
            try{if(safety!=IntPtr.Zero){Require(TerminateJobObject(safety,98),"CONPTY_SAFETY_STOP");Exited(held);WaitEmpty(safety);result["cleanup"]=new Dictionary<string,object>{{"verified",true},{"active",Active(safety)},{"held",ConptyStates(held,a,b,false)}};}}
            catch(Exception error){result["status"]="FAILED";result["cleanupError"]=error.Message;code=1;}
            foreach(IntPtr handle in held)CloseHandle(handle);if(worker.thread!=IntPtr.Zero)CloseHandle(worker.thread);if(worker.process!=IntPtr.Zero)CloseHandle(worker.process);
            if(a!=IntPtr.Zero)CloseHandle(a);if(b!=IntPtr.Zero)CloseHandle(b);if(safety!=IntPtr.Zero)CloseHandle(safety);
            string json=ConptyJson.Serialize(result);File.WriteAllText(Path.Combine(directory,"native-result.json"),json,new UTF8Encoding(false));Console.WriteLine(json);
        }return code;
    }
    static int Main(string[] args) {
        try{if(args.Length!=2||!Path.IsPathRooted(args[1]))return 2;if(args[0]=="conpty-worker")return ConptyWorker(args[1]);if(args[0]=="conpty-positive"||args[0]=="conpty-negative")return ConptyStudy(args[0]=="conpty-negative",args[1]);return Fixture(args[0],args[1]);}
        catch(Exception error){Console.Error.WriteLine(error.Message);return 1;}
    }
}
