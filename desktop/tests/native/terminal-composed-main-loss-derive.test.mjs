import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {control} from './terminal-session-composition-test-fixture.mjs';
import {deriveComposedMainLossRunner,deriveComposedMainLossBuilder,deriveComposedMainLossHost} from './terminal-composed-main-loss-derive.mjs';
import {deriveSessionComposition} from './terminal-session-composition-derive.mjs';
const desktop=new URL('../../',import.meta.url);
const read=p=>readFile(new URL(p,desktop),'utf8');
const runner=await read('tests/native/terminal-session-composition.mjs'),builder=await read('tests/native/build-terminal-session-composition.mjs');
test('derives first-ready and armed abort protocol while preserving the original experiment',()=>{
 const derived=deriveComposedMainLossRunner({runner,desktop});
 assert.match(derived,/hostSnapshot,groups:owned,runtime:result.runtime,negative:config.negative,fixtureAgeMs:Date.now\(\)-age/);
 const main=s=>s.slice(s.indexOf('async function main('),s.indexOf('\ntry{\n const paths='));
 const expected=main(runner).replace('{mainPid:process.pid,held:hostSnapshot.held}','{mainPid:process.pid,held:hostSnapshot.held,hostSnapshot,groups:owned,runtime:result.runtime,negative:config.negative,fixtureAgeMs:Date.now()-age}')
  .replace('let hostOwner,host,hostClosed=false;','let hostOwner,host,hostClosed=false,mainLossArmed=false;')
  .replace("  await persist(join(config.output,'composition-'+label+'-ready.json')","  if(label==='first')mainLossArmed=true;\n  await persist(join(config.output,'composition-'+label+'-ready.json')")
  .replace('}catch(e){result.error={code:e.code,message:e.message,stack:e.stack};result.failureSnapshots=[];',"}catch(e){if(mainLossArmed){try{await persist(join(config.output,'composition-main-loss-abort.json'),{status:'ABORTED',message:e.message});}catch{await new Promise(()=>{});}}result.error={code:e.code,message:e.message,stack:e.stack};result.failureSnapshots=[];");
 assert.equal(main(derived),expected);
 assert.match(derived,/receipt.ready=JSON.parse/);assert.doesNotMatch(derived,/receipt.native=JSON.parse/);
});
test('changed original runner or builder bytes are refused',()=>{
 assert.throws(()=>deriveComposedMainLossRunner({runner:runner+'\n',desktop}),/MAIN_LOSS_RUNNER_DRIFT/);
 assert.throws(()=>deriveComposedMainLossBuilder({builder:builder+'\n',desktop}),/MAIN_LOSS_BUILDER_DRIFT/);
});
test('negative build switches kill-on-close at both native ownership levels only',async()=>{
 const native=deriveSessionComposition({host:await read('tests/fixtures/terminal-host-guard/host.cc'),fixture:await read('tests/fixtures/terminal-job-list.cs'),extension:await read('tests/fixtures/terminal-session-composition.inc')}).host;
 const derived=deriveComposedMainLossHost(native);
 assert.equal(derived.split('#ifndef SIREN_TEST_DISABLE_COMPOSED_KILL_ON_CLOSE').length-1,2);
 const flag='limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;';
 assert.equal(derived.replaceAll('\n#ifndef SIREN_TEST_DISABLE_COMPOSED_KILL_ON_CLOSE\n'+flag+'\n#endif\n',flag),native);
 assert.throws(()=>deriveComposedMainLossHost(native+'\n'),/MAIN_LOSS_NATIVE_DRIFT/);
});
test('separate builder preserves graph binding and runs both new controls',()=>{
 const derived=deriveComposedMainLossBuilder({builder,desktop});
 assert.match(derived,/SIREN_TEST_DISABLE_COMPOSED_KILL_ON_CLOSE=1/);
 assert.doesNotMatch(derived,/SIREN_TEST_DISABLE_SESSION_ROOT_MONITOR=1/);
 assert.match(derived,/disabled-both-kill-on-close-control/);
 assert.match(derived,/composed-abrupt-main-loss-control/);
 assert.match(derived,/recheckTerminalCandidateGraph/);
});
test('generated program records its own source relative to desktop before joining paths',()=>{
 for(const [kind,source,derive] of [['paths',runner,deriveComposedMainLossRunner],['names',builder,deriveComposedMainLossBuilder]]){
  const generated=derive({[kind==='paths'?'runner':'builder']:source,desktop});
  const expression=generated.match(new RegExp('const '+kind+'=(\\[[^;]+\\]);'))[1].replaceAll('import.meta.url','"inert-generated-url"');
  const base='C:\\SIREN\\desktop\\',child='evidence\\owned-derived\\program.mjs';
  const paths=vm.runInNewContext(expression,{desktop:base,fileURLToPath:()=>base+child});
  assert.equal(paths[0],child,'source capture must not join an absolute path onto desktop twice');
 }
});

