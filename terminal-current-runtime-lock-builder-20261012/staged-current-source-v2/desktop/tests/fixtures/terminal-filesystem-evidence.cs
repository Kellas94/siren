// Disposable hosted qualification helper. Never installed or run locally/product.
// Reads actual Windows HANDLE identities and attributes; never executes a path.
// Repeated handle reads do not establish race-free relative path traversal.
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

static class TerminalFilesystemEvidence {
 [StructLayout(LayoutKind.Sequential)] struct FileInfo {
  public uint Attributes,CreationLow,CreationHigh,AccessLow,AccessHigh,WriteLow,WriteHigh;
  public uint VolumeSerial,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle handle,out FileInfo info);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle,StringBuilder output,uint length,uint flags);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetSystemDirectoryW(StringBuilder output,uint length);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern uint GetDriveTypeW(string root);
 const uint Reparse=0x400,Directory=0x10;
 sealed class Held : IDisposable {
  public SafeFileHandle Handle; public FileInfo Before; public string Canonical;
  public void Dispose(){if(Handle!=null)Handle.Dispose();}
 }
 static void Require(bool condition,string code){if(!condition)throw new InvalidOperationException(code);}
 static string Local(string value){
  Require(value!=null&&value.Length>=3&&value.Length<32768,"FS_LOCAL_PATH_REQUIRED");value=value.Replace('/','\\');
  Require(Regex.IsMatch(value,@"^[A-Za-z]:\\")&&value.IndexOf(':',2)<0,"FS_LOCAL_PATH_REQUIRED");
  string[] parts=value.Substring(3).Split('\\');
  foreach(string part in parts)Require(part.Length>0&&part!="."&&part!=".."&&!Regex.IsMatch(part,@"[<>:""|?*\x00-\x1f\x7f]|[. ]$|~\d")&&!Regex.IsMatch(part,@"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)",RegexOptions.IgnoreCase),"FS_AMBIGUOUS_COMPONENT");
  string result=Path.GetFullPath(value);Require(String.Equals(result,value,StringComparison.OrdinalIgnoreCase),"FS_PATH_ALIAS");return result;
 }
 static string Canonical(SafeFileHandle handle){
  StringBuilder buffer=new StringBuilder(32768);uint count=GetFinalPathNameByHandleW(handle,buffer,(uint)buffer.Capacity,0);
  Require(count>0&&count<buffer.Capacity,"FS_CANONICAL_QUERY_FAILED");string result=buffer.ToString();
  Require(result.StartsWith(@"\\?\",StringComparison.Ordinal)&&Regex.IsMatch(result.Substring(4),@"^[A-Za-z]:\\"),"FS_CANONICAL_LOCAL_REQUIRED");
  result=result.Substring(4);return result.Length==3?result:result.TrimEnd('\\');
 }
 static string Identity(FileInfo info){return info.VolumeSerial.ToString("x8")+":"+info.IndexHigh.ToString("x8")+info.IndexLow.ToString("x8");}
 static Held Open(string requested,bool directory){
  Held held=new Held();try{
   held.Handle=CreateFileW(requested,0x80,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
   Require(!held.Handle.IsInvalid,"FS_OPEN_FAILED");Require(GetFileInformationByHandle(held.Handle,out held.Before),"FS_IDENTITY_QUERY_FAILED");
   Require((held.Before.Attributes&Reparse)==0,"FS_REPARSE_REFUSED");Require(((held.Before.Attributes&Directory)!=0)==directory,"FS_TYPE_REFUSED");
   held.Canonical=Canonical(held.Handle);Require(String.Equals(held.Canonical,requested,StringComparison.OrdinalIgnoreCase),"FS_CANONICAL_ALIAS");return held;
  }catch{held.Dispose();throw;}
 }
 static Dictionary<string,object> Ancestor(Held held){return new Dictionary<string,object>{{"path",held.Canonical},{"identity",Identity(held.Before)},{"directory",true},{"reparse",false}};}
 static object Capture(string input,bool directory){
  string selected=Local(input),root=Path.GetPathRoot(selected);Require(GetDriveTypeW(root)==3,"FS_FIXED_DRIVE_REQUIRED");
  List<Held> held=new List<Held>();List<object> ancestors=new List<object>();
  try{
   string parent=directory?selected:Path.GetDirectoryName(selected);string[] parts=parent.Substring(root.Length).Split(new char[]{'\\'},StringSplitOptions.RemoveEmptyEntries);string cursor=root;
   Held item=Open(cursor,true);held.Add(item);ancestors.Add(Ancestor(item));
   foreach(string part in parts){cursor=Path.Combine(cursor,part);item=Open(cursor,true);held.Add(item);ancestors.Add(Ancestor(item));}
   Held leaf=directory?held[held.Count-1]:Open(selected,false);if(!directory)held.Add(leaf);
   foreach(Held handle in held){FileInfo current;Require(GetFileInformationByHandle(handle.Handle,out current),"FS_RECHECK_FAILED");Require(Identity(current)==Identity(handle.Before)&&current.Attributes==handle.Before.Attributes&&Canonical(handle.Handle)==handle.Canonical,"FS_SNAPSHOT_CHANGED");}
   Dictionary<string,object> result=new Dictionary<string,object>{{"canonicalPath",leaf.Canonical},{"identity",Identity(leaf.Before)},{"reparse",false},{"ancestors",ancestors}};result.Add(directory?"directory":"file",true);return result;
  }finally{foreach(Held handle in held)handle.Dispose();}
 }
 static int Main(string[] args){
  Console.OutputEncoding=new UTF8Encoding(false);
  try{
   object result;
   if(args.Length==1&&args[0]=="system"){
    StringBuilder output=new StringBuilder(32768);uint count=GetSystemDirectoryW(output,(uint)output.Capacity);Require(count>3&&count<output.Capacity,"FS_SYSTEM_DIRECTORY_FAILED");result=Local(output.ToString());
   }else{Require(args.Length==2&&(args[0]=="directory"||args[0]=="file"),"FS_ARGUMENTS_REFUSED");result=Capture(args[1],args[0]=="directory");}
   Console.WriteLine(new JavaScriptSerializer().Serialize(result));return 0;
  }catch(Exception error){string code=error is InvalidOperationException?error.Message:"FS_CAPTURE_FAILED";Console.Error.WriteLine(code);return 2;}
 }
}
