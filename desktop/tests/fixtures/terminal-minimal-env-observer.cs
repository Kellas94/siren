using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
// Outer Safety stays open during both actual native containment observations.
// No duplicate inner Job handles are obtained. No product/native admission.
internal static partial class TerminalMainOwnerObserver {
    static object Stage(string directory,string label,IntPtr safety,string electron,string fixture,long created,List<Held> all,ProcessInfo main,Stopwatch age) {
        string ready=Path.Combine(directory,"composition-"+label+"-ready.json");
        while(!File.Exists(ready)&&age.ElapsedMilliseconds<20000&&WaitForSingleObject(main.process,0)==258)Thread.Sleep(5);
        Require(File.Exists(ready)&&new FileInfo(ready).Length<=262144&&age.ElapsedMilliseconds<20000,"COMPOSITION_STAGE_DEADLINE");
        var record=Map(Json.DeserializeObject(File.ReadAllText(ready,new UTF8Encoding(false,true))));
        Require(Pid(record["mainPid"])==main.pid,"COMPOSITION_MAIN_IDENTITY");
        var next=Hold(safety,electron,fixture,created);
        try {
            var required=Array(record["held"]);Require(required.Length>=11&&required.Length<=64,"COMPOSITION_STAGE_SET");
            var ids=new HashSet<uint>();
            foreach(var raw in required){var p=Map(raw);uint pid=Pid(p["pid"]);var live=Find(next,pid);Require(ids.Add(pid)&&(bool)p["alive"]&&live.created==Convert.ToString(p["createdFileTime"])&&live.image==Convert.ToString(p["image"]),"COMPOSITION_STAGE_HELD_IDENTITY");}
            foreach(var p in next){var prior=all.Find(q=>q.pid==p.pid&&q.created==p.created);if(prior==null){all.Add(p);}else CloseHandle(p.handle);}next.Clear();
            // Capture while the stage barrier still blocks native Stop/exit.
            var observed=Observe(all);
            File.WriteAllText(Path.Combine(directory,"composition-"+label+"-go.request"),"go",new UTF8Encoding(false));
            return observed;
        }finally{foreach(var p in next)CloseHandle(p.handle);}
    }
    static int Main(string[] args) {
        if(args.Length!=4)return 2;foreach(string path in args)if(!Path.IsPathRooted(path))return 2;
        string electron=args[0],application=args[1],directory=args[2],fixture=args[3];
        IntPtr safety=IntPtr.Zero;ProcessInfo main=new ProcessInfo();var held=new List<Held>();var age=Stopwatch.StartNew();int code=1;
        var result=new Dictionary<string,object>{{"admitted",false},{"status","FAILED"}};
        try {
            safety=NewJob();main=Spawn(electron,application,directory,new[]{safety},true,false);
            Require(Member(main.process,safety),"COMPOSITION_MAIN_ATOMIC_SAFETY");var identity=Identity(main.process,main.pid);result["main"]=identity.Observe();
            Require(ResumeThread(main.thread)==1,"COMPOSITION_MAIN_RESUME");
            result["firstHeld"]=Stage(directory,"first",safety,electron,fixture,long.Parse(identity.created),held,main,age);
            result["allHeldBeforeFinal"]=Stage(directory,"second",safety,electron,fixture,long.Parse(identity.created),held,main,age);
            Require(WaitForSingleObject(main.process,10000)==0,"COMPOSITION_MAIN_COMPLETION_DEADLINE");
            uint exit;Require(GetExitCodeProcess(main.process,out exit)&&exit==0,"COMPOSITION_MAIN_FAILED");
            var cleanup=Stopwatch.StartNew();while(Active(safety)!=0&&cleanup.ElapsedMilliseconds<3000)Thread.Sleep(5);
            Require(Active(safety)==0,"COMPOSITION_SAFETY_NOT_EMPTY_BEFORE_CLEANUP");
            foreach(var p in held)Require(WaitForSingleObject(p.handle,0)==0,"COMPOSITION_HELD_EXIT_UNVERIFIED");
            result["after"]=Observe(held);result["safetyOpenAtObservation"]=true;result["activeBeforeSafetyCleanup"]=0;result["ageMs"]=age.ElapsedMilliseconds;
            result["status"]="COMPOSITION_SAFETY_OBSERVED_NOT_ADMITTED";code=0;
        }catch(Exception e){result["error"]=e.Message;}
        finally {
            try{if(safety!=IntPtr.Zero){Require(TerminateJobObject(safety,98),"COMPOSITION_SAFETY_CLEANUP");var timer=Stopwatch.StartNew();while(Active(safety)!=0&&timer.ElapsedMilliseconds<3000)Thread.Sleep(5);Require(Active(safety)==0,"COMPOSITION_SAFETY_CLEANUP_NOT_EMPTY");foreach(var p in held)Require(WaitForSingleObject(p.handle,0)==0,"COMPOSITION_SAFETY_HELD_SURVIVED");result["cleanupVerified"]=true;}}
            catch(Exception e){result["cleanupError"]=e.Message;result["status"]="FAILED";code=1;}
            foreach(var p in held)CloseHandle(p.handle);if(main.thread!=IntPtr.Zero)CloseHandle(main.thread);if(main.process!=IntPtr.Zero)CloseHandle(main.process);if(safety!=IntPtr.Zero)CloseHandle(safety);
            File.WriteAllText(Path.Combine(directory,"observer-result.json"),Json.Serialize(result),new UTF8Encoding(false));Console.WriteLine(Json.Serialize(result));
        }return code;
    }
}
