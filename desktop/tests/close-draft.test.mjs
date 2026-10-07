import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from '../tests/fixtures/temporary.mjs';
import {buildRenderer} from '../build/renderer.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {PrimaryPersistence} from '../src/windows/primary.mjs';

const dir=await mkdtemp(join(tmpdir(),'siren-close-draft-real-'));
await buildRenderer({baselinePath:new URL('../baseline/R78.html',import.meta.url),outputDir:dir});
const html=await readFile(join(dir,'app.html'),'utf8');
const section=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const close=section('window.sirenDesktopApplySafety =','let accountTransitionBodyState =');
const draft=section('      function writeDraft() {','      /* Quota failures');
const clean=section('      function markCleanExit() {','      function markSessionRunning() {');
const running=section('      function markSessionRunning() {','      function readDraft() {');
const shrink=section('      function allowRecoveryDraftShrink() {','      function reportDraftWriteFailure(error) {');
const transition=section('let accountTransitionBodyState =','        window.sirenDesktopStartOpening =');
const adapter=await readFile(new URL('../src/ui/storage.js',import.meta.url),'utf8');

async function fixture({failWorkspace=false,failDraft=false,failFinalWorkspace=false,largerDraft=false}={}){
 const state={activeDiagramId:'one',source:'flowchart TD\n A-->B',diagrams:[{id:'one',source:'flowchart TD\n A-->B',zoom:33}],workpapers:[],map:{cards:[]}};
 const prior={activeDiagramId:'one',diagrams:[{...state.diagrams[0],zoom:29}],workpapers:[],map:state.map};
 if(largerDraft)prior.diagrams.push({id:'recover-only',source:'flowchart TD\n X-->Y',zoom:100});
 const storage={workspace:JSON.stringify(state),'workspace-draft':JSON.stringify(prior),'workspace-clean-exit':'no','private-code':'PRIVATE_RECOVERABLE_CODE'};
 const root=await mkdtemp(join(tmpdir(),'siren-close-draft-data-')),projects=new ProjectStore(root),recovery=new RecoveryStore(root);
 const snapshot=await projects.createProject({label:'Owned native-purpose semantics',json:JSON.stringify({kind:'siren-desktop',schema:1,storage})});
 const scope={projectId:snapshot.project.id,isCurrent:()=>true},primary=new PrimaryPersistence({projects:({canWrite})=>new ProjectStore(root,{canSave:canWrite}),recovery}),calls=[];
 const window={sirenDesktopBootstrap:{mode:'normal',snapshot},sirenDesktop:{saveProject:async request=>{
  calls.push(request);
  if(failWorkspace&&request.purpose==='workspace'||failDraft&&request.purpose==='recovery'||failFinalWorkspace&&request.purpose==='workspace'&&calls.filter(r=>r.purpose==='workspace').length>1)return {ok:false,message:'Owned write refusal'};
  // Electron IPC structured-clones the renderer realm before native validators.
  return primary.save(JSON.parse(JSON.stringify(request)),scope);
 }}};
 const context=vm.createContext({window,state,clearTimeout,saveTimer:null,draftTimer:null,readOnlyMode:false,el:{source:{value:state.source}},DRAFT_KEY:'workspace-draft',CLEAN_EXIT_KEY:'workspace-clean-exit',draftShrinkAllowedUntil:0,showToast:()=>{},reportDraftWriteFailure:()=>{},document:{body:{inert:false,classList:{add(){},remove(){}}}},saveState:null,syncStateFromControls:()=>{}});
 vm.runInContext(adapter,context);context.sirenStore=window.createSirenDesktopStore({workspaceKey:'workspace'});
 context.desktopCache={setItem:(key,value)=>context.sirenStore.set(key,String(value))};
 context.saveState=async()=>{const receipt=await context.sirenStore.setWithBackup('workspace',JSON.stringify(state),'backup',storage.workspace);return {status:receipt.ok?'confirmed':'failed'};};
 vm.runInContext(draft+'\n'+clean+'\n'+running+'\n'+shrink+'\n'+close+'\n'+transition,context);
 return {window,context,calls,state,prior,projects,snapshot,recovery,saved:async()=>JSON.parse((await projects.readProject(snapshot.project.id)).json).storage};
}

