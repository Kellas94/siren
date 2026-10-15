using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Test-only eight-creator startup/isolation study. No arbitrary shell or input.
internal static partial class TerminalJobListProbe {
    static readonly Dictionary<uint,string> CapacityMembership=new Dictionary<uint,string>();
    static object[] CapacityStates(List<IntPtr> held,List<IntPtr> sessions,bool capture) {
        IntPtr a=sessions.Count>0?sessions[0]:IntPtr.Zero,b=sessions.Count>1?sessions[1]:IntPtr.Zero;
        var rows=ConptyStates(held,a,b,capture);
        foreach(object value in rows){var row=(Dictionary<string,object>)value;uint pid=(uint)row["pid"];
            if(capture){string label=null;foreach(IntPtr h in held)if(GetProcessId(h)==pid){
                for(int i=0;i<sessions.Count;i++)if(Member(h,sessions[i])){Require(label==null,"CAPACITY_OVERLAPPING_SESSIONS");label=((char)('A'+i)).ToString();}break;
            }CapacityMembership.Add(pid,label);}
            Require(CapacityMembership.ContainsKey(pid),"CAPACITY_MEMBERSHIP_NOT_CAPTURED");row["session"]=CapacityMembership[pid];
        }return rows;
    }
    static void CapacityWaitFixtures(string directory,Stopwatch age){
        while(age.ElapsedMilliseconds<8000){bool ready=true;foreach(string mode in new[]{"root","branch","grandchild","detached"})ready&=File.Exists(Path.Combine(directory,mode+".ready"));if(ready)return;Thread.Sleep(5);}
        throw new Exception("CAPACITY_FIXTURE_READY_DEADLINE");
    }
    static int CapacityStudy(bool negative,string directory){
        IntPtr safety=IntPtr.Zero;var sessions=new List<IntPtr>();var workers=new List<ProcessInfo>();var held=new List<IntPtr>();var age=Stopwatch.StartNew();int code=1;
        var groups=new List<object>();var result=new Dictionary<string,object>{{"status","FAILED"},{"admitted",false},{"negative",negative},{"groups",groups},{"fixtureImage",Assembly.GetExecutingAssembly().Location},{"systemConhostImage",Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe")}};
        try{
            var version=new OsVersion();version.size=(uint)Marshal.SizeOf(typeof(OsVersion));Require(RtlGetVersion(ref version)==0,"CAPACITY_OS_VERSION");result["os"]=version.major+"."+version.minor+"."+version.build;
            string configPath=Path.Combine(directory,"study-config.json");Require(new FileInfo(configPath).Length<65536,"CAPACITY_CONFIG_SIZE");var config=ConptyJson.Deserialize<Dictionary<string,object>>(File.ReadAllText(configPath));
            string electron=(string)config["electron"],script=(string)config["script"],package=(string)config["packagePath"];result["electronImage"]=electron;
            safety=NewJob();for(int i=0;i<8;i++)sessions.Add(NewJob());long rss=0;var fixedIdentities=new HashSet<uint>();
            for(int i=0;i<8;i++){
                string label=((char)('A'+i)).ToString(),sub=Path.Combine(directory,label);bool expected=!(negative&&i==0);Directory.CreateDirectory(sub);
                File.WriteAllText(Path.Combine(sub,"electron-config.json"),ConptyJson.Serialize(new Dictionary<string,object>{{"fixture",Assembly.GetExecutingAssembly().Location},{"packagePath",package}}),new UTF8Encoding(false));
                var child=ElectronSpawn(electron,script,sub,expected?new[]{safety,sessions[i]}:new[]{safety});workers.Add(child);
                Require(Member(child.process,safety),"CAPACITY_WORKER_SAFETY");for(int j=0;j<8;j++)Require(Member(child.process,sessions[j])==(expected&&i==j),"CAPACITY_WORKER_NOT_ATOMIC");
                Require(ResumeThread(child.thread)!=uint.MaxValue,"CAPACITY_RESUME");string readyPath=Path.Combine(sub,"electron-ready.json");
                while(!File.Exists(readyPath)&&age.ElapsedMilliseconds<8000&&WaitForSingleObject(child.process,0)==258)Thread.Sleep(5);
                Require(File.Exists(readyPath)&&age.ElapsedMilliseconds<8000&&new FileInfo(readyPath).Length<65536,"CAPACITY_WORKER_READY_DEADLINE");
                var ready=ConptyJson.Deserialize<Dictionary<string,object>>(File.ReadAllText(readyPath));Require(Convert.ToUInt32(ready["workerPid"])==child.pid,"CAPACITY_WORKER_IDENTITY");
                CapacityWaitFixtures(sub,age);uint[] fixtures=ConptyFixtures(sub);Require(Convert.ToUInt32(ready["rootPid"])==fixtures[0],"CAPACITY_ROOT_IDENTITY");
                Require(fixedIdentities.Add(child.pid),"CAPACITY_DUPLICATE_WORKER");foreach(uint n in fixtures)Require(fixedIdentities.Add(n),"CAPACITY_DUPLICATE_FIXTURE");rss=checked(rss+Convert.ToInt64(ready["rssBytes"]));
                groups.Add(new Dictionary<string,object>{{"label",label},{"workerPid",child.pid},{"workerBeforeResume",expected},{"rootPid",fixtures[0]},{"fixturePids",fixtures},{"workerReady",ready}});
            }
            result["workersRssTotalBytes"]=rss;held=ElectronHold(safety,electron);Require(held.Count>=48&&Active(safety)==held.Count,"CAPACITY_SAFETY_SET_INCOMPLETE");result["hostActiveBefore"]=Active(safety);result["before"]=CapacityStates(held,sessions,true);
            var seen=new HashSet<uint>();foreach(IntPtr h in held){uint pid=GetProcessId(h);Require(seen.Add(pid),"CAPACITY_DUPLICATE_HANDLE");Require(negative?CapacityMembership[pid]!="A":CapacityMembership[pid]!=null,"CAPACITY_UNCONTAINED_MEMBER");}
            for(int i=0;i<groups.Count;i++){var group=(Dictionary<string,object>)groups[i];string label=(string)group["label"],expected=negative&&i==0?null:label;
                uint worker=(uint)group["workerPid"];Require(seen.Contains(worker)&&CapacityMembership[worker]==expected,"CAPACITY_WORKER_MISSING");
                foreach(uint n in (uint[])group["fixturePids"])Require(seen.Contains(n)&&CapacityMembership[n]==expected,"CAPACITY_FIXTURE_WRONG_SESSION");
            }
            var stop=Stopwatch.StartNew();Require(TerminateJobObject(sessions[0],77),"CAPACITY_STOP_A");
            if(negative){while(stop.ElapsedMilliseconds<2000)Thread.Sleep(5);}else{
                WaitEmpty(sessions[0]);result["sessionActiveAfterStop"]=Active(sessions[0]);var waits=new List<object>();result["stopWaits"]=waits;
                foreach(IntPtr h in held)if(CapacityMembership[GetProcessId(h)]=="A"){
                    long remaining=3000-stop.ElapsedMilliseconds;Require(remaining>0,"CAPACITY_STOP_GLOBAL_DEADLINE");uint initial=WaitForSingleObject(h,0),final=WaitForSingleObject(h,(uint)remaining),exit;
                    waits.Add(new Dictionary<string,object>{{"pid",GetProcessId(h)},{"initialWait",initial},{"finalWait",final},{"elapsedMs",stop.ElapsedMilliseconds}});Require(final==0&&GetExitCodeProcess(h,out exit)&&exit==77,"CAPACITY_STOP_NOT_CAUSAL");
                }
            }
            foreach(IntPtr h in held)if(negative||CapacityMembership[GetProcessId(h)]!="A")Require(WaitForSingleObject(h,0)==258,"CAPACITY_SEVEN_SESSION_ISOLATION");
            result["after"]=CapacityStates(held,sessions,false);result["stopMs"]=stop.ElapsedMilliseconds;result["fixtureAgeMs"]=age.ElapsedMilliseconds;Require(stop.ElapsedMilliseconds<3000&&age.ElapsedMilliseconds<11000,"CAPACITY_NATURAL_DEADLINE");
            result["status"]=negative?"EXPECTED_EIGHT_SESSION_ASSIGNMENT_REFUSED":"EIGHT_ELECTRON_CREATORS_OBSERVED_NOT_ADMITTED";code=negative?1:0;
        }catch(Exception error){result["error"]=error.Message;result["status"]="FAILED";}
        finally{
            try{if(safety!=IntPtr.Zero){Require(TerminateJobObject(safety,98),"CAPACITY_SAFETY_STOP");Exited(held);WaitEmpty(safety);result["cleanup"]=new Dictionary<string,object>{{"verified",true},{"active",Active(safety)},{"held",CapacityStates(held,sessions,false)}};}}
            catch(Exception error){result["cleanupError"]=error.Message;result["status"]="FAILED";code=1;}
            foreach(IntPtr h in held)CloseHandle(h);foreach(var worker in workers){if(worker.thread!=IntPtr.Zero)CloseHandle(worker.thread);if(worker.process!=IntPtr.Zero)CloseHandle(worker.process);}foreach(IntPtr session in sessions)CloseHandle(session);if(safety!=IntPtr.Zero)CloseHandle(safety);
            string json=ConptyJson.Serialize(result);File.WriteAllText(Path.Combine(directory,"native-result.json"),json,new UTF8Encoding(false));Console.WriteLine(json);
        }return code;
    }
    static int Main(string[] args){
        try{if(args.Length!=2||!Path.IsPathRooted(args[1]))return 2;if(args[0]=="capacity-positive"||args[0]=="capacity-negative")return CapacityStudy(args[0]=="capacity-negative",args[1]);Console.WriteLine("SIREN_NATIVE_FIXED_READY");return Fixture(args[0],args[1]);}
        catch(Exception error){Console.Error.WriteLine(error.Message);return 1;}
    }
}
