// Wait for actual held-job admission before importing any application/driver module.
import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {readFile,writeFile,mkdir,readdir,cp,open,rename,access} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const ROOT=dirname(fileURLToPath(import.meta.url)),OUT=join(ROOT,'operation'),DATA=join(ROOT,'package','Data');
const result={status:'ADVERSE',scope:'One owned physical development-package Restore UI, exact v1/v7 bytes, session-bound Quit/family-exit/restart; no physical-keyboard, installed, hosted-equivalence or release qualification',primaryError:null,finalErrors:[],launches:[]};
const error=e=>({name:e.name,message:String(e.message).slice(0,2500),code:e.code??null});let driver,ctx,restored,go,config,route;const requests=[];
let prepareFixture,verifyRestored,inventory,sha,launchDesktop,unlockDesktop,attachNativePage,pointerExpression,stablePointerExpression,reserveInspectorPort,attachNativeKeyboard,nativeKeyboard;
let readJson=async path=>JSON.parse(await readFile(path,'utf8'));
async function retainJSON(path,value){
 const handle=await open(path,'wx');let primary;
 try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();}catch(e){primary=e;}
 try{await handle.close();}catch(e){if(primary)result.finalErrors.push({stage:'diagnostic-file-close',...error(e)});else primary=e;}
 if(primary)throw primary;
}
let save=retainJSON;
async function publishProtocol(path,value){
 const pending=path+'.pending-owned-actor';await retainJSON(pending,value);
 let absent=false;try{await access(path);}catch(e){if(e.code==='ENOENT')absent=true;else throw e;}assert(absent,'PROTOCOL_TARGET_ALREADY_EXISTS');await rename(pending,path);
}
async function phase(name){result.phase=name;await writeFile(join(OUT,'progress.json'),JSON.stringify({phase:name,at:new Date().toISOString()}));}
async function capture(name){
 const root=join(OUT,'captures',name);await mkdir(root,{recursive:true});
 for(const part of ['Projects','Recovery'])await cp(join(DATA,part),join(root,part),{recursive:true,errorOnExist:true,force:false});
 try{await writeFile(join(root,'session-selection.json'),await readFile(join(DATA,'session-selection.json')),{flag:'wx'});}catch(e){if(e.code!=='ENOENT')throw e;}
 await save(join(OUT,'captures',name+'.json'),await inventory(root));
}
async function barrier(number,stage,pid){
 const request={number,stage,pid,at:new Date().toISOString(),...(stage==='baseline'?{launchCount:result.launches.length}:{})};await publishProtocol(join(OUT,`barrier-${number}-${stage}-request.json`),request);
 const path=join(OUT,`barrier-${number}-${stage}-ack.json`),end=Date.now()+15000;
 while(Date.now()<end){try{const ack=await readJson(path);assert.equal(ack.number,number);assert.equal(ack.stage,stage);assert.equal(ack.pid,pid);assert.equal(ack.accepted,true);return ack;}catch(e){if(e.code!=='ENOENT')throw e;}await delay(100);}throw Error('HOST_PROCESS_BARRIER_TIMEOUT');
}
async function launch(number){
 await phase('launch-'+number);const inspectorPort=await reserveInspectorPort();const extraArgs=[`--inspect=127.0.0.1:${inspectorPort}`];
 assert(extraArgs.every(x=>!x.startsWith('--siren-test-project=')&&!x.startsWith('--siren-test-root=')));
 const owned=await launchDesktop({root:join(ROOT,'app'),executable:go.electron,packaged:true,extraArgs});driver=owned;
 const receipt={number,pid:driver.pid,extraArgs,launchedAt:new Date().toISOString()};result.launches.push(receipt);nativeKeyboard=await attachNativeKeyboard({port:inspectorPort,pid:driver.pid});receipt.nativeInputInspector={port:inspectorPort,pid:driver.pid,pidCheckedByMaintainedHelper:true};
 await unlockDesktop(driver,{pin:'4826',autoSetup:number===1,surface:'home'});
 await driver.waitFor('location.href==="siren://app/home.html" && window.sirenHomeView!=null');
 receipt.home=await driver.evaluate('window.sirenHome.getHomeState()');assert.equal(receipt.home.ok,true);assert.equal(receipt.home.state.selectedProjectId,number===1?route.projectId:restored.project.id);
 const until=Date.now()+10000;
 while(Date.now()<until){const events=(await readJson(join(DATA,'Recovery','sessions.json'))).events;const opened=events.filter(e=>e.event==='opened'&&e.processIdentity.pid===driver.pid&&!ctx.importedSessionIds.includes(e.sessionId));
  if(opened.length===1&&events.some(e=>e.event==='ready'&&e.sessionId===opened[0].sessionId)){receipt.opened=opened[0];break;}await delay(100);}
 assert(receipt.opened,'NEW_SESSION_BOUND_OPEN_READY_REQUIRED');assert.equal(receipt.opened.processIdentity.path.toLowerCase(),go.electron.replaceAll('/','\\').toLowerCase());
 receipt.live=await barrier(number,'live',driver.pid);await save(join(OUT,`launch-${number}.json`),receipt);return receipt;
}
async function clickRestore(selector){
 await driver.waitFor(stablePointerExpression(selector));const point=await driver.evaluate(pointerExpression(selector));assert.equal(point.hit,true);
 const record={selector,point,packets:[],requestedAt:new Date().toISOString()};requests.push(record);
 try{for(const type of ['mousePressed','mouseReleased']){const packet={type,x:point.x,y:point.y,button:'left',clickCount:1};record.packets.push({packet,acknowledged:false});await driver.send('Input.dispatchMouseEvent',packet);record.packets.at(-1).acknowledged=true;}}
 finally{await writeFile(join(OUT,'restore-click.json'),JSON.stringify(record,null,2));}
}
async function targetFor(role){
 const end=Date.now()+30000;
 while(Date.now()<end){const targets=await driver.send('Target.getTargets'),matches=targets.targetInfos.filter(t=>t.url.startsWith(`siren://app/windows/${role}.html?`));assert(matches.length<=1,'UNIQUE_NATIVE_VIEW_REQUIRED');if(matches.length===1)return matches[0];await delay(100);}
 throw Error('NATIVE_VIEW_TARGET_DEADLINE');
}
async function openRecoveredViews(number){
 await phase('recovered-views-'+number);
 if(await driver.evaluate('location.href==="siren://app/app.html"')){
  await driver.waitFor('document.querySelector("#desktopHome")!==null && '+stablePointerExpression('#desktopHome'));
  await driver.click('#desktopHome');
 }
 await driver.waitFor('location.href==="siren://app/home.html" && window.sirenHomeView!=null');
 const verified=await verifyRestored(ctx,route,await ctx.projects.readProject(restored.project.id));result['verified'+number]=verified;
 await driver.click('#homeModule-code');const selector=`.home-library-items [data-entity-id="${verified.sourceV7.sourceId}"]`;
 await driver.waitFor(`document.querySelectorAll(${JSON.stringify(selector)}).length===1`);await driver.click(selector);
 const code=await attachNativePage(driver,(await targetFor('code')).url);await code.waitFor(`document.body?.dataset?.sourceReady==='true'&&document.body.dataset.sourceId===${JSON.stringify(verified.sourceV7.sourceId)}&&document.body.dataset.sourceVersion==='1'&&document.body.dataset.sourceSha256===${JSON.stringify(route.v7.sha256)}`);
 await code.click('.cm-content');for(const type of ['keyDown','keyUp'])await code.send('Input.dispatchKeyEvent',{type,key:'End',code:'End',modifiers:2,windowsVirtualKeyCode:35});
 const tail=ctx.seven.bytes.toString('utf8').trimEnd().split('\n').at(-1);assert(tail.length>0&&tail.length<400);await code.waitFor(`document.querySelector('.cm-content')?.textContent.includes(${JSON.stringify(tail)})`);
 await code.screenshot(join(OUT,`recovered-code-${number}.png`));await save(join(OUT,`code-${number}.json`),await code.evaluate('({url:location.href,dataset:{...document.body.dataset},visibleText:document.querySelector(".cm-content")?.textContent})'));
 await driver.click('#homeModule-docs');await driver.waitFor(`document.querySelectorAll(${JSON.stringify('.home-library-items [data-entity-id="doc-a"]')}).length===1`);await driver.click('.home-library-items [data-entity-id="doc-a"]');
 const doc=await attachNativePage(driver,(await targetFor('docs')).url);await doc.waitFor('document.body?.dataset?.documentReady==="true"&&document.body.dataset.documentId==="doc-a"');await doc.screenshot(join(OUT,`recovered-docs-${number}.png`));
 await save(join(OUT,`docs-${number}.json`),await doc.evaluate('({url:location.href,dataset:{...document.body.dataset},text:document.body.textContent})'));
 await capture('recovered-'+number);
}
async function quit(number,receipt){
 await phase('quit-'+number);await capture('pre-quit-'+number);const before=(await readJson(join(DATA,'Recovery','sessions.json'))).events;assert(!before.some(e=>e.event==='clean-close'&&e.sessionId===receipt.opened.sessionId));
 const nativeURL=await driver.evaluate('location.href');assert.equal(nativeURL,'siren://app/home.html');const request={at:new Date().toISOString(),pid:driver.pid,opened:receipt.opened,beforeEvents:before,nativeInput:{url:nativeURL,key:'Q',modifiers:['control'],inspector:receipt.nativeInputInspector,beforeWindow:await nativeKeyboard.windowState(nativeURL)}};await save(join(OUT,`quit-${number}-request.json`),request);
 const inputAcknowledged=await nativeKeyboard.closeShortcut(nativeURL,'Q');assert.equal(inputAcknowledged,true);await save(join(OUT,`quit-${number}-native-input-ack.json`),{nativeInput:request.nativeInput,acknowledged:true,at:new Date().toISOString(),scope:'PID-checked owned Electron WebContents keyDown/keyUp input; no physical-keyboard claim'});nativeKeyboard.close();nativeKeyboard=null;await driver.waitForExit();
 const after=(await readJson(join(DATA,'Recovery','sessions.json'))).events;const matches=after.filter(e=>e.event==='clean-close'&&e.sessionId===receipt.opened.sessionId);assert.equal(matches.length,1);assert.deepEqual(matches[0].processIdentity,receipt.opened.processIdentity);assert(Date.parse(matches[0].at)>=Date.parse(request.at));assert(!before.some(e=>JSON.stringify(e)===JSON.stringify(matches[0])));
 const exit=driver.processExit();assert.equal(exit.exitCode,0);assert.equal(exit.signalCode,null);await writeFile(join(OUT,`electron-${number}.log`),driver.logs());await driver.close();driver=null;
 await save(join(OUT,`quit-${number}-observed-before-ack.json`),{request,cleanClose:matches[0],exit,stage:'Actual main exit and session-bound clean close observed; family barrier still pending'});
 const family=await barrier(number,'closed',receipt.pid);await save(join(OUT,`quit-${number}-result.json`),{request,cleanClose:matches[0],exit,family});await capture('after-quit-'+number);
}
try{
 result.phase='held-job-go';const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
 try{go=await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('HELD_JOB_GO_TIMEOUT')),15000);lines.once('line',text=>{clearTimeout(timer);try{ok(JSON.parse(text));}catch(e){no(e);}});});}finally{lines.close();}
 assert.equal(go.pid,process.pid);assert.equal(go.assignment.assignedActualHeldHandlePID,process.pid);assert.equal(go.assignment.limitKillOnJobClose,true);
 await retainJSON(join(OUT,'actor-attempt.json'),{go,scope:result.scope});result.phase='guarded-application-imports';
 ({prepareFixture,verifyRestored,inventory,save,readJson,sha}=await import('./fixture.mjs'));
 ({launchDesktop,unlockDesktop}=await import('./app/tests/native/drive.mjs'));
 ({attachNativePage}=await import('./app/tests/native/attach-page.mjs'));
 ({pointerExpression,stablePointerExpression}=await import('./app/tests/native/pointer.mjs'));
 ({reserveInspectorPort,attachNativeKeyboard}=await import('./app/tests/native/native-keyboard.mjs'));
 config=await readJson(join(ROOT,'config.json'));route=config.routes.packaged;result.head=config.head;await phase('prepare-fresh-synthetic-fixture');
 ctx=await prepareFixture(route,DATA,OUT);ctx.importedSessionIds=(await readJson(join(DATA,'Recovery','sessions.json'))).events.map(e=>e.sessionId);await capture('prepared');
 const initialSelectionBytes=await readFile(join(DATA,'session-selection.json'));const initialSelection=JSON.parse(initialSelectionBytes);const capturedSelection=route.files.find(row=>row.relativePath==='session-selection.json');assert(capturedSelection);assert.equal(initialSelection.schema,1);assert.equal(initialSelection.projectId,route.projectId);assert.equal(initialSelectionBytes.length,capturedSelection.bytes);assert.equal(sha(initialSelectionBytes),capturedSelection.sha256);result.initialSelection={selection:initialSelection,bytes:initialSelectionBytes.length,sha256:sha(initialSelectionBytes),scope:'Existing captured packaged selection, preserved without rewrite or override'};await save(join(OUT,'initial-selection.json'),result.initialSelection);
 assert.equal(result.launches.length,0);await phase('pre-electron-harness-baseline');result.harnessBaseline=await barrier(0,'baseline',process.pid);
 const first=await launch(1);await phase('open-real-recovery-dialog');
 await driver.evaluate('window.sirenHome.openModule({surface:"diagrams"})').catch(()=>{});await driver.waitFor('location.href==="siren://app/app.html"&&document.getElementById("desktopOptions")!=null');
 await driver.evaluate('window.sirenDesktopAdmitted()');await driver.waitFor('(async()=>{const r=await window.sirenWindow.getView();return r?.ok===true&&r.view.role==="workspace";})()');
 const beforeAdmission=await driver.evaluate('(async()=>({view:await window.sirenWindow.getView(),selectionGeneration:window.sirenDesktopBootstrap.selectionGeneration}))()');assert.equal(beforeAdmission.view.view.projectId,route.projectId);await save(join(OUT,'workspace-before-restore.json'),beforeAdmission);
 await driver.click('#desktopOptions');await driver.click('#desktopRecovery');await driver.waitFor('document.getElementById("desktopRecoveryPanel")?.open===true');
 const row=`#desktopRecoveryPanel [data-point-id="${ctx.point.id}"]`;const observed=await driver.evaluate(`(()=>{const r=document.querySelectorAll(${JSON.stringify(row)});return {count:r.length,text:r[0]?.textContent};})()`);assert.equal(observed.count,1);assert(observed.text.includes('revision 3'));await save(join(OUT,'point-dom.json'),{pointId:ctx.point.id,...observed});await driver.screenshot(join(OUT,'recovery-before-click.png'));
 await phase('single-trusted-restore-click');await clickRestore('#recover-'+ctx.point.id);
 await driver.waitFor(`window.sirenDesktopBootstrap?.snapshot?.project?.id&&window.sirenDesktopBootstrap.snapshot.project.id!==${JSON.stringify(route.projectId)}`);
 const selected=await readJson(join(DATA,'session-selection.json'));restored=await ctx.projects.readProject(selected.projectId);assert.notEqual(restored.project.id,route.projectId);await verifyRestored(ctx,route,restored);await capture('after-restore');
 await driver.evaluate('window.sirenDesktopAdmitted()');await driver.waitFor('(async()=>{const r=await window.sirenWindow.getView();return r?.ok===true&&r.view.role==="workspace";})()');
 const afterAdmission=await driver.evaluate('(async()=>({view:await window.sirenWindow.getView(),selectionGeneration:window.sirenDesktopBootstrap.selectionGeneration,views:await window.sirenWindow.listViews()}))()');assert.equal(afterAdmission.view.view.projectId,restored.project.id);assert(afterAdmission.view.view.epoch>beforeAdmission.view.view.epoch);assert(afterAdmission.selectionGeneration>beforeAdmission.selectionGeneration);assert.equal(afterAdmission.views.ok,true);assert(afterAdmission.views.views.every(v=>v.projectId===restored.project.id&&v.epoch===afterAdmission.view.view.epoch));await save(join(OUT,'workspace-after-restore.json'),afterAdmission);
 await openRecoveredViews(1);await quit(1,first);const selectionBytes=await readFile(join(DATA,'session-selection.json'));await save(join(OUT,'persisted-selection-before-restart.json'),{selection:JSON.parse(selectionBytes),bytes:selectionBytes.length,sha256:sha(selectionBytes)});
 const second=await launch(2);assert.notEqual(second.pid,first.pid);assert.notEqual(second.opened.sessionId,first.opened.sessionId);assert.deepEqual(await readFile(join(DATA,'session-selection.json')),selectionBytes);await openRecoveredViews(2);await quit(2,second);
 const final=await inventory(DATA);const protectedPath=p=>p===`Projects/${route.projectId}`||p.startsWith(`Projects/${route.projectId}/`)||p===`Recovery/${route.projectId}`||p.startsWith(`Recovery/${route.projectId}/`);
 assert.deepEqual(final.files.filter(r=>protectedPath(r.relativePath)),ctx.prepared.files.filter(r=>protectedPath(r.relativePath)));assert.deepEqual(final.directories.filter(protectedPath),ctx.prepared.directories.filter(protectedPath));
 result.originalsAndPointsUnchanged=true;result.status='NATIVE_RESTORE_V7_QUIT_RESTART_COMPLETE_REQUIRES_INDEPENDENT_DATA';
}catch(e){result.primaryError=error(e);}
finally{
 if(nativeKeyboard){try{nativeKeyboard.close();nativeKeyboard=null;}catch(e){result.finalErrors.push({stage:'native-inspector-cleanup',...error(e)});}}
 if(driver){try{await writeFile(join(OUT,'electron-adverse.log'),driver.logs());await driver.screenshot(join(OUT,'adverse.png'));}catch(e){result.finalErrors.push({stage:'adverse-observation',...error(e)});}try{result.cleanupOnly=true;await driver.close();}catch(e){result.finalErrors.push({stage:'cleanup-only',...error(e)});}}
 if(typeof inventory==='function'){try{await capture('actor-final');}catch(e){result.finalErrors.push({stage:'raw-final',...error(e)});}}else result.rawDataUnavailableBeforeImports=true;
 if(result.finalErrors.length||result.cleanupOnly)result.status='ADVERSE';
 try{await retainJSON(join(OUT,'actor-result.json'),result);}catch(e){result.finalErrors.push({stage:'result-retention',...error(e)});result.status='ADVERSE';result.fallbackDiagnosticOnly=true;}
}
console.log(JSON.stringify(result));if(result.status!=='NATIVE_RESTORE_V7_QUIT_RESTART_COMPLETE_REQUIRES_INDEPENDENT_DATA')process.exitCode=1;
