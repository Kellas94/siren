import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { ProjectStore } from '../../src/projects/store.mjs';
import { SourceRepository } from '../../src/sources/repository.mjs';
import { RecoveryStore } from '../../src/recovery/checkpoints.mjs';
import { migrateLegacySources } from '../../src/sources/migration.mjs';
import { launchDesktop, unlockDesktop } from './drive.mjs';

// Current role privacy: each Code may render ONLY its admitted source; Docs
// may render ONLY its admitted document. Retain the old data-free oracle unchanged.
// This does not qualify all transport,
// multiple physical monitors, terminal processes or a production release.
const evidence = resolve('evidence', `native-window-role-privacy-${new Date().toISOString().replaceAll(':','-')}`);
await mkdir(evidence,{recursive:true}); const dataRoot=join(evidence,'owned-data');
await mkdir(dataRoot);
const projects=new ProjectStore(dataRoot); const repository=new SourceRepository(dataRoot); const recovery=new RecoveryStore(dataRoot,{sources:repository});
const privateSentinel='PRIVATE_SOURCE_A_ONLY',otherSentinel='PRIVATE_SOURCE_B_ONLY';
const sourceTexts={file_a:`print('${privateSentinel}')\n`,file_b:`print('${otherSentinel}')\n`};
const documentTexts={doc_a:'PRIVATE_DOC_A_ONLY',doc_b:'PRIVATE_DOC_B_ONLY'};
const paths=['src/main.mjs','src/windows/registry.mjs','src/windows/surface.mjs','src/windows/preload.cjs','src/windows/source-reads.mjs','src/windows/docs-reads.mjs','generated/home.html','generated/windows/code.html','generated/windows/docs.html','tests/native/window-role-privacy.mjs'];
const capture=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')]))),inputs=await capture();
const original=await projects.createProject({label:'Owned native shell fixture',json:JSON.stringify({source:'flowchart TD\n A[Native roles]-->B[Scoped windows]',workpapers:[{id:'doc_a',title:'Owned A',content:documentTexts.doc_a,blocks:[]},{id:'doc_b',title:'Owned B',content:documentTexts.doc_b,blocks:[]}],codeFiles:[{id:'file_a',name:'one.py',content:sourceTexts.file_a},{id:'file_b',name:'two.py',content:sourceTexts.file_b}]})});
const migrated=await migrateLegacySources({snapshot:original,repository,projects,recovery}); assert.equal(migrated.ok,true);
const refs=migrated.snapshot.sourceRefs.filter(ref=>ref.provenance.kind==='standalone'); assert.equal(refs.length,2);
const probeSha256=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
let driver; const peers=[]; let operation='launch';
async function connect(url) {
  const socket=new WebSocket(url); await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let serial=0; const pending=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);const job=pending.get(message.id);if(!job)return;clearTimeout(job.timer);pending.delete(message.id);message.error?job.reject(new Error(JSON.stringify(message.error))):job.resolve(message.result);});
  socket.addEventListener('close',()=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(new Error('Owned role socket closed'));}pending.clear();});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Owned role CDP timeout: ${method}`));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  return {evaluate,close:()=>socket.close()};
}
try {
  driver=await launchDesktop({extraArgs:[`--siren-test-root=${dataRoot}`,`--siren-test-project=${migrated.newProjectId}`]});
  operation='unlock'; await unlockDesktop(driver,{pin:'4826',autoSetup:true});
  await driver.waitFor('document.readyState === "complete" && typeof window.sirenWindow?.openView === "function"');
  assert.equal((await driver.evaluate('window.sirenWindow.getView()')).view.role,'workspace');
  operation='open registered roles'; const views=[];
  for(const request of [{role:'docs',entityId:'doc_a'},{role:'docs',entityId:'doc_b'},...refs.map(ref=>({role:'code',entityId:ref.sourceId,version:ref.version}))]) {
    const receipt=await driver.evaluate(`window.sirenWindow.openView(${JSON.stringify(request)})`); assert.equal(receipt.ok,true);views.push(receipt.view);
  }
  assert.equal((await driver.evaluate('window.sirenWindow.listViews()')).views.length,5);
  const match=/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(driver.logs()); assert.ok(match,'Owned runtime debugger endpoint must be observed');
  const targets=await (await fetch(`http://127.0.0.1:${match[1]}/json/list`,{signal:AbortSignal.timeout(3000)})).json();
  operation='role privacy and caller validation';
  for(const view of views) {
    const target=targets.find(target=>target.url===`siren://app/windows/${view.role}.html?windowId=${view.windowId}`); assert.ok(target);
    const peer=await connect(target.webSocketDebuggerUrl);peers.push(peer);
    const until=Date.now()+15000; let ready=false;
    while(Date.now()<until) {if(await peer.evaluate('document.body?.dataset.connected === "true" && (location.pathname.endsWith("/code.html")?document.body.dataset.sourceReady==="true":document.body.dataset.documentReady==="true")')){ready=true;break;}await delay(100);}
    assert.equal(ready,true);
    const state=await peer.evaluate(String.raw`(async()=>({require:typeof window.require,desktop:typeof window.sirenDesktop,bootstrap:typeof window.sirenDesktopBootstrap,body:document.body.textContent,editor:document.querySelector('.cm-content')?Array.from(document.querySelectorAll('.cm-content .cm-line'),line=>line.textContent).join('\n'):null,source:{...document.body.dataset},view:await window.sirenWindow.getView(),list:await window.sirenWindow.listViews(),forged:await window.sirenWindow.getView({role:'workspace'})}))()`);
    assert.equal(state.require,'undefined');assert.equal(state.desktop,'undefined');assert.equal(state.bootstrap,'undefined');
    if(view.role==='code'){
      const own=refs.find(ref=>ref.sourceId===view.entityId);assert.ok(own);assert.equal(state.editor,sourceTexts[own.provenance.fileId]);assert.equal(state.source.sourceId,own.sourceId);assert.equal(state.source.sourceVersion,'1');assert.equal(state.source.sourceSha256,own.sha256);
      const other=refs.find(ref=>ref.sourceId!==view.entityId),forbidden=other.provenance.fileId==='file_a'?privateSentinel:otherSentinel;assert.equal(state.body.includes(forbidden),false);
      assert.equal((await peer.evaluate(`window.sirenSource.getMetrics(${JSON.stringify({sourceId:other.sourceId,version:1})})`)).code,'ACCESS_REFUSED');
      for(const marker of Object.values(documentTexts))assert.equal(state.body.includes(marker),false);
    }else{
      assert.equal(state.body.includes(privateSentinel)||state.body.includes(otherSentinel),false);assert.equal(state.body.includes(documentTexts[view.entityId]),true);for(const[id,marker]of Object.entries(documentTexts))if(id!==view.entityId)assert.equal(state.body.includes(marker),false);
      const doc=await peer.evaluate('window.sirenDocsRead.getDocument()');assert.equal(doc.ok,true);assert.equal(doc.document.id,view.entityId);assert.equal(doc.document.content,documentTexts[view.entityId]);
      assert.equal((await peer.evaluate(`window.sirenSource.getMetrics(${JSON.stringify({sourceId:refs[0].sourceId,version:1})})`)).code,'ACCESS_REFUSED');
    }
    assert.equal(state.view.ok,true);assert.equal(state.view.view.role,view.role);assert.deepEqual(state.view.view.entityIds,[view.entityId]);assert.equal(state.list.code,'ACCESS_REFUSED');assert.equal(state.forged.code,'REQUEST_REFUSED');
  }
  assert.equal((await driver.evaluate(`window.sirenWindow.openView({role:'docs',entityId:'doc_a',projectId:'forged'})`)).code,'REQUEST_REFUSED');
  assert.equal((await driver.evaluate(`window.sirenWindow.openView({role:'code',entityId:${JSON.stringify(refs[0].sourceId)},version:999})`)).ok,false);
  operation='native close and revocation'; const closed=await driver.evaluate(`window.sirenWindow.closeView({windowId:${JSON.stringify(views[0].windowId)}})`);assert.equal(closed.ok,true);
  assert.equal((await driver.evaluate(`window.sirenWindow.focusView({windowId:${JSON.stringify(views[0].windowId)}})`)).code,'VIEW_REFUSED');
  operation='all-shell Lock'; assert.equal((await driver.evaluate('window.sirenDesktop.lockPin()')).ok,true);
  assert.equal((await driver.evaluate('window.sirenDesktop.getPinState()')).unlocked,false);
  await driver.evaluate('setTimeout(()=>location.reload(),0);true'); await driver.waitFor('window.sirenDesktopBootstrap?.mode === "locked"');
  assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'),null);
  assert.equal((await driver.evaluate('window.sirenWindow.listViews()')).code,'SENDER_REFUSED');
  const after=await driver.send('Target.getTargets');assert.equal(after.targetInfos.filter(target=>target.url.startsWith('siren://app/windows/')).length,0);
  assert.deepEqual(await projects.readProject(original.project.id),original);assert.deepEqual(await projects.readProject(migrated.newProjectId),migrated.snapshot);
  operation='owned close';await driver.evaluate('window.sirenDesktop.requestClose()');await driver.waitForExit();
  const afterInputs=await capture();assert.deepEqual(afterInputs,inputs);
  const result={completed:true,status:'COMPLETE',inputs,afterInputs,scope:'Actual native two Code and two Docs: exact admitted own content/SHA/version, opposite source/document sentinel absent and cross-source reads refused; caller/preload isolation, foreign scope/version refusal, native close/revocation, all-view Lock/null bootstrap and original/migrated disk invariance. Separate modern oracle; old data-free ADVERSE unchanged. No exhaustive privacy or release approval.',probeSha256};
  await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({evidence,...result}));
} catch(error) {
  await writeFile(join(evidence,'result.json'),JSON.stringify({completed:false,operation,error:error.message,probeSha256},null,2));console.error(JSON.stringify({evidence,operation,error:error.message}));process.exitCode=1;
} finally {
  for(const peer of peers)peer.close();if(driver){await writeFile(join(evidence,'electron.log'),driver.logs());await driver.close();}
}
