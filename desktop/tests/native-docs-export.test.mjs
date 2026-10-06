import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,rm,mkdir,rename} from 'node:fs/promises';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {NativeDocsReads} from '../src/windows/docs-reads.mjs';
import {formatSavedDocument} from '../src/documents/export.mjs';
const module=await import('../src/windows/docs-export.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
async function fixture(t,format){
 const document={id:'doc-a',title:'Exact saved context',blocks:[{id:'p',kind:'prompt',text:'print("Saved Ș😀")'},{id:'k',kind:'knowledge',rows:[{id:'r',name:'agent.py'}]}],opaque:{claim:'IMPORTED_NOT_APPROVED'}};
 const f=await sourceReadFixture({workpapers:[document,{id:'doc-b',title:'FOREIGN_DOC_SECRET'}],unrelated:'UNRELATED_SECRET'});let selected=f.selected;
 t.after(async()=>{assert.equal(dirname(resolve(f.root)),resolve(tmpdir()));assert.match(basename(f.root),/^siren-source-read-bridge-/);await rm(f.root,{recursive:true,force:true});});
 const ref=f.refs[0];document.blocks[1].rows[0].sourceRef={sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256};
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:f.selected.revision,sourceRefs:f.refs,metadata:{workpapers:[document,{id:'doc-b',title:'FOREIGN_DOC_SECRET'}],unrelated:'UNRELATED_SECRET'},operationId:'saved-doc-export-fixture'})).ok,true);
 f.selected=selected=await f.projects.readProject(f.selected.project.id);
 const domains=new DomainRepository({projects:()=>new ProjectStore(f.root,{canSave:()=>false}),sources:()=>new SourceRepository(f.root,{canWrite:()=>false}),validatePatch:()=>false});
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>new SourceRepository(f.root,{canWrite:()=>false}),domains,access:(_grant,scope)=>f.isUnlocked()&&scope.action==='read-domain'&&scope.domain==='docs'&&scope.entityId==='doc-a'});
 const reads=new NativeDocsReads({registry:f.registry,owner,documentFor:()=>JSON.parse(selected.json).workpapers.find(d=>d.id==='doc-a')});
 assert.equal(typeof module.NativeDocsExports,'function','Own saved Docs export service must exist');
 const revealed=[],service=new module.NativeDocsExports({registry:f.registry,owner,reads,projects:f.projects,format:format??formatSavedDocument,reveal:path=>revealed.push(path)}),saved=await reads.invoke({event:f.event(1),method:'getDocument'});
 assert.equal(saved.ok,true);const request={format:'json',expectedVersion:saved.version,expectedSha256:saved.sha256};
 return {...f,document,domains,owner,reads,service,saved,request,revealed,select:value=>selected=value,call:(method='exportSaved',payload=request,event=f.event(1))=>service.invoke({event,method,payload})};
}
test('readonly saved Docs exports exact archive with finite receipt; references and claims remain exact, foreign project data excluded',async t=>{
 const f=await fixture(t),result=await f.call();assert.equal(result.ok,true);assert.equal(result.version,f.saved.version);assert.equal(result.entitySha256,f.saved.sha256);assert.equal(result.entityId,'doc-a');assert.equal(result.projectRevision,f.saved.projectRevision);assert.equal('path'in result,false);assert.equal('document'in result,false);
 const path=join(await f.projects.directory(f.selected.project.id),'exports',result.filename),bytes=await readFile(path),archive=JSON.parse(bytes);assert.deepEqual(archive.document,f.document);assert.equal(result.bytes,bytes.length);assert.equal(bytes.includes(Buffer.from('foreign secret')),false);assert.equal(bytes.includes(Buffer.from('UNRELATED_SECRET')),false);assert.equal(bytes.includes(Buffer.from('FOREIGN_DOC_SECRET')),false);assert.equal(archive.sourcePolicy,'references-only');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 assert.equal((await f.call('revealExport',{exportId:result.exportId})).ok,true);assert.deepEqual(f.revealed,[path]);
 for(const format of ['html','markdown'])assert.equal((await f.call('exportSaved',{...f.request,format})).ok,true);
 f.service.pause();await f.service.drain();assert.equal(f.service.isIdle(),true);f.service.resume();assert.equal((await f.call('revealExport',{exportId:result.exportId})).code,'ACCESS_REFUSED');
});
test('Docs-only current frame, exact CAS/hash and finite request reject spoofed source/role/path/body/getters before formatting',async t=>{
 let formats=0;const f=await fixture(t,data=>{formats++;return formatSavedDocument(data);});
 for(const p of [{...f.request,path:'outside'},{...f.request,document:{}},{...f.request,format:'pdf'},{...f.request,expectedVersion:1},{...f.request,expectedVersion:'0'.repeat(64)},{...f.request,expectedSha256:'0'.repeat(64)}])assert.equal((await f.call('exportSaved',p)).ok,false);
 assert.equal((await f.call('exportSaved',f.request,f.event(0))).ok,false);assert.equal((await f.call('exportSaved',f.request,{sender:{...f.event(1).sender},senderFrame:f.event(1).senderFrame})).ok,false);
 let ran=false;const getter=Object.defineProperty({...f.request},'format',{enumerable:true,get(){ran=true;return'json';}});assert.equal((await f.call('exportSaved',getter)).ok,false);assert.equal(ran,false);assert.equal((await f.call('writeFile')).ok,false);assert.equal(formats,0);
 let coerced=false;assert.equal((await f.call('exportSaved',{...f.request,format:{toString(){coerced=true;return'json';}}})).ok,false);assert.equal(coerced,false);assert.equal(formats,0);
 f.lock();assert.equal((await f.call()).code,'ACCESS_REFUSED');
});
test('pending formatter is unique per own window; Lock abort/drain permanently fences output and leaves snapshot exact',async t=>{
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);const f=await fixture(t,async(data,scope)=>{enter(scope);await gate;return formatSavedDocument(data);});
 const pending=f.call(),scope=await entered;assert.equal((await f.call()).code,'EXPORT_BUSY');f.service.pause();f.owner.pause('Lock');assert.equal(scope.signal.aborted,true);let drained=false;const drain=f.service.drain().then(()=>drained=true);await new Promise(r=>setImmediate(r));assert.equal(drained,false);release();await drain;assert.equal((await pending).ok,false);assert.equal(f.service.isIdle(),true);assert.equal((await readdir(await f.projects.directory(f.selected.project.id))).includes('exports'),false);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('saved context change during formatting refuses output; no hidden flush/save or source retrieval',async t=>{
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);const f=await fixture(t,async data=>{enter();await gate;return formatSavedDocument(data);});const pending=f.call();await entered;
 const metadata=JSON.parse(f.selected.json);metadata.workpapers[0].title='Changed saved runtime';f.select({...f.selected,json:JSON.stringify(metadata)});release();assert.equal((await pending).ok,false);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('Lock during final read after actual rename removes unretained export and stage before drain completes',async t=>{
 const f=await fixture(t);let enter,release,count=0;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r),read=f.domains.read.bind(f.domains);f.domains.read=async(...args)=>{const result=await read(...args);if(++count===3){enter();await gate;}return result;};
 const pending=f.call();await entered;const directory=join(await f.projects.directory(f.selected.project.id),'exports');assert.equal((await readdir(directory)).filter(n=>n.endsWith('.json')).length,1);f.service.pause();f.owner.pause('Lock');release();await f.service.drain();assert.equal((await pending).ok,false);assert.deepEqual(await readdir(directory),[]);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('modified file cannot reveal, and malformed/oversized formatter bytes cannot publish',async t=>{
 const f=await fixture(t),result=await f.call();assert.equal(result.ok,true);const path=join(await f.projects.directory(f.selected.project.id),'exports',result.filename);await writeFile(path,'modified');assert.equal((await f.call('revealExport',{exportId:result.exportId})).code,'EXPORT_CHANGED');assert.deepEqual(f.revealed,[]);
 for(const output of [{bytes:Buffer.from('x'),extension:'exe'},{bytes:Buffer.alloc(16*1024*1024+1),extension:'json'},{bytes:'not-buffer',extension:'json'}]){const other=await fixture(t,()=>output);assert.equal((await other.call()).ok,false);assert.equal((await readdir(await other.projects.directory(other.selected.project.id))).includes('exports'),false);}
});
test('uncertain cleanup after real rename permanently fences exports and refuses quiescence',async t=>{
 const f=await fixture(t);let enter,release,count=0;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r),read=f.domains.read.bind(f.domains);f.domains.read=async(...args)=>{const result=await read(...args);if(++count===3){enter();await gate;}return result;};
 const pending=f.call();await entered;const directory=join(await f.projects.directory(f.selected.project.id),'exports'),files=await readdir(directory);assert.equal(files.length,1);assert.match(files[0],/\.json$/);
 const output=join(directory,files[0]);await rename(output,join(f.root,'owned-displaced-export.json'));await mkdir(output);f.service.pause();f.owner.pause('Lock');release();assert.equal((await pending).code,'DOCS_EXPORT_FAILED');
 assert.equal(f.service.isIdle(),false);await assert.rejects(f.service.drain(),/DOCS_EXPORT_NOT_IDLE/);f.service.resume();assert.equal((await f.call()).code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
