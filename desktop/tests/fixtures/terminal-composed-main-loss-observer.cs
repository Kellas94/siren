using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
// External Safety observer. No inner Job handles are duplicated or held here.
internal static partial class TerminalMainOwnerObserver {
    static void SafetyLimits(IntPtr safety) {
        int size=Marshal.SizeOf(typeof(Limits));IntPtr bytes=Marshal.AllocHGlobal(size);
        try {uint returned;Require(QueryInformationJobObject(safety,9,bytes,(uint)size,out returned),"MAIN_LOSS_SAFETY_LIMITS_UNKNOWN");
            var limits=(Limits)Marshal.PtrToStructure(bytes,typeof(Limits));uint flags;
            Require(limits.basic.flags==KillOnClose&&GetHandleInformation(safety,out flags)&&(flags&1)==0,"MAIN_LOSS_SAFETY_LIMITS_REFUSED");
        }finally{Marshal.FreeHGlobal(bytes);}
    }
    static uint Bind(Dictionary<string,object> record,List<Held> held) {
        uint pid=Pid(record["pid"]);var actual=Find(held,pid);
        Require((bool)record["alive"]&&Convert.ToUInt32(record["exitCode"])==259&&actual.created==Convert.ToString(record["createdFileTime"])&&actual.image==Convert.ToString(record["image"]),"MAIN_LOSS_HELD_IDENTITY");
        return pid;
    }
    static void LimitsMatch(Dictionary<string,object> record,bool negative) {
        Require((bool)record["killOnClose"]==!negative&&!(bool)record["breakaway"]&&!(bool)record["inheritable"],"MAIN_LOSS_INNER_LIMITS_REFUSED");
    }
    static List<uint> ValidateComposed(Dictionary<string,object> ready,List<Held> held,bool negative,uint mainPid,string electron,string fixture) {
        Require(Pid(ready["mainPid"])==mainPid&&(bool)ready["negative"]==negative&&Convert.ToInt32(ready["fixtureAgeMs"])<6000,"MAIN_LOSS_READY_REFUSED");
        var host=Map(ready["hostSnapshot"]);LimitsMatch(host,negative);uint utility=Bind(Map(host["root"]),held);
        Require(utility!=mainPid&&Find(held,utility).image==electron,"MAIN_LOSS_UTILITY_REFUSED");
        var expected=new HashSet<uint>();expected.Add(utility);var canaries=new List<uint>();
        var groups=Array(ready["groups"]);Require(groups.Length==2,"MAIN_LOSS_TWO_SESSIONS_REQUIRED");
        for(int i=0;i<groups.Length;i++) {
            var group=Map(groups[i]);Require(Convert.ToString(group["label"])==new[]{"A","B"}[i],"MAIN_LOSS_GROUP_LABEL");
            var snapshot=Map(group["before"]);LimitsMatch(snapshot,negative);Require((bool)snapshot["atomicBeforeResume"]&&Pid(snapshot["hostPid"])==utility,"MAIN_LOSS_SESSION_NOT_ATOMIC");
            var members=Array(snapshot["held"]);Require(members.Length>=5&&members.Length<=32&&Convert.ToInt32(snapshot["active"])==members.Length,"MAIN_LOSS_SESSION_SET");
            var own=new HashSet<uint>();foreach(var raw in members){uint pid=Bind(Map(raw),held);Require(pid!=mainPid&&own.Add(pid)&&expected.Add(pid),"MAIN_LOSS_SESSION_OVERLAP");}
            uint creator=Bind(Map(snapshot["root"]),held),shell=Bind(Map(snapshot["shell"]),held);
            Require(own.Contains(creator)&&own.Contains(shell)&&Find(held,creator).image==electron,"MAIN_LOSS_SESSION_CREATOR");
            var worker=Map(group["ready"]);Require(Pid(worker["workerPid"])==creator&&Pid(worker["rootPid"])==shell,"MAIN_LOSS_WORKER_BINDING");
            var fixtures=Map(group["fixturePids"]);Require(fixtures.Count==4&&Pid(fixtures["root"])==shell,"MAIN_LOSS_FIXTURE_SET");
            canaries.Add(creator);
            foreach(string key in new[]{"root","branch","grandchild","detached"}){uint pid=Pid(fixtures[key]);Require(own.Contains(pid)&&!canaries.Contains(pid)&&Find(held,pid).image==fixture,"MAIN_LOSS_FIXTURE_BINDING");canaries.Add(pid);}
        }
        Require(canaries.Count==10,"MAIN_LOSS_TEN_CANARIES_REQUIRED");
        var hostMembers=Array(host["held"]);Require(hostMembers.Length==expected.Count&&Convert.ToInt32(host["active"])==expected.Count,"MAIN_LOSS_HOST_SET");
        var seen=new HashSet<uint>();foreach(var raw in hostMembers){uint pid=Bind(Map(raw),held);Require(expected.Contains(pid)&&seen.Add(pid),"MAIN_LOSS_HOST_BINDING");}
        var declared=Array(ready["held"]);Require(declared.Length==expected.Count,"MAIN_LOSS_READY_SET");seen.Clear();foreach(var raw in declared){uint pid=Bind(Map(raw),held);Require(expected.Contains(pid)&&seen.Add(pid),"MAIN_LOSS_READY_BINDING");}
        return canaries;
    }
    static int Main(string[] args) {
        if(args.Length!=5)return 2;foreach(string path in new[]{args[0],args[1],args[2],args[3]})if(!Path.IsPathRooted(path))return 2;
        bool negative=args[4]=="negative";if(!negative&&args[4]!="positive")return 2;
        string electron=args[0],application=args[1],directory=args[2],fixture=args[3];
        IntPtr safety=IntPtr.Zero;ProcessInfo main=new ProcessInfo();var held=new List<Held>();var age=Stopwatch.StartNew();int code=1;
        var result=new Dictionary<string,object>{{"admitted",false},{"status","FAILED"},{"guardEnabled",!negative}};
        try {
            safety=NewJob();SafetyLimits(safety);result["safetyKillOnClose"]=true;result["safetyInheritable"]=false;
            main=Spawn(electron,application,directory,new[]{safety},true,false);Require(Member(main.process,safety),"MAIN_LOSS_MAIN_NOT_ATOMIC");result["atomicSafety"]=true;
            var identity=Identity(main.process,main.pid);result["main"]=identity.Observe();Require(ResumeThread(main.thread)==1,"MAIN_LOSS_RESUME_FAILED");
            string readyPath=Path.Combine(directory,"composition-first-ready.json");
            while(!File.Exists(readyPath)&&age.ElapsedMilliseconds<11000&&WaitForSingleObject(main.process,0)==258)Thread.Sleep(5);
            Require(File.Exists(readyPath)&&age.ElapsedMilliseconds<11000&&new FileInfo(readyPath).Length<=262144,"MAIN_LOSS_READY_DEADLINE");
            var ready=Map(Json.DeserializeObject(File.ReadAllText(readyPath,new UTF8Encoding(false,true))));result["ready"]=ready;
            held=Hold(safety,electron,fixture,long.Parse(identity.created));var canaries=ValidateComposed(ready,held,negative,main.pid,electron,fixture);
            result["before"]=Observe(held);foreach(var p in held)Require(WaitForSingleObject(p.handle,0)==258,"MAIN_LOSS_EARLY_MEMBER_EXIT");
            Require(!File.Exists(Path.Combine(directory,"composition-first-go.request")),"MAIN_LOSS_STAGE_ALREADY_ACKNOWLEDGED");
            Require(age.ElapsedMilliseconds<11000,"MAIN_LOSS_TOTAL_AGE_EXCEEDED");
            var observation=Stopwatch.StartNew();Require(TerminateProcess(main.process,101),"MAIN_LOSS_TERMINATE_FAILED");result["mainTerminationCode"]=101;
            Require(WaitForSingleObject(main.process,1000)==0,"MAIN_LOSS_MAIN_EXIT_UNOBSERVED");result["mainExit"]=identity.Observe();
            uint mainCode;Require(GetExitCodeProcess(main.process,out mainCode)&&mainCode==101,"MAIN_LOSS_MAIN_EXIT_NOT_CAUSAL");
            // Main can no longer publish an abort. An in-flight pending write
            // also invalidates this observation; cleanup awaited its rename.
            string abortPath=Path.Combine(directory,"composition-main-loss-abort.json");
            bool aborted=File.Exists(abortPath),pending=File.Exists(abortPath+".pending"),acknowledged=File.Exists(Path.Combine(directory,"composition-first-go.request"));
            result["abortCheck"]=new Dictionary<string,object>{{"checkedAfterMainExit",true},{"present",aborted},{"pending",pending},{"firstGoPresent",acknowledged}};
            Require(!aborted&&!pending&&!acknowledged,"MAIN_LOSS_ABORT_MARKED");
            if(negative){while(observation.ElapsedMilliseconds<2000)Thread.Sleep(5);foreach(uint pid in canaries)Require(WaitForSingleObject(Find(held,pid).handle,0)==258,"MAIN_LOSS_NEGATIVE_CANARY_GONE");}
            else {while(Active(safety)!=0&&observation.ElapsedMilliseconds<3000)Thread.Sleep(5);Require(Active(safety)==0,"MAIN_LOSS_POSITIVE_NOT_EMPTY");foreach(var p in held)Require(WaitForSingleObject(p.handle,0)==0,"MAIN_LOSS_POSITIVE_HELD_LIVE");}
            Require(observation.ElapsedMilliseconds<3000,"MAIN_LOSS_OBSERVATION_DEADLINE");result["after"]=Observe(held);result["observeMs"]=observation.ElapsedMilliseconds;
            result["safetyOpenAtObservation"]=true;result["activeBeforeSafetyCleanup"]=Active(safety);
            result["mainAgeMs"]=age.ElapsedMilliseconds;Require(age.ElapsedMilliseconds<11000,"MAIN_LOSS_TOTAL_AGE_EXCEEDED");
            result["status"]="COMPOSED_MAIN_LOSS_OBSERVED_NOT_ADMITTED";code=0;
        }catch(Exception e){result["error"]=e.Message;}
        finally {
            try {if(safety!=IntPtr.Zero){Require(TerminateJobObject(safety,98),"MAIN_LOSS_SAFETY_CLEANUP_FAILED");var cleanup=Stopwatch.StartNew();while(Active(safety)!=0&&cleanup.ElapsedMilliseconds<3000)Thread.Sleep(5);Require(Active(safety)==0,"MAIN_LOSS_SAFETY_CLEANUP_NOT_EMPTY");foreach(var p in held)Require(WaitForSingleObject(p.handle,0)==0,"MAIN_LOSS_SAFETY_HELD_LIVE");result["cleanup"]=new Dictionary<string,object>{{"verified",true},{"active",0},{"held",Observe(held)}};}}
            catch(Exception e){result["cleanupError"]=e.Message;result["status"]="FAILED";code=1;}
            foreach(var p in held)CloseHandle(p.handle);if(main.thread!=IntPtr.Zero)CloseHandle(main.thread);if(main.process!=IntPtr.Zero)CloseHandle(main.process);if(safety!=IntPtr.Zero)CloseHandle(safety);
            File.WriteAllText(Path.Combine(directory,"observer-result.json"),Json.Serialize(result),new UTF8Encoding(false));Console.WriteLine(Json.Serialize(result));
        }return code;
    }
}
