import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {ProjectStore} from 'file:///C:/Claude/SIREN_WORK/portable/desktop/src/projects/store.mjs';
import {SourceRepository} from 'file:///C:/Claude/SIREN_WORK/portable/desktop/src/sources/repository.mjs';
import {RecoveryStore} from 'file:///C:/Claude/SIREN_WORK/portable/desktop/src/recovery/checkpoints.mjs';
import {commitManifest} from 'file:///C:/Claude/SIREN_WORK/portable/desktop/src/sources/manifest.mjs';
import {parseSourceBundle} from 'file:///C:/Claude/SIREN_WORK/portable/desktop/src/sources/bundle-import.mjs';
import {launchDesktop,unlockDesktop} from 'file:///C:/Claude/SIREN_WORK/portable/desktop/tests/native/drive.mjs';
import {reserveInspectorPort} from 'file:///C:/Claude/SIREN_WORK/portable/desktop/tests/native/native-keyboard.mjs';
import {copiedPackageContext} from 'file:///C:/Claude/SIREN_WORK/portable/desktop/tests/native/package-context.mjs';
import {fileURLToPath} from 'node:url';

// Actual native menu/input -> Home command -> preload -> main exporter. Only
// the OS destination chooser is adapted in this PID-checked owned process.
// No product IPC, authority, PIN, crypto or storage operation is replaced.
const root="C:\\Claude\\SIREN_WORK\\portable\\desktop",evidence=resolve(root,'evidence/workspace-surface/home-backup-neutral-cancel/runs',new Date().toISOString().replaceAll(':','-'));
assert.ok(process.argv.includes('--package'),'This one-off requires an explicit development preview --package root');
await mkdir(evidence,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFile=async path=>{const digest=createHash('sha256');for await(const chunk of createReadStream(path))digest.update(chunk);return digest.digest('hex');};
async function capture(){
 const paths=[];
 async function walk(path){const entry=await lstat(path);assert.equal(entry.isSymbolicLink(),false,'No linked qualification inputs');if(entry.isDirectory()){for(const name of (await readdir(path)).sort())await walk(join(path,name));}else if(entry.isFile())paths.push(path);}
 for(const name of ['src','build','generated','tests','baseline','package.json','package-lock.json'])await walk(join(root,name));
 paths.push(join(root,'node_modules/electron/dist/electron.exe'),fileURLToPath(import.meta.url));
 return Object.fromEntries(await Promise.all(paths.sort().map(async path=>[relative(root,path).replaceAll('\\','/'),await hashFile(path)])));
}
async function attachChooser({port,pid}){
 let target;const deadline=Date.now()+15000;
 while(Date.now()<deadline){try{target=(await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)})).json()).find(t=>t.type==='node');if(target)break;}catch{}await delay(100);}
 assert.ok(target,'Owned main inspector required');const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let serial=0;
 await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',event=>{const reply=JSON.parse(event.data),request=pending.get(reply.id);if(!request)return;pending.delete(reply.id);clearTimeout(request.timer);reply.error?request.no(Error(JSON.stringify(reply.error))):request.yes(reply.result);});
 const evaluate=expression=>new Promise((yes,no)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);no(Error('Owned chooser inspector deadline'));},10000);pending.set(id,{timer,yes:result=>result.exceptionDetails?no(Error(JSON.stringify(result.exceptionDetails))):yes(result.result.value),no});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});
 assert.equal(await evaluate('process.pid'),pid);
 const electron=`process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron')`;
 await evaluate(`(()=>{const e=${electron},original=e.dialog.showSaveDialog;const state={calls:[],next:null,waiting:null,restore:()=>{if(state.waiting)state.waiting({canceled:true});e.dialog.showSaveDialog=original;}};globalThis.__ownedHomeBackupChooser=state;e.dialog.showSaveDialog=(...args)=>{const options=args.at(-1);if(options?.title!=='Export local SIREN data'||!state.next)throw Error('Unexpected owned backup chooser');const next=state.next;state.next=null;const call={title:options.title,defaultPath:options.defaultPath,mode:next.mode,delivered:false};state.calls.push(call);if(next.mode==='pending')return new Promise(resolve=>{state.waiting=reply=>{state.waiting=null;call.delivered=true;resolve(reply);};});call.delivered=true;return Promise.resolve(next.mode==='cancel'?{canceled:true}:{canceled:false,filePath:next.file});};return true;})()`);
 const ownedFile=file=>assert.equal(relative(evidence,file).startsWith('..'),false,'Chooser can name only this owned evidence tree');
 return {
  configure:async(mode,file)=>{assert.ok(['save','cancel','pending'].includes(mode));if(mode==='save')ownedFile(file);return evaluate(`(()=>{const s=globalThis.__ownedHomeBackupChooser;if(s.next||s.waiting)throw Error('Chooser already configured');s.next=${JSON.stringify({mode,file})};return true;})()`);},
  release:async file=>{ownedFile(file);return evaluate(`(async()=>{const s=globalThis.__ownedHomeBackupChooser;if(!s.waiting)throw Error('No pending chooser');s.waiting({canceled:false,filePath:${JSON.stringify(file)}});await new Promise(resolve=>setImmediate(resolve));return {waiting:!!s.waiting,calls:s.calls};})()`);},
  observations:()=>evaluate(`(()=>{const s=globalThis.__ownedHomeBackupChooser;return {waiting:!!s.waiting,configured:!!s.next,calls:s.calls};})()`),
  command:async(label,keyboard=false)=>evaluate(`(()=>{const e=${electron},w=e.BaseWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL()==='siren://app/home.html');if(!w)throw Error('Actual Home window required');w.focus();w.webContents.focus();if(${JSON.stringify(keyboard)}){for(const type of ['keyDown','keyUp'])w.webContents.sendInputEvent({type,keyCode:'E',modifiers:['control','alt']});return 'native-before-input-event';}const items=e.Menu.getApplicationMenu().items.flatMap(item=>item.submenu?.items??[]),item=items.find(item=>item.label===${JSON.stringify(label)});if(!item)throw Error('Actual native menu command required');item.click({},w,null);return 'native-menu-callback';})()`),
  close:async()=>{try{await evaluate('globalThis.__ownedHomeBackupChooser.restore();delete globalThis.__ownedHomeBackupChooser;true');}finally{ws.close();}}
 };
}
const result={status:'ADVERSE',author:'/root/hosted_resume_retention',executionOwner:'/root',originalFixtureAuthor:'/root/media_batch_review',scope:'One-off owned copied development-preview probe prepared by /root/hosted_resume_retention for execution by ROOT; not independent approval. Actual native menu callback and WebContents keyboard input, actual Home/preload/main/exporter/atomic storage/PIN. PID-checked fixture replaces only OS Save chooser. Concurrency calls use the real Home bridge explicitly. Requires --package, copied Data and verified ASAR/runtime/process-reader before and after actual exit. No manual OS chooser, readonly native mode, physical monitor, release or maximum-capacity qualification.',cases:[],startedAt:new Date().toISOString()};
let driver,chooser,packaged;
try{
 result.inputs=await capture();
 result.probe={path:fileURLToPath(import.meta.url),sha256:hash(await readFile(fileURLToPath(import.meta.url))),baseSha256:'99d8109c65f5d678fd41184f857c17de69be5e41a5c7f57c5b4ceb545365d8f0'};
 result.packageRequest={preview:resolve(process.argv[process.argv.indexOf('--package')+1]),expectedCopy:join(evidence,'Pachet-Știință-UI')};
 packaged=await copiedPackageContext(evidence);assert.ok(packaged,'Copied package context required');
 result.package={sourceCommit:packaged.receipt.sourceCommit,copy:packaged.copy,archive:packaged.receipt.appArchive,runtime:packaged.receipt.runtimeBinary,processReader:packaged.receipt.processReader};
 await packaged.verify();result.packageVerifiedBefore=true;
 const data=packaged.data,outputs=join(evidence,'outputs');await mkdir(data,{recursive:true});assert.deepEqual(await readdir(data),[],'Copied fixture Data must begin empty');await mkdir(outputs);
 const projects=new ProjectStore(data),sources=new SourceRepository(data),recovery=new RecoveryStore(data,{sources});
 const first=await projects.createProject({label:'Owned Home backup 100k',json:'{}'}),lineCount=100000;
 const sourceBytes=Buffer.from('\ufeff'+Array.from({length:lineCount},(_,i)=>`entry_${i} = "Ș😀"`).join('\r\n'));
 const ref=await sources.importSource({projectId:first.project.id,bytes:sourceBytes,provenance:{agentId:'backup-fixture-agent',opaque:'preserved'}}),point={sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256};
 const metadata={kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':JSON.stringify({diagrams:[{id:'flow',name:'Backup diagram',source:'flowchart TD\nA[Saved]-->B[Backup]'}],workpapers:[{id:'doc-a',title:'Backup context',blocks:[{id:'knowledge-a',kind:'knowledge',reasoningEffort:'',rows:[{id:'row-a',name:'agent.py',fileType:'python',role:'code',notes:'Saved source',sourceRef:point}]}],agent:null,releases:[]}],codeFiles:[{id:'file-a',name:'agent.py',language:'python',sourceRef:point}]})},opaque:{original:'retained'}};
 assert.equal((await commitManifest({projects,repository:sources,recovery,projectId:first.project.id,baseRevision:1,sourceRefs:[ref],metadata,operationId:'home-backup-fixture'})).ok,true);
 const original=await projects.readProject(first.project.id),expected=await recovery.exportSourceSnapshot(original);
 await writeFile(join(data,'session-selection.json'),JSON.stringify({schema:1,accountId:null,projectId:first.project.id}));
 result.fixture={projectId:first.project.id,revision:original.revision,lineCount,sourceBytes:sourceBytes.length,sourceSha256:hash(sourceBytes),expectedBundleBytes:expected.length,expectedBundleSha256:hash(expected)};
 const port=await reserveInspectorPort();driver=await launchDesktop({...packaged.launch,extraArgs:[`--inspect=127.0.0.1:${port}`]});result.ownedPid=driver.pid;
 chooser=await attachChooser({port,pid:driver.pid});await unlockDesktop(driver,{pin:'4826',autoSetup:true,surface:'home'});
 const ready=()=>driver.waitFor(`location.href==='siren://app/home.html'&&window.sirenHomeView!=null&&document.getElementById('homeRoot')?.getAttribute('aria-busy')==='false'`);
 await ready();assert.equal((await driver.evaluate('window.sirenHome.getHomeState()')).state.selectedProjectId,first.project.id);
 const verifyOutput=async file=>{const bytes=await readFile(file);assert.deepEqual(bytes,expected);const decoded=parseSourceBundle(bytes);assert.deepEqual(decoded.snapshot,original);assert.deepEqual(decoded.metadata,metadata);assert.equal(decoded.sources.length,1);assert.deepEqual(decoded.sources[0].ref,ref);assert.deepEqual(decoded.sources[0].bytes,sourceBytes);return {bytes:bytes.length,sha256:hash(bytes),sourceSha256:hash(decoded.sources[0].bytes)};};
 const saved=join(outputs,'saved.siren-backup');await chooser.configure('save',saved);await chooser.command('Export saved backup…');
 await driver.waitFor(`document.getElementById('homeStatus')?.textContent.startsWith('Saved backup exported · revision ${original.revision}.')&&document.getElementById('homeRoot')?.getAttribute('aria-busy')==='false'`);
 result.cases.push({name:'Actual native menu -> Home exports exact saved source bundle',ok:true,...await verifyOutput(saved)});
 await chooser.configure('cancel');await chooser.command('Export saved backup…',true);
 await driver.waitFor(`document.getElementById('homeStatus')?.textContent==='Backup export cancelled.'&&document.getElementById('homeRoot')?.getAttribute('aria-busy')==='false'`);
 assert.equal(await driver.evaluate(`document.querySelector('#homeStatus .siren-help-error')===null`),true,'Normal cancellation must not be labelled as an error');
 assert.deepEqual((await readdir(outputs)).sort(),['saved.siren-backup']);result.cases.push({name:'Actual Ctrl+Alt+E cancellation produces no output or pending stage',ok:true});
 await chooser.configure('pending');await chooser.command('Export saved backup…');
 await driver.waitFor(`document.getElementById('homeRoot')?.getAttribute('aria-busy')==='true'&&document.getElementById('homeStatus')?.textContent.startsWith('Exporting the saved version.')`);
 // Read-only readiness polling observes the already-started chooser, never
 // retries a mutation or changes deadlines until a successful attempt appears.
 const deadline=Date.now()+10000;let observed;do{observed=await chooser.observations();if(observed.waiting)break;await delay(50);}while(Date.now()<deadline);
 assert.equal(observed.waiting,true);assert.equal(observed.calls.length,3);
 const concurrent=await driver.evaluate('window.sirenHome.exportSavedBackup()');assert.deepEqual(concurrent,{ok:false,code:'EXPORT_BUSY'});
 assert.equal((await chooser.observations()).calls.length,3);result.cases.push({name:'Second actual Home bridge request is EXPORT_BUSY, only one destination chooser',ok:true,receipt:concurrent});
 await chooser.command('Lock SIREN');await driver.waitFor(`window.sirenDesktopBootstrap?.mode==='locked'`);
 assert.equal((await driver.evaluate('window.sirenDesktop.getPinState()')).unlocked,false);assert.equal((await chooser.observations()).waiting,true);
 await unlockDesktop(driver,{pin:'4826',surface:'home'});await ready();
 assert.equal((await driver.evaluate('window.sirenHome.getHomeState()')).state.selectedProjectId,first.project.id);
 const revoked=join(outputs,'revoked.siren-backup');await chooser.release(revoked);
 const fresh=join(outputs,'fresh.siren-backup');await chooser.configure('save',fresh);await chooser.command('Export saved backup…');
 await driver.waitFor(`document.getElementById('homeStatus')?.textContent.startsWith('Saved backup exported · revision ${original.revision}.')&&document.getElementById('homeRoot')?.getAttribute('aria-busy')==='false'`);
 assert.deepEqual((await readdir(outputs)).sort(),['fresh.siren-backup','saved.siren-backup']);await verifyOutput(fresh);
 assert.deepEqual(await projects.readProject(first.project.id),original);assert.equal(await recovery.hasSavedSnapshot(original),true);
 result.cases.push({name:'Real common Lock permanently revokes pending chooser after unlock; fresh export works',ok:true});
 result.chooser=await chooser.observations();assert.equal(result.chooser.calls.length,4);assert.equal(result.chooser.waiting,false);assert.equal(result.chooser.configured,false);
 assert.ok(result.chooser.calls.every(call=>call.defaultPath===`SIREN-${first.project.id}.siren-backup`&&call.delivered));
 await chooser.close();chooser=null;
 await driver.evaluate('window.sirenDesktop.requestClose()').catch(()=>{});await driver.waitForExit();result.exitObserved=true;await driver.close();driver=null;
 result.status='COMPLETE';
}catch(cause){result.error={message:cause.message,stack:cause.stack};try{result.chooser=await chooser?.observations();await driver?.screenshot(join(evidence,'failure.png'));result.runtimeLog=driver?.logs().slice(-6000);result.observed=await driver?.evaluate(`({url:location.href,mode:window.sirenDesktopBootstrap?.mode,busy:document.getElementById('homeRoot')?.getAttribute('aria-busy'),status:document.getElementById('homeStatus')?.textContent})`);}catch{}}
finally{
 try{await chooser?.close();}catch{}
 if(driver){try{await driver.close();await driver.waitForExit();result.exitObserved=true;}catch(cause){result.status='ADVERSE';result.exitError=cause.message;}}
 if(packaged){try{assert.equal(result.exitObserved,true,'Actual owned copied process exit must precede post-hash verification');await packaged.verify();result.packageUnchanged=true;}catch(cause){result.packageUnchanged=false;result.status='ADVERSE';result.packageError=cause.message;}}
 if(result.status==='COMPLETE'&&(!packaged||result.packageVerifiedBefore!==true||result.packageUnchanged!==true||result.exitObserved!==true))result.status='ADVERSE';
 result.afterInputs=await capture();result.changedInputs=Object.keys({...result.inputs,...result.afterInputs}).filter(path=>result.inputs?.[path]!==result.afterInputs[path]);if(result.changedInputs.length)result.status='ADVERSE';result.endedAt=new Date().toISOString();await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({evidence,status:result.status,cases:result.cases.length,changedInputs:result.changedInputs,copy:packaged?.copy,packageUnchanged:result.packageUnchanged,exitObserved:result.exitObserved,error:result.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;
}
