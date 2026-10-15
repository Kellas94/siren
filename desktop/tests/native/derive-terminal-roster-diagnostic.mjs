// Test-only diagnostic derivative. Original native candidate remains unchanged.
// This reports the refusing Win32 observation; it never bypasses a refusal.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export function deriveRosterDiagnostic(bytes){
 if(!Buffer.isBuffer(bytes)||createHash('sha256').update(bytes).digest('hex')!=='18259d597bceed360ed7408e6f65fc6870d6edf80f447bb30803c0ad2928637f')throw Error('DIAGNOSTIC_BASE_REFUSED');
 const source=bytes.toString('utf8'),start=source.indexOf('bool HostExactExited('),end=source.indexOf('bool HostCaptureCurrentMembers(',start);
 if(start<0||end<=start)throw Error('DIAGNOSTIC_SITE_REFUSED');
 const replacement=`// DIAGNOSTIC DERIVATIVE ONLY: one fixed case-local observation file.
bool HostDiagnosticFailure(const char* step,DWORD pid,DWORD error,bool win32Valid){
 FILE* log=_wfopen(L"native-diagnostic.txt",L"w");
 if(log){fprintf(log,"step=%s pid=%lu win32=%lu win32-valid=%u\\n",step,static_cast<unsigned long>(pid),static_cast<unsigned long>(error),win32Valid?1u:0u);fclose(log);}
 return false;
}
bool HostExactExited(const Member& m,bool& dead){
 if(!m.process.h)return HostDiagnosticFailure("handle",m.pid,0,false);
 DWORD actualPid=GetProcessId(m.process.h);if(!actualPid)return HostDiagnosticFailure("pid-query",m.pid,GetLastError(),true);
 if(actualPid!=m.pid)return HostDiagnosticFailure("pid",m.pid,0,false);
 FILETIME c,e,k,u;if(!GetProcessTimes(m.process.h,&c,&e,&k,&u))return HostDiagnosticFailure("times",m.pid,GetLastError(),true);
 if(Ticks(c)!=m.created)return HostDiagnosticFailure("birth",m.pid,0,false);
 wchar_t image[32768];DWORD length=32768;
 if(!QueryFullProcessImageNameW(m.process.h,0,image,&length))return HostDiagnosticFailure("image-query",m.pid,GetLastError(),true);
 if(length!=m.image.size()||CompareStringOrdinal(image,static_cast<int>(length),m.image.c_str(),static_cast<int>(m.image.size()),TRUE)!=CSTR_EQUAL)return HostDiagnosticFailure("image-match",m.pid,0,false);
 DWORD state=WaitForSingleObject(m.process.h,0),code=0;
 if(state!=WAIT_OBJECT_0&&state!=WAIT_TIMEOUT)return HostDiagnosticFailure("wait",m.pid,state==WAIT_FAILED?GetLastError():0,state==WAIT_FAILED);
 if(!GetExitCodeProcess(m.process.h,&code))return HostDiagnosticFailure("exit-code",m.pid,GetLastError(),true);
 dead=dead&&state==WAIT_OBJECT_0;return true;
}
`;
 const originalCheck='  if(!Active(p,active)||!HostExactExited(p->root,dead)){work->error="HOST_EXIT_UNVERIFIED";return;}';
 if(source.split(originalCheck).length!==2)throw Error('DIAGNOSTIC_JOB_SITE_REFUSED');
 return (source.slice(0,start)+replacement+source.slice(end)).replace('#include <windows.h>','#include <windows.h>\n#include <cstdio>').replace(originalCheck,'  if(!Active(p,active)){HostDiagnosticFailure("job-accounting",p->root.pid,GetLastError(),true);work->error="HOST_EXIT_UNVERIFIED";return;}\n  if(!HostExactExited(p->root,dead)){work->error="HOST_EXIT_UNVERIFIED";return;}');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==4)throw Error('FIXED_DIAGNOSTIC_INPUT_OUTPUT_REQUIRED');
 writeFileSync(process.argv[3],deriveRosterDiagnostic(readFileSync(process.argv[2])),{flag:'wx'});
}
