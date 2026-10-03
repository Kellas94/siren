import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { commitManifest } from '../src/sources/manifest.mjs';
import { createLocationResolver } from '../src/navigation/resolver.mjs';

const pointer=ref=>({sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256});
async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'siren-navigation-resolver-'));
  const projects=new ProjectStore(root),sources=new SourceRepository(root);
  const initial=await projects.createProject({label:'Resolver fixture',json:'{}'});
  const bytes=Buffer.from('a😀b\r\nc');
  const ref=await sources.importSource({projectId:initial.project.id,bytes});
  const metadata={diagrams:[{id:'diagram-a',source:'flowchart TD\nA-->B',presentation:{slides:[{id:'slide-a'}]}}],workpapers:[{id:'doc-a',blocks:[],releases:[{snapshot:{workpapers:[{id:'released-doc'}]}}]}],codeFiles:[{id:'file-a',sourceRef:pointer(ref)}],storage:{'old-cache':JSON.stringify({diagrams:[{id:'cached-diagram'}],workpapers:[{id:'cached-doc'}]})}};
  assert.equal((await commitManifest({projects,repository:sources,projectId:initial.project.id,baseRevision:1,sourceRefs:[ref],metadata,operationId:'create-manifest'})).ok,true);
  const snapshot=await projects.readProject(initial.project.id);let current=true;
  const resolve=createLocationResolver({sources,displays:()=>[{id:1,primary:true,workArea:{x:0,y:0,width:1200,height:800}}]});
  const context={projectId:initial.project.id,snapshot,isCurrent:()=>current};
  return {root,projects,sources,snapshot,ref,bytes,resolve,context,setCurrent:value=>{current=value;}};
}

test('native resolver recognizes each active module entity without treating release or cache IDs as authority',async()=>{
  const f=await fixture();
  for(const location of [{surface:'diagrams',entityId:'diagram-a'},{surface:'docs',entityId:'doc-a'},{surface:'present',entityId:'diagram-a'},{surface:'code',entityId:f.ref.sourceId,sourceRef:pointer(f.ref)}])assert.equal((await f.resolve({...f.context,location})).ok,true);
  for(const location of [{surface:'docs',entityId:'diagram-a'},{surface:'diagrams',entityId:'doc-a'},{surface:'present',entityId:'doc-a'},{surface:'code',entityId:'file-a'},{surface:'docs',entityId:'released-doc'},{surface:'docs',entityId:'cached-doc'},{surface:'diagrams',entityId:'cached-diagram'}])assert.equal((await f.resolve({...f.context,location})).code,'ENTITY_UNAVAILABLE');
});

test('Continue resolves the exact old source version after newer private edits without changing any selected bytes',async()=>{
  const f=await fixture();const before=await readFile(join(f.root,'Projects',f.context.projectId,'current.json'));
  const edit=await f.sources.applyEdit({projectId:f.context.projectId,edit:{sourceId:f.ref.sourceId,expectedVersion:1,operationId:'newer-private-edit',start:0,end:1,insertedText:'new'}});assert.equal(edit.ok,true);
  const result=await f.resolve({...f.context,location:{surface:'code',entityId:f.ref.sourceId,sourceRef:pointer(f.ref),cursor:{anchor:1,head:f.ref.utf16Units}}});
  assert.equal(result.ok,true);assert.deepEqual(result.location.sourceRef,pointer(f.ref));
  assert.deepEqual(await f.sources.exportSource({projectId:f.context.projectId,sourceId:f.ref.sourceId,version:1}),f.bytes);
  assert.deepEqual(await readFile(join(f.root,'Projects',f.context.projectId,'current.json')),before);
  assert.deepEqual(await f.projects.readProject(f.context.projectId),f.snapshot);
});

test('missing version forged hash mismatched ID and offsets beyond actual UTF16 units refuse without substitution',async()=>{
  const f=await fixture();const base={surface:'code',entityId:f.ref.sourceId,sourceRef:pointer(f.ref)};
  for(const ref of [{...base.sourceRef,version:99},{...base.sourceRef,sha256:'a'.repeat(64)},{...base.sourceRef,sourceId:'other-source'}])assert.equal((await f.resolve({...f.context,location:{...base,sourceRef:ref}})).code,'SOURCE_VERSION_UNAVAILABLE');
  assert.equal((await f.resolve({...f.context,location:{...base,cursor:{anchor:0,head:f.ref.utf16Units+1}}})).code,'INVALID_NAVIGATION');
  assert.equal((await f.resolve({...f.context,location:{surface:'docs',entityId:'doc-a',sourceRef:pointer(f.ref)}})).code,'INVALID_NAVIGATION');
  assert.equal((await f.resolve({...f.context,location:{surface:'code',entityId:f.ref.sourceId}})).code,'SOURCE_VERSION_UNAVAILABLE');
});

test('Lock during exact source verification suppresses the resolved route',async()=>{
  const f=await fixture();const metrics=f.sources.getMetrics.bind(f.sources);
  f.sources.getMetrics=async request=>{const value=await metrics(request);f.setCurrent(false);return value;};
  assert.equal((await f.resolve({...f.context,location:{surface:'code',entityId:f.ref.sourceId,sourceRef:pointer(f.ref)}})).code,'ACCESS_REFUSED');
});

test('restored layouts use current workAreas and require each referenced entity to belong to its role',async()=>{
  const f=await fixture();const layout={role:'diagram',entityId:'diagram-a',normalBounds:{x:9000,y:9000,width:700,height:500},displayId:99,maximized:false,fullscreen:false};
  const result=await f.resolve({...f.context,location:{surface:'diagrams',entityId:'diagram-a',layouts:[layout]}});assert.equal(result.ok,true);assert.equal(result.location.layouts[0].displayId,1);assert.deepEqual(result.location.layouts[0].normalBounds,{x:500,y:300,width:700,height:500});
  assert.equal((await f.resolve({...f.context,location:{surface:'diagrams',entityId:'diagram-a',layouts:[{...layout,entityId:'doc-a'}]}})).code,'ENTITY_UNAVAILABLE');
  assert.equal(layout.displayId,99);
});
