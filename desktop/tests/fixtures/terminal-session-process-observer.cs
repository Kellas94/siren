// Independent finite observer: exact existing HANDLE identities, no process launch or kill.
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Globalization;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
class TerminalSessionProcessObserver {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint GetProcessId(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr handle,out long created,out long exited,out long kernel,out long user);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool QueryFullProcessImageNameW(IntPtr handle,uint flags,StringBuilder path,ref uint length);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
 class Held { public uint pid;public IntPtr handle;public string image;public string created; }
 static void Require(bool ok,string message){if(!ok)throw new Exception(message+":"+Marshal.GetLastWin32Error());}
 static Dictionary<string,object> Observe(Held held){uint state=WaitForSingleObject(held.handle,0),code;Require(state==0||state==258,"WAIT_FAILED");Require(GetExitCodeProcess(held.handle,out code),"EXIT_CODE_FAILED");return new Dictionary<string,object>{{"pid",held.pid},{"image",held.image},{"createdFileTime",held.created},{"wait",state},{"exitCode",code}};}
 static void Save(string path,object value,JavaScriptSerializer json){using(var stream=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.Read))using(var writer=new StreamWriter(stream,new UTF8Encoding(false)))writer.Write(json.Serialize(value)+"\n");}
 static int Main(string[] args){var json=new JavaScriptSerializer();var held=new List<Held>();var result=new Dictionary<string,object>{{"scope","EXACT_HELD_PROCESS_EXIT_OBSERVER"},{"status","FAILED"},{"nativeExecutionAdmitted",false},{"productActivation",false}};string output=null;var age=Stopwatch.StartNew();int exit=2;
  try{
   Require(args.Length==3&&args[0]=="capture","ARGUMENTS_REFUSED");output=Path.GetFullPath(args[1]);Require(Path.IsPathRooted(args[1])&&Path.IsPathRooted(args[2]),"ABSOLUTE_PATH_REQUIRED");
   var rows=json.DeserializeObject(File.ReadAllText(args[2],Encoding.UTF8)) as object[];Require(rows!=null&&rows.Length>0&&rows.Length<=64,"IDENTITY_ROWS_REFUSED");var seen=new HashSet<uint>();
   foreach(object value in rows){var row=value as Dictionary<string,object>;Require(row!=null&&row.Count==3&&row.ContainsKey("pid")&&row.ContainsKey("image")&&row.ContainsKey("createdFileTime"),"IDENTITY_SHAPE_REFUSED");uint pid;Require(uint.TryParse(Convert.ToString(row["pid"],CultureInfo.InvariantCulture),NumberStyles.None,CultureInfo.InvariantCulture,out pid)&&pid>0&&seen.Add(pid),"PID_REFUSED");string expectedImage=row["image"] as string,expectedTime=row["createdFileTime"] as string;long parsed;Require(!String.IsNullOrEmpty(expectedImage)&&Path.IsPathRooted(expectedImage)&&long.TryParse(expectedTime,NumberStyles.None,CultureInfo.InvariantCulture,out parsed)&&parsed>0,"IDENTITY_REFUSED");
    IntPtr handle=OpenProcess(0x1000|0x100000,false,pid);Require(handle!=IntPtr.Zero,"OPEN_FAILED");var member=new Held{pid=pid,handle=handle};held.Add(member);
    Require(GetProcessId(handle)==pid&&WaitForSingleObject(handle,0)==258,"NOT_LIVE_EXPECTED_PROCESS");long created,ended,kernel,user;Require(GetProcessTimes(handle,out created,out ended,out kernel,out user),"TIMES_FAILED");member.created=created.ToString(CultureInfo.InvariantCulture);var image=new StringBuilder(32768);uint length=32768;Require(QueryFullProcessImageNameW(handle,0,image,ref length),"IMAGE_FAILED");member.image=image.ToString();Require(member.created==expectedTime&&String.Equals(member.image,expectedImage,StringComparison.OrdinalIgnoreCase),"IDENTITY_MISMATCH");
   }
   var before=new List<object>();foreach(var member in held){var observed=Observe(member);Require((uint)observed["wait"]==258,"EXIT_BEFORE_READY");before.Add(observed);}result["before"]=before;
   Console.WriteLine(json.Serialize(new Dictionary<string,object>{{"status","READY"},{"identities",before}}));Console.Out.Flush();var wait=Stopwatch.StartNew();
   while(true){bool all=true;foreach(var member in held){uint state=WaitForSingleObject(member.handle,0);Require(state==0||state==258,"WAIT_FAILED");all&=state==0;}if(all)break;Require(wait.ElapsedMilliseconds<45000,"EXIT_DEADLINE_EXCEEDED");Thread.Sleep(10);}
   var after=new List<object>();foreach(var member in held)after.Add(Observe(member));result["after"]=after;result["waitMs"]=wait.ElapsedMilliseconds;result["status"]="EXACT_HELD_PROCESSES_EXITED";exit=0;
  }catch(Exception error){result["error"]=error.Message;Console.Error.WriteLine(error.Message);}
  finally{result["elapsedMs"]=age.ElapsedMilliseconds;foreach(var member in held)CloseHandle(member.handle);if(output!=null)try{Save(output,result,json);}catch(Exception error){Console.Error.WriteLine("RESULT_WRITE_FAILED:"+error.Message);exit=2;}}
  return exit;
 }
}
