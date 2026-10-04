import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
import {launchDesktop,unlockDesktop} from './drive.mjs';
import {attachNativePage} from './attach-page.mjs';
import {hashOwnedFile} from '../../src/updates/download.mjs';

const evidence=resolve('evidence/source-edit',new Date().toISOString().replaceAll(':','-'));await mkdir(evidence,{recursive:true});
const at=process.argv.indexOf('--package'),packageRoot=at<0?null:resolve(process.argv[at+1]||'');let packageReceipt,packageCopy;
if(packageRoot){packageReceipt=JSON.parse(await readFile(join(packageRoot,'BUILD-IDENTITY.json'),'utf8'));assert.equal(packageReceipt.kind,'development-preview');assert.equal(packageReceipt.releaseAdmitted,false);packageCopy=join(evidence,'Pachet-Știință-Code');await cp(packageRoot,packageCopy,{recursive:true,errorOnExist:true,force:false});assert.equal(createHash('sha256').update(await readFile(join(packageCopy,'App/versions/0.1.0/resources/app.asar'))).digest('hex'),packageReceipt.appArchive.sha256);}
const data=packageCopy?join(packageCopy,'Data'):join(evidence,'owned-data');await mkdir(data,{recursive:true});
const paths=['src/main.mjs','src/windows/working-sources.mjs','src/windows/source-bridge.mjs','src/windows/source-reads.mjs','src/windows/preload.cjs','src/windows/coordinator.mjs','src/ui/windows/code.js','src/ui/code/editor-adapter.js','src/ui/code/source-client.js','src/ui/code/view-lifecycle.js','generated/windows/code.html','tests/native/source-edit.mjs','tests/native/attach-page.mjs'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),capture=async()=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,hash(await readFile(path))]))),inputs=await capture();
const projects=new ProjectStore(data),sources=new SourceRepository(data),original=await projects.createProject({label:'Actual writable Code fixture',json:'{}'});
const lineCount=process.argv.includes('--300k')?300000:100000;
const text=Array.from({length:lineCount},(_,i)=>`value_${i} = ${i} # Python Ș😀`).join('\n')+'\n';
const ref=await sources.importSource({projectId:original.project.id,bytes:Buffer.from(text)});
const doc={id:'doc-a',title:'Keep linked Docs unchanged',blocks:[{id:'knowledge-a',kind:'knowledge',rows:[{id:'row-a',sourceRef:{sourceId:ref.sourceId,version:1,sha256:ref.sha256}}]}]};
assert.equal((await commitManifest({projects,repository:sources,projectId:original.project.id,baseRevision:1,sourceRefs:[ref],metadata:{workpapers:[doc]},operationId:'initial-edit-source'})).ok,true);
const selected=await projects.readProject(original.project.id),result={status:'ADVERSE',inputs,lineCount,utf8Bytes:Buffer.byteLength(text),cases:[],scope:'Actual production native Code working copy; exact immutable selected source/Docs, source draft/commit, native close/reopen and all-view Lock. No explicit Docs linking or physical-monitor admission.'};let driver;
const keys=async(page,key,code,windowsVirtualKeyCode,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await page.send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode,modifiers});};
try{
 if(packageReceipt)await writeFile(join(data,'session-selection.json'),JSON.stringify({schema:1,accountId:null,projectId:original.project.id}));
 driver=await launchDesktop(packageCopy?{executable:join(packageCopy,packageReceipt.appRelativePath),packaged:true}:{extraArgs:[`--siren-test-root=${data}`,`--siren-test-project=${original.project.id}`]});result.ownedPid=driver.pid;
 await unlockDesktop(driver,{pin:'4826',autoSetup:true,surface:'home'});await driver.waitFor('document.getElementById("homeModule-code")!=null');
 await driver.click('#homeModule-code');await driver.waitFor('document.querySelector(".home-library [data-entity-id]")!=null');await driver.click('.home-library [data-entity-id]');
 await driver.waitFor('(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.some(v=>v.role==="code")})()');
 let views=(await driver.evaluate('window.sirenWindow.listViews()')).views;const immutable=views.find(view=>view.role==='code');assert.ok(immutable);
 const reader=await attachNativePage(driver,'siren://app/windows/code.html?windowId='+immutable.windowId);await reader.waitFor('document.body.dataset.sourceReady==="true"');
 assert.equal(await reader.evaluate('document.querySelector(".cm-content").getAttribute("contenteditable")'),'false');assert.equal(await reader.evaluate('document.body.dataset.sourceSha256'),ref.sha256);
 await reader.click('#openWorkingCopy');await driver.waitFor('(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.filter(v=>v.role==="code").length===2})()');
 views=(await driver.evaluate('window.sirenWindow.listViews()')).views;let editView=views.find(view=>view.role==='code'&&view.windowId!==immutable.windowId),editor=await attachNativePage(driver,'siren://app/windows/code.html?windowId='+editView.windowId);
 await editor.waitFor('document.body.dataset.sourceReady==="true"');assert.equal(await editor.evaluate('document.querySelector(".cm-content").getAttribute("contenteditable")'),'true');assert.equal(await editor.evaluate('document.body.dataset.sourceReadonly'),'false');
 result.cases.push({name:'actual readonly selected large source opens a separate explicit writable native Code view',ok:true});
 const insertion='\ndef reviewed_agent(context: dict[str, int]) -> int:\n    return sum(value for value in context.values() if value > 0)\n';
 await editor.click('.cm-content');await keys(editor,'End','End',35,2);await keys(editor,'Enter','Enter',13);await editor.send('Input.insertText',{text:insertion.slice(1)});await editor.waitFor('Number(document.body.dataset.sourceVersion)===3');
 assert.deepEqual(await sources.exportSource({projectId:original.project.id,sourceId:ref.sourceId,version:3}),Buffer.from(text+insertion));
 await editor.click('[data-command=save]');await editor.waitFor('document.querySelector(".siren-code-editor").textContent.includes("Source saved")');
 const latest=await sources.getMetrics({projectId:original.project.id,sourceId:ref.sourceId});assert.equal(latest.version,3);
 assert.match(await editor.evaluate('document.getElementById("viewStatus").textContent'),/Stored version 3/);
 assert.equal(await editor.evaluate('Number(document.body.dataset.sourceUnits)'),(text+insertion).length);assert.equal(await editor.evaluate('Number(document.body.dataset.sourceLines)'),latest.lines);
 assert.equal(await reader.evaluate('document.body.dataset.sourceSha256'),ref.sha256);assert.deepEqual(await projects.readProject(original.project.id),selected);
 await editor.screenshot(join(evidence,'working-copy-saved.png'));
 result.cases.push({name:'actual Python pointer/keyboard editing stores exact expected bytes and commits the source while immutable version and full Docs/project stay unchanged',ok:true});
 await editor.click('#closeView');await driver.waitFor('(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.filter(v=>v.role==="code").length===1&&!document.body.inert&&!document.getElementById("homeRoot").hidden})()');
 assert.deepEqual(await projects.readProject(original.project.id),selected);assert.deepEqual(await sources.exportSource({projectId:original.project.id,sourceId:ref.sourceId,version:3}),Buffer.from(text+insertion));
 await reader.click('#openWorkingCopy');await driver.waitFor('(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.filter(v=>v.role==="code").length===2})()');
 views=(await driver.evaluate('window.sirenWindow.listViews()')).views;editView=views.find(view=>view.role==='code'&&view.windowId!==immutable.windowId);editor=await attachNativePage(driver,'siren://app/windows/code.html?windowId='+editView.windowId);await editor.waitFor('document.body.dataset.sourceReady==="true"&&document.body.dataset.sourceVersion==="3"');assert.equal(await editor.evaluate('document.body.dataset.sourceSha256'),latest.sha256);
 result.cases.push({name:'native writable close prepares all views and reopening resumes the actual retained draft version without changing the selected Docs link',ok:true});
 await driver.click('#homeLock');await driver.waitFor('window.sirenDesktopBootstrap.mode==="locked"');
 assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'),null);assert.equal((await driver.evaluate('window.sirenDesktop.getPinState()')).unlocked,false);
 assert.equal((await driver.send('Target.getTargets')).targetInfos.some(target=>target.url.startsWith('siren://app/windows/')),false);assert.deepEqual(await projects.readProject(original.project.id),selected);
 assert.deepEqual(await sources.exportSource({projectId:original.project.id,sourceId:ref.sourceId,version:3}),Buffer.from(text+insertion));
 result.cases.push({name:'actual all-view Lock commits the working copy, destroys both Code windows and retains exact source/Docs/project bytes',ok:true});result.status='COMPLETE';
}catch(cause){result.error={message:cause.message,stack:cause.stack};try{await driver?.screenshot(join(evidence,'failure.png'));result.runtimeLog=driver?.logs().slice(-5000);
 const targets=(await driver.send('Target.getTargets')).targetInfos.filter(target=>target.url.startsWith('siren://app/windows/code.html'));result.codeDiagnostics=[];
 for(const target of targets){const page=await attachNativePage(driver,target.url);result.codeDiagnostics.push(await page.evaluate('(async()=>({url:location.href,status:document.getElementById("viewStatus")?.textContent,body:{...document.body.dataset},reference:await window.sirenSourceRead.getReference(),editorCount:document.querySelectorAll(".cm-editor").length}))()'));await page.screenshot(join(evidence,'code-failure-'+result.codeDiagnostics.length+'.png'));}
}catch{}}
finally{await driver?.close();result.afterInputs=await capture();result.inputsUnchanged=JSON.stringify(inputs)===JSON.stringify(result.afterInputs);if(!result.inputsUnchanged)result.status='ADVERSE';if(packageReceipt){result.package={sourceCommit:packageReceipt.sourceCommit,archive:packageReceipt.appArchive,runtime:packageReceipt.runtimeBinary};result.packageUnchanged=hash(await readFile(join(packageCopy,'App/versions/0.1.0/resources/app.asar')))===packageReceipt.appArchive.sha256&&JSON.stringify(await hashOwnedFile(join(packageCopy,packageReceipt.appRelativePath),1024**3))===JSON.stringify(packageReceipt.runtimeBinary);if(!result.packageUnchanged)result.status='ADVERSE';}await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({evidence,status:result.status,cases:result.cases.length,error:result.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;}
