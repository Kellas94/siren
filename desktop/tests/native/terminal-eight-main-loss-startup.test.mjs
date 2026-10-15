// Actual generated main orchestration against inert FS/native/time doubles only.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import path from 'node:path';import {readFile} from 'node:fs/promises';import {control} from './terminal-session-composition-test-fixture.mjs';import {eightMainControl} from './terminal-eight-main-loss-test-fixture.mjs';import {deriveEightMainLossRunner} from './terminal-eight-main-loss-derive.mjs';const desktop=new URL('../../',import.meta.url),runner=await readFile(new URL('tests/native/terminal-composition-eight.mjs',desktop),'utf8');
async function timeoutSeam(failAbort=false){
 let source=deriveEightMainLossRunner({runner,desktop});
 source=source.slice(source.indexOf('async function main(config){'),source.indexOf('\ntry{\n const paths='));
 for(const name of ['electron','node:module','node:fs/promises','node:path','node:timers/promises'])source=source.replaceAll("await import('"+name+"')",'seams['+JSON.stringify(name)+']');
 source=source.replaceAll("(await import('node:assert/strict')).default",'seams.assert').replaceAll('import.meta.url',"'inert-source-seam'");
 assert.doesNotMatch(source,/\bimport\s*\(/);
 let now=0,reads=0;const events=[],owners=[],host={pid:10},base=control(),groups=eightMainControl().ready.groups;
 const root={...groups[0].before.root,pid:10},members=[root,...groups.flatMap(g=>g.before.held)];
 const snapshot=o=>{const s=structuredClone(groups[o.index].before);if(o.stopped){s.active=0;for(const p of s.held){p.alive=false;p.exitCode=98;}s.root=s.held[0];s.shell=s.held[1];}return s;};
 const native={mark:()=>0,start:()=>host,createSession:()=>{if(owners.length===8)throw Object.assign(Error('capacity'),{code:'SESSION_CAPACITY_REFUSED'});const o={index:owners.length};owners.push(o);return o;},watchRoot:(o,p,image)=>{if(image.endsWith('.wrong'))throw Object.assign(Error('wrong'),{code:'SESSION_ROOT_IDENTITY_REFUSED'});},snapshotSession:snapshot,captureSession:snapshot,capture:()=>({active:members.length,root,held:members}),captureCompositionHost:()=>({active:members.length,root,held:members}),
  snapshot:o=>o===host?{active:host.stopped?0:owners.length?members.length:1,root:{...root,alive:!host.stopped,exitCode:host.stopped?98:259},held:members.map(p=>({...p,alive:!host.stopped,exitCode:host.stopped?98:259}))}:snapshot(o),
  stopSession:(o,code)=>{o.stopped=true;events.push({kind:'stop',code});},closeSession:()=>true,stop:()=>{host.stopped=true;},close:()=>true};
 const seams={assert,'electron':{app:{setPath(){},async whenReady(){},exit:code=>events.push({kind:'exit',code})},utilityProcess:{fork:()=>({pid:10,on:(kind,fn)=>{if(kind==='message')fn({kind:'hello',pid:10});},postMessage(){}})}},'node:module':{createRequire:()=>()=>native},'node:path':path,'node:timers/promises':{setTimeout:async()=>{now+=5;}},'node:fs/promises':{
  mkdir:async()=>{},writeFile:async(p)=>{if(p.endsWith('composition-first-ready.json.pending'))events.push({kind:'ready'});if(p.endsWith('composition-main-loss-abort.json.pending')){events.push({kind:'abort-attempt'});if(failAbort)throw Error('INERT_ABORT_WRITE_FAILED');}},
  rename:async(p)=>{if(p.endsWith('composition-main-loss-abort.json.pending'))events.push({kind:'abort-committed'});},
  readFile:async p=>{const label=path.basename(path.dirname(p)),g=groups['ABCDEFGH'.indexOf(label)];if(p.endsWith('creator-bootstrap.json'))throw Object.assign(Error('absent'),{code:'ENOENT'});if(p.endsWith('electron-ready.json'))return JSON.stringify(g.ready);for(const k of ['root','branch','grandchild','detached'])if(p.endsWith(path.sep+k+'.ready'))return String(g.fixturePids[k]);if(p.endsWith('composition-first-go.request')){reads++;throw Object.assign(Error('absent'),{code:'ENOENT'});}throw Error('Unexpected inert path '+p);}
 }};
 const VirtualDate=class extends Date{static now(){return now;}};
 const fn=vm.runInNewContext('('+source+')',{seams,Date:VirtualDate,globalThis:{},setTimeout:()=>1,clearTimeout:()=>{},process:{pid:1,versions:base.runtime,arch:'x64',platform:'win32',hrtime:{bigint:()=>BigInt(now)*1000000n}}});
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
 assert.deepEqual(events.filter(e=>e.kind==='stop').map(e=>e.code),Array(8).fill(98));
});
test('failed abort publication parks main without cleanup or app exit',async()=>{
 const {events,settled}=await timeoutSeam(true);assert.ok(events.some(e=>e.kind==='abort-attempt'));
 assert.equal(settled,false);assert.equal(events.some(e=>['stop','exit','abort-committed'].includes(e.kind)),false);
});
