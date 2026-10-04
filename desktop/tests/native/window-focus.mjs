import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
import {launchDesktop,unlockDesktop} from './drive.mjs';
import {attachNativePage} from './attach-page.mjs';
import {reserveInspectorPort,attachNativeKeyboard} from './native-keyboard.mjs';
import {waitForNativeCondition} from './condition.mjs';
import {exerciseNativeLayout} from './window-layout.mjs';

// Missing native accelerator routing must leave a genuinely minimized Code
// unchanged, rather than pass through renderer CDP key dispatch or a menu mock.
const evidence=resolve('evidence/window-focus',new Date().toISOString().replaceAll(':','-'));await mkdir(evidence,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const packageAt=process.argv.indexOf('--package'),packageRoot=packageAt<0?null:resolve(process.argv[packageAt+1]||'');let packageReceipt=null,packageCopy=null;
if(packageRoot){packageReceipt=JSON.parse(await readFile(join(packageRoot,'BUILD-IDENTITY.json'),'utf8'));assert.equal(packageReceipt.kind,'development-preview');assert.equal(packageReceipt.releaseAdmitted,false);packageCopy=join(evidence,'Pachet-Știință-Ferestre');await cp(packageRoot,packageCopy,{recursive:true,errorOnExist:true,force:false});assert.equal(hash(await readFile(join(packageCopy,'App/versions/0.1.0/resources/app.asar'))),packageReceipt.appArchive.sha256);}
const paths=['src/main.mjs','src/windows/registry.mjs','src/windows/focus.mjs','src/windows/layout.mjs','tests/native/window-focus.mjs','tests/native/window-layout.mjs','tests/native/native-keyboard.mjs','generated/home.html','generated/windows/code.html','generated/windows/docs.html','generated/windows/diagram.html'];
const capture=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(p))]))),inputs=await capture();
const data=packageCopy?join(packageCopy,'Data'):join(evidence,'owned-data');await mkdir(data,{recursive:true});
const projects=new ProjectStore(data),sources=new SourceRepository(data),original=await projects.createProject({label:'Owned native window focus',json:'{}'});
const text='def agent(value):\n    return value * 2\n',ref=await sources.importSource({projectId:original.project.id,bytes:Buffer.from(text),provenance:{kind:'standalone',fileName:'agent.py'}});
assert.equal((await commitManifest({projects,repository:sources,projectId:original.project.id,baseRevision:1,sourceRefs:[ref],metadata:{workpapers:[{id:'doc-a',title:'Agent documentation',blocks:[]}],diagrams:[{id:'flow-a',name:'Agent flow',source:'flowchart TD\nA-->B'}]},operationId:'owned-focus-seed'})).ok,true);
const selected=await projects.readProject(original.project.id),result={status:'ADVERSE',inputs,cases:[],scope:'Actual PID-checked Electron native menu keyboard route, Code/Docs/Diagram minimize/restore/cycle, main return, original project/source invariance and shared Lock. No physical-monitor or package admission.'};let driver,native;
if(packageReceipt){await writeFile(join(data,'session-selection.json'),JSON.stringify({schema:1,accountId:null,projectId:original.project.id}));result.package={sourceCommit:packageReceipt.sourceCommit,archive:packageReceipt.appArchive,runtime:packageReceipt.runtimeBinary};result.scope='Actual copied development package native input/restore/cycle/main/Lock, exact source/project invariance and PID-checked owned instrumentation. No physical keyboard/monitor, launcher or release admission.';}
try{
 const port=await reserveInspectorPort();driver=await launchDesktop(packageCopy?{executable:join(packageCopy,packageReceipt.appRelativePath),packaged:true,extraArgs:[`--inspect=127.0.0.1:${port}`]}:{extraArgs:[`--siren-test-root=${data}`,`--siren-test-project=${original.project.id}`,`--inspect=127.0.0.1:${port}`]});native=await attachNativeKeyboard({port,pid:driver.pid});
 await unlockDesktop(driver,{pin:'4826',autoSetup:true,surface:'home'});await driver.waitFor('document.getElementById("homeModule-code")!=null');
 const open=async(role,entityId,ready)=>{const r=await driver.evaluate('window.sirenWindow.openView('+JSON.stringify({role,entityId,...(role==='code'?{version:1}:{})})+')');assert.equal(r.ok,true,JSON.stringify(r));const url='siren://app/windows/'+role+'.html?windowId='+r.view.windowId,page=await attachNativePage(driver,url);await page.waitFor(ready);return {url,page};};
 const code=await open('code',ref.sourceId,'document.body.dataset.sourceReady==="true"'),docs=await open('docs','doc-a','document.body.dataset.documentReady==="true"'),diagram=await open('diagram','flow-a','document.body.dataset.diagramReady==="true"');
 await native.minimizeView(code.url);assert.equal((await native.windowState(code.url)).minimized,true);
 await native.windowShortcut('siren://app/home.html','Right');
 await waitForNativeCondition(async()=>{const state=await native.windowState(code.url);return !state.minimized&&state.focused;},'Next native window accelerator must restore and focus the minimized Code from Home');
 assert.deepEqual(await projects.readProject(original.project.id),selected);result.cases.push({name:'actual native Ctrl+Alt+Right restores minimized Code from Home without project writes',ok:true});
 await native.minimizeView(docs.url);await native.windowShortcut(code.url,'Right');await waitForNativeCondition(async()=>{const s=await native.windowState(docs.url);return !s.minimized&&s.focused;},'Code native next shortcut restores Docs');
 await native.minimizeView(diagram.url);await native.windowShortcut(docs.url,'Right');await waitForNativeCondition(async()=>{const s=await native.windowState(diagram.url);return !s.minimized&&s.focused;},'Docs native next shortcut restores Diagram');
 await native.windowShortcut(diagram.url,'Left');await waitForNativeCondition(async()=> (await native.windowState(docs.url)).focused,'Diagram previous shortcut returns to Docs');
 result.cases.push({name:'actual Code and Docs next shortcuts restore their minimized neighbours; Diagram previous returns to Docs',ok:true});
 await native.minimizeView('siren://app/home.html');await native.windowShortcut(docs.url,'1');await waitForNativeCondition(async()=>{const s=await native.windowState('siren://app/home.html');return !s.minimized&&s.focused;},'Satellite main shortcut restores Home');
 await driver.screenshot(join(evidence,'restored-home.png'));assert.deepEqual(await projects.readProject(original.project.id),selected);assert.deepEqual(await sources.exportSource({projectId:original.project.id,sourceId:ref.sourceId,version:1}),Buffer.from(text));result.cases.push({name:'actual native main shortcut restores minimized Home without navigating, saving or changing source bytes',ok:true});
 await exerciseNativeLayout({native,driver,code,docs,diagram,result});assert.deepEqual(await projects.readProject(original.project.id),selected);assert.deepEqual(await sources.exportSource({projectId:original.project.id,sourceId:ref.sourceId,version:1}),Buffer.from(text));
 await driver.click('#homeLock');await driver.waitFor('window.sirenDesktopBootstrap.mode==="locked"');await native.windowShortcut('siren://app/home.html','Right');assert.equal((await driver.send('Target.getTargets')).targetInfos.some(t=>t.url.startsWith('siren://app/windows/')),false);assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'),null);assert.deepEqual(await projects.readProject(original.project.id),selected);await native.displaceView('siren://app/home.html','normal');assert.equal(await native.layoutCommand(),true);const lockedAreas=await native.displayAreas();await waitForNativeCondition(async()=>{const b=(await native.windowState('siren://app/home.html')).normalBounds;return lockedAreas.some(({workArea:a})=>b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width&&b.y+b.height<=a.y+a.height);},'Locked PIN window recovered without native data grants');assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'),null);result.cases.push({name:'Lock destroys satellites and native cycling cannot reopen them; bring-back recovers only the PIN window without exposing a snapshot',ok:true});result.status='COMPLETE';
}catch(cause){result.error={message:cause.message,stack:cause.stack};await driver?.screenshot(join(evidence,'failure.png')).catch(()=>{});result.log=driver?.logs();}
finally{native?.close();await driver?.close();result.afterInputs=await capture();if(JSON.stringify(inputs)!==JSON.stringify(result.afterInputs))result.status='ADVERSE';await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({evidence,status:result.status,cases:result.cases.length,error:result.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;}
