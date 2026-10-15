using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Test-only atomic launcher for the existing Electron binary. No product bridge.
internal static partial class TerminalJobListProbe {
    static ProcessInfo ElectronSpawn(string executable,string script,string directory,IntPtr[] jobs) {
        Require(Path.IsPathRooted(executable)&&Path.IsPathRooted(script)&&jobs.Length>=1&&jobs.Length<=2,"ELECTRON_FIXED_PATHS");
        var command=new StringBuilder(Quote(executable)+" "+Quote(script)+" "+Quote(directory));
        var startup=new StartupEx();startup.startup.cb=(uint)Marshal.SizeOf(typeof(StartupEx));
        IntPtr list=IntPtr.Zero,values=IntPtr.Zero,environment=IntPtr.Zero;bool initialized=false;
        try {
            UIntPtr bytes=UIntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref bytes);Require(bytes.ToUInt64()>0&&bytes.ToUInt64()<65536,"ELECTRON_ATTRIBUTE_SIZE");
            list=Marshal.AllocHGlobal((int)bytes.ToUInt64());Require(InitializeProcThreadAttributeList(list,1,0,ref bytes),"ELECTRON_ATTRIBUTE_INIT");initialized=true;
            values=Marshal.AllocHGlobal(jobs.Length*IntPtr.Size);for(int i=0;i<jobs.Length;i++)Marshal.WriteIntPtr(values,i*IntPtr.Size,jobs[i]);
            Require(UpdateProcThreadAttribute(list,0,JobListAttribute,values,(UIntPtr)(jobs.Length*IntPtr.Size),IntPtr.Zero,IntPtr.Zero),"ELECTRON_ATTRIBUTE_UPDATE");startup.attributes=list;
            var env=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
            foreach(System.Collections.DictionaryEntry pair in Environment.GetEnvironmentVariables()){
                string key=(string)pair.Key;if(key.StartsWith("NODE_",StringComparison.OrdinalIgnoreCase)||key.StartsWith("ELECTRON_",StringComparison.OrdinalIgnoreCase))continue;env[key]=(string)pair.Value;
            }
            env["ELECTRON_RUN_AS_NODE"]="1";var block=new StringBuilder();foreach(var pair in env)block.Append(pair.Key+"="+pair.Value+'\0');block.Append('\0');environment=Marshal.StringToHGlobalUni(block.ToString());
            ProcessInfo child;Require(CreateProcessW(executable,command,IntPtr.Zero,IntPtr.Zero,false,NoWindow|Suspended|Extended|0x400,environment,directory,ref startup,out child),"ELECTRON_CREATE_PROCESS");return child;
        }finally{if(initialized)DeleteProcThreadAttributeList(list);if(values!=IntPtr.Zero)Marshal.FreeHGlobal(values);if(list!=IntPtr.Zero)Marshal.FreeHGlobal(list);if(environment!=IntPtr.Zero)Marshal.FreeHGlobal(environment);}
    }
    static List<IntPtr> ElectronHold(IntPtr safety,string electron) {
        IntPtr buffer=Marshal.AllocHGlobal(8192);var held=new List<IntPtr>();
        try {
            uint returned;Require(QueryInformationJobObject(safety,3,buffer,8192,out returned),"ELECTRON_PID_LIST");int assigned=Marshal.ReadInt32(buffer),count=Marshal.ReadInt32(buffer,4);
            Require(count>=12&&count<=32&&assigned==count,"ELECTRON_HELD_COUNT");
            for(int i=0;i<count;i++){
                long raw=Marshal.ReadIntPtr(buffer,8+i*IntPtr.Size).ToInt64();Require(raw>0&&raw<=uint.MaxValue,"ELECTRON_PID_RANGE");
                IntPtr h=OpenProcess(Query|Synchronize,false,(uint)raw);Require(h!=IntPtr.Zero,"ELECTRON_HOLD_PROCESS");held.Add(h);
                Require(Member(h,safety)&&WaitForSingleObject(h,0)==258,"ELECTRON_HELD_NOT_LIVE");var image=new StringBuilder(32768);uint size=32768;Require(QueryFullProcessImageNameW(h,0,image,ref size),"ELECTRON_HELD_IMAGE");
                string value=image.ToString();Require(string.Equals(value,electron,StringComparison.OrdinalIgnoreCase)||string.Equals(value,Assembly.GetExecutingAssembly().Location,StringComparison.OrdinalIgnoreCase)||string.Equals(value,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe"),StringComparison.OrdinalIgnoreCase),"ELECTRON_UNEXPECTED_IMAGE:"+value);
            }return held;
        }catch{foreach(IntPtr h in held)CloseHandle(h);throw;}finally{Marshal.FreeHGlobal(buffer);}
    }
    static int ElectronStudy(bool negative,string directory) {
        IntPtr safety=IntPtr.Zero,a=IntPtr.Zero,b=IntPtr.Zero;var workers=new List<ProcessInfo>();var held=new List<IntPtr>();var age=Stopwatch.StartNew();int code=1;
        var result=new Dictionary<string,object>{{"status","FAILED"},{"admitted",false},{"negative",negative},{"fixtureImage",Assembly.GetExecutingAssembly().Location},{"systemConhostImage",Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe")}};
        try {
            string configPath=Path.Combine(directory,"study-config.json");Require(new FileInfo(configPath).Length<65536,"ELECTRON_CONFIG_SIZE");var config=ConptyJson.Deserialize<Dictionary<string,object>>(File.ReadAllText(configPath));
            string electron=(string)config["electron"],script=(string)config["script"],package=(string)config["packagePath"];result["electronImage"]=electron;
            safety=NewJob();a=NewJob();b=NewJob();var before=new Dictionary<string,object>();var pids=new Dictionary<string,object>();var roots=new Dictionary<string,object>();var readyRows=new Dictionary<string,object>();
            foreach(string label in new[]{"A","B"}){
                bool expected=!(negative&&label=="A");IntPtr session=label=="A"?a:b;string sub=Path.Combine(directory,label);Directory.CreateDirectory(sub);
                File.WriteAllText(Path.Combine(sub,"electron-config.json"),ConptyJson.Serialize(new Dictionary<string,object>{{"fixture",Assembly.GetExecutingAssembly().Location},{"packagePath",package}}),new UTF8Encoding(false));
                var child=ElectronSpawn(electron,script,sub,expected?new[]{safety,session}:new[]{safety});workers.Add(child);
                Require(Member(child.process,safety)&&Member(child.process,session)==expected&&!Member(child.process,label=="A"?b:a),"ELECTRON_WORKER_NOT_ATOMIC");before[label]=Member(child.process,session);pids[label]=child.pid;
                Require(ResumeThread(child.thread)!=uint.MaxValue,"ELECTRON_RESUME");string readyPath=Path.Combine(sub,"electron-ready.json");
                while(!File.Exists(readyPath)&&age.ElapsedMilliseconds<8000&&WaitForSingleObject(child.process,0)==258)Thread.Sleep(5);
                Require(File.Exists(readyPath)&&age.ElapsedMilliseconds<8000&&new FileInfo(readyPath).Length<65536,"ELECTRON_WORKER_READY_DEADLINE");
                var ready=ConptyJson.Deserialize<Dictionary<string,object>>(File.ReadAllText(readyPath));Require(Convert.ToUInt32(ready["workerPid"])==child.pid,"ELECTRON_READY_IDENTITY");readyRows[label]=ready;roots[label]=ready["rootPid"];
                WaitReady(sub);
            }
            result["workerBeforeResume"]=before;result["workerPids"]=pids;result["rootPids"]=roots;result["workers"]=readyRows;
            var fixedA=ConptyFixtures(Path.Combine(directory,"A"));var fixedB=ConptyFixtures(Path.Combine(directory,"B"));result["fixturePids"]=new Dictionary<string,object>{{"A",fixedA},{"B",fixedB}};
            Require(Convert.ToUInt32(roots["A"])==fixedA[0]&&Convert.ToUInt32(roots["B"])==fixedB[0],"ELECTRON_ROOT_IDENTITY");
            held=ElectronHold(safety,electron);Require(Active(safety)==held.Count,"ELECTRON_SAFETY_SET_INCOMPLETE");result["hostActiveBefore"]=Active(safety);result["before"]=ConptyStates(held,a,b,true);
            var seen=new HashSet<uint>();foreach(IntPtr h in held){uint n=GetProcessId(h);Require(seen.Add(n),"ELECTRON_DUPLICATE_HANDLE");var m=ConptyMembership[n];Require(negative?!m[0]:m[0]!=m[1],"ELECTRON_UNCONTAINED_MEMBER");}
            foreach(uint n in fixedA)Require(seen.Contains(n)&&ConptyMembership[n][0]==!negative&&!ConptyMembership[n][1],"ELECTRON_A_FIXTURE");foreach(uint n in fixedB)Require(seen.Contains(n)&&!ConptyMembership[n][0]&&ConptyMembership[n][1],"ELECTRON_B_FIXTURE");
            Require(seen.Contains(workers[0].pid)&&seen.Contains(workers[1].pid),"ELECTRON_WORKERS_MISSING");
            var stop=Stopwatch.StartNew();Require(TerminateJobObject(a,77),"ELECTRON_STOP_A");
            if(negative){while(stop.ElapsedMilliseconds<2000)Thread.Sleep(5);}else{
                WaitEmpty(a);result["sessionActiveAfterStop"]=Active(a);var waits=new List<object>();result["stopWaits"]=waits;
                foreach(IntPtr h in held)if(ConptyMembership[GetProcessId(h)][0]){long remaining=3000-stop.ElapsedMilliseconds;Require(remaining>0,"ELECTRON_STOP_GLOBAL_DEADLINE");uint initial=WaitForSingleObject(h,0),final=WaitForSingleObject(h,(uint)remaining),exit;waits.Add(new Dictionary<string,object>{{"pid",GetProcessId(h)},{"initialWait",initial},{"finalWait",final},{"elapsedMs",stop.ElapsedMilliseconds}});Require(final==0&&GetExitCodeProcess(h,out exit)&&exit==77,"ELECTRON_STOP_NOT_CAUSAL");}
            }
            foreach(IntPtr h in held)if(negative||ConptyMembership[GetProcessId(h)][1])Require(WaitForSingleObject(h,0)==258,"ELECTRON_B_ISOLATION");
            result["after"]=ConptyStates(held,a,b,false);result["stopMs"]=stop.ElapsedMilliseconds;result["fixtureAgeMs"]=age.ElapsedMilliseconds;Require(stop.ElapsedMilliseconds<3000&&age.ElapsedMilliseconds<11000,"ELECTRON_NATURAL_DEADLINE");
            result["status"]=negative?"EXPECTED_ELECTRON_BROKER_ASSIGNMENT_REFUSED":"ELECTRON_NODE_PTY_BROKER_OBSERVED_NOT_ADMITTED";code=negative?1:0;
        }catch(Exception e){result["error"]=e.Message;result["status"]="FAILED";}
        finally{
            try{if(safety!=IntPtr.Zero){Require(TerminateJobObject(safety,98),"ELECTRON_SAFETY_STOP");Exited(held);WaitEmpty(safety);result["cleanup"]=new Dictionary<string,object>{{"verified",true},{"active",Active(safety)},{"held",ConptyStates(held,a,b,false)}};}}
            catch(Exception e){result["cleanupError"]=e.Message;result["status"]="FAILED";code=1;}
            foreach(IntPtr h in held)CloseHandle(h);foreach(var w in workers){if(w.thread!=IntPtr.Zero)CloseHandle(w.thread);if(w.process!=IntPtr.Zero)CloseHandle(w.process);}if(a!=IntPtr.Zero)CloseHandle(a);if(b!=IntPtr.Zero)CloseHandle(b);if(safety!=IntPtr.Zero)CloseHandle(safety);
            string json=ConptyJson.Serialize(result);File.WriteAllText(Path.Combine(directory,"native-result.json"),json,new UTF8Encoding(false));Console.WriteLine(json);
        }return code;
    }
    static int Main(string[] args) {
        try{if(args.Length!=2||!Path.IsPathRooted(args[1]))return 2;if(args[0]=="electron-positive"||args[0]=="electron-negative")return ElectronStudy(args[0]=="electron-negative",args[1]);Console.WriteLine("SIREN_NATIVE_FIXED_READY");return Fixture(args[0],args[1]);}
        catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}
    }
}
