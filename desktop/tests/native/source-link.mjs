import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
import {launchDesktop,unlockDesktop} from './drive.mjs';
import {attachNativePage} from './attach-page.mjs';

const evidence=resolve('evidence/source-link',new Date().toISOString().replaceAll(':','-'));await mkdir(evidence,{recursive:true});
const packageAt=process.argv.indexOf('--package'),packageRoot=packageAt<0?null:resolve(process.argv[packageAt+1]||'');
let packageReceipt=null,packageCopy=null;
if(packageRoot){
 packageReceipt=JSON.parse(await readFile(join(packageRoot,'BUILD-IDENTITY.json'),'utf8'));assert.equal(packageReceipt.kind,'development-preview');assert.equal(packageReceipt.releaseAdmitted,false);
 packageCopy=join(evidence,'Pachet-Știință-Code');await cp(packageRoot,packageCopy,{recursive:true,errorOnExist:true,force:false});
 const archive=await readFile(join(packageCopy,'App','versions','0.1.0','resources','app.asar'));assert.equal(createHash('sha256').update(archive).digest('hex'),packageReceipt.appArchive.sha256);
}
const data=packageCopy?join(packageCopy,'Data'):join(evidence,'owned-data');await mkdir(data,{recursive:true});
const paths=['src/main.mjs','src/windows/code-docs.mjs','src/windows/docs.mjs','src/windows/working-sources.mjs','src/windows/source-bridge.mjs','src/windows/preload.cjs','src/windows/coordinator.mjs','src/ui/windows/code.js','src/ui/code/docs-links.js','src/ui/windows/docs.js','build/windows.mjs','generated/windows/code.html','generated/windows/docs.html','tests/native/source-link.mjs','tests/native/attach-page.mjs'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),capture=async()=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,hash(await readFile(path))]))),inputs=await capture();
const projects=new ProjectStore(data),sources=new SourceRepository(data),original=await projects.createProject({label:'Explicit native Docs links',json:'{}'}),lineCount=process.argv.includes('--300k')?300000:100000;
const text=Array.from({length:lineCount},(_,i)=>`value_${i} = ${i} # Python Ș😀`).join('\n')+'\n';
const ref=await sources.importSource({projectId:original.project.id,bytes:Buffer.from(text)}),point={sourceId:ref.sourceId,version:1,sha256:ref.sha256};
const docs=['doc-a','doc-b'].map(id=>({id,title:id==='doc-a'?'Agent <b>literal</b>':'Unchanged agent',agent:{name:id},releases:[{id:'historic',sourceRef:point}],blocks:[{id:'knowledge-a',kind:'knowledge',rows:[{id:'row-a',title:'Python agent',sourceRef:point},{id:'row-b',title:'Keep other row',sourceRef:point}]}]}));
assert.equal((await commitManifest({projects,repository:sources,projectId:original.project.id,baseRevision:1,sourceRefs:[ref],metadata:{workpapers:docs},operationId:'initial-link-source'})).ok,true);
const selected=await projects.readProject(original.project.id),result={status:'ADVERSE',inputs,lineCount,utf8Bytes:Buffer.byteLength(text),cases:[],scope:'Actual production native Code edit and explicit chosen-row Docs link, cancellation, stale CAS, refresh, native close/reopen and Lock with exact unchanged historical source/other Docs. No physical monitor qualification.'};let driver;
if(packageReceipt){await writeFile(join(data,'session-selection.json'),JSON.stringify({schema:1,accountId:null,projectId:original.project.id}));result.package={sourceCommit:packageReceipt.sourceCommit,archive:packageReceipt.appArchive,runtime:packageReceipt.runtimeBinary};}
const keys=async(page,key,code,windowsVirtualKeyCode,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await page.send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode,modifiers});};
try{
 driver=await launchDesktop(packageCopy?{executable:join(packageCopy,packageReceipt.appRelativePath),packaged:true}:{extraArgs:[`--siren-test-root=${data}`,`--siren-test-project=${original.project.id}`]});result.ownedPid=driver.pid;
 await unlockDesktop(driver,{pin:'4826',autoSetup:true,surface:'home'});await driver.waitFor('document.getElementById("homeModule-code")!=null');
 await driver.click('#homeModule-code');await driver.waitFor('document.querySelector(".home-library [data-entity-id]")!=null');await driver.click('.home-library [data-entity-id]');
 await driver.waitFor('(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.some(v=>v.role==="code")})()');
 let views=(await driver.evaluate('window.sirenWindow.listViews()')).views;const immutable=views.find(view=>view.role==='code');
 const reader=await attachNativePage(driver,'siren://app/windows/code.html?windowId='+immutable.windowId);await reader.waitFor('document.body.dataset.sourceReady==="true"');
 await driver.click('#homeModule-docs');await driver.waitFor('document.querySelector(".home-library [data-entity-id=doc-a]")!=null');await driver.click('.home-library [data-entity-id=doc-a]');
 await driver.waitFor('(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.some(v=>v.role==="docs")})()');
 views=(await driver.evaluate('window.sirenWindow.listViews()')).views;const docsView=views.find(view=>view.role==='docs'),docReader=await attachNativePage(driver,'siren://app/windows/docs.html?windowId='+docsView.windowId);
 await docReader.waitFor('document.body.dataset.documentReady==="true"');const beforeDoc=await docReader.evaluate('window.sirenDocsRead.getDocument()');assert.equal(beforeDoc.ok,true);assert.deepEqual(beforeDoc.document,docs[0]);
 await reader.click('#openWorkingCopy');await driver.waitFor('(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.filter(v=>v.role==="code").length===2})()');
 views=(await driver.evaluate('window.sirenWindow.listViews()')).views;let editView=views.find(view=>view.role==='code'&&view.windowId!==immutable.windowId),editor=await attachNativePage(driver,'siren://app/windows/code.html?windowId='+editView.windowId);
 await editor.waitFor('document.body.dataset.sourceReady==="true"');const insertion='\ndef documented_agent(context: dict[str, int]) -> int:\n    return sum(context.values())\n';
 await editor.click('.cm-content');await keys(editor,'End','End',35,2);await keys(editor,'Enter','Enter',13);await editor.send('Input.insertText',{text:insertion.slice(1)});await editor.waitFor('Number(document.body.dataset.sourceVersion)===3');
 assert.deepEqual(await sources.exportSource({projectId:original.project.id,sourceId:ref.sourceId,version:3}),Buffer.from(text+insertion));assert.deepEqual(await projects.readProject(original.project.id),selected);
 await editor.click('#linkCodeDocs');await editor.waitFor('document.querySelector(".code-docs-dialog")?.open===true');
 assert.equal(await editor.evaluate('document.querySelector(".code-docs-dialog").textContent.includes("Agent <b>literal</b>")'),true);assert.equal(await editor.evaluate('document.querySelector(".code-docs-dialog b")'),null);
 await editor.screenshot(join(evidence,'link-selector.png'));await editor.click('.code-docs-actions button:nth-child(2)');await editor.waitFor('document.querySelector(".code-docs-dialog")==null');assert.deepEqual(await projects.readProject(original.project.id),selected);
 result.cases.push({name:'actual large Python edit remains separate from Docs and cancelling the explicit target dialog retains the exact selected project',ok:true});
 const oldTargets=await editor.evaluate('window.sirenCodeDocs.listTargets({offset:0})');assert.equal(oldTargets.total,4);
 await editor.click('#linkCodeDocs');await editor.waitFor('document.querySelector(".code-docs-dialog")?.open===true');await editor.click('.code-docs-target input');await editor.click('.code-docs-actions button:last-child');
 await editor.waitFor('document.querySelector(".code-docs-dialog")==null&&document.getElementById("viewStatus").textContent.includes("Docs now links source version 3")');
 const linked=await projects.readProject(original.project.id),metadata=JSON.parse(linked.json),latest=await sources.getMetrics({projectId:original.project.id,sourceId:ref.sourceId}),expectedDocs=structuredClone(docs);
 expectedDocs[0].blocks[0].rows[0].sourceRef={sourceId:latest.sourceId,version:3,sha256:latest.sha256};assert.deepEqual(metadata.workpapers,expectedDocs);assert.equal(linked.revision,selected.revision+1);assert.equal(linked.sourceRefs.length,2);assert.deepEqual(linked.sourceRefs.find(value=>value.version===1),ref);
 assert.equal(await reader.evaluate('document.body.dataset.sourceSha256'),ref.sha256);assert.deepEqual(await sources.exportSource({projectId:original.project.id,sourceId:ref.sourceId,version:1}),Buffer.from(text));
 await docReader.click('#retryDocument');await docReader.waitFor('document.body.dataset.documentReady==="true"');const refreshed=await docReader.evaluate('window.sirenDocsRead.getDocument()');assert.equal(refreshed.ok,true);assert.deepEqual(refreshed.document,expectedDocs[0]);
 result.cases.push({name:'actual explicit pointer selection changes exactly one Docs row, retains agent/releases/other Docs and old source, and native Docs refresh reads the new selected manifest',ok:true});
 const committed=await editor.evaluate(`window.sirenSource.commitSource({sourceId:${JSON.stringify(ref.sourceId)},expectedVersion:3,operationId:"native-stale-proof"})`);assert.equal(committed.ok,true);
 const oldTarget=oldTargets.targets[0],stale={documentId:oldTarget.documentId,rowId:oldTarget.rowId,expectedDocumentVersion:oldTarget.documentVersion,operationId:'native-stale-link',sourceReceipt:committed};
 const refusal=await editor.evaluate(`window.sirenCodeDocs.commitCodeToDocs(${JSON.stringify(stale)})`);assert.equal(refusal.code,'DOCUMENT_CONFLICT');assert.deepEqual(await projects.readProject(original.project.id),linked);
 assert.equal((await reader.evaluate('window.sirenCodeDocs.listTargets({})')).code,'ACCESS_REFUSED');assert.equal((await docReader.evaluate('window.sirenCodeDocs.listTargets({})')).code,'ACCESS_REFUSED');
 result.cases.push({name:'real stale document CAS and readonly Code/Docs link attempts refuse without changing the selected manifest',ok:true});
 await editor.click('#closeView');await driver.waitFor('(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.filter(v=>v.role==="code").length===1&&!document.body.inert})()');
 await reader.click('#openWorkingCopy');await driver.waitFor('(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.filter(v=>v.role==="code").length===2})()');
 views=(await driver.evaluate('window.sirenWindow.listViews()')).views;editView=views.find(view=>view.role==='code'&&view.windowId!==immutable.windowId);editor=await attachNativePage(driver,'siren://app/windows/code.html?windowId='+editView.windowId);await editor.waitFor('document.body.dataset.sourceReady==="true"&&document.body.dataset.sourceVersion==="3"');
 await editor.click('#linkCodeDocs');await editor.waitFor('document.querySelector(".code-docs-dialog")?.open===true');
 await driver.click('#homeLock');await driver.waitFor('window.sirenDesktopBootstrap.mode==="locked"');assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'),null);assert.equal((await driver.send('Target.getTargets')).targetInfos.some(target=>target.url.startsWith('siren://app/windows/')),false);
 assert.deepEqual(await projects.readProject(original.project.id),linked);assert.deepEqual(await sources.exportSource({projectId:original.project.id,sourceId:ref.sourceId,version:3}),Buffer.from(text+insertion));
 result.cases.push({name:'native working Close/reopen and all-view Lock with an open link dialog retain the exact explicitly linked manifest and source version',ok:true});result.status='COMPLETE';
}catch(cause){result.error={message:cause.message,stack:cause.stack};try{await driver?.screenshot(join(evidence,'failure.png'));result.runtimeLog=driver?.logs().slice(-5000);const targets=(await driver.send('Target.getTargets')).targetInfos.filter(target=>target.url.startsWith('siren://app/windows/'));result.diagnostics=[];
 for(const target of targets){const page=await attachNativePage(driver,target.url);result.diagnostics.push(await page.evaluate('({url:location.href,status:document.getElementById("viewStatus")?.textContent,body:{...document.body.dataset},dialog:document.querySelector(".code-docs-dialog")?.textContent})'));await page.screenshot(join(evidence,'view-failure-'+result.diagnostics.length+'.png'));}
}catch{}}
finally{await driver?.close();result.afterInputs=await capture();result.inputsUnchanged=JSON.stringify(inputs)===JSON.stringify(result.afterInputs);if(!result.inputsUnchanged)result.status='ADVERSE';await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({evidence,status:result.status,cases:result.cases.length,error:result.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;}
