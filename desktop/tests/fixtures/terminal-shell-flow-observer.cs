using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
// Separate long-running CI observer. Original twelve-second fixtures and
// observers are unchanged. Safety handle never enters main/utility/worker.
internal static partial class TerminalMainOwnerObserver {
    static bool AllFlowExited(List<Held> held) {foreach(var p in held)if(WaitForSingleObject(p.handle,0)!=0)return false;return true;}
    static Dictionary<string,object> FlowRecord(string path) {
        Require(File.Exists(path)&&new FileInfo(path).Length<=262144,"FLOW_RECORD_BUDGET");
        return Map(Json.DeserializeObject(File.ReadAllText(path,new UTF8Encoding(false,true))));
    }
    static uint FlowBind(Dictionary<string,object> value,List<Held> held) {
        uint pid=Pid(value["pid"]);var live=Find(held,pid);
        Require((bool)value["alive"]&&live.image==Convert.ToString(value["image"])&&live.created==Convert.ToString(value["createdFileTime"]),"FLOW_NATIVE_IDENTITY_MISMATCH");return pid;
    }
    static ulong JobPeak(IntPtr job) {
        int size=Marshal.SizeOf(typeof(Limits));IntPtr bytes=Marshal.AllocHGlobal(size);
        try{uint returned;Require(QueryInformationJobObject(job,9,bytes,(uint)size,out returned),"FLOW_JOB_MEMORY_UNKNOWN");return ((Limits)Marshal.PtrToStructure(bytes,typeof(Limits))).peakJob.ToUInt64();}
        finally{Marshal.FreeHGlobal(bytes);}
    }
    static void SameFlowMembers(IntPtr safety,List<Held> held,string electron,string fixture,long created) {
        var next=Hold(safety,electron,fixture,created);
        try{
            Require(next.Count==held.Count,"FLOW_MEMBERSHIP_CHANGED");
            foreach(var p in next){var old=Find(held,p.pid);Require(old.image==p.image&&old.created==p.created,"FLOW_HELD_SET_CHANGED");}
        }finally{foreach(var p in next)CloseHandle(p.handle);}
    }
    static List<uint> ValidateFlow(Dictionary<string,object> ready,List<Held> held,uint main,string electron,string fixture) {
        Require(Pid(ready["mainPid"])==main,"FLOW_MAIN_IDENTITY");
        var session=Map(ready["session"]);var host=Map(ready["host"]);var worker=Map(ready["worker"]);
        foreach(var capture in new[]{session,host})Require((bool)capture["killOnClose"]&&!(bool)capture["breakaway"]&&!(bool)capture["inheritable"],"FLOW_JOB_FLAGS");
        var ids=new HashSet<uint>();foreach(var raw in Array(session["held"]))Require(ids.Add(FlowBind(Map(raw),held)),"FLOW_SESSION_DUPLICATE");
        Require(ids.Count>=6&&ids.Count<=32&&Convert.ToInt32(session["active"])==ids.Count,"FLOW_SESSION_COUNT");
        uint creator=FlowBind(Map(session["root"]),held),shell=FlowBind(Map(session["shell"]),held);
        Require(ids.Contains(creator)&&ids.Contains(shell)&&creator!=shell&&creator==Pid(worker["workerPid"])&&shell==Pid(worker["rootPid"]),"FLOW_WORKER_BINDING");
        string expected=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell\\v1.0\\powershell.exe");
        Require(string.Equals(Find(held,shell).image,expected,StringComparison.OrdinalIgnoreCase)&&string.Equals(Find(held,creator).image,electron,StringComparison.OrdinalIgnoreCase),"FLOW_SHELL_IMAGE");
        var canaries=new HashSet<uint>();foreach(var raw in Map(ready["fixturePids"]).Values){uint pid=Pid(raw);Require(ids.Contains(pid)&&canaries.Add(pid)&&string.Equals(Find(held,pid).image,fixture,StringComparison.OrdinalIgnoreCase),"FLOW_FIXED_CANARY");}
        Require(canaries.Count==4,"FLOW_FOUR_CANARIES");
        uint utility=FlowBind(Map(host["root"]),held);Require(!ids.Contains(utility)&&string.Equals(Find(held,utility).image,electron,StringComparison.OrdinalIgnoreCase),"FLOW_UTILITY_IDENTITY");
        var expectedHost=new HashSet<uint>(ids);expectedHost.Add(utility);var actualHost=new HashSet<uint>();
        foreach(var raw in Array(host["held"]))Require(actualHost.Add(FlowBind(Map(raw),held)),"FLOW_HOST_DUPLICATE");
        Require(actualHost.SetEquals(expectedHost)&&Convert.ToInt32(host["active"])==actualHost.Count,"FLOW_HOST_SESSION_SET");
        return new List<uint>(ids);
    }
    static int Main(string[] args) {
        if(args.Length!=4)return 2;foreach(string path in args)if(!Path.IsPathRooted(path))return 2;
        string electron=args[0],application=args[1],directory=args[2],fixture=args[3];
        IntPtr safety=IntPtr.Zero;ProcessInfo main=new ProcessInfo();var held=new List<Held>();var age=Stopwatch.StartNew();int code=1;
        var samples=new List<object>();var result=new Dictionary<string,object>{{"admitted",false},{"status","FAILED"}};
        try {
            safety=NewJob();main=Spawn(electron,application,directory,new[]{safety},true,false);Require(Member(main.process,safety),"FLOW_MAIN_ATOMIC_SAFETY");
            var identity=Identity(main.process,main.pid);result["main"]=identity.Observe();Require(ResumeThread(main.thread)==1,"FLOW_MAIN_RESUME");
            string first=Path.Combine(directory,"flow-first-ready.json");while(!File.Exists(first)&&age.ElapsedMilliseconds<30000&&WaitForSingleObject(main.process,0)==258)Thread.Sleep(5);
            Require(age.ElapsedMilliseconds<30000,"FLOW_READY_DEADLINE");var ready=FlowRecord(first);
            held=Hold(safety,electron,fixture,long.Parse(identity.created));var sessionIds=ValidateFlow(ready,held,main.pid,electron,fixture);result["ready"]=ready;result["before"]=Observe(held);
            File.WriteAllText(Path.Combine(directory,"flow-first-go.request"),"go",new UTF8Encoding(false));
            var measuring=Stopwatch.StartNew();string finish=Path.Combine(directory,"flow-finish-ready.json");
            while(!File.Exists(finish)&&age.ElapsedMilliseconds<95000&&WaitForSingleObject(main.process,0)==258){
                SameFlowMembers(safety,held,electron,fixture,long.Parse(identity.created));Require(samples.Count<400,"FLOW_SAMPLE_BUDGET");
                samples.Add(new Dictionary<string,object>{{"ageMs",age.ElapsedMilliseconds},{"intervalMs",measuring.ElapsedMilliseconds},{"heldCount",held.Count},{"active",Active(safety)},{"peakSafetyJobMemoryBytes",JobPeak(safety)}});Thread.Sleep(250);
            }
            Require(age.ElapsedMilliseconds<95000&&measuring.ElapsedMilliseconds>=60000,"FLOW_MEASUREMENT_DEADLINE");
            var finished=FlowRecord(finish);Require(Pid(finished["mainPid"])==main.pid,"FLOW_FINISH_MAIN");SameFlowMembers(safety,held,electron,fixture,long.Parse(identity.created));
            result["finish"]=finished;result["samples"]=samples;result["measurementMs"]=measuring.ElapsedMilliseconds;result["peakSafetyJobMemoryBytes"]=JobPeak(safety);
            result["memoryScope"]="Kernel Job peak memory; includes main, utility, creator, PowerShell, fixed canaries and helpers. Not RSS or per-Session attribution. Membership checked every 250ms; transients between samples not individually held.";
            File.WriteAllText(Path.Combine(directory,"flow-finish-go.request"),"go",new UTF8Encoding(false));
            Require(WaitForSingleObject(main.process,5000)==0,"FLOW_MAIN_COMPLETION_DEADLINE");uint exit;Require(GetExitCodeProcess(main.process,out exit)&&exit==0,"FLOW_MAIN_FAILED");
            var cleanup=Stopwatch.StartNew();while((Active(safety)!=0||!AllFlowExited(held))&&cleanup.ElapsedMilliseconds<3000)Thread.Sleep(5);
            Require(Active(safety)==0&&AllFlowExited(held),"FLOW_OWNED_FAMILY_SURVIVED");
            foreach(uint pid in sessionIds){uint cause;Require(GetExitCodeProcess(Find(held,pid).handle,out cause)&&cause==77,"FLOW_STOP_NOT_CAUSAL");}
            result["after"]=Observe(held);result["safetyOpenAtObservation"]=true;result["activeBeforeSafetyCleanup"]=0;result["ageMs"]=age.ElapsedMilliseconds;
            Require(age.ElapsedMilliseconds<100000,"FLOW_TOTAL_DEADLINE");result["status"]="SHELL_FLOW_SAFETY_OBSERVED_NOT_ADMITTED";code=0;
        }catch(Exception e){result["error"]=e.Message;result["samples"]=samples;}
        finally {
            try{if(safety!=IntPtr.Zero){Require(TerminateJobObject(safety,98),"FLOW_SAFETY_STOP");var timer=Stopwatch.StartNew();while((Active(safety)!=0||!AllFlowExited(held))&&timer.ElapsedMilliseconds<3000)Thread.Sleep(5);Require(Active(safety)==0&&AllFlowExited(held),"FLOW_SAFETY_CLEANUP_UNVERIFIED");result["cleanupVerified"]=true;}}
            catch(Exception e){result["cleanupError"]=e.Message;result["status"]="FAILED";code=1;}
            foreach(var p in held)CloseHandle(p.handle);if(main.thread!=IntPtr.Zero)CloseHandle(main.thread);if(main.process!=IntPtr.Zero)CloseHandle(main.process);if(safety!=IntPtr.Zero)CloseHandle(safety);
            File.WriteAllText(Path.Combine(directory,"observer-result.json"),Json.Serialize(result),new UTF8Encoding(false));Console.WriteLine(Json.Serialize(result));
        }return code;
    }
}