test('confirmed desktop close selects matching real draft/clean flag, not merely a separate recovery checkpoint',async()=>{
 const f=await fixture();await f.window.sirenDesktopRequestClose();
 const saved=await f.saved();assert.equal(saved['workspace-clean-exit'],'yes');
 assert.deepEqual(JSON.parse(saved['workspace-draft']).diagrams,JSON.parse(saved.workspace).diagrams);
 assert.equal(JSON.parse(saved.workspace).diagrams[0].zoom,33);assert.equal(saved['private-code'],'PRIVATE_RECOVERABLE_CODE');
 const current=await f.projects.readProject(f.snapshot.project.id),points=await f.recovery.scan(current.project.id);
 assert.ok(points.valid.some(point=>point.kind==='saved'&&point.snapshot.json===current.json));
 assert.equal((await f.window.sirenDesktopFlush()).ok,true);
});
test('refused workspace close cannot mark clean exit or replace a recoverable draft',async()=>{
 const f=await fixture({failWorkspace:true});await assert.rejects(f.window.sirenDesktopRequestClose(),/not acknowledged/);
 const saved=await f.saved();assert.equal(saved['workspace-clean-exit'],'no');assert.deepEqual(JSON.parse(saved['workspace-draft']),f.prior);
});
test('close retains a larger recovery-only workspace instead of deleting its extra diagram',async()=>{
 const f=await fixture({largerDraft:true});await f.window.sirenDesktopRequestClose();
 const saved=await f.saved();assert.deepEqual(JSON.parse(saved['workspace-draft']),f.prior);assert.equal(saved['workspace-clean-exit'],'yes');
});
test('an acknowledged selected workspace retains the complete draft even when separate recovery-only requests refuse',async()=>{
 const f=await fixture({failDraft:true});await f.window.sirenDesktopRequestClose();
 const saved=await f.saved();assert.equal(saved['workspace-clean-exit'],'yes');
 assert.deepEqual(JSON.parse(saved['workspace-draft']).diagrams,JSON.parse(saved.workspace).diagrams);
 const current=await f.projects.readProject(f.snapshot.project.id);
 assert.ok((await f.recovery.scan(current.project.id)).valid.some(point=>point.kind==='saved'&&point.snapshot.json===current.json));
});
test('a final selected-workspace refusal cannot be hidden by acknowledged recovery-only checkpoints',async()=>{
 const f=await fixture({failFinalWorkspace:true});await assert.rejects(f.window.sirenDesktopRequestClose(),/not acknowledged/);
 assert.equal((await f.saved())['workspace-clean-exit'],'no');
});
test('cancelled native transition selects a running marker without retaining a false clean-exit flag',async()=>{
 const f=await fixture();await f.window.sirenDesktopBeginAccountTransition();
 assert.equal((await f.saved())['workspace-clean-exit'],'yes');assert.equal(f.window.sirenDesktopStorageLocked,true);
 f.window.sirenDesktopEndAccountTransition();await vm.runInContext('drainDesktopSaves()',f.context);await f.window.sirenDesktopFlush();
 assert.equal((await f.saved())['workspace-clean-exit'],'no');assert.equal(f.window.sirenDesktopStorageLocked,false);
});
test('repeated acknowledged close without edits preserves the complete selected snapshot and recovery timestamp',async()=>{
 const f=await fixture();let clock=Date.parse('2026-10-04T21:00:00.000Z');
 f.context.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 await f.window.sirenDesktopRequestClose();const acknowledged=await f.projects.readProject(f.snapshot.project.id);
 clock+=1000;await f.window.sirenDesktopRequestClose();
 assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),acknowledged);
 assert.ok((await f.recovery.scan(acknowledged.project.id)).valid.some(point=>point.kind==='saved'&&point.snapshot.json===acknowledged.json));
});
test('unchanged-close deduplication still commits changed view settings and private recovery data',async()=>{
 const f=await fixture();let clock=Date.parse('2026-10-04T21:00:00.000Z');
 f.context.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 await f.window.sirenDesktopRequestClose();const before=await f.projects.readProject(f.snapshot.project.id);
 clock+=1000;f.state.diagrams[0].zoom=44;await f.context.sirenStore.set('private-code','NEW_PRIVATE_CODE');await f.window.sirenDesktopRequestClose();
 const current=await f.projects.readProject(before.project.id),saved=JSON.parse(current.json).storage;
 assert.ok(current.revision>before.revision);assert.equal(JSON.parse(saved.workspace).diagrams[0].zoom,44);
 assert.equal(JSON.parse(saved['workspace-draft']).diagrams[0].zoom,44);assert.equal(saved['private-code'],'NEW_PRIVATE_CODE');
 assert.equal(saved['workspace-clean-exit'],'yes');assert.equal(JSON.parse(saved['workspace-draft']).savedAt,new Date(clock).toISOString());
});
test('repeated close after an intentional draft shrink preserves the complete already-confirmed smaller snapshot',async()=>{
 const f=await fixture({largerDraft:true});let clock=Date.parse('2026-10-04T21:00:00.000Z');
 f.context.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 vm.runInContext('allowRecoveryDraftShrink()',f.context);await f.window.sirenDesktopRequestClose();
 const acknowledged=await f.projects.readProject(f.snapshot.project.id);
 assert.equal(JSON.parse(JSON.parse(acknowledged.json).storage['workspace-draft']).diagrams.length,1);
 clock+=1000;await f.window.sirenDesktopRequestClose();
 assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),acknowledged);
});
