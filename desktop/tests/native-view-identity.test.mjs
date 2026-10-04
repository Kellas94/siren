import test from 'node:test';
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{runInNewContext}from'node:vm';
import * as reads from '../src/windows/source-reads.mjs';
import{sourceReadFixture}from'./fixtures/source-read-context.mjs';
const ref={sourceId:'owned-source',version:3,sha256:'a'.repeat(64)};
const snapshot=(files=[],provenance={})=>({schema:2,sourceRefs:[{...ref,provenance}],json:JSON.stringify({codeFiles:files,workpapers:[{id:'private-doc',title:'SECRET_DOCS_LABEL',content:'SECRET_DOCS_BODY'}]})});
test('source identity uses only exact admitted metadata and safe Unicode file names',()=>{
 assert.equal(typeof reads.selectedSourceDisplayName,'function');
 assert.equal(reads.selectedSourceDisplayName(snapshot([{name:'agent Ș😀.py',sourceRef:ref}]),ref),'agent Ș😀.py');
 assert.equal(reads.selectedSourceDisplayName(snapshot([],{kind:'standalone',fileName:'imported.py'}),ref),'imported.py');
 assert.equal(reads.selectedSourceDisplayName(snapshot([{id:'owned-file',name:'old-name.py',sourceRef:{...ref,version:4}}],{kind:'standalone',fileId:'owned-file'}),ref),'old-name.py');
});
test('source names cannot be borrowed from other refs, documents, draft or release provenance',()=>{
 assert.equal(typeof reads.selectedSourceDisplayName,'function');
 assert.equal(reads.selectedSourceDisplayName(snapshot([{name:'OTHER_PRIVATE.py',sourceRef:{...ref,sha256:'b'.repeat(64)}}]),ref),null);
 for(const kind of ['docs','release','draft'])assert.equal(reads.selectedSourceDisplayName(snapshot([],{kind,fileName:'SECRET.py'}),ref),null);
 assert.equal(reads.selectedSourceDisplayName(snapshot(),{...ref,version:4}),null);
});
test('unsafe, overlong and accessor names are not exposed; metadata scan is bounded',()=>{
 assert.equal(typeof reads.selectedSourceDisplayName,'function');
 for(const name of ['../secret.py','C:\\secret.py','/secret.py','a\n.py','a\u202e.py','x'.repeat(201),'bad\ud800.py'])assert.equal(reads.selectedSourceDisplayName(snapshot([{name,sourceRef:ref}]),ref),null);
 let called=false;const s=snapshot();Object.defineProperty(s,'sourceRefs',{get(){called=true;throw Error('getter');}});assert.equal(reads.selectedSourceDisplayName(s,ref),null);assert.equal(called,false);
 const files=Array.from({length:4096},()=>({name:'other.py',sourceRef:{...ref,sourceId:'other'}}));files.push({name:'past-budget.py',sourceRef:ref});assert.equal(reads.selectedSourceDisplayName(snapshot(files),ref),null);
});
test('optional native source label has exact owner checks and no repository/body access',async t=>{
 const f=await sourceReadFixture();let calls=0;const grant=()=>f.registry.capture(f.event(0));
 const service=new reads.NativeSourceReads({registry:f.registry,owner:f.owner,referenceFor:(g,r)=>reads.selectedSourceReference(f.selected,f.registry,g,r),repositoryFactory(){throw Error('metadata must not open repository');},displayNameFor(g,r){calls++;assert.equal(g.projectId,grant().projectId);assert.equal(r.sourceId,f.refs[0].sourceId);return 'Agent.py';}});t.after(()=>service.dispose());
 const result=await service.invoke({event:f.event(0),method:'getReference'});assert.equal(result.displayName,'Agent.py');assert.equal(result.sourceRef.sha256,f.refs[0].sha256);assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
 assert.equal((await service.invoke({event:f.event(1),method:'getReference'})).code,'ACCESS_REFUSED');assert.equal(calls,1);
});
test('label adapter cannot publish after owner pause or change the exact reference',async t=>{
 const f=await sourceReadFixture();const service=new reads.NativeSourceReads({registry:f.registry,owner:f.owner,referenceFor:(g,r)=>reads.selectedSourceReference(f.selected,f.registry,g,r),repositoryFactory(){throw Error('no read');},displayNameFor(){f.owner.pause('identity metadata');return 'SECRET';}});t.after(()=>service.dispose());
 const result=await service.invoke({event:f.event(0),method:'getReference'});assert.equal(result.ok,false);assert.equal(result.displayName,undefined);
});
async function ui(){const window={},document={title:'',getElementById(){return heading;}},heading={textContent:'',title:''};runInNewContext(await readFile(new URL('../src/ui/windows/identity.js',import.meta.url),'utf8'),{window,document});return{api:window.SirenNativeViewIdentity,document,heading};}
test('native title identifies source, exact version, mode and local draft without markup',async()=>{
 const f=await ui();f.api.set({role:'code',name:'agent Ș😀.py',version:3,readonly:false,dirty:true});
 assert.equal(f.document.title,'SIREN — ⌘ Code — agent Ș😀.py · v3 · Working copy · Unsaved');assert.equal(f.heading.textContent,'⌘ Code · agent Ș😀.py');
 f.api.set({role:'code',name:'agent Ș😀.py',version:4,readonly:true});assert.equal(f.document.title,'SIREN — ⌘ Code — agent Ș😀.py · v4 · Read only');
 f.api.set({role:'docs',name:'<img onerror=bad>\nAgent\u202e',revision:2,readonly:false});assert.equal(f.heading.textContent,'<img onerror=bad> Agent');assert.equal(f.document.title,'SIREN — Docs — <img onerror=bad> Agent · r2 · Working copy');assert.equal(f.document.title.includes('\n'),false);assert.equal(f.document.title.includes('\u202e'),false);
});
test('bounded Unicode titles never retain a broken surrogate or metadata after reset',async()=>{
 const f=await ui();f.api.set({role:'diagram',name:'x'.repeat(119)+'😀rest',version:1,readonly:true});assert.ok(f.heading.textContent.length<=120);assert.equal(f.heading.textContent.isWellFormed(),true);
 f.api.clear('diagram');assert.equal(f.document.title,'SIREN — Diagrams');assert.equal(f.heading.textContent,'Diagrams');assert.equal(f.heading.title,'');
});
