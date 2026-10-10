import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deriveFixedRosterDiagnostic} from './native/derive-terminal-roster-fixed-diagnostic.mjs';
const bytes=readFileSync(new URL('../native/terminal-host-roster-candidate/ownership.cc',import.meta.url));
test('fixed diagnostic refuses unknown bytes before output',()=>{for(const b of [null,'source',Buffer.concat([bytes,Buffer.from('\n')])])assert.throws(()=>deriveFixedRosterDiagnostic(b),/FIXED_DIAGNOSTIC_BASE_REFUSED/);});
test('fixed diagnostic preserves all source outside explicit observation functions and accounting check',()=>{
 const s=bytes.toString(),d=deriveFixedRosterDiagnostic(bytes),start=s.indexOf('bool HostExactExited('),end=s.indexOf('bool HostDeadline(');
 assert(d.startsWith(s.slice(0,start).replace('#include <windows.h>','#include <windows.h>\n#include <cstdio>')));
 const tail=s.slice(end).replace('  if(!Active(p,active)||!HostExactExited(p->root,dead)){work->error="HOST_EXIT_UNVERIFIED";return;}','  if(!Active(p,active)){HostDiagnosticFailure("job-accounting",p->root.pid,GetLastError(),true);work->error="HOST_EXIT_UNVERIFIED";return;}\n  if(!HostExactExited(p->root,dead)){work->error="HOST_EXIT_UNVERIFIED";return;}');
 assert(d.endsWith(tail));
 for(const step of ['image-failure-second-wait','image-match','capture-list-mismatch','capture-open','capture-read-identity'])assert(d.includes('"'+step+'"'));
 assert.equal((d.match(/TerminateJobObject\(/g)||[]).length,(s.match(/TerminateJobObject\(/g)||[]).length);
 assert.deepEqual(bytes,readFileSync(new URL('../native/terminal-host-roster-candidate/ownership.cc',import.meta.url)));
});
