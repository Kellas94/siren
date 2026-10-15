using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Separate test-only fixed worker per HPCON. Compile with the mechanically
// derived original fixture/shared study; no product PTY backend or user input.
internal static partial class TerminalJobListProbe {
    static int BrokerWorker(string directory) {
        string path=Path.Combine(directory,"broker-config.json");Require(new FileInfo(path).Length<65536,"BROKER_CONFIG_SIZE");
        var config=ConptyJson.Deserialize<Dictionary<string,object>>(File.ReadAllText(path));
        string name=(string)config["session"];bool expected=(bool)config["expectedSession"];
        Require(name.StartsWith("Local\\SIREN-CP-BROKER-",StringComparison.Ordinal)&&name.Length<128,"BROKER_JOB_NAME");
        IntPtr session=OpenJobObjectW(4,false,name);Require(session!=IntPtr.Zero,"BROKER_SESSION_OPEN");ConsoleLease lease=null;
        try {
            uint flags;Require(GetHandleInformation(session,out flags)&&(flags&1)==0,"BROKER_OPEN_INHERITABLE");
            using(var self=Process.GetCurrentProcess())Require(Member(self.Handle,session)==expected,"BROKER_CREATOR_NOT_CONTAINED");
            bool before;
            // No root JOB_LIST attribute here: the already-contained creator
            // supplies inherited Session ownership BEFORE pseudoconsole creation.
            lease=ConptyStart(directory,session,true,out before,expected);
            CloseHandle(session);session=IntPtr.Zero;WaitReady(directory);
            var ready=new Dictionary<string,object>{{"workerPid",Process.GetCurrentProcess().Id},{"pseudoConsoles",1},{"rootBeforeResume",before},{"rootPid",lease.root.pid}};
            string pending=Path.Combine(directory,"broker-ready.pending");File.WriteAllText(pending,ConptyJson.Serialize(ready),new UTF8Encoding(false));File.Move(pending,Path.Combine(directory,"broker-ready.json"));
            Thread.Sleep(8000);return 0;
        }finally{if(session!=IntPtr.Zero)CloseHandle(session);if(lease!=null)lease.Close();}
    }
    static int BrokerStudy(bool negative,string directory) {
        IntPtr safety=IntPtr.Zero,a=IntPtr.Zero,b=IntPtr.Zero;var workers=new List<ProcessInfo>();var held=new List<IntPtr>();var age=Stopwatch.StartNew();int code=1;
        var result=new Dictionary<string,object>{{"status","FAILED"},{"negative",negative},{"fixtureImage",Assembly.GetExecutingAssembly().Location},{"systemConhostImage",Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe")}};
        try {
            var os=new OsVersion();os.size=(uint)Marshal.SizeOf(typeof(OsVersion));Require(RtlGetVersion(ref os)==0,"BROKER_OS_VERSION");result["os"]=os.major+"."+os.minor+"."+os.build;
            string nameA="Local\\SIREN-CP-BROKER-"+Guid.NewGuid().ToString(),nameB="Local\\SIREN-CP-BROKER-"+Guid.NewGuid().ToString();
            safety=NewJob();a=ConptyNamedJob(nameA);b=ConptyNamedJob(nameB);
            var workerPids=new Dictionary<string,object>();var workerBefore=new Dictionary<string,object>();var roots=new Dictionary<string,object>();var rootBefore=new Dictionary<string,object>();int consoles=0;
            foreach(string label in new[]{"A","B"}) {
                bool expected=!(negative&&label=="A");IntPtr session=label=="A"?a:b;
                string sub=Path.Combine(directory,label);Directory.CreateDirectory(sub);
                File.WriteAllText(Path.Combine(sub,"broker-config.json"),ConptyJson.Serialize(new Dictionary<string,object>{{"session",label=="A"?nameA:nameB},{"expectedSession",expected}}),new UTF8Encoding(false));
                var worker=Spawn("broker-worker",sub,expected?new[]{safety,session}:new[]{safety},true,false);workers.Add(worker);
                Require(Member(worker.process,safety)&&Member(worker.process,session)==expected,"BROKER_WORKER_NOT_ATOMIC");
                Require(!Member(worker.process,label=="A"?b:a),"BROKER_WORKER_CROSS_SESSION");
                workerPids[label]=worker.pid;workerBefore[label]=Member(worker.process,session);
                Require(ResumeThread(worker.thread)!=uint.MaxValue,"BROKER_WORKER_RESUME");
                string readyPath=Path.Combine(sub,"broker-ready.json");while(!File.Exists(readyPath)&&age.ElapsedMilliseconds<5000&&WaitForSingleObject(worker.process,0)==258)Thread.Sleep(5);
                Require(File.Exists(readyPath)&&age.ElapsedMilliseconds<5000&&new FileInfo(readyPath).Length<65536,"BROKER_WORKER_DEADLINE");
                var ready=ConptyJson.Deserialize<Dictionary<string,object>>(File.ReadAllText(readyPath));Require(Convert.ToUInt32(ready["workerPid"])==worker.pid,"BROKER_WORKER_IDENTITY");
                Require(Convert.ToInt32(ready["pseudoConsoles"])==1&&(bool)ready["rootBeforeResume"]==expected,"BROKER_ROOT_BEFORE_RESUME");
                roots[label]=ready["rootPid"];rootBefore[label]=ready["rootBeforeResume"];consoles++;
            }
            result["workerPids"]=workerPids;result["workerBeforeResume"]=workerBefore;result["rootPids"]=roots;result["rootBeforeResume"]=rootBefore;result["pseudoConsoles"]=consoles;
            var fixedA=ConptyFixtures(Path.Combine(directory,"A"));var fixedB=ConptyFixtures(Path.Combine(directory,"B"));result["fixturePids"]=new Dictionary<string,object>{{"A",fixedA},{"B",fixedB}};
            Require(Convert.ToUInt32(roots["A"])==fixedA[0]&&Convert.ToUInt32(roots["B"])==fixedB[0],"BROKER_ROOT_PID_MISMATCH");
            held=HoldMembers(safety,safety,10);Require(Active(safety)==held.Count,"BROKER_SAFETY_SET_INCOMPLETE");result["hostActiveBefore"]=Active(safety);result["before"]=ConptyStates(held,a,b,true);
            var seen=new HashSet<uint>();int helperA=0,helperB=0;
            foreach(IntPtr handle in held) {
                uint pid=GetProcessId(handle);seen.Add(pid);var membership=ConptyMembership[pid];Require(WaitForSingleObject(handle,0)==258,"BROKER_EARLY_EXIT");
                Require(negative?!membership[0]:membership[0]!=membership[1],"BROKER_UNCONTAINED_MEMBER");
                bool fixture=Array.IndexOf(fixedA,pid)>=0||Array.IndexOf(fixedB,pid)>=0||pid==workers[0].pid||pid==workers[1].pid;
                if(!fixture){if(negative?!membership[1]:membership[0])helperA++;if(membership[1])helperB++;}
            }
            Require(helperA>0&&helperB>0,"BROKER_HELPER_OBSERVATION_MISSING");
            foreach(uint pid in fixedA)Require(seen.Contains(pid)&&ConptyMembership[pid][0]==!negative&&!ConptyMembership[pid][1],"BROKER_A_FIXTURE_SET");
            foreach(uint pid in fixedB)Require(seen.Contains(pid)&&!ConptyMembership[pid][0]&&ConptyMembership[pid][1],"BROKER_B_FIXTURE_SET");
            Require(seen.Contains(workers[0].pid)&&seen.Contains(workers[1].pid),"BROKER_WORKER_SET_MISSING");
            var stop=Stopwatch.StartNew();Require(TerminateJobObject(a,77),"BROKER_STOP_A");
            if(negative){while(stop.ElapsedMilliseconds<2000)Thread.Sleep(5);}
            else {
                WaitEmpty(a);result["sessionActiveAfterStop"]=Active(a);var waits=new List<object>();result["stopWaits"]=waits;
                foreach(IntPtr handle in held)if(ConptyMembership[GetProcessId(handle)][0]) {
                    long remaining=3000-stop.ElapsedMilliseconds;Require(remaining>0,"BROKER_STOP_GLOBAL_DEADLINE");
                    uint initial=WaitForSingleObject(handle,0),final=WaitForSingleObject(handle,(uint)remaining);
                    waits.Add(new Dictionary<string,object>{{"pid",GetProcessId(handle)},{"initialWait",initial},{"finalWait",final},{"elapsedMs",stop.ElapsedMilliseconds}});
                    uint exit;Require(final==0&&GetExitCodeProcess(handle,out exit)&&exit==77,"BROKER_A_STOP_NOT_CAUSAL");
                }
            }
            foreach(IntPtr handle in held)if(negative||ConptyMembership[GetProcessId(handle)][1])Require(WaitForSingleObject(handle,0)==258,"BROKER_ISOLATION_FAILED");
            result["after"]=ConptyStates(held,a,b,false);result["stopMs"]=stop.ElapsedMilliseconds;result["fixtureAgeMs"]=age.ElapsedMilliseconds;
            Require(stop.ElapsedMilliseconds<3000&&age.ElapsedMilliseconds<6000,"BROKER_NATURAL_DEADLINE");
            result["status"]=negative?"EXPECTED_BROKER_SESSION_ASSIGNMENT_REFUSED":"CONPTY_BROKER_CONTAINMENT_OBSERVED_TERMINAL_NOT_ADMITTED";code=negative?1:0;
        }catch(Exception error){result["status"]="FAILED";result["error"]=error.Message;}
        finally {
            try{if(safety!=IntPtr.Zero){Require(TerminateJobObject(safety,98),"BROKER_SAFETY_STOP");Exited(held);WaitEmpty(safety);result["cleanup"]=new Dictionary<string,object>{{"verified",true},{"active",Active(safety)},{"held",ConptyStates(held,a,b,false)}};}}
            catch(Exception error){result["status"]="FAILED";result["cleanupError"]=error.Message;code=1;}
            foreach(IntPtr handle in held)CloseHandle(handle);foreach(var worker in workers){if(worker.thread!=IntPtr.Zero)CloseHandle(worker.thread);if(worker.process!=IntPtr.Zero)CloseHandle(worker.process);}
            if(a!=IntPtr.Zero)CloseHandle(a);if(b!=IntPtr.Zero)CloseHandle(b);if(safety!=IntPtr.Zero)CloseHandle(safety);
            string json=ConptyJson.Serialize(result);File.WriteAllText(Path.Combine(directory,"native-result.json"),json,new UTF8Encoding(false));Console.WriteLine(json);
        }return code;
    }
    static int Main(string[] args) {
        try{if(args.Length!=2||!Path.IsPathRooted(args[1]))return 2;if(args[0]=="broker-worker")return BrokerWorker(args[1]);if(args[0]=="broker-positive"||args[0]=="broker-negative")return BrokerStudy(args[0]=="broker-negative",args[1]);return Fixture(args[0],args[1]);}
        catch(Exception error){Console.Error.WriteLine(error.Message);return 1;}
    }
}
