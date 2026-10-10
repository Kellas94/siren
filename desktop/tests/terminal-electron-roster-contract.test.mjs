import test from 'node:test';
import assert from 'node:assert/strict';
import {electronRosterAbiPassed} from './native/terminal-electron-roster-contract.mjs';
const hash='a'.repeat(64),other='b'.repeat(64);
// Explicit synthetic DATA, not a native observation.
const sample=()=>({scope:'ELECTRON_ROSTER_ABI_ONLY',nativeExecutionAdmitted:false,exitObserved:true,exitCode:0,outerDeadlineExceeded:false,
 build:{status:'COMPILED_ELECTRON_TARGET_NOT_RUNTIME_QUALIFIED',target:'44.5.1',arch:'x64',napi:10,delayLoadHook:true,hook:{bytes:2048,sha256:hash},binary:{bytes:249344,sha256:hash},sourceSha256:'d7014c6401e4e1186f3180a7377594cd044b16a84006a0ef38d6b6903c366fdd',includeSha256:'aa4ccd3428a1c547a5e8dccc1116ebab45a3be6972c1229903db36c5081be476'},
 executable:{bytes:204800,sha256:other},addonReadbackSha256:hash,runtimeReadbackSha256:other,
 native:{status:'ABI_PAIR_PASSED',hostExitObserved:true,hostExitCode:0,deadlineExceeded:false,
 main:{status:'ABI_CONTEXT_PASSED',role:'main',pid:123,runtime:{electron:'44.5.1',modules:'149',napi:'10',arch:'x64',platform:'win32',electronRunAsNode:false},addonSha256:hash,executableSha256:other,exportsChecked:30,markSamples:2048,markMonotonic:true,forgedRefusals:9,getterCalls:0},
 utility:{status:'ABI_CONTEXT_PASSED',role:'utility',pid:124,runtime:{electron:'44.5.1',modules:'149',napi:'10',arch:'x64',platform:'win32',electronRunAsNode:false},addonSha256:hash,executableSha256:other,exportsChecked:30,markSamples:2048,markMonotonic:true,forgedRefusals:9,getterCalls:0}}});
test('fixed synthetic main/utility target pair passes narrow ABI gate',()=>assert.equal(electronRosterAbiPassed(sample()),true));
const mutations={
 'Node target build cannot become Electron proof':r=>r.build.target='24.16.0',
 'missing delay load hook':r=>r.build.delayLoadHook=false,
 'empty hook pin':r=>r.build.hook.bytes=0,
 'old candidate source':r=>r.build.sourceSha256=other,
 'changed peer include':r=>r.build.includeSha256=other,
 'wrong actual addon':r=>r.native.utility.addonSha256=other,
 'changed addon after test':r=>r.addonReadbackSha256=other,
 'changed executable after test':r=>r.runtimeReadbackSha256=hash,
 'different Electron':r=>r.native.main.runtime.electron='44.5.0',
 'Node impersonating main':r=>r.native.main.runtime.electronRunAsNode=true,
 'wrong ABI':r=>r.native.utility.runtime.modules='137',
 'wrong NAPI':r=>r.native.utility.runtime.napi='9',
 'same process reported twice':r=>r.native.utility.pid=r.native.main.pid,
 'swapped roles':r=>r.native.utility.role='main',
 'unobserved host exit':r=>r.native.hostExitObserved=false,
 'failed host exit':r=>r.native.hostExitCode=1,
 'deadline followed by zero exit':r=>r.outerDeadlineExceeded=true,
 'getter executed while refusing handle':r=>r.native.main.getterCalls=1,
 'incomplete refusal controls':r=>r.native.main.forgedRefusals=8,
 'unknown process exit':r=>r.exitObserved=false,
 'admission misrepresented':r=>r.nativeExecutionAdmitted=true,
 'missing runtime':r=>delete r.native.utility.runtime,
 'missing context':r=>delete r.native.main,
 'wrong context failure':r=>r.native.utility.status='FAILED'
};
for(const [name,mutate]of Object.entries(mutations))test(name,()=>{const r=sample();mutate(r);assert.equal(electronRosterAbiPassed(r),false);});
test('absent or malformed data fails closed',()=>{for(const r of [null,undefined,{},[],0,'PASS'])assert.equal(electronRosterAbiPassed(r),false);});
