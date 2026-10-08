// New finite normal-shell observer extension; historical base stays unchanged.
using System;
using System.Collections.Generic;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
internal static partial class TerminalMainOwnerObserver {
 static List<Held> HoldNormal(IntPtr job,string electron,string shell,long minimumCreation) {
  var held=new List<Held>();IntPtr buffer=Marshal.AllocHGlobal(8192);
  try {
   uint returned;Require(QueryInformationJobObject(job,3,buffer,8192,out returned),"NORMAL_JOB_SET_UNKNOWN");
   int assigned=Marshal.ReadInt32(buffer),count=Marshal.ReadInt32(buffer,4);Require(assigned==count&&count>=4&&count<=48,"NORMAL_JOB_SET_REFUSED");
   var unique=new HashSet<uint>();
   for(int i=0;i<count;i++){
    long value=Marshal.ReadIntPtr(buffer,8+i*IntPtr.Size).ToInt64();Require(value>0&&value<=uint.MaxValue&&unique.Add((uint)value),"NORMAL_DUPLICATE_PID");
    IntPtr process=OpenProcess(Query|Synchronize,false,(uint)value);Require(process!=IntPtr.Zero,"NORMAL_OPEN_FAILED");
    try {
     Require(Member(process,job)&&WaitForSingleObject(process,0)==258,"NORMAL_NOT_LIVE_MEMBER");var p=Identity(process,(uint)value);Require(long.Parse(p.created)>=minimumCreation,"NORMAL_OLD_IDENTITY");
     string conhost=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"conhost.exe");
     Require(string.Equals(p.image,electron,StringComparison.OrdinalIgnoreCase)||string.Equals(p.image,shell,StringComparison.OrdinalIgnoreCase)||string.Equals(p.image,conhost,StringComparison.OrdinalIgnoreCase),"NORMAL_IMAGE_REFUSED");
     held.Add(p);process=IntPtr.Zero;
    }finally{if(process!=IntPtr.Zero)CloseHandle(process);}
   }
   Require(Active(job)==count,"NORMAL_ACCOUNTING_CHANGED");return held;
  }catch{foreach(var p in held)CloseHandle(p.handle);throw;}finally{Marshal.FreeHGlobal(buffer);}
 }
 static int Main(string[] args) {
  if(args.Length!=4)return 2;foreach(string path in args)if(!Path.IsPathRooted(path))return 2;
  string electron=args[0],application=args[1],directory=args[2],shell=args[3];
  IntPtr safety=IntPtr.Zero;ProcessInfo main=new ProcessInfo();var held=new List<Held>();var age=Stopwatch.StartNew();int code=1;
  var result=new Dictionary<string,object>{{"admitted",false},{"status","FAILED"}};
  try {
   safety=NewJob();main=Spawn(electron,application,directory,new[]{safety},true,false);Require(Member(main.process,safety),"NORMAL_MAIN_ATOMIC_SAFETY");
   var identity=Identity(main.process,main.pid);result["main"]=identity.Observe();Require(ResumeThread(main.thread)==1,"NORMAL_MAIN_RESUME");
   string readyPath=Path.Combine(directory,"normal-safety-ready.json");while(!File.Exists(readyPath)&&age.ElapsedMilliseconds<12000){Require(WaitForSingleObject(main.process,0)==258,"NORMAL_MAIN_EXITED_EARLY");Thread.Sleep(5);}Require(File.Exists(readyPath),"NORMAL_READY_DEADLINE");
   Require(new FileInfo(readyPath).Length<=65536,"NORMAL_READY_SIZE");var ready=Map(Json.DeserializeObject(File.ReadAllText(readyPath,new UTF8Encoding(false,true))));Require(Pid(ready["mainPid"])==main.pid,"NORMAL_MAIN_IDENTITY_MISMATCH");
   held=HoldNormal(safety,electron,shell,long.Parse(identity.created));var expected=Array(ready["held"]);Require(held.Count>=expected.Length+1,"NORMAL_HELD_COUNT_MISMATCH");var seen=new HashSet<uint>();
   foreach(var value in expected){var r=Map(value);uint pid=Pid(r["pid"]);Require(pid!=main.pid&&seen.Add(pid),"NORMAL_READY_DUPLICATE");var h=Find(held,pid);Require(h.created==Convert.ToString(r["createdFileTime"])&&string.Equals(h.image,Convert.ToString(r["image"]),StringComparison.OrdinalIgnoreCase),"NORMAL_HELD_IDENTITY_MISMATCH");}
   Require(Find(held,main.pid).created==identity.created,"NORMAL_MAIN_HELD_MISMATCH");result["before"]=Observe(held);result["safetyHeldBeforeGo"]=true;
   File.WriteAllText(Path.Combine(directory,"normal-safety-go.request"),"go",new UTF8Encoding(false));
   Require(WaitForSingleObject(main.process,15000)==0,"NORMAL_MAIN_COMPLETION_DEADLINE");uint exit;Require(GetExitCodeProcess(main.process,out exit)&&exit==0,"NORMAL_MAIN_FAILED");
   var wait=Stopwatch.StartNew();for(;;){bool all=true;foreach(var h in held)all=all&&WaitForSingleObject(h.handle,0)==0;if(all&&Active(safety)==0)break;Require(wait.ElapsedMilliseconds<3000,"NORMAL_HELD_EXIT_DEADLINE");Thread.Sleep(5);}
   Require(age.ElapsedMilliseconds<25000,"NORMAL_WHOLE_DEADLINE");result["after"]=Observe(held);result["safetyOpenAtObservation"]=true;result["activeBeforeSafetyCleanup"]=0;result["ageMs"]=age.ElapsedMilliseconds;result["status"]="NORMAL_SAFETY_OBSERVED_NOT_ADMITTED";code=0;
  }catch(Exception e){result["error"]=e.Message;}
  finally {
   try{if(safety!=IntPtr.Zero){Require(TerminateJobObject(safety,98),"NORMAL_SAFETY_CLEANUP");var wait=Stopwatch.StartNew();for(;;){bool all=true;foreach(var h in held)all=all&&WaitForSingleObject(h.handle,0)==0;if(all&&Active(safety)==0)break;Require(wait.ElapsedMilliseconds<3000,"NORMAL_CLEANUP_SURVIVOR");Thread.Sleep(5);}result["cleanupVerified"]=true;}}
   catch(Exception e){result["cleanupError"]=e.Message;result["status"]="FAILED";code=1;}
   foreach(var h in held)CloseHandle(h.handle);if(main.thread!=IntPtr.Zero)CloseHandle(main.thread);if(main.process!=IntPtr.Zero)CloseHandle(main.process);if(safety!=IntPtr.Zero)CloseHandle(safety);
   File.WriteAllText(Path.Combine(directory,"observer-result.json"),Json.Serialize(result),new UTF8Encoding(false));Console.WriteLine(Json.Serialize(result));
  }return code;
 }
}
