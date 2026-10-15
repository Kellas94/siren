// Finite preparation tests only. No provider, Electron, shell or native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {currentLockFixture,syntheticFourJoinObservation} from './terminal-current-runtime-lock-test-fixture.mjs';
const scenario=await import('./terminal-current-runtime-lock.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const closure=await import('./terminal-current-runtime-lock-sources.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('current running-Lock preparation exists without executing or loading a native provider',()=>{
 assert.equal(typeof scenario.runCurrentRuntimeLockScenario,'function');
 assert.equal(typeof scenario.discoverCurrentRuntimeLock,'function');
 assert.equal(typeof closure.planCurrentRuntimeLockSources,'function');
});
test('current closure includes current catalogue owner and PIN owner, never a historical execution overlay',async()=>{
 assert.equal(typeof closure.planCurrentRuntimeLockSources,'function');
 const root=resolve(import.meta.dirname,'../../..');
 const plan=await closure.planCurrentRuntimeLockSources(p=>readFile(resolve(root,p)));
 for(const p of ['desktop/src/terminal/shutdown-graph.mjs','desktop/src/terminal/profile-catalogue-owner.mjs','desktop/src/terminal/production-manager.mjs','desktop/src/terminal/pin-lifecycle-owner.mjs','desktop/src/account/pin-lifecycle.mjs','desktop/tests/native/terminal-session-command.mjs'])assert(plan.files.some(r=>r.path===p),p);
 assert.equal(plan.historicalOverlays,false);assert.equal(plan.nativeExecutionAdmitted,false);
 assert(plan.files.every(r=>!r.path.includes('/execution/')));
});
test('actual current authority classes discover, run original fixture, fence synchronously, retain history and freshly reattach the same session',async()=>{
 const h=await currentLockFixture();try{
  const options=await h.prepare(scenario.discoverCurrentRuntimeLock);
  const result=await scenario.runCurrentRuntimeLockScenario(options);
  assert.equal(result.status,'CURRENT_RUNNING_LOCK_OBSERVED_NOT_ADMITTED');assert.equal(result.nativeExecutionAdmitted,false);assert.equal(result.actualPinUiProof,false);
  assert.equal(h.composition.state.spawns.length,1);assert.deepEqual(h.composition.state.writes,[h.fixture.input]);assert.equal(h.files.has(h.fixture.forbiddenPath),false);
  assert(h.trace.indexOf('started')<h.trace.indexOf('prepare'));assert(h.trace.indexOf('inert-completion-while-locked')<h.trace.indexOf('unlocked'));assert(h.trace.indexOf('completed-while-locked')<h.trace.indexOf('unlocked'));
  assert.equal(h.composition.state.trace.filter(r=>r.name==='native-stop').length,1);
 }finally{await h.dispose();}
});
test('private preinput refusal dispatches no command and does not rewrite or release fixture',async()=>{
 const h=await currentLockFixture({refuseInput:true});try{await assert.rejects(scenario.runCurrentRuntimeLockScenario(await h.prepare(scenario.discoverCurrentRuntimeLock)),/CURRENT_LOCK_PREINPUT_REFUSED/);assert.equal(h.composition.state.writes.length,0);assert.equal(h.files.size,0);}finally{await h.dispose();}
});
test('revoked permit continuation dispatches no command',async()=>{
 const h=await currentLockFixture({revokedPermit:true});try{await assert.rejects(scenario.runCurrentRuntimeLockScenario(await h.prepare(scenario.discoverCurrentRuntimeLock)),/CURRENT_LOCK_PERMIT_REVOKED/);assert.equal(h.composition.state.writes.length,0);}finally{await h.dispose();}
});
test('malformed private held-session boundary refuses BEFORE input, waits, release and Stop',async()=>{
 const live={pid:42,image:'C:\\powershell.exe',createdFileTime:'1234',alive:true};
 for(const beforeSession of [undefined,null,{}, {root:{}},{shell:{}},{root:{},shell:{}},...['root','shell'].flatMap(key=>[p=>p.pid=0,p=>p.pid=1.5,p=>p.image='',p=>p.createdFileTime='0',p=>p.createdFileTime='0123',p=>p.alive=false].map(mutate=>{const s={root:{...live},shell:{...live,pid:84}};mutate(s[key]);return s;}))]){
  const h=await currentLockFixture();try{
   const o=await h.prepare(scenario.discoverCurrentRuntimeLock);let waits=0;
   o.beforeInput=async()=>({inputAuthorized:true,isCurrent:()=>true,beforeSession});o.io.waitFile=async()=>{waits++;throw Error('WAIT_MUST_NOT_ENTER');};
   await assert.rejects(scenario.runCurrentRuntimeLockScenario(o),/HELD_PREINPUT_SESSION_REQUIRED/);
   assert.equal(h.composition.state.writes.length,0);assert.equal(waits,0);assert.equal(h.files.size,0);assert.equal(h.composition.state.trace.filter(r=>r.name==='native-stop').length,0);
  }finally{await h.dispose();}
 }
});
test('changed running-process identity after Lock remains adverse and cannot release command',async()=>{
 const h=await currentLockFixture();try{const o=await h.prepare(scenario.discoverCurrentRuntimeLock),read=o.observeRunning;let count=0;o.observeRunning=async()=>{const r=await read();if(++count>1)r.session.shell.createdFileTime='9999';return r;};await assert.rejects(scenario.runCurrentRuntimeLockScenario(o),/RUNNING_SESSION_IDENTITY_CHANGED/);assert.equal(h.files.has(h.fixture.releasePath),false);assert.equal(h.state.locked,true);}finally{await h.dispose();}
});
test('original fixture wait failure remains adverse, with no automatic unlock or substitute command',async()=>{
 const h=await currentLockFixture();try{const o=await h.prepare(scenario.discoverCurrentRuntimeLock);const original=o.io.waitFile;o.io.waitFile=async(p,v)=>{if(p===h.fixture.completedPath)throw Error('FIXTURE_FILE_DEADLINE');return original(p,v);};await assert.rejects(scenario.runCurrentRuntimeLockScenario(o),/FIXTURE_FILE_DEADLINE/);assert.equal(h.state.locked,true);assert.equal(h.members.access.currentRouter(),null);assert.deepEqual(h.composition.state.writes,[h.fixture.input]);}finally{await h.dispose();}
});
test('missing mandatory backend marker cannot qualify completion or trigger unlock',async()=>{
 const h=await currentLockFixture({omitMarker:true});try{await assert.rejects(scenario.runCurrentRuntimeLockScenario(await h.prepare(scenario.discoverCurrentRuntimeLock)),/LOCKED_BACKEND_HISTORY_MARKER_MISSING/);assert.equal(h.state.locked,true);assert.equal(h.trace.includes('unlocked'),false);}finally{await h.dispose();}
});
test('all original cleanup assertions remain literally identical apart from exported name',async()=>{
 const worker=await readFile(new URL('./terminal-system-seeded-worker.mjs',import.meta.url),'utf8'),target=await readFile(new URL('./terminal-current-runtime-lock-cleanup.mjs',import.meta.url),'utf8');
 const original=worker.slice(worker.indexOf('function identityKey(value){'),worker.indexOf('// INERT_HELPERS_END'));
 assert.equal(target.slice(target.indexOf('function identityKey(value){')).replace('export function assertCurrentRuntimeLockCleanup(observation){','function assertCleanupObservation(observation){'),original);
});
test('synthetic cleanup consistency does not grant native admission; each original join falsifier fails',async()=>{
 const {assertCurrentRuntimeLockCleanup}=await import('./terminal-current-runtime-lock-cleanup.mjs');assert.doesNotThrow(()=>assertCurrentRuntimeLockCleanup(syntheticFourJoinObservation()));
 for(const change of [o=>o.graph.actualSettled=false,o=>o.sessionReceipts[0].snapshot.shell.alive=true,o=>o.hostReceipt.closed=false,o=>o.external.after[0].createdFileTime='9999',o=>o.utilityExit=0,o=>o.expected.pop()]){const o=syntheticFourJoinObservation();change(o);assert.throws(()=>assertCurrentRuntimeLockCleanup(o));}
});
test('exact current source plan detects source drift and missing transitive imports',async()=>{
 const root=resolve(import.meta.dirname,'../../..'),read=p=>readFile(resolve(root,p)),plan=await closure.planCurrentRuntimeLockSources(read);
 assert.equal((await closure.verifyCurrentRuntimeLockSources(plan,read)).ok,true);
 await assert.rejects(closure.verifyCurrentRuntimeLockSources(plan,async p=>p.endsWith('/profile-catalogue-owner.mjs')?Buffer.concat([await read(p),Buffer.from('\n// drift\n')]):read(p)),/CURRENT_LOCK_SOURCE_DRIFT/);
 await assert.rejects(closure.planCurrentRuntimeLockSources(async p=>{if(p.endsWith('/contracts.mjs'))throw Error('MISSING_CURRENT_IMPORT');return read(p);}),/MISSING_CURRENT_IMPORT/);
});
test('current materialization copies exact planned bytes only and refuses drift before the first write',async()=>{
 assert.equal(typeof closure.materializeCurrentRuntimeLockSources,'function');
 const root=resolve(import.meta.dirname,'../../..'),read=p=>readFile(resolve(root,p)),plan=await closure.planCurrentRuntimeLockSources(read),written=new Map();
 await closure.materializeCurrentRuntimeLockSources(plan,read,async(p,b)=>written.set(p,Buffer.from(b)));
 assert.equal(written.size,plan.files.length+plan.resources.length);
 for(const row of [...plan.files,...plan.resources])assert.deepEqual(written.get(row.path),await read(row.path));
 written.clear();await assert.rejects(closure.materializeCurrentRuntimeLockSources(plan,async p=>p.endsWith('/profile-catalogue-owner.mjs')?Buffer.concat([await read(p),Buffer.from('\n// refused drift\n')]):read(p),async(p,b)=>written.set(p,b)),/CURRENT_LOCK_SOURCE_DRIFT/);assert.equal(written.size,0);
 assert.equal(plan.requireResources.binariesQualified,false);assert.equal(plan.generatedHost.packagedHostQualified,false);assert.equal(plan.resources.length,8);
});
