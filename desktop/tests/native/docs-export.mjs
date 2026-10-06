import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {parse} from 'parse5';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {RecoveryStore} from '../../src/recovery/checkpoints.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
import {documentVersion} from '../../src/windows/docs.mjs';
import {AppearanceStore} from '../../src/appearance/store.mjs';
import {launchDesktop,unlockDesktop} from './drive.mjs';
import {attachNativePage} from './attach-page.mjs';
import {copiedPackageContext} from './package-context.mjs';
import {reserveInspectorPort} from './native-keyboard.mjs';

// Actual native Docs picker and export service; no product IPC/storage/PIN stubs.
// Only OS file reveal is adapted, in the independently PID-checked owned main.
const root=resolve('.'),evidence=resolve('evidence/docs-export-native',new Date().toISOString().replaceAll(':','-'));
await mkdir(evidence,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFile=async path=>{const digest=createHash('sha256');for await(const chunk of createReadStream(path))digest.update(chunk);return digest.digest('hex');};
async function capture(){
 const paths=[];async function walk(path){const entry=await lstat(path);assert.equal(entry.isSymbolicLink(),false);if(entry.isDirectory()){for(const name of(await readdir(path)).sort())await walk(join(path,name));}else if(entry.isFile())paths.push(path);}
 for(const name of ['src','build','generated','tests','baseline','package.json','package-lock.json'])await walk(join(root,name));
 paths.push(join(root,'node_modules/electron/dist/electron.exe'));
 return Object.fromEntries(await Promise.all(paths.sort().map(async path=>[relative(root,path).replaceAll('\\','/'),await hashFile(path)])));
}
async function attachReveal({port,pid,directory}){
 let target;const deadline=Date.now()+15000;
 while(Date.now()<deadline){try{target=(await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)})).json()).find(t=>t.type==='node');if(target)break;}catch{}await delay(100);}
 assert.ok(target,'Owned main inspector required');const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let serial=0;
 await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',event=>{const r=JSON.parse(event.data),p=pending.get(r.id);if(!p)return;pending.delete(r.id);clearTimeout(p.timer);r.error?p.no(Error(JSON.stringify(r.error))):p.yes(r.result);});
 const evaluate=expression=>new Promise((yes,no)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);no(Error('Owned reveal inspector deadline'));},10000);pending.set(id,{timer,yes:r=>r.exceptionDetails?no(Error(JSON.stringify(r.exceptionDetails))):yes(r.result.value),no});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});
 assert.equal(await evaluate('process.pid'),pid);
 await evaluate(`(()=>{const require=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json'),e=require('electron'),path=require('node:path'),original=e.shell.showItemInFolder;const state={calls:[],restore:()=>{e.shell.showItemInFolder=original;}};globalThis.__ownedDocsExportReveal=state;e.shell.showItemInFolder=file=>{const base=${JSON.stringify(directory)},inside=path.relative(base,file);if(path.isAbsolute(inside)||inside.startsWith('..')||!/^document-[a-f0-9-]{36}\\.(?:json|md|html)$/.test(inside))throw Error('Reveal outside owned exports');state.calls.push(inside);};return true;})()`);
 return {observations:()=>evaluate('globalThis.__ownedDocsExportReveal.calls'),close:async()=>{try{await evaluate('globalThis.__ownedDocsExportReveal.restore();delete globalThis.__ownedDocsExportReveal;true');}finally{ws.close();}}};
}
const keys=async(page,key,code,windowsVirtualKeyCode,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await page.send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode,modifiers,...(type==='keyDown'&&key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});};
function nodes(tree){const all=[];const visit=node=>{all.push(node);for(const child of node.childNodes??[])visit(child);};visit(tree);return all;}
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes??[]).map(text).join('');
const result={status:'ADVERSE',author:'/root/media_batch_review',startedAt:new Date().toISOString(),cases:[],scope:'Actual Docs read/working window, trusted UI clicks and CDP keyboard input, native saved-export service and real owned publication. Only shell.showItemInFolder is adapted, explicitly not OS Explorer UX. Exact saved JSON/Markdown/static HTML archives and source pointers; no PDF, Office, reimport, native stress limit or global release approval.'};
let driver,reveal,page,packaged;
try{
 result.harness={path:'tests/native/docs-export.mjs',sha256:await hashFile(join(root,'tests/native/docs-export.mjs')),enterTransport:'keyDown text/unmodifiedText CR then keyUp; trusted browser activation'};
 packaged=await copiedPackageContext(evidence);const data=packaged?.data??join(evidence,'owned-data');await mkdir(data,{recursive:true});
 result.inputs=await capture();
 const projects=new ProjectStore(data),sources=new SourceRepository(data),recovery=new RecoveryStore(data,{sources});
 const initial=await projects.createProject({label:'Owned Docs export',json:'{}'}),sourceBytes=Buffer.from('\ufeff'+Array.from({length:1000},(_,i)=>`step_${i} = "Ș😀"`).join('\r\n'));
 const ref=await sources.importSource({projectId:initial.project.id,bytes:sourceBytes,provenance:{agentId:'native-docs-export',opaque:'EXACT_SOURCE_PROVENANCE'}}),pointer={sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256};
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6HcAAAAASUVORK5CYII=';
 const document={id:'doc-a',title:'Saved Agent Ș😀',type:'agent-spec',owner:'Original owner',agent:{agentId:'AG-EXPORT',opaque:'EXACT_AGENT_DATA'},releases:[{id:'historic',author:'Original retained author',verdict:'not-run',sourceRef:pointer}],comments:[{id:'comment-a',author:'Original person',text:'Retained claim, not current approval'}],unknown:{literal:'</script><img src="https://export-fixture.invalid/leak">',sourceRef:pointer},blocks:[{id:'heading-a',kind:'heading',level:2,text:'Saved purpose'},{id:'text-a',kind:'text',html:'<p>Saved <strong>context</strong> &amp; evidence.</p>'},{id:'table-a',kind:'table',headerRow:true,rows:Array.from({length:25},(_,i)=>['Cell | '+i,'Exact <value> '+i])},{id:'check-a',kind:'checklist',items:[{text:'Keep `fences` and [brackets]',done:true}]},{id:'prompt-a',kind:'prompt',label:'Documented instructions',text:'```\n</script>\n# Exact prompt Ș😀\n```',model:'',reasoningEffort:'',history:[]},{id:'knowledge-a',kind:'knowledge',reasoningEffort:'Original effort',rows:[{id:'row-a',name:'agent.py',fileType:'python',role:'code',notes:'Original source context',sourceRef:pointer,opaque:'EXACT_ROW_DATA'}]},{id:'image-a',kind:'image',dataUri:png,caption:'Exact image evidence',fileName:'pixel.png',opaque:'EXACT_IMAGE_FIELD'},{id:'unknown-a',kind:'future-section',value:{unknown:'EXACT_UNKNOWN_BLOCK',unsafe:'<script>literal</script>'}}]};
 const foreign='FOREIGN_DOCUMENT_MUST_NOT_EXPORT_9D481',metadata={kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':JSON.stringify({diagrams:[{id:'diagram-a',name:'Saved diagram',source:'flowchart TD\nA-->B'}],workpapers:[document,{id:'doc-b',title:'Other document',private:foreign,blocks:[]}],codeFiles:[{id:'code-a',name:'agent.py',language:'python',sourceRef:pointer}]})},privateOutsideDocument:foreign};
 assert.equal((await commitManifest({projects,repository:sources,recovery,projectId:initial.project.id,baseRevision:1,sourceRefs:[ref],metadata,operationId:'native-docs-export-fixture'})).ok,true);
 const saved=await projects.readProject(initial.project.id),version=documentVersion(saved,'doc-a'),documentSha256=hash(Buffer.from(JSON.stringify(document))),directory=join(await projects.directory(initial.project.id),'exports');
 await writeFile(join(data,'session-selection.json'),JSON.stringify({schema:1,accountId:null,projectId:initial.project.id}));assert.equal((await new AppearanceStore(data).set({theme:'kpmg'})).ok,true);
 result.fixture={projectId:initial.project.id,projectRevision:saved.revision,documentVersion:version,documentSha256,sourceBytes:sourceBytes.length,sourceSha256:hash(sourceBytes)};
 const port=await reserveInspectorPort();driver=await launchDesktop({...packaged?.launch,extraArgs:[...(!packaged?[`--siren-test-root=${data}`]:[]),`--inspect=127.0.0.1:${port}`]});result.ownedPid=driver.pid;
 reveal=await attachReveal({port,pid:driver.pid,directory});await unlockDesktop(driver,{pin:'4826',autoSetup:true,surface:'home'});
 const opened=await driver.evaluate('window.sirenWindow.openView({role:"docs",entityId:"doc-a"})');assert.equal(opened.ok,true);const reader=await attachNativePage(driver,`siren://app/windows/docs.html?windowId=${opened.view.windowId}`);page=reader;
 await reader.waitFor('document.body.dataset.documentReady==="true"&&document.documentElement.dataset.theme==="kpmg"&&document.getElementById("exportDocument")?.disabled===false');
 const list=async()=>{try{return(await readdir(directory)).sort();}catch(error){if(error.code==='ENOENT')return [];throw error;}};
 const decode=async(format,file)=>{
  const bytes=await readFile(join(directory,file)),body=bytes.toString('utf8');assert.equal(body.includes(foreign),false);assert.equal(body.includes('UNSAVED_NATIVE_EXPORT_TITLE'),false);
  let archive;
  if(format==='json')archive=JSON.parse(body);
  else if(format==='markdown'){const marker='\n\nPreserved data (JSON archive)\n\n',at=body.lastIndexOf(marker);assert.ok(at>=0);const encoded=body.slice(at+marker.length).split('\n');assert.ok(encoded.every(line=>line.startsWith('    ')));archive=JSON.parse(encoded.map(line=>line.slice(4)).join('\n'));assert.ok(body.includes('Cell \\| 24'));}
  else{
   const tree=parse(body),all=nodes(tree),raw=all.find(n=>n.tagName==='pre'&&n.attrs.some(a=>a.name==='id'&&a.value==='siren-archive'));assert.ok(raw);archive=JSON.parse(text(raw));
   assert.equal(all.some(n=>['script','iframe','object','embed','form','img','link','svg'].includes(n.tagName)),false);
   assert.equal(all.some(n=>(n.attrs??[]).some(a=>/^on/i.test(a.name)||['src','href','srcdoc'].includes(a.name))),false);
   const csp=all.find(n=>n.tagName==='meta'&&n.attrs.some(a=>a.name==='http-equiv'&&a.value==='Content-Security-Policy'));assert.ok(csp?.attrs.some(a=>a.name==='content'&&a.value.includes("default-src 'none'")));
   assert.equal(all.filter(n=>n.tagName==='tr').length,25);assert.ok(text(tree).includes('Original image data retained in Preserved data; not rendered in this export.'));
  }
  assert.equal(archive.format,'siren-document-archive');assert.equal(archive.schema,1);assert.equal(archive.projectId,initial.project.id);assert.equal(archive.documentId,'doc-a');assert.equal(archive.projectRevision,saved.revision);assert.equal(archive.version,version);assert.equal(archive.documentSha256,documentSha256);assert.equal(archive.sourcePolicy,'references-only');assert.ok(Number.isFinite(Date.parse(archive.exportedAt)));assert.deepEqual(archive.document,document);
  assert.deepEqual(archive.document.blocks.find(b=>b.id==='knowledge-a').rows[0].sourceRef,pointer);assert.equal(archive.document.blocks.find(b=>b.id==='image-a').dataUri,png);
  return {filename:file,bytes:bytes.length,sha256:hash(bytes),archiveDocumentSha256:hash(Buffer.from(JSON.stringify(archive.document)))};
 };
 const exportUI=async(own,format,keyboard=false,keyboardConfirm=false)=>{
  const before=await list();
  if(keyboard)await keys(own,'E','KeyE',69,10);else await own.click('#exportDocument');
  await own.waitFor('document.getElementById("documentExportPicker")?.open===true');
  assert.ok((await own.evaluate('document.getElementById("documentExportDisclosure").textContent')).includes('saved version'));
  // Modal initial focus is the closed native select; keyboard changes value
  // without forcing DOM.value or relying on OS popup keyboard routing.
  await own.waitFor('document.activeElement?.id==="documentExportFormat"');await keys(own,'Home','Home',36);
  for(let i=0;i<({html:0,markdown:1,json:2}[format]);i++)await keys(own,'ArrowDown','ArrowDown',40);
  await own.waitFor(`document.getElementById('documentExportFormat').value===${JSON.stringify(format)}`);
  await keys(own,'Tab','Tab',9);
  if(keyboardConfirm){await own.waitFor('document.activeElement?.id==="documentExportCancel"');await keys(own,'Tab','Tab',9);await own.waitFor('document.activeElement?.id==="documentExportConfirm"');await keys(own,'Enter','Enter',13);}
  else await own.click('#documentExportConfirm');
  await own.waitFor(`document.getElementById('viewStatus').textContent.startsWith('Saved document exported · ${format.toUpperCase()} ·')&&document.getElementById('exportDocument').disabled===false`);
  const after=await list(),added=after.filter(file=>!before.includes(file));assert.equal(added.length,1);assert.match(added[0],/^document-[a-f0-9-]{36}\.(?:json|md|html)$/);return decode(format,added[0]);
 };
 const json=await exportUI(reader,'json');result.cases.push({name:'Actual readonly Docs click exports exact saved JSON archive with own source pointers/unknown fields/image bytes and no foreign data',ok:true,...json});
 await reader.click('#revealDocumentExport');
 const revealDeadline=Date.now()+10000;let calls;do{calls=await reveal.observations();if(calls.length)break;await delay(50);}while(Date.now()<revealDeadline);
 assert.deepEqual(calls,[json.filename]);await reader.waitFor('document.getElementById("revealDocumentExport").disabled===false');
 result.cases.push({name:'Actual Show file uses its retained receipt and exact owned file; OS reveal only adapted',ok:true,filename:json.filename});
 const beforeViews=(await driver.evaluate('window.sirenWindow.listViews()')).views.map(view=>view.windowId);await reader.click('#openWorkingDocument');
 await driver.waitFor(`(async()=>{const r=await window.sirenWindow.listViews();return r.ok&&r.views.some(v=>!${JSON.stringify(beforeViews)}.includes(v.windowId));})()`);
 const working=(await driver.evaluate('window.sirenWindow.listViews()')).views.find(view=>!beforeViews.includes(view.windowId));page=await attachNativePage(driver,`siren://app/windows/docs.html?windowId=${working.windowId}`);
 await page.waitFor('document.body.dataset.documentReady==="true"&&document.body.dataset.documentReadonly==="false"&&document.getElementById("exportDocument").disabled===false');
 await page.click('#documentTitleInput');await keys(page,'a','KeyA',65,2);await page.send('Input.insertText',{text:'UNSAVED_NATIVE_EXPORT_TITLE'});await page.waitFor('document.body.dataset.documentDirty==="true"');
 const markdown=await exportUI(page,'markdown',true);assert.equal(await page.evaluate('document.getElementById("documentTitleInput").value'),'UNSAVED_NATIVE_EXPORT_TITLE');assert.equal(await page.evaluate('document.body.dataset.documentDirty'),'true');assert.ok((await page.evaluate('document.getElementById("viewStatus").textContent')).includes('Unsaved changes remain here'));
 result.cases.push({name:'Actual Ctrl+Shift+E from dirty working Docs exports saved Markdown and retains local unsaved title',ok:true,...markdown});
 const html=await exportUI(page,'html');result.cases.push({name:'Actual HTML picker publishes inert self-contained page and exact archival appendix, all table rows and image disclosure',ok:true,...html});
 const ownId=json.filename.slice('document-'.length,-'.json'.length),foreignReveal=await page.evaluate('window.sirenDocsExport.revealExport('+JSON.stringify({exportId:ownId})+')');assert.deepEqual(foreignReveal,{ok:false,code:'ACCESS_REFUSED'});assert.deepEqual(await reveal.observations(),[json.filename]);
 assert.deepEqual(await projects.readProject(initial.project.id),saved);assert.deepEqual(await sources.exportSource({projectId:initial.project.id,...ref}),sourceBytes);assert.equal(await recovery.hasSavedSnapshot(saved),true);assert.equal((await list()).some(file=>file.startsWith('pending-')),false);
 result.cases.push({name:'Different actual Docs window cannot reveal reader receipt; saved project/source/checkpoint remain exact and no pending stage remains',ok:true});
 await page.evaluate(`(()=>{globalThis.__ownedDocsExportKeyboardTrace=[];for(const type of ['keydown','keypress','keyup','click'])document.addEventListener(type,event=>{if(globalThis.__ownedDocsExportKeyboardTrace.length<80)globalThis.__ownedDocsExportKeyboardTrace.push({type:event.type,key:event.key??null,charCode:event.charCode??null,trusted:event.isTrusted,target:event.target?.id??null,active:document.activeElement?.id??null});},true);return true;})()`);
 const beforeCancel=await list();await page.click('#exportDocument');
 await page.waitFor('document.getElementById("documentExportPicker")?.open===true&&document.activeElement?.id==="documentExportFormat"');
 await keys(page,'Tab','Tab',9);await page.waitFor('document.activeElement?.id==="documentExportCancel"');
 await page.screenshot(join(evidence,'docs-export-picker-kpmg.png'));
 await keys(page,'Enter','Enter',13);
 await page.waitFor('document.getElementById("documentExportPicker")?.open===false&&document.getElementById("exportDocument").disabled===false');
 assert.deepEqual(await list(),beforeCancel);assert.equal(await page.evaluate('document.body.dataset.documentDirty'),'true');
 result.cases.push({name:'Actual browser Enter on focused Cancel closes picker without publication and retains dirty draft',ok:true});
 const keyboardJson=await exportUI(page,'json',true,true);assert.equal(await page.evaluate('document.getElementById("documentTitleInput").value'),'UNSAVED_NATIVE_EXPORT_TITLE');assert.equal(await page.evaluate('document.body.dataset.documentDirty'),'true');
 assert.deepEqual(await projects.readProject(initial.project.id),saved);assert.equal((await list()).some(file=>file.startsWith('pending-')),false);
 result.cases.push({name:'Keyboard-only Ctrl+Shift+E, closed select and Tab-to-Confirm Enter publishes exact saved JSON',ok:true,...keyboardJson});
 result.keyboardTrace=await page.evaluate('globalThis.__ownedDocsExportKeyboardTrace');await page.screenshot(join(evidence,'docs-export-working-kpmg.png'));result.revealCalls=await reveal.observations();result.status='COMPLETE';
}catch(cause){result.error={message:cause.message,stack:cause.stack};try{await(page??driver)?.screenshot(join(evidence,'failure.png'));result.runtimeLog=driver?.logs().slice(-6000);result.observed=await page?.evaluate('({url:location.href,status:document.getElementById("viewStatus")?.textContent,dirty:document.body.dataset.documentDirty,pickerOpen:document.getElementById("documentExportPicker")?.open,format:document.getElementById("documentExportFormat")?.value,active:document.activeElement?.id})');result.revealCalls=await reveal?.observations();}catch{}}
finally{
 try{await reveal?.close();}catch{}await driver?.close();result.afterInputs=await capture();result.changedInputs=Object.keys({...result.inputs,...result.afterInputs}).filter(path=>result.inputs?.[path]!==result.afterInputs[path]);if(result.changedInputs.length)result.status='ADVERSE';
 if(packaged){result.package={sourceCommit:packaged.receipt.sourceCommit,copy:packaged.copy,archive:packaged.receipt.appArchive,runtime:packaged.receipt.runtimeBinary};try{await packaged.verify();result.packageUnchanged=true;}catch(cause){result.packageUnchanged=false;result.packageError=cause.message;result.status='ADVERSE';}}
 result.endedAt=new Date().toISOString();await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({evidence,status:result.status,cases:result.cases.length,changedInputs:result.changedInputs,error:result.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;
}
