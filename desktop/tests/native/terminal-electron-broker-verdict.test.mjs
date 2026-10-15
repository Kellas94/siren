import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {isElectronBrokerObserved,isExpectedElectronBrokerRefusal} from './terminal-electron-broker-verdict.mjs';

export function sample(negative=false){
 const r={status:negative?'EXPECTED_ELECTRON_BROKER_ASSIGNMENT_REFUSED':'ELECTRON_NODE_PTY_BROKER_OBSERVED_NOT_ADMITTED',negative,admitted:false,fixtureImage:'C:\\fixed.exe',electronImage:'C:\\electron.exe',systemConhostImage:'C:\\Windows\\System32\\conhost.exe',workerBeforeResume:{A:!negative,B:true},workerPids:{A:1,B:2},fixturePids:{A:[3,4,5,6],B:[7,8,9,10]},rootPids:{A:3,B:7},fixtureAgeMs:negative?2600:600,stopMs:negative?2001:10,sessionActiveAfterStop:0,workers:{},before:[],after:[],cleanup:{verified:true,active:0,held:[]},stopWaits:[]};
 for(const label of ['A','B'])r.workers[label]={workerPid:r.workerPids[label],rootPid:r.rootPids[label],runtime:{electron:'44.5.1',node:'24.21.0',modules:'149',napi:'10',arch:'x64',platform:'win32'},nodePty:'1.1.0',osConpty:true,useConptyDll:false,windowsRelease:'10.0.26100',receivedBytes:25,retainedBytes:25,inputWrites:0,rssBytes:40000000,helperListObserved:true,helperExitCode:0,helperPid:label==='A'?20:21,consolePids:[r.rootPids[label]]};
 for(let n=1;n<=12;n++){const a=n===1||(n>=3&&n<=6)||n===11;r.before.push({pid:n,image:n<=2?r.electronImage:n<=10?r.fixtureImage:r.systemConhostImage,createdFileTime:String(1000+n),alive:true,exitCode:259,inA:a&&!negative,inB:!a});}
 r.hostActiveBefore=r.before.length;r.after=r.before.map(p=>({...p,...(!negative&&p.inA?{alive:false,exitCode:77}:{})}));r.cleanup.held=r.before.map(p=>({...p,alive:false,exitCode:!negative&&p.inA?77:98}));r.stopWaits=r.before.filter(p=>p.inA).map(p=>({pid:p.pid,initialWait:258,finalWait:0,elapsedMs:9}));return r;
}
test('actual runtime, node-pty, bounded drain and held identity are required together',()=>assert.equal(isElectronBrokerObserved(sample()),true));
test('omitted A assignment must remain live for two seconds and clean up exactly',()=>{assert.equal(isExpectedElectronBrokerRefusal(sample(true)),true);assert.equal(isElectronBrokerObserved(sample(true)),false);});
test('incomplete containment, wrong runtime, writes and missing helper evidence refuse',()=>{
 for(const mutate of [r=>r.before[10].inA=false,r=>r.after[1].alive=false,r=>r.cleanup.held[0].exitCode=98,r=>r.workers.A.runtime.modules='148',r=>r.workers.B.runtime.electron='44.0.0',r=>r.workers.A.nodePty='1.0.0',r=>r.workers.A.inputWrites=1,r=>r.workers.A.receivedBytes=0,r=>r.workers.A.retainedBytes=4194305,r=>r.workers.A.helperListObserved=false,r=>r.workers.A.consolePids=[999],r=>r.workers.A.workerPid=99,r=>r.before[0].image=r.fixtureImage,r=>r.after[0].createdFileTime='99999',r=>r.stopWaits.pop(),r=>r.stopMs=3000,r=>r.fixtureAgeMs=11000,r=>r.admitted=true]){const r=sample();mutate(r);assert.equal(isElectronBrokerObserved(r),false);}
});
test('negative exact deadline and cleanup remain mandatory',()=>{for(const mutate of [r=>r.stopMs=1999,r=>r.before[0].inA=true,r=>r.cleanup.active=1,r=>r.after[2].alive=false]){const r=sample(true);mutate(r);assert.equal(isExpectedElectronBrokerRefusal(r),false);}});
test('upstream timeout fallback cannot count as observed helper completion',()=>{const r=sample();r.workers.A.helperExitCode=99;assert.equal(isElectronBrokerObserved(r),false);});
test('requested OS ConPTY is insufficient without observed platform and DLL refusal',()=>{
 for(const mutate of [r=>r.workers.A.useConptyDll=true,r=>delete r.workers.B.useConptyDll,r=>r.workers.A.windowsRelease='10.0.18308',r=>delete r.workers.A.windowsRelease,r=>r.workers.B.osConpty=false]){const r=sample();mutate(r);assert.equal(isElectronBrokerObserved(r),false);}
});
test('worker script cannot create an arbitrary shell or send input',async()=>{
 const source=await readFile(new URL('./terminal-electron-broker-worker.mjs',import.meta.url),'utf8');
 assert.match(source,/useConptyDll:\s*false/);assert.match(source,/useConpty:\s*true/);assert.doesNotMatch(source,/term\.(?:write|kill|pause)\s*\(/);assert.match(source,/_getConsoleProcessList/);
});
