// PREPARED ONLY: one additional hosted Windows scenario, outside the old
// docs-diagram-embeds workflow/input freeze. Never import this file in pure tests.
// Reuses that driver's owned fixture and real pointer/keyboard/bridge contracts.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {RecoveryStore} from '../../src/recovery/checkpoints.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
import {DiagramEmbedAssetStore} from '../../src/documents/diagram-embed-assets.mjs';
import {verifyDiagramSnapshot} from '../../src/documents/diagram-embed-bundle.mjs';
import {workspaceMetadata} from '../../src/windows/entities.mjs';
import {documentVersion} from '../../src/windows/docs.mjs';
import {launchDesktop,unlockDesktop} from './drive.mjs';
import {attachNativePage} from './attach-page.mjs';

if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='Kellas94/siren'||process.env.GITHUB_REF!=='refs/heads/probe/docs-clean-pending-save-20261011')throw Error('HOSTED_DISPOSABLE_WINDOWS_ONLY');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const desktopRoot=fileURLToPath(new URL('../../',import.meta.url)),evidenceParent=join(desktopRoot,'evidence/docs-clean-pending-save-native');
const evidence=join(evidenceParent,randomUUID()),data=join(evidence,'owned-data');
await mkdir(evidenceParent,{recursive:true});await mkdir(evidence);await mkdir(data);
const result={schema:1,author:'/root/access_transition_review',role:'OWNER_NATIVE_PROBE_PREPARATION',status:'ADVERSE',commit:process.env.GITHUB_SHA,startedAt:new Date().toISOString(),checks:[],cleanup:{locked:false,unlockedReadback:false,normalCloseJoined:false,fallbackAttempted:false},limitations:[
 'One development Electron scenario only; no installed/packaged, physical keyboard, arbitrary crash or power-loss qualification.',
 'Two passive public metadata receipts plus exact selected revision establish a clean flush followed by one persisted version-changing embed publication; no private invocation counter or filesystem write-attempt count is claimed.',
 'Fresh pending notifications during flush may conservatively retain the Save affordance after publication. This case does not require dismissing them or retry Save.',
 'Public event subscriptions only: no wrapper, fabricated reply, renderer/preload replacement or private publisher call.',
 'The separate hosted branch, rebuilt renderer and complete execution input manifest/workflow still require approval; this file is not wired to the old 20-case probe.'
]};
const sourcePins={
 'src/main.mjs':'2e0af8215b4cad2b4326faabb262d74b9d8b5473084efa35fe7dca1449c890a2',
 'src/windows/preload.cjs':'6c85a6f51370af238f6234c6c3b577c2e7cb1430c065b21bcd8458327b5ed5d0',
 'src/windows/docs-diagram-refresh.mjs':'acafda2271cacc13baf62b13e259ca5033bdc61f4f077fb0912d4eeee0b0c46f',
 'src/ui/windows/docs.js':'4737b32808c339a3635580abeda5650f4b676e63c2d77ecc09398154e31e6b7b',
 'src/ui/docs/draft.js':'efd7c448985201d20bbf90974fce50d1a005f9ce7d8eccc0da79ab99dda8f5fb',
 'src/ui/docs/diagram-embeds.js':'28d14b647b544d2e22667995ab0411e77d5837de77ec535907e8194d587b4342'
};
const runtimePaths=[...Object.keys(sourcePins),'generated/windows/docs.html','generated/windows/diagram.html','generated/build.json','node_modules/electron/dist/electron.exe'];
async function inputPins(){return Promise.all(runtimePaths.map(async path=>{const bytes=await readFile(resolve(desktopRoot,path));return {path,bytes:bytes.length,sha256:hash(bytes)};}));}
const check=name=>result.checks.push({name,ok:true,at:new Date().toISOString()});
const keys=async(own,key,code,vk,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await own.send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:vk,modifiers});};
const click=async(own,selector)=>{await own.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);await own.click(selector);};
const select=async(own,selector,down)=>{await click(own,selector);await keys(own,'Escape','Escape',27);await keys(own,'Home','Home',36);for(let i=0;i<down;i++)await keys(own,'ArrowDown','ArrowDown',40);await keys(own,'Tab','Tab',9);};
const source='flowchart LR\n A[Input] --> B{Check}\n B --> C[Review]\n C --> D[Store]';
const revisedSource=source.replace('C[Review]','C[Review revised]');
let driver,page,phase='renderer-preflight',projects,assets,projectId;
const saved=()=>projects.readProject(projectId);
const doc=snapshot=>workspaceMetadata(snapshot).workpapers[0];
const diagram=snapshot=>workspaceMetadata(snapshot).diagrams[0];
const embed=snapshot=>doc(snapshot).blocks.find(block=>block.kind==='diagram-embed');
const persist=async(name,value)=>writeFile(join(evidence,name),JSON.stringify(value,null,2)+'\n');
async function awaitSnapshot(predicate){const until=Date.now()+30000;while(Date.now()<until){const snapshot=await saved();if(predicate(snapshot))return snapshot;await delay(100);}throw Error('SAVED_STATE_DEADLINE');}
async function savedView(own,snapshot){await own.waitFor('document.body.dataset.documentReady==="true"&&document.body.dataset.documentVersion==='+JSON.stringify(documentVersion(snapshot,'doc-a')));}
async function attach(view){const own=await attachNativePage(driver,`siren://app/windows/${view.role}.html?windowId=${view.windowId}`);await own.waitFor(`document.body.dataset.${view.role==='docs'?'document':'diagram'}Ready==='true'`);return {view,page:own};}
async function open(role,entityId){const receipt=await driver.evaluate('window.sirenWindow.openView('+JSON.stringify({role,entityId})+')');assert.equal(receipt?.ok,true,JSON.stringify(receipt));return attach(receipt.view);}
async function working(reader,role){
 const before=await driver.evaluate('window.sirenWindow.listViews()');assert.equal(before?.ok,true);const ids=before.views.map(view=>view.windowId);
 await click(reader.page,role==='docs'?'#openWorkingDocument':'#openWorkingDiagram');
 await driver.waitFor('(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.some(v=>v.role==='+JSON.stringify(role)+'&&!'+JSON.stringify(ids)+'.includes(v.windowId));})()');
 const after=await driver.evaluate('window.sirenWindow.listViews()');assert.equal(after?.ok,true);const matches=after.views.filter(view=>view.role===role&&!ids.includes(view.windowId));assert.equal(matches.length,1);
 const own=await attach(matches[0]);await own.page.waitFor(`document.body.dataset.${role==='docs'?'document':'diagram'}Readonly==='false'`);return own;
}
// Subscriptions are consumers of the unchanged production preload. CDP console
// events carry their finite metadata back without altering any product method.
function observed(marker){const rows=[];for(const event of driver.events){if(event.method!=='Target.receivedMessageFromTarget')continue;const message=JSON.parse(event.params.message);if(message.method!=='Runtime.consoleAPICalled')continue;const args=message.params.args;if(args[0]?.value===marker){assert.equal(args.length,2);assert.equal(typeof args[1]?.value,'string');assert.ok(args[1].value.length<1024);rows.push(JSON.parse(args[1].value));}}assert.ok(rows.length<=16,'Owned single-case observation cap');return rows;}
async function preservedAssets(block,prior){for(const [kind,ref]of [['source',block.snapshot.sourceAsset],['visual',block.snapshot.visualAsset]]){const bytes=await assets.read({projectId,ref,isCurrent:()=>true});assert.deepEqual(bytes,prior[kind]);}}
try{
 for(const [path,expected]of Object.entries(sourcePins))assert.equal(hash(await readFile(resolve(desktopRoot,path))),expected,'Prepared production source identity: '+path);
 const generated=(await readFile(resolve(desktopRoot,'generated/windows/docs.html'),'utf8')).replace(/\r\n?/g,'\n');
 for(const path of ['src/ui/windows/docs.js','src/ui/docs/draft.js','src/ui/docs/diagram-embeds.js'])assert.ok(generated.includes((await readFile(resolve(desktopRoot,path),'utf8')).replace(/\r\n?/g,'\n')),'GENERATED_DOCS_STALE: '+path);
 result.inputs=await inputPins();
 phase='owned-project';projects=new ProjectStore(data);const sources=new SourceRepository(data);assets=new DiagramEmbedAssetStore({projects});const recovery=new RecoveryStore(data,{sources,assets});
 const initial=await projects.createProject({label:'Clean pending Save owned native fixture',json:'{}'});projectId=initial.project.id;
 const workspace={version:'1.131.0',diagrams:[{id:'flow-a',name:'Review flow',source}],workpapers:[{id:'doc-a',title:'Clean pending Save',type:'note',blocks:[{id:'before',kind:'heading',level:2,text:'Before the flow'},{id:'after',kind:'text',html:'<p>After the flow</p>'}],future:{preserve:'EXACT_UNKNOWN'}}],codeFiles:[]};
 const metadata={kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':JSON.stringify(workspace)},future:{preserve:'EXACT_ENVELOPE'}};
 const fixture=await commitManifest({projects,repository:sources,recovery,projectId,baseRevision:1,sourceRefs:[],metadata,operationId:'clean-pending-save-fixture'});assert.equal(fixture?.ok,true,JSON.stringify(fixture));
 result.fixture={projectId,source,revisedSource};await persist('fixture-snapshot.json',await saved());
 await writeFile(join(data,'session-selection.json'),JSON.stringify({schema:1,accountId:null,projectId}));
 phase='launch';driver=await launchDesktop({root:desktopRoot,extraArgs:['--siren-test-root='+data,'--siren-test-project='+projectId]});result.pid=driver.pid;await unlockDesktop(driver,{pin:'4826',autoSetup:true,surface:'home'});
 const reader=await open('docs','doc-a'),editor=await working(reader,'docs');page=editor.page;
 phase='insert-one-live';await savedView(page,await saved());await click(page,'.document-block-actions>button:first-child');
 await page.waitFor('document.querySelector(".document-diagram-picker")?.open===true&&document.querySelector("[data-embed-action=choose-diagram]")?.options.length===1');
 await select(page,'[data-embed-action=choose-position]',1);assert.equal(await page.evaluate('document.querySelector("[data-embed-action=choose-scope]").value'),'whole');
 await click(page,'[data-embed-action=preview]');await page.waitFor('document.querySelector(".document-diagram-picker img")?.naturalWidth>0&&!document.querySelector("[data-embed-action=confirm-insert]").disabled');
 await click(page,'[data-embed-action=confirm-insert]');await page.waitFor('document.querySelector(".document-diagram-picker")==null&&document.body.dataset.documentDirty==="false"');
 const inserted=await awaitSnapshot(snapshot=>doc(snapshot).blocks.length===3);const originalBlock=structuredClone(embed(inserted));assert.equal(originalBlock.mode,'live');assert.equal(originalBlock.scope,'whole');assert.equal(originalBlock.status,'current');assert.deepEqual(doc(inserted).blocks.map(b=>b.id),['before',originalBlock.id,'after']);
 await savedView(page,inserted);await savedView(reader.page,inserted);assert.equal(await page.evaluate('document.getElementById("saveDocument").disabled'),true,'Clean working copy has no initial pending Save');
 const originalAssets={source:await assets.read({projectId,ref:originalBlock.snapshot.sourceAsset,isCurrent:()=>true}),visual:await assets.read({projectId,ref:originalBlock.snapshot.visualAsset,isCurrent:()=>true})};assert.deepEqual(JSON.parse(originalAssets.source),diagram(inserted));
 await persist('inserted-snapshot.json',inserted);await verifyDiagramSnapshot({snapshot:inserted,assets,isCurrent:()=>true});
 const diagramReader=await open('diagram','flow-a'),diagramEditor=await working(diagramReader,'diagram');
 const referenceMarker='OWNED_CLEAN_PENDING_SAVE_REFERENCE_'+reader.view.windowId,pendingMarker='OWNED_CLEAN_PENDING_SAVE_PENDING_'+reader.view.windowId;
 await reader.page.send('Runtime.enable');assert.equal(await reader.page.evaluate(`(()=>{const a=window.sirenDocsEdit.onReferenceChanged(ref=>console.info(${JSON.stringify(referenceMarker)},JSON.stringify(ref)));const b=window.sirenDocsDiagramEvents.onPending(ref=>console.info(${JSON.stringify(pendingMarker)},JSON.stringify(ref)));window.addEventListener('beforeunload',()=>{a();b();},{once:true});return true;})()`),true);
 phase='saved-source-blocked';page=diagramEditor.page;await click(page,'#diagramSource');await keys(page,'a','KeyA',65,2);await page.send('Input.insertText',{text:revisedSource});await page.waitFor('document.body.dataset.diagramDirty==="true"');await click(page,'#saveDiagram');await page.waitFor('document.body.dataset.diagramDirty==="false"');
 const blocked=await awaitSnapshot(snapshot=>diagram(snapshot).source===revisedSource);assert.equal(blocked.revision,inserted.revision+1,'Exactly one diagram save before Docs Save');assert.deepEqual(embed(blocked),originalBlock);assert.deepEqual(doc(blocked),doc(inserted));
 page=editor.page;await page.waitFor('document.body.dataset.documentDirty==="false"&&!document.getElementById("saveDocument").hidden&&!document.getElementById("saveDocument").disabled&&!document.getElementById("documentChangesNotice").hidden&&document.getElementById("documentChangesMessage").textContent.startsWith("Diagram update pending")');
 assert.equal(await page.evaluate('document.body.dataset.documentReadonly'),'false');assert.equal(await page.evaluate('document.body.dataset.documentVersion'),documentVersion(inserted,'doc-a'));assert.deepEqual(observed(referenceMarker),[]);
 const pending=observed(pendingMarker);assert.ok(pending.some(ref=>ref.documentId==='doc-a'&&ref.diagramId==='flow-a'&&ref.reason==='working-draft'),'Actual main working lease must emit pending');
 await persist('blocked-snapshot.json',blocked);await page.screenshot(join(evidence,'clean-pending-save-enabled.png'));check('Saved diagram changed, clean working Docs blocks publication and exposes actual enabled Save');
 phase='one-explicit-save';await click(page,'#saveDocument');
 const published=await awaitSnapshot(snapshot=>embed(snapshot).snapshot.sourceHash!==originalBlock.snapshot.sourceHash);assert.equal(published.revision,blocked.revision+1,'One selected embed publication, with no clean content mutation');
 const currentBlock=embed(published),currentDiagram=diagram(published);assert.equal(currentBlock.id,originalBlock.id);assert.equal(currentBlock.mode,'live');assert.equal(currentBlock.scope,'whole');assert.equal(currentBlock.status,'current');assert.equal(currentBlock.snapshot.sourceVersion,currentDiagram.sirenNativeVersion);assert.equal(currentDiagram.source,revisedSource);assert.deepEqual(currentDiagram,{...diagram(inserted),source:revisedSource,sirenNativeVersion:2});
 assert.deepEqual(doc(published),{...doc(inserted),blocks:doc(inserted).blocks.map(block=>block.id===originalBlock.id?currentBlock:block)});assert.deepEqual(JSON.parse(published.json).future,{preserve:'EXACT_ENVELOPE'});assert.deepEqual(published.sourceRefs,inserted.sourceRefs);
 const records=await verifyDiagramSnapshot({snapshot:published,assets,isCurrent:()=>true});const sourceBytes=await assets.read({projectId,ref:currentBlock.snapshot.sourceAsset,isCurrent:()=>true});assert.deepEqual(JSON.parse(sourceBytes),currentDiagram);assert.equal(hash(sourceBytes),currentBlock.snapshot.sourceHash);await preservedAssets(originalBlock,originalAssets);
 await savedView(page,published);await savedView(reader.page,published);await page.waitFor('document.body.dataset.documentDirty==="false"&&document.body.dataset.documentSaveError==null&&document.getElementById("viewStatus").textContent.startsWith("Document saved")');
 const publicRead=await reader.page.evaluate('window.sirenDocsRead.getDocument()');assert.equal(publicRead?.ok,true);assert.equal(publicRead.readonly,true);assert.equal(publicRead.version,documentVersion(published,'doc-a'));assert.equal(publicRead.projectRevision,published.revision);assert.deepEqual(publicRead.document,doc(published));assert.equal(publicRead.sha256,hash(Buffer.from(JSON.stringify(doc(published)))));
 const receipts=observed(referenceMarker);assert.deepEqual(receipts,[{documentId:'doc-a',version:documentVersion(blocked,'doc-a'),projectRevision:blocked.revision},{documentId:'doc-a',version:documentVersion(published,'doc-a'),projectRevision:published.revision}],'Ordered real unchanged-version flush then one new-version publication');
 const viewport=`[data-embed-action=viewport][data-embed-id="${currentBlock.id}"]`;await reader.page.evaluate('document.querySelector('+JSON.stringify(viewport)+').scrollIntoView({block:"center",behavior:"instant"})');await reader.page.waitFor('document.querySelector('+JSON.stringify(viewport+' img')+')?.naturalWidth>0');
 const readerVisual=await reader.page.evaluate('document.querySelector('+JSON.stringify(viewport+' img')+').src');assert.equal(typeof readerVisual,'string');assert.ok(readerVisual.length<2796240);assert.ok(readerVisual.startsWith('data:image/svg+xml;base64,'));assert.equal(hash(Buffer.from(readerVisual.slice('data:image/svg+xml;base64,'.length),'base64')),currentBlock.snapshot.visualAsset.sha256,'Actual reader image bytes match the new saved visual');
 assert.deepEqual(await saved(),published);await persist('published-snapshot.json',published);result.publication={beforeRevision:blocked.revision,afterRevision:published.revision,receipts,reader:{version:publicRead.version,sha256:publicRead.sha256,projectRevision:publicRead.projectRevision},assets:records.map(record=>record.ref),pending:observed(pendingMarker)};await reader.page.screenshot(join(evidence,'current-saved-reader.png'));check('One actual clean Save yields native flush metadata, one persisted current embed and reader/asset readback');
 phase='normal-lock';await driver.click('#homeLock');await driver.waitFor('window.sirenDesktopBootstrap.mode==="locked"');assert.equal((await driver.send('Target.getTargets')).targetInfos.some(target=>target.url.startsWith('siren://app/windows/')),false);assert.deepEqual(await saved(),published);result.cleanup.locked=true;
 await unlockDesktop(driver,{pin:'4826',surface:'home'});const reopened=await open('docs','doc-a');page=reopened.page;await savedView(page,published);const reopenedRead=await page.evaluate('window.sirenDocsRead.getDocument()');assert.equal(reopenedRead?.ok,true);assert.deepEqual(reopenedRead.document,doc(published));await verifyDiagramSnapshot({snapshot:await saved(),assets,isCurrent:()=>true});await preservedAssets(originalBlock,originalAssets);result.cleanup.unlockedReadback=true;
 phase='normal-close';result.closeRequest=await driver.evaluate('window.sirenDesktop.requestClose()').then(reply=>({reply}),error=>({transportRetired:true,message:error.message}));await driver.waitForExit();assert.equal(driver.processExit().exitCode,0);assert.equal(driver.processExit().signalCode,null);assert.match(driver.logs(),/SIREN_CLOSE_STAGE.*"stage":"window-close"/);assert.deepEqual(await saved(),published);result.cleanup.normalCloseJoined=true;result.cleanup.process=driver.processExit();await writeFile(join(evidence,'electron.log'),driver.logs());await driver.close();driver=null;page=null;
 check('Normal Lock, genuine unlock/reopen and coordinated Close retain current and original immutable assets');result.status='BOUNDED_NATIVE_COMPLETE';
}catch(error){
 result.error={phase,name:error.name,code:error.code,message:error.message,stack:error.stack};
 try{result.ui=await(page??driver)?.evaluate('({url:location.href,body:{...document.body.dataset},text:document.body.innerText.slice(0,5000)})');await(page??driver)?.screenshot(join(evidence,'failure.png'));}catch(observation){result.failureObservation={message:observation.message};}
 // Persist adverse evidence before normal cleanup or the driver's forced fallback.
 await persist('failure-before-cleanup.json',result);if(driver)await writeFile(join(evidence,'failure-electron-before-cleanup.log'),driver.logs());
}finally{
 if(driver){try{result.cleanup.normalCloseAttempt=await driver.evaluate('window.sirenDesktop.requestClose()').then(reply=>({reply}),error=>({transportRetired:true,message:error.message}));await driver.waitForExit();result.cleanup.failedRunProcess=driver.processExit();}catch(error){result.cleanup.normalCloseError={message:error.message};}finally{result.cleanup.fallbackAttempted=true;await writeFile(join(evidence,'electron.log'),driver.logs());await driver.close().catch(error=>{result.cleanup.fallbackError={message:error.message};});}}
 if(result.inputs){try{const after=await inputPins();result.changedInputs=result.inputs.filter((row,i)=>JSON.stringify(row)!==JSON.stringify(after[i]));if(result.changedInputs.length)result.status='ADVERSE';}catch(error){result.status='ADVERSE';result.inputReadbackError={message:error.message};}}
 result.finishedAt=new Date().toISOString();await persist('result.json',result);console.log(JSON.stringify({evidence,status:result.status,checks:result.checks.length,error:result.error}));process.exitCode=result.status==='BOUNDED_NATIVE_COMPLETE'?0:1;
}
