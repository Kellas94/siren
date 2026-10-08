// Pure execution of the actual runner seams; no addon/child process execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./terminal-session-composition.mjs',import.meta.url),'utf8');
const match=source.match(/const exited=(.*);/);assert.ok(match);
const exited=vm.runInNewContext(match[1]);
test('pre-capture zero job accounting cannot close a still-live creator',()=>{
 assert.equal(exited({active:0,held:[],root:{alive:true},shell:false}),false);
});
test('cleanup waits for the independently held shell as well as creator',()=>{
 assert.equal(exited({active:0,held:[],root:{alive:false},shell:{alive:true}}),false);
});
test('cleanup accepts only a fully exited captured or pre-capture session',()=>{
 assert.equal(exited({active:0,held:[],root:{alive:false},shell:false}),true);
 assert.equal(exited({active:0,held:[{alive:false}],root:{alive:false},shell:{alive:false}}),true);
 assert.equal(exited({active:1,held:[],root:{alive:false},shell:false}),false);
 assert.equal(exited({active:0,held:[{alive:true}],root:{alive:false},shell:false}),false);
});
async function bootstrap(failure){
 const start=source.indexOf('async function creator('),end=source.indexOf('async function main(',start);
 assert.ok(start>=0&&end>start,'MISSING_CREATOR_BOUNDARY_DIAGNOSTIC');
 const writes=[],mockImport=async name=>{
  if(name==='node:fs/promises')return {writeFile:async(path,data,options)=>{assert.equal(options.flag,'wx');writes.push({path,value:JSON.parse(data)});}};
  if(name==='node:path')return {join:(...p)=>p.join('/')};
  assert.equal(name,'fixed-worker.mjs');if(failure)throw failure;return {};
 };
 let error;try{await vm.runInNewContext(source.slice(start,end).replaceAll('import(', 'mockImport(')+'\ncreator("fixed-worker.mjs","fixed-output");',{mockImport,process:{pid:12,argv:['electron.exe','creator.mjs','fixed-output'],versions:{electron:'test'},env:{ELECTRON_RUN_AS_NODE:'1'}}});}catch(e){error=e;}
 return {writes,error};
}
test('creator records entry before importing the unchanged worker',async()=>{
 const {writes,error}=await bootstrap();assert.equal(error,undefined);assert.equal(writes.length,1);assert.equal(writes[0].value.status,'CREATOR_JS_ENTERED_NOT_QUALIFIED');assert.equal(writes[0].value.pid,12);
});
test('creator preserves static-import or top-level worker errors before its own catch',async()=>{
 const failure=Object.assign(Error('INERT_STATIC_IMPORT_REFUSED'),{code:'ERR_INERT'});
 const {writes,error}=await bootstrap(failure);assert.equal(error,failure);assert.equal(writes.length,2);assert.equal(writes[1].value.status,'FAILED');assert.equal(writes[1].value.code,'ERR_INERT');assert.equal(writes[1].value.message,failure.message);
});
test('start waits for every descendant confirmation before capture within one startup deadline',async()=>{
 const first=source.indexOf('async function start(label){'),last=source.indexOf('async function close(',first);assert.ok(first>=0&&last>first);
 const events=[],deadlines=[],pids={root:43,branch:44,grandchild:45,detached:46};let grandchildReads=0,allConfirmed=false;
 const native={mark:()=>1n,createSession:()=>({}),snapshotSession:()=>({}),snapshot:()=>({}),watchRoot(_owner,_pid,image){if(image.endsWith('.wrong'))throw Object.assign(Error('wrong'),{code:'SESSION_ROOT_IDENTITY_REFUSED'});},captureSession(){events.push('capture');assert.equal(allConfirmed,true,'CAPTURE_BEFORE_FIXTURE_CONFIRMATION');return {root:{pid:42},shell:{pid:43},hostPid:99};}};
 const result={groups:[]},states=[];
 const readFile=async path=>{if(path.endsWith('electron-ready.json'))return JSON.stringify({workerPid:42,rootPid:43});const key=path.split('/').at(-1).replace('.ready','');if(key==='grandchild'&&grandchildReads++===0)throw Object.assign(Error('pending'),{code:'ENOENT'});if(key==='detached')allConfirmed=true;return String(pids[key]);};
 const wait=async(fn,deadline)=>{deadlines.push(deadline);for(let i=0;i<4;i++){const value=await fn();if(value)return value;}throw Error('INERT_FIXED_DEADLINE');};
 await vm.runInNewContext(source.slice(first,last)+'\nstart("A");',{native,hostOwner:{},host:{pid:99},config:{output:'out',electron:'electron',creator:'creator',fixture:'fixture',packagePath:'package'},join:(...p)=>p.join('/'),mkdir:async()=>{},writeFile:async()=>{},readFile,states,result,assert,wait,Date:{now:()=>100}});
 assert.equal(result.groups.length,1);assert.deepEqual(events,['capture']);assert.ok(grandchildReads>=2);assert.ok(deadlines.length>=2);assert.ok(deadlines.every(d=>d===3100),'STARTUP_BUDGET_MUST_NOT_RESET');
});
test('a readiness result arriving after the actual shared deadline is refused',async()=>{
 let now=100;const wait=vm.runInNewContext(source.match(/const wait=(.*);/)[1],{Date:{now:()=>now},delay:async()=>{now+=5;}});
 await assert.rejects(wait(async()=>{now=3101;return true;},3100),/COMPOSITION_WAIT_DEADLINE/);
 now=100;assert.equal(await wait(async()=>true,3100),true);
});
