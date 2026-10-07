import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {createDiagramMetadataContract} from '../src/documents/diagram-metadata.mjs';
const script=await readFile(new URL('../src/ui/diagram/draft.js',import.meta.url),'utf8'),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fixture({metadata,readonly=false,apply}={}){
 const initial={id:'diagram-a',name:'Annotations',source:'flowchart TD\nA-->B',nodeStyles:{A:{fill:'#ff3366'}},future:{sourceRef:{sourceId:'source-a',version:3,sha256:'a'.repeat(64)}},...(metadata===undefined?{}:{nodeMetadata:metadata})};
 let saved=structuredClone(initial),version=1,revision=2;const requests=[],window={SirenDiagramMetadata:createDiagramMetadataContract()};runInNewContext(script,{window,structuredClone,TextEncoder,crypto:webcrypto});
 const bridge={async applyDiagram(r){requests.push(structuredClone(r));if(apply)return apply(r);assert.equal(r.expectedVersion,version);const p=structuredClone(r.payload),resets=p.resetStyleFields??[];delete p.resetStyleFields;for(const k of resets)delete saved[k];saved={...saved,...p,sirenNativeVersion:++version};return{ok:true,domain:'diagram',entityId:saved.id,version,sha256:hash(saved),projectRevision:++revision,durability:'committed',operationId:r.operationId};},async flushDiagram(){return{ok:true,domain:'diagram',entityId:saved.id,version,sha256:hash(saved),projectRevision:revision,durability:'committed'};}};
 const draft=window.SirenNativeDiagramDraft.create({context:{ok:true,readonly,diagram:initial,version,sha256:hash(initial),projectRevision:revision},bridge,operationId:()=> 'metadata-op'});assert.equal(typeof draft.editMetadata,'function');return{draft,initial,requests,saved:()=>structuredClone(saved)};
}

test('metadata no-op and rejected fields preserve original absence, clean status and history',()=>{
 const f=fixture(),d=f.draft;assert.equal(d.editMetadata({id:'A',changes:{owner:''}}).ok,true);assert.equal(Object.hasOwn(d.getDiagram(),'nodeMetadata'),false);assert.equal(d.getStatus().dirty,false);assert.equal(d.getHistory().entries.length,1);
 for(const changes of [{owner:'x'.repeat(101)},{sourceRef:'forged'},{status:'future'},{owner:42}])assert.equal(d.editMetadata({id:'A',changes}).ok,false);
 assert.equal(d.getHistory().entries.length,1);assert.equal(d.getStatus().dirty,false);assert.equal(d.setStyle({nodeMetadata:{A:{owner:'bypass'}}}).ok,false);
});

test('one finite annotation delta is undoable while opaque source pointers and other nodes stay exact',()=>{
 const metadata={A:{owner:'Before',future:{sourceRef:{sourceId:'source-a',version:1,sha256:'b'.repeat(64)}}},constructor:{status:'future'}},f=fixture({metadata}),d=f.draft;
 assert.equal(d.editMetadata({id:'A',changes:{owner:'Știință 😀',risk:'Risk'}}).ok,true);assert.equal(d.getHistory().entries.length,2);assert.equal(d.getDiagram().nodeMetadata.A.owner,'Știință 😀');assert.deepEqual(d.getDiagram().nodeMetadata.A.future,metadata.A.future);
 assert.equal(d.undo().ok,true);assert.deepEqual(d.getDiagram().nodeMetadata,metadata);assert.equal(d.getStatus().dirty,false);assert.equal(d.redo().ok,true);assert.equal(d.editMetadata({id:'A',changes:{owner:''}}).ok,true);assert.equal(Object.hasOwn(d.getDiagram().nodeMetadata.A,'owner'),false);assert.deepEqual(d.getDiagram().nodeMetadata.constructor,metadata.constructor);assert.deepEqual(d.getDiagram().future,f.initial.future);
});

test('source/style/annotations save in one current CAS and Undo after Save restores optional metadata absence',async()=>{
 const f=fixture(),d=f.draft,first=d.getHistory().entries[0].id;d.setSource('flowchart TD\r\nA-->C');d.setStyle({fontSize:20});assert.equal(d.editMetadata({id:'constructor',changes:{owner:'Owner'}}).ok,true);
 assert.equal((await d.save()).ok,true);assert.equal(f.requests.length,1);assert.equal(f.requests[0].action,'replace-content');assert.equal(f.requests[0].payload.nodeMetadata.constructor.owner,'Owner');assert.equal(f.requests[0].payload.fontSize,20);assert.equal(f.requests[0].expectedVersion,1);assert.deepEqual(d.getDiagram().future,f.initial.future);assert.deepEqual(d.getDiagram().nodeStyles,f.initial.nodeStyles);
 assert.equal(d.restoreHistory(first).ok,true);assert.equal(Object.hasOwn(d.getDiagram(),'nodeMetadata'),false);assert.equal((await d.save()).ok,true);assert.deepEqual(new Set(f.requests[1].payload.resetStyleFields),new Set(['fontSize','nodeMetadata']));assert.equal(f.requests[1].expectedVersion,2);assert.equal(Object.hasOwn(f.saved(),'nodeMetadata'),false);assert.equal(d.redo().ok,true);
});

test('readonly/pending/fenced/paused/disposed annotation writes refuse and preserve local data',async()=>{
 const read=fixture({readonly:true}).draft;assert.equal(read.editMetadata({id:'A',changes:{owner:'bad'}}).ok,false);
 let release;const f=fixture({apply:()=>new Promise(r=>release=r)}),d=f.draft;d.editMetadata({id:'A',changes:{owner:'Local'}});const saving=d.save();assert.equal(d.editMetadata({id:'A',changes:{owner:'race'}}).ok,false);release({ok:false,code:'REVISION_CONFLICT'});assert.equal((await saving).ok,false);assert.equal(d.editMetadata({id:'A',changes:{owner:'retry'}}).ok,false);assert.equal(d.getDiagram().nodeMetadata.A.owner,'Local');
 const paused=fixture().draft;assert.equal((await paused.flushView()).ok,true);assert.equal(paused.editMetadata({id:'A',changes:{owner:'paused'}}).ok,false);paused.resumeView();assert.equal(paused.editMetadata({id:'A',changes:{owner:'resumed'}}).ok,true);paused.dispose();assert.equal(paused.editMetadata({id:'A',changes:{owner:'disposed'}}).ok,false);
});

test('annotation history observes existing state/byte budgets and equal updates do not create steps',()=>{
 const d=fixture({metadata:{A:{evidence:'e'.repeat(600)}}}).draft;for(let i=0;i<80;i++)assert.equal(d.editMetadata({id:'A',changes:{owner:'Owner'+i}}).ok,true);assert.equal(d.getHistory().entries.length,60);assert.ok(d.getHistory().bytes<=8*1024*1024);const n=d.getHistory().entries.length;d.editMetadata({id:'A',changes:{owner:'Owner79'}});assert.equal(d.getHistory().entries.length,n);assert.equal(d.getDiagram().nodeMetadata.A.evidence,'e'.repeat(600));
});
