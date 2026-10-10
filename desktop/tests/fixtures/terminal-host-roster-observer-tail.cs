// Appended to byte-pinned Win32 helpers from terminal-main-owner-observer.cs.
// This is test-only Safety, external to the JS worker and native addon.
    static List<Held> HoldLocal(IntPtr job,string exe,long since) {
        var held=new List<Held>();IntPtr buffer=Marshal.AllocHGlobal(8192);
        try {
            uint returned;Require(QueryInformationJobObject(job,3,buffer,8192,out returned),"SAFETY_ENUMERATION_UNKNOWN");
            int assigned=Marshal.ReadInt32(buffer),count=Marshal.ReadInt32(buffer,4);
            Require(assigned==count&&count>=3&&count<=64,"SAFETY_SET_REFUSED");
            for(int i=0;i<count;i++){
                long id=Marshal.ReadIntPtr(buffer,8+i*IntPtr.Size).ToInt64();Require(id>0&&id<=uint.MaxValue,"SAFETY_PID_REFUSED");
                IntPtr handle=OpenProcess(Query|Synchronize,false,(uint)id);Require(handle!=IntPtr.Zero,"SAFETY_OPEN_FAILED");
                try{
                    Require(Member(handle,job)&&WaitForSingleObject(handle,0)==258,"SAFETY_NOT_LIVE_MEMBER");
                    var p=Identity(handle,(uint)id);string conhost=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe");
                    Require(long.Parse(p.created)>=since&&(string.Equals(p.image,exe,StringComparison.OrdinalIgnoreCase)||string.Equals(p.image,conhost,StringComparison.OrdinalIgnoreCase)),"SAFETY_IDENTITY_REFUSED:"+p.image);
                    held.Add(p);handle=IntPtr.Zero;
                }finally{if(handle!=IntPtr.Zero)CloseHandle(handle);}
            }return held;
        }catch{foreach(var p in held)CloseHandle(p.handle);throw;}
        finally{Marshal.FreeHGlobal(buffer);}
    }
    static object[] ObserveLocal(List<Held> held){var rows=new List<object>();foreach(var p in held)rows.Add(p.Observe());return rows.ToArray();}
    static Held LocalFind(List<Held> held,uint pid){var rows=held.FindAll(p=>p.pid==pid);Require(rows.Count==1,"SAFETY_MEMBER_MISSING");return rows[0];}
    static Dictionary<string,object> ReadLocal(string path){Require(new FileInfo(path).Length<=262144,"PROTOCOL_BUDGET");return Map(Json.DeserializeObject(File.ReadAllText(path,new UTF8Encoding(false,true))));}
    static void WaitFile(string path,Stopwatch age,IntPtr worker,Dictionary<string,object> result){
        while(!File.Exists(path)&&age.ElapsedMilliseconds<20000){
            string errorPath=Path.Combine(Path.GetDirectoryName(path),"worker-error.json");
            if(File.Exists(errorPath)){result["nativeWorkerError"]=ReadLocal(errorPath);Require(false,"WORKER_REPORTED_ERROR:"+Path.GetFileName(path));}
            Require(WaitForSingleObject(worker,0)==258,"WORKER_EXITED_BEFORE_PROTOCOL:"+Path.GetFileName(path));Thread.Sleep(5);
        }
        if(!File.Exists(path)||age.ElapsedMilliseconds>=20000){
            result["watchdogElapsedMs"]=age.ElapsedMilliseconds;result["watchdogWorkerAlive"]=WaitForSingleObject(worker,0)==258;result["watchdogProtocol"]=Path.GetFileName(path);
            Require((bool)result["watchdogWorkerAlive"],"WORKER_EXITED_BEFORE_PROTOCOL:"+Path.GetFileName(path));
            Require(false,"EXTERNAL_WATCHDOG_DEADLINE:"+Path.GetFileName(path));
        }
    }
    static int Main(string[] args){
        if(args.Length!=3)return 2;foreach(string p in args)if(!Path.IsPathRooted(p))return 2;
        string exe=Path.GetFullPath(args[0]),script=Path.GetFullPath(args[1]),dir=Path.GetFullPath(args[2]);
        var result=new Dictionary<string,object>{{"status","FAILED"},{"scope","LOCAL_WINDOWS_NODE_ROSTER_QUALIFICATION"},{"nativeExecutionAdmitted",false}};
        IntPtr safety=IntPtr.Zero;ProcessInfo worker=new ProcessInfo();var held=new List<Held>();int code=1;var age=Stopwatch.StartNew();
        try{
            Require(!File.Exists(Path.Combine(dir,"before.json"))&&!File.Exists(Path.Combine(dir,"observer-result.json")),"STALE_PROTOCOL");
            safety=NewJob();worker=Spawn(exe,script,dir,new[]{safety},true,false);
            Require(Member(worker.process,safety),"WORKER_NOT_ATOMICALLY_CONTAINED");var main=Identity(worker.process,worker.pid);
            Require(ResumeThread(worker.thread)==1,"WORKER_RESUME_FAILED");
            string beforePath=Path.Combine(dir,"before.json");WaitFile(beforePath,age,worker.process,result);var before=ReadLocal(beforePath);
            Require(Pid(before["mainPid"])==worker.pid,"WORKER_IDENTITY_REFUSED");held=HoldLocal(safety,exe,long.Parse(main.created));
            var snap=Map(before["before"]);var rows=Array(snap["held"]);var required=new HashSet<uint>();
            foreach(var raw in rows){var row=Map(raw);uint pid=Pid(row["pid"]);var p=LocalFind(held,pid);
                Require(required.Add(pid)&&(bool)row["alive"]&&p.created==Convert.ToString(row["createdFileTime"])&&p.image==Convert.ToString(row["image"]),"NATIVE_IDENTITY_MISMATCH");}
            int count=Convert.ToInt32(before["sessionCount"]);Require(count==0||count==8,"FIXTURE_COUNT_REFUSED");
            var sessionRows=Array(before["sessionCaptures"]);Require(sessionRows.Length==count,"SESSION_CAPTURE_MISSING");var sessionMembers=new HashSet<uint>();
            string expectedConsole=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe");
            foreach(var rawSession in sessionRows){var s=Map(rawSession);var r=Map(s["ready"]);var c=Map(s["captured"]);uint creator=Pid(r["creatorPid"]),shell=Pid(r["shellPid"]);
                Require(creator!=shell&&required.Contains(creator)&&required.Contains(shell),"SESSION_NODE_MISSING");
                var members=Array(c["held"]);Require(members.Length>=2&&members.Length<=4&&Convert.ToInt32(c["active"])==members.Length,"SESSION_CAPTURE_REFUSED");
                var local=new HashSet<uint>();foreach(var rawMember in members){var m=Map(rawMember);uint pid=Pid(m["pid"]);var actual=LocalFind(held,pid);
                    Require(local.Add(pid)&&sessionMembers.Add(pid)&&required.Contains(pid)&&(bool)m["alive"]&&actual.created==Convert.ToString(m["createdFileTime"])&&actual.image==Convert.ToString(m["image"]),"SESSION_IDENTITY_REFUSED");
                    Require(string.Equals(actual.image,pid==creator||pid==shell?exe:expectedConsole,StringComparison.OrdinalIgnoreCase),"UNEXPECTED_SESSION_EXECUTABLE");}
                Require(local.Contains(creator)&&local.Contains(shell),"SESSION_NODE_NOT_CAPTURED");}
            Require(required.Count>=1+count*2&&required.Count<=2+count*4&&Convert.ToInt32(snap["active"])==required.Count,"NATIVE_GROUP_INCOMPLETE");
            var root=Map(snap["root"]);Require(required.Contains(Pid(root["pid"])),"NATIVE_ROOT_MISSING");
            Require(!sessionMembers.Contains(Pid(root["pid"])),"HOST_OVERLAPS_SESSION");
            foreach(uint pid in required)if(pid!=Pid(root["pid"])&&!sessionMembers.Contains(pid))Require(string.Equals(LocalFind(held,pid).image,expectedConsole,StringComparison.OrdinalIgnoreCase),"UNEXPECTED_HOST_DESCENDANT");
            uint canary=Pid(before["canaryPid"]);LocalFind(held,canary);LocalFind(held,worker.pid);
            Require(!required.Contains(canary)&&!required.Contains(worker.pid),"SAFETY_PARTITION_REFUSED");
            int extra=0;string consoleHost=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe");
            foreach(var p in held)if(!required.Contains(p.pid)&&p.pid!=canary&&p.pid!=worker.pid){
                Require(string.Equals(p.image,consoleHost,StringComparison.OrdinalIgnoreCase),"UNEXPECTED_OUTSIDE_NATIVE_PROCESS");extra++;}
            Require(extra<=3&&held.Count==required.Count+2+extra,"SAFETY_PARTITION_REFUSED");result["outsideConsoleHelpers"]=extra;
            Require(Active(safety)==held.Count,"SAFETY_ACTIVE_MISMATCH");result["before"]=ObserveLocal(held);result["nativeBefore"]=before;
            File.WriteAllText(Path.Combine(dir,"go.json"),"{}",new UTF8Encoding(false));
            string afterPath=Path.Combine(dir,"after.json");WaitFile(afterPath,age,worker.process,result);result["nativeAfter"]=ReadLocal(afterPath);
            // Causal observation occurs before release, Job close or Safety kill.
            result["afterBeforeSafetyCleanup"]=ObserveLocal(held);result["activeBeforeSafetyCleanup"]=Active(safety);
            foreach(uint pid in required)Require(WaitForSingleObject(LocalFind(held,pid).handle,0)==0,"NATIVE_LEFT_LIVE_DESCENDANT");
            Require(WaitForSingleObject(LocalFind(held,canary).handle,0)==258&&WaitForSingleObject(worker.process,0)==258,"UNRELATED_PROCESS_KILLED");
            uint alive=0;foreach(var p in held)if(WaitForSingleObject(p.handle,0)==258)alive++;
            Require(Active(safety)==alive&&alive>=2&&alive<=2+extra,"UNOBSERVED_LIVE_PROCESS");Require(age.ElapsedMilliseconds<20000,"NATURAL_EXIT_COULD_MASK_PROOF");
            result["nativeGroupDeadBeforeSafetyCleanup"]=true;result["canaryAliveBeforeSafetyCleanup"]=true;
            File.WriteAllText(Path.Combine(dir,"release.json"),"{}",new UTF8Encoding(false));
            Require(WaitForSingleObject(worker.process,3000)==0,"WORKER_EXIT_DEADLINE");uint exit;Require(GetExitCodeProcess(worker.process,out exit)&&exit==0,"WORKER_FAILED");
            var settle=Stopwatch.StartNew();while(Active(safety)!=0&&settle.ElapsedMilliseconds<1000)Thread.Sleep(5);
            result["finalBeforeSafetyCleanup"]=ObserveLocal(held);result["finalActiveBeforeSafetyCleanup"]=Active(safety);
            Require(Active(safety)==0,"FINAL_JOB_NOT_EMPTY");foreach(var p in held)Require(WaitForSingleObject(p.handle,0)==0,"FINAL_HELD_STILL_LIVE");
            result["status"]="LOCAL_NATIVE_CASE_PASSED";code=0;
        }catch(Exception error){result["error"]=error.Message;}
        finally{
            try{
                if(safety!=IntPtr.Zero){
                    result["cleanupEntryActive"]=Active(safety);result["cleanupEntryHeld"]=ObserveLocal(held);
                    Require(TerminateJobObject(safety,98),"SAFETY_CLEANUP_FAILED");var clean=Stopwatch.StartNew();
                    for(;;){
                        bool allDead=true;foreach(var p in held){uint state=WaitForSingleObject(p.handle,0);Require(state==0||state==258,"SAFETY_CLEANUP_WAIT_UNKNOWN");allDead=allDead&&state==0;}
                        if((Active(safety)==0&&allDead)||clean.ElapsedMilliseconds>=3000)break;Thread.Sleep(5);
                    }
                    result["cleanupElapsedMs"]=clean.ElapsedMilliseconds;result["cleanupFinalActive"]=Active(safety);result["cleanupFinalHeld"]=ObserveLocal(held);
                    Require(Active(safety)==0,"SAFETY_CLEANUP_NOT_EMPTY");foreach(var p in held)Require(WaitForSingleObject(p.handle,0)==0,"SAFETY_CLEANUP_HELD_LIVE");
                    Require(clean.ElapsedMilliseconds<3000,"SAFETY_CLEANUP_DEADLINE");
                    result["cleanupVerified"]=true;
                }
            }catch(Exception error){result["status"]="FAILED";result["cleanupError"]=error.Message;code=1;}
            result["elapsedMs"]=age.ElapsedMilliseconds;
            foreach(var p in held)CloseHandle(p.handle);if(worker.thread!=IntPtr.Zero)CloseHandle(worker.thread);if(worker.process!=IntPtr.Zero)CloseHandle(worker.process);if(safety!=IntPtr.Zero)CloseHandle(safety);
            File.WriteAllText(Path.Combine(dir,"observer-result.json"),Json.Serialize(result),new UTF8Encoding(false));Console.WriteLine(Json.Serialize(result));
        }return code;
    }
}
