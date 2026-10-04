import test from 'node:test';
import assert from 'node:assert/strict';
import {rm,readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {diagramContext} from './fixtures/diagram-context.mjs';
import {NativeDiagramReads} from '../src/windows/diagram-reads.mjs';
const module=await import('../src/windows/diagram-export.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><text>Exact colour</text></svg>';
async function fixture(t,render=async()=>svg){
 const f=await diagramContext();t.after(()=>rm(f.root,{recursive:true,force:true}));assert.equal(typeof module.NativeDiagramExports,'function');const calls=[],revealed=[];
 const reads=new NativeDiagramReads({registry:f.registry,owner:f.owner,diagramFor:f.diagramFor});
 const service=new module.NativeDiagramExports({registry:f.registry,owner:f.owner,reads,projects:f.projects,render:async(input,scope)=>{calls.push(input);return render(input,scope);},reveal:path=>revealed.push(path)});
 const saved=await reads.invoke({event:f.event(0),method:'getDiagram'}),request={expectedVersion:saved.version,expectedSha256:saved.sha256,appearance:'light'};
 return {...f,service,calls,revealed,request,call:(method='exportSvg',payload=request,event=f.event(0))=>service.invoke({event,method,payload})};
}
test('SVG export derives only selected saved Diagram, writes owned unique exports and reveals only its actual unchanged receipt',async t=>{
 const f=await fixture(t),result=await f.call();assert.equal(result.ok,true);assert.equal(result.version,1);assert.equal(result.entityId,'diagram-a');assert.equal(result.entitySha256,f.request.expectedSha256);assert.match(result.exportId,/^[a-f0-9-]{36}$/);assert.equal(result.bytes,Buffer.byteLength(svg));
 assert.deepEqual(f.calls,[{diagram:f.workspace.diagrams[0],appearance:'light'}]);assert.equal(JSON.stringify(f.calls).includes('PRIVATE_'),false);assert.equal('path'in result,false);assert.equal('svg'in result,false);
 const path=join(await f.projects.directory(f.selected.project.id),'exports',result.filename);assert.equal(await readFile(path,'utf8'),svg);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 assert.equal((await f.call('revealExport',{exportId:result.exportId})).ok,true);assert.deepEqual(f.revealed,[path]);assert.equal((await f.call('revealExport',{exportId:'00000000-0000-4000-8000-000000000000'})).ok,false);
 f.service.pause();assert.equal((await f.call('revealExport',{exportId:result.exportId})).ok,false);await f.service.drain();assert.equal(f.service.isIdle(),true);f.service.resume();assert.equal((await f.call('revealExport',{exportId:result.exportId})).ok,false);
});
test('SVG export rejects spoofed frames/roles, stale hash/version, paths/source, unknown methods and getters before rendering',async t=>{
 const f=await fixture(t);for(const index of [1,2])assert.equal((await f.call('exportSvg',f.request,f.event(index))).ok,false);
 for(const request of [{...f.request,source:'attacker'},{...f.request,path:'outside.svg'},{...f.request,expectedVersion:2},{...f.request,expectedSha256:'0'.repeat(64)},{...f.request,appearance:'unknown'}])assert.equal((await f.call('exportSvg',request)).ok,false);
 let called=false;const getter=Object.defineProperty({...f.request},'expectedSha256',{get(){called=true;return f.request.expectedSha256;}});assert.equal((await f.call('exportSvg',getter)).ok,false);assert.equal(called,false);
 assert.equal((await f.call('exportSvg',f.request,{sender:{...f.event(0).sender},senderFrame:f.event(0).senderFrame})).ok,false);assert.equal((await f.call('writeFile')).ok,false);assert.equal(f.calls.length,0);
});
test('Lock aborts and joins pending SVG render, rejects late results and leaves saved project exact',async t=>{
 let enter;const entered=new Promise(r=>enter=r);const f=await fixture(t,async(_input,scope)=>{enter();return new Promise((_,reject)=>scope.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));});
 const pending=f.call();await entered;f.service.pause();f.owner.pause('Lock');await f.service.drain();assert.equal((await pending).ok,false);assert.equal(f.service.isIdle(),true);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 const files=await readdir(await f.projects.directory(f.selected.project.id));assert.equal(files.includes('exports'),false);
});
test('saved entity replacement during isolated render refuses publication and budget accepts no arbitrary oversized result',async t=>{
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);const f=await fixture(t,async()=>{enter();await gate;return svg;});const pending=f.call();await entered;
 const metadata=JSON.parse(f.selected.json),workspace=JSON.parse(metadata.storage['t-industries-siren-v23-state']);workspace.diagrams[0].source='flowchart TD\nX-->Y';metadata.storage['t-industries-siren-v23-state']=JSON.stringify(workspace);f.setSelected({...f.selected,json:JSON.stringify(metadata)});release();assert.equal((await pending).ok,false);
 const big=await fixture(t,async()=>'<svg '+'x'.repeat(2*1024*1024)+'/>');assert.equal((await big.call()).ok,false);assert.deepEqual(await big.projects.readProject(big.selected.project.id),big.selected);
});
test('Lock during final saved-entity recheck cleans the actual renamed export and temporary bytes before drain completes',async t=>{
 const f=await fixture(t);let enter,release,count=0;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r),read=f.domains.read.bind(f.domains);
 f.domains.read=async(...args)=>{const actual=await read(...args);if(++count===3){enter();await gate;}return actual;};const pending=f.call();await entered;
 const directory=join(await f.projects.directory(f.selected.project.id),'exports');assert.equal((await readdir(directory)).filter(path=>path.endsWith('.svg')).length,1,'Actual renamed file must exist before revocation');f.service.pause();f.owner.pause('Lock');release();await f.service.drain();assert.equal((await pending).ok,false);assert.deepEqual(await readdir(directory),[]);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('changed export bytes cannot be revealed and payload value objects never invoke user coercion',async t=>{
 const f=await fixture(t);let coerced=false;assert.equal((await f.call('exportSvg',{...f.request,expectedSha256:{toString(){coerced=true;return f.request.expectedSha256;}}})).ok,false);assert.equal(coerced,false);assert.equal(f.calls.length,0);
 const result=await f.call();assert.equal(result.ok,true);const path=join(await f.projects.directory(f.selected.project.id),'exports',result.filename);await writeFile(path,'changed export');assert.equal((await f.call('revealExport',{exportId:result.exportId})).code,'EXPORT_CHANGED');assert.deepEqual(f.revealed,[]);
});
