import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deriveRosterDiagnostic} from './native/derive-terminal-roster-diagnostic.mjs';
const original=()=>readFileSync(new URL('./fixtures/terminal-host-roster-pre-exit-fix.cc',import.meta.url));
test('diagnostic derivative retains source around the two explicit observation sites',()=>{
 const before=original(),text=before.toString('utf8'),derived=deriveRosterDiagnostic(before);
 const start=text.indexOf('bool HostExactExited('),end=text.indexOf('bool HostCaptureCurrentMembers(',start);
 assert(derived.startsWith(text.slice(0,start).replace('#include <windows.h>','#include <windows.h>\n#include <cstdio>')));
 assert(derived.endsWith(text.slice(text.indexOf('  for(const auto& m:p->held)if(!HostExactExited(m,dead))'))));
 assert(derived.includes(text.slice(end,text.indexOf('  if(!Active(p,active)||!HostExactExited(p->root,dead))'))));
 for(const step of ['pid','times','birth','image-query','image-match','wait','exit-code','job-accounting'])assert(derived.includes('"'+step+'"'),step);
 assert.equal((derived.match(/TerminateJobObject\(/g)||[]).length,(text.match(/TerminateJobObject\(/g)||[]).length);
 assert.deepEqual(original(),before);
});
test('diagnostic derivation refuses any input drift before generating output',()=>{
 const wrong=original();wrong[0]^=1;
 assert.throws(()=>deriveRosterDiagnostic(wrong),/DIAGNOSTIC_BASE_REFUSED/);
 assert.throws(()=>deriveRosterDiagnostic(Buffer.alloc(0)),/DIAGNOSTIC_BASE_REFUSED/);
});
