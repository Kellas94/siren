// Test-only exact-source diagnostic derivative; no original native file mutation.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export function deriveFixedRosterDiagnostic(bytes){
 if(!Buffer.isBuffer(bytes)||createHash('sha256').update(bytes).digest('hex')!=='6029d0f9d507db518198534c0946e4149d8ed15a1c244d97ce0427429cf70781')throw Error('FIXED_DIAGNOSTIC_BASE_REFUSED');
 const source=bytes.toString('utf8'),start=source.indexOf('bool HostExactExited('),end=source.indexOf('bool HostCaptureCurrentMembers(',start);
 if(start<0||end<=start)throw Error('FIXED_DIAGNOSTIC_SITE_REFUSED');
 const replacement=String.raw`// DIAGNOSTIC ONLY: preserve each original refusal and record its actual step.
bool HostDiagnosticFailure(const char* step,DWORD pid,DWORD error,bool win32Valid,DWORD observed=0){
 FILE* log=_wfopen(L"native-diagnostic.txt",L"a");
 if(log){fprintf(log,"step=%s pid=%lu win32=%lu win32-valid=%u observed=%lu\n",step,static_cast<unsigned long>(pid),static_cast<unsigned long>(error),win32Valid?1u:0u,static_cast<unsigned long>(observed));fclose(log);}
 return false;
}
bool HostExactExited(const Member& m,bool& dead){
 if(!m.process.h)return HostDiagnosticFailure("handle",m.pid,0,false);
 if(m.image.empty())return HostDiagnosticFailure("captured-image-empty",m.pid,0,false);
 DWORD actualPid=GetProcessId(m.process.h);if(!actualPid)return HostDiagnosticFailure("pid-query",m.pid,GetLastError(),true);
 if(actualPid!=m.pid)return HostDiagnosticFailure("pid-mismatch",m.pid,0,false,actualPid);
 FILETIME c,e,k,u;if(!GetProcessTimes(m.process.h,&c,&e,&k,&u))return HostDiagnosticFailure("times",m.pid,GetLastError(),true);
 if(Ticks(c)!=m.created)return HostDiagnosticFailure("birth",m.pid,0,false);
 DWORD state=WaitForSingleObject(m.process.h,0),code=0;
 if(state!=WAIT_OBJECT_0&&state!=WAIT_TIMEOUT)return HostDiagnosticFailure("wait",m.pid,state==WAIT_FAILED?GetLastError():0,state==WAIT_FAILED,state);
 if(!GetExitCodeProcess(m.process.h,&code))return HostDiagnosticFailure("exit-code",m.pid,GetLastError(),true);
 if(state==WAIT_OBJECT_0)return true;
 wchar_t image[32768];DWORD length=32768;
 if(!QueryFullProcessImageNameW(m.process.h,0,image,&length)){
  DWORD imageError=GetLastError(),secondState=WaitForSingleObject(m.process.h,0);
  if(secondState!=WAIT_OBJECT_0)return HostDiagnosticFailure("image-failure-second-wait",m.pid,imageError,true,secondState);
  if(!GetExitCodeProcess(m.process.h,&code))return HostDiagnosticFailure("race-exit-code",m.pid,GetLastError(),true);
  return true;
 }
 if(length!=m.image.size())return HostDiagnosticFailure("image-length",m.pid,0,false,length);
 if(CompareStringOrdinal(image,static_cast<int>(length),m.image.c_str(),static_cast<int>(m.image.size()),TRUE)!=CSTR_EQUAL)return HostDiagnosticFailure("image-match",m.pid,0,false);
 dead=false;return true;
}
`;
 let result=(source.slice(0,start)+replacement+source.slice(end)).replace('#include <windows.h>','#include <windows.h>\n#include <cstdio>');
 const changes=[
  ['if(!QueryInformationJobObject(p->job.h,JobObjectBasicProcessIdList,list,sizeof(buffer),nullptr)||list->NumberOfAssignedProcesses!=list->NumberOfProcessIdsInList||list->NumberOfProcessIdsInList>128)return false;', 'if(!QueryInformationJobObject(p->job.h,JobObjectBasicProcessIdList,list,sizeof(buffer),nullptr))return HostDiagnosticFailure("capture-job-list",p->root.pid,GetLastError(),true);\n if(list->NumberOfAssignedProcesses!=list->NumberOfProcessIdsInList)return HostDiagnosticFailure("capture-list-mismatch",p->root.pid,0,false,list->NumberOfAssignedProcesses);\n if(list->NumberOfProcessIdsInList>128)return HostDiagnosticFailure("capture-list-bound",p->root.pid,0,false,list->NumberOfProcessIdsInList);'],
  ['if(!raw||raw>0xFFFFFFFF)return false;DWORD pid=', 'if(!raw||raw>0xFFFFFFFF)return HostDiagnosticFailure("capture-pid",p->root.pid,0,false);DWORD pid='],
  ['if(p->held.size()>=128)return false;Member m;', 'if(p->held.size()>=128)return HostDiagnosticFailure("capture-held-bound",p->root.pid,0,false);Member m;'],
  ['if(!m.process.h||!MemberOf(m.process.h,p->job.h)||!ReadIdentity(m))return false;', 'if(!m.process.h)return HostDiagnosticFailure("capture-open",pid,GetLastError(),true);\n  if(!MemberOf(m.process.h,p->job.h))return HostDiagnosticFailure("capture-membership",pid,0,false);\n  if(!ReadIdentity(m))return HostDiagnosticFailure("capture-read-identity",pid,0,false);'],
  ['  if(!Active(p,active)||!HostExactExited(p->root,dead)){work->error="HOST_EXIT_UNVERIFIED";return;}', '  if(!Active(p,active)){HostDiagnosticFailure("job-accounting",p->root.pid,GetLastError(),true);work->error="HOST_EXIT_UNVERIFIED";return;}\n  if(!HostExactExited(p->root,dead)){work->error="HOST_EXIT_UNVERIFIED";return;}'],
 ];
 for(const [from,to]of changes){if(result.split(from).length!==2)throw Error('FIXED_DIAGNOSTIC_ANCHOR_REFUSED');result=result.replace(from,to);}
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==4)throw Error('FIXED_DIAGNOSTIC_INPUT_OUTPUT_REQUIRED');
 writeFileSync(process.argv[3],deriveFixedRosterDiagnostic(readFileSync(process.argv[2])),{flag:'wx'});
}