// Owner adaptation of the independent reviewer's actual-function inert seam.
// Real derived main text runs against virtual time and data only; no entrypoint,
// Electron, addon, process spawn, compiler or native API is imported/executed.
async function timeoutSeam(failAbort=false){
 let source=deriveComposedMainLossRunner({runner,desktop});
 source=source.slice(source.indexOf('async function main(config){'),source.indexOf('\ntry{\n const paths='));
 for(const name of ['electron','node:module','node:fs/promises','node:path','node:timers/promises'])source=source.replaceAll("await import('"+name+"')",'seams['+JSON.stringify(name)+']');
 source=source.replaceAll("(await import('node:assert/strict')).default",'seams.assert').replaceAll('import.meta.url',"'inert-source-seam'");
 assert.doesNotMatch(source,/\bimport\s*\(/);
 let now=0,reads=0;const events=[],owners=[],host={pid:10},base=control(),groups=base.groups.slice(0,2);
 const root={...groups[0].before.root,pid:10},members=[root,...groups.flatMap(g=>g.before.held)];
 const snapshot=o=>{const s=structuredClone(groups[o.index].before);if(o.stopped){s.active=0;for(const p of s.held){p.alive=false;p.exitCode=98;}s.root=s.held[0];s.shell=s.held[1];}return s;};
 const native={mark:()=>0,start:()=>host,createSession:()=>{const o={index:owners.length};owners.push(o);return o;},watchRoot:(o,p,image)=>{if(image.endsWith('.wrong'))throw Object.assign(Error('wrong'),{code:'SESSION_ROOT_IDENTITY_REFUSED'});},snapshotSession:snapshot,captureSession:snapshot,capture:()=>({active:members.length,root,held:members}),
  snapshot:o=>o===host?{active:host.stopped?0:owners.length?members.length:1,root:{...root,alive:!host.stopped,exitCode:host.stopped?98:259},held:members.map(p=>({...p,alive:!host.stopped,exitCode:host.stopped?98:259}))}:snapshot(o),
  stopSession:(o,code)=>{o.stopped=true;events.push({kind:'stop',code});},closeSession:()=>true,stop:()=>{host.stopped=true;},close:()=>true};
 const seams={assert,'electron':{app:{setPath(){},async whenReady(){},exit:code=>events.push({kind:'exit',code})},utilityProcess:{fork:()=>({pid:10,on:(kind,fn)=>{if(kind==='message')fn({kind:'hello',pid:10});},postMessage(){}})}},'node:module':{createRequire:()=>()=>native},'node:path':path,'node:timers/promises':{setTimeout:async()=>{now+=5;}},'node:fs/promises':{
  mkdir:async()=>{},writeFile:async(p)=>{if(p.endsWith('composition-first-ready.json.pending'))events.push({kind:'ready'});if(p.endsWith('composition-main-loss-abort.json.pending')){events.push({kind:'abort-attempt'});if(failAbort)throw Error('INERT_ABORT_WRITE_FAILED');}},
  rename:async(p)=>{if(p.endsWith('composition-main-loss-abort.json.pending'))events.push({kind:'abort-committed'});},
  readFile:async p=>{const g=groups[p.includes(path.sep+'B'+path.sep)?1:0];if(p.endsWith('electron-ready.json'))return JSON.stringify(g.ready);for(const k of ['root','branch','grandchild','detached'])if(p.endsWith(path.sep+k+'.ready'))return String(g.fixturePids[k]);if(p.endsWith('composition-first-go.request')){reads++;throw Object.assign(Error('absent'),{code:'ENOENT'});}throw Error('Unexpected inert path '+p);}
 }};
 const VirtualDate=class extends Date{static now(){return now;}};
 const fn=vm.runInNewContext('('+source+')',{seams,Date:VirtualDate,globalThis:{},setTimeout:()=>1,clearTimeout:()=>{},process:{pid:1,versions:base.runtime,arch:'x64',platform:'win32'}});
 let settled=false;const execution=fn({output:'C:/inert',addon:'inert.node',fixture:'C:/fixture.exe',packagePath:'inert.json',electron:'C:/electron.exe',creator:'creator.mjs',hostEntry:'host.mjs',negative:false}).then(()=>{settled=true;});
 // Enough microtasks for virtual polling; no elapsed/native deadline is waited.
 await new Promise(resolve=>setImmediate(resolve));
 if(!failAbort)await execution;
 assert.ok(events.some(e=>e.kind==='ready'));assert.equal(reads,601);assert.equal(now,3005);
 return {events,settled};
}
test('actual derived timeout commits abort before any main cleanup',async()=>{
 const {events,settled}=await timeoutSeam();assert.equal(settled,true);
 const committed=events.findIndex(e=>e.kind==='abort-committed'),stopped=events.findIndex(e=>e.kind==='stop');
 assert.ok(committed>=0,'armed timeout must publish an abort');assert.ok(stopped>committed,'no cleanup before committed abort');
 assert.deepEqual(events.filter(e=>e.kind==='stop').map(e=>e.code),[98,98]);
});
test('failed abort publication parks main without cleanup or app exit',async()=>{
 const {events,settled}=await timeoutSeam(true);assert.ok(events.some(e=>e.kind==='abort-attempt'));
 assert.equal(settled,false);assert.equal(events.some(e=>['stop','exit','abort-committed'].includes(e.kind)),false);
});
test('observer binds abort absence after main101 and bounds total age around observation',async()=>{
 const s=await read('tests/fixtures/terminal-composed-main-loss-observer.cs');
 assert.ok(s.indexOf('MAIN_LOSS_ABORT_MARKED')>s.indexOf('MAIN_LOSS_MAIN_EXIT_NOT_CAUSAL'));
 assert.match(s,/result\["mainAgeMs"\]=age.ElapsedMilliseconds/);
 assert.ok(s.indexOf('MAIN_LOSS_TOTAL_AGE_EXCEEDED')<s.indexOf('TerminateProcess(main.process,101)'));
 assert.ok(s.lastIndexOf('MAIN_LOSS_TOTAL_AGE_EXCEEDED')>s.indexOf('result["after"]=Observe(held)'));
});
test('actual observer pending-exit rule waits for held handles after Job accounting reaches zero',async()=>{
 const s=await read('tests/fixtures/terminal-composed-main-loss-observer.cs');
 const body=s.match(/static bool PendingExit\(uint active,bool allHeldExited\)\s*\{\s*return ([^;]+);\s*\}/);
 assert.ok(body,'shared native exit condition must include accounting and held handles');
 const pending=vm.runInNewContext('(active,allHeldExited)=>('+body[1]+')');
 assert.equal(pending(0,false),true,'actual CI failure: accounting empty while at least one held handle remains live');
 assert.equal(pending(1,true),true);assert.equal(pending(1,false),true);assert.equal(pending(0,true),false);
 assert.match(s,/while\(PendingExit\(Active\(safety\),AllHeldExited\(held\)\)&&observation.ElapsedMilliseconds<3000\)/);
 assert.match(s,/while\(PendingExit\(Active\(safety\),AllHeldExited\(held\)\)&&cleanup.ElapsedMilliseconds<3000\)/);
});
