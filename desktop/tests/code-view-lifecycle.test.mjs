import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {sourceClient} from '../src/ui/code/source-client.js';
import {createEditorAdapter} from '../src/ui/code/editor-adapter.js';
const module=await import('../src/ui/code/view-lifecycle.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('Code view lifecycle exists',()=>assert.equal(typeof module.createCodeViewLifecycle,'function'));
const check=(name,fn)=>test(name,{skip:!module.createCodeViewLifecycle},fn);
const deferred=()=>{let release;return {promise:new Promise(resolve=>{release=resolve;}),release:()=>release()};};
async function fixture(t,{readonly=false,refusal=null}={}) {
  const root=await mkdtemp(join(tmpdir(),'siren-code-view-'));
  const project=await new ProjectStore(root).createProject({label:'Lifecycle',json:'{"workpapers":[{"id":"docs-original","content":"untouched"}]}'});
  const repo=new SourceRepository(root),ref=await repo.importSource({projectId:project.project.id,bytes:Buffer.from('a😀b\r\nc')});
  let held=null,entered=null,commits=0;const readers=new Map(),writes=new Set();
  const writing=promise=>{writes.add(promise);promise.finally(()=>writes.delete(promise));return promise;};
  const bridge={getMetrics:async p=>{const {provenance,...value}=await repo.getMetrics({projectId:project.project.id,...p});return {ok:true,...value};},
    readRange:async p=>({ok:true,...p,text:await repo.readRange({projectId:project.project.id,...p})}),
    applyEdit:async p=>{entered?.release();if(held)await held.promise;return refusal||writing(repo.applyEdit({projectId:project.project.id,edit:p}));},
    commitSource:async p=>{commits++;return writing(repo.commitSource({projectId:project.project.id,...p}));},
    openRead:async p=>{const readId=randomUUID(),reader=await repo.openReader({projectId:project.project.id,...p});readers.set(readId,reader);return {ok:true,readId,...reader.info};},
    readChunk:async p=>({ok:true,readId:p.readId,...await readers.get(p.readId).readChunk(p)}),
    closeRead:async p=>{readers.get(p.readId)?.dispose();readers.delete(p.readId);return {ok:true,...p};}};
  const client=sourceClient({bridge,sourceRef:ref}),editor=createEditorAdapter({client,readonly});
  t.after(async()=>{editor.dispose();client.dispose();held?.release();for(const reader of readers.values())reader.dispose();await Promise.allSettled([...writes]);await rm(root,{recursive:true,force:true});});assert.equal((await editor.open(ref)).ok,true);
  const view=module.createCodeViewLifecycle({editor,client});
  return {root,project,repo,ref,editor,client,view,commits:()=>commits,hold(){held=deferred();entered=deferred();return {entered:entered.promise,release:held.release};}};
}
check('flushView freezes first and drains all accepted editor edits before the downstream client',async t=>{
  const f=await fixture(t),g=f.hold();
  f.editor.dispatch({changes:[{from:0,to:1,insert:'X'},{from:6,to:7,insert:'Ș'}]});await g.entered;
  const preparing=f.view.flushView();assert.equal(f.view.flushView(),preparing);
  assert.equal(f.editor.getStatus().paused,true);assert.equal(f.client.getState().paused,false);
  assert.equal(f.editor.dispatch({changes:{from:0,insert:'late'}}).code,'EDITOR_PAUSED');
  assert.equal(f.view.resumeView().code,'VIEW_BUSY');g.release();
  const saved=await preparing;assert.equal(saved.ok,true);assert.equal(saved.sourceReceipt.version,3);assert.equal(saved.sourceReceipt.durability,'committed');
  assert.equal(f.client.getState().paused,true);assert.equal(f.editor.getStatus().dirty,false);
  assert.deepEqual(await new SourceRepository(f.root).exportSource({projectId:f.project.project.id,sourceId:f.ref.sourceId,version:3}),Buffer.from('X😀b\r\nȘ'));
  assert.deepEqual(await new ProjectStore(f.root).readProject(f.project.project.id),f.project);
  assert.equal(f.view.resumeView().ok,true);assert.equal(f.client.getState().paused,false);assert.equal(f.editor.getStatus().paused,false);
  assert.equal(f.editor.dispatch({changes:{from:0,insert:'after'}}).ok,true);
  const again=await f.view.flushView();assert.equal(again.ok,true);assert.equal(again.sourceReceipt.version,4);assert.equal(f.commits(),2);
});
check('failed flush retains optimistic text and cannot become a prepared or resumed view',async t=>{
  const f=await fixture(t,{refusal:{ok:false,code:'REVISION_CONFLICT'}});
  f.editor.dispatch({changes:{from:0,insert:'local'}});
  assert.equal((await f.view.flushView()).code,'REVISION_CONFLICT');assert.equal(f.editor.getStatus().dirty,true);
  assert.equal(f.editor.getState().doc.toString('\n'),'locala😀b\r\nc');assert.equal(f.commits(),0);
  assert.equal(f.view.resumeView().ok,false);assert.equal(f.editor.getStatus().paused,true);
});
check('readonly view drains without a synthetic commit acknowledgement',async t=>{
  const f=await fixture(t,{readonly:true});const value=await f.view.flushView();
  assert.equal(value.ok,true);assert.equal(value.readonly,true);assert.equal('sourceReceipt' in value,false);assert.equal(f.commits(),0);
  assert.equal(f.client.getState().paused,true);assert.equal(f.view.resumeView().ok,true);
});
check('disposal while native work is pending never prepares a retired view',async t=>{
  const f=await fixture(t),g=f.hold();f.editor.dispatch({changes:{from:0,insert:'local'}});await g.entered;
  const pending=f.view.flushView();f.editor.dispose();g.release();
  assert.equal((await pending).ok,false);assert.equal(f.view.resumeView().ok,false);assert.equal(f.commits(),0);
});
check('a save observer admitting another edit cannot make incomplete local text look prepared',async t=>{
  const f=await fixture(t);let once=false;
  f.editor.subscribe(status=>{if(status.paused&&!status.saving&&status.durability==='committed'&&!once){once=true;f.editor.resumeView();f.editor.dispatch({changes:{from:0,insert:'unexpected'}});}});
  assert.equal((await f.view.flushView()).ok,false);
  assert.equal(f.editor.getState().doc.toString('\n'),'unexpecteda😀b\r\nc');assert.equal(f.editor.getStatus().dirty,true);
});
