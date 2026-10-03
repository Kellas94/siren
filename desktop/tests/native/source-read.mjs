import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
import {launchDesktop,unlockDesktop} from './drive.mjs';

const evidence=resolve('evidence/source-read',new Date().toISOString().replaceAll(':','-'));
await mkdir(evidence,{recursive:true});const data=join(evidence,'owned-data');await mkdir(data,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const paths=['src/main.mjs','src/preload.cjs','src/windows/preload.cjs','src/windows/registry.mjs','src/windows/coordinator.mjs','src/windows/source-bridge.mjs','src/windows/source-reads.mjs','src/windows/docs-reads.mjs','src/windows/domain.mjs','src/sources/ipc.mjs','src/sources/read-ipc.mjs','src/ui/windows/code.js','src/ui/windows/docs.js','src/ui/windows/entry.js','src/ui/code/editor.js','src/ui/code/source-client.js','src/ui/code/editor-adapter.js','build/windows.mjs','generated/windows/code.html','generated/windows/docs.html','tests/native/source-read.mjs','tests/native/drive.mjs'];
const capture=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(p))])));
const inputs=await capture(),projects=new ProjectStore(data),sources=new SourceRepository(data);
const first=await projects.createProject({label:'Owned exact native source reads',json:'{}'});
const prefix='from dataclasses import dataclass\r\n\r\n@dataclass\r\nclass Agent:\r\n    name: str = "Ș😀"\r\n';
const eof='SIREN_NATIVE_EOF_300000 = "exact Ș😀"';
const text=prefix+Array.from({length:299994},(_,i)=>`item_${i.toString().padStart(6,'0')} = ${i}\r\n`).join('')+eof+'\r\n';
const a=await sources.importSource({projectId:first.project.id,bytes:Buffer.from(text)});
const b=await sources.importSource({projectId:first.project.id,bytes:Buffer.from('OTHER_SOURCE_PRIVATE_CONTENT\n')});
const doc={id:'doc-a',title:'Agent documentation — Ș😀',agent:{name:'Context investigator',purpose:'Explain the decisions behind the code'},content:'Context connects the code to its purpose.\n<img src="https://invalid.example/private" onerror="window.__docsInjected=true">',blocks:[{id:'knowledge-a',kind:'knowledge',title:'Selected Python source',rows:[{id:'row-a',sourceRef:{sourceId:a.sourceId,version:1,sha256:a.sha256}}]}],releases:[{id:'release-a',verdict:'not-run',notes:'An imported label is not independent approval'}]};
assert.equal((await commitManifest({projects,repository:sources,projectId:first.project.id,baseRevision:1,sourceRefs:[a,b],metadata:{workpapers:[doc,{id:'doc-b',title:'Unrelated documentation',content:'OTHER_DOC_PRIVATE_CONTENT'}]},operationId:'initial-native-read'})).ok,true);
const selected=await projects.readProject(first.project.id);
assert.equal((await sources.applyEdit({projectId:first.project.id,edit:{sourceId:a.sourceId,expectedVersion:1,operationId:'unselected-future-draft',start:0,end:0,insertedText:'UNSELECTED_PRIVATE_DRAFT\n'}})).ok,true);
const result={status:'ADVERSE',scope:'Actual production native readonly Code/Docs: 300k-line source, EOF Find, Python colours, themes, Wrap; scoped Docs document/outline/lazy sections, safe literal imported text and Lock; no writable editor or physical multi-monitor admission',inputs,cases:[],source:{sha256:hash(Buffer.from(text)),utf8Bytes:Buffer.byteLength(text),utf16Units:text.length,contentLines:300000},build:JSON.parse(await readFile('generated/build.json','utf8'))};
let driver;
async function attachPage(url){
 const targets=await driver.send('Target.getTargets');const target=targets.targetInfos.find(t=>t.url===url);assert.ok(target,'Actual native target required');
 const {sessionId}=await driver.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});let serial=0;
 const send=async(method,params={})=>{
  const id=++serial,from=driver.events.length;await driver.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})});
  const until=Date.now()+20000;
  while(Date.now()<until){const event=driver.events.slice(from).find(e=>e.method==='Target.receivedMessageFromTarget'&&e.params.sessionId===sessionId&&JSON.parse(e.params.message).id===id);
   if(event){const message=JSON.parse(event.params.message);if(message.error)throw Error(JSON.stringify(message.error));return message.result;}await delay(20);}
  throw Error('Owned satellite CDP timeout: '+method);
 };
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const waitFor=async expression=>{const until=Date.now()+30000;while(Date.now()<until){if(await evaluate(expression))return;await delay(100);}throw Error('Native Code UI condition not met: '+expression);};
 const click=async selector=>{const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing native Code control');const r=e.getBoundingClientRect(),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom),x=(left+right)/2,y=(top+bottom)/2;return {x,y,hit:right>left&&bottom>top&&e.contains(document.elementFromPoint(x,y))};})()`);assert.equal(point.hit,true,'Native Code control must be visible and hit-testable: '+selector);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:'left',clickCount:1});};
 const key=async(key,code=key,windowsVirtualKeyCode=13)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode});};
 return {evaluate,waitFor,click,key,send,screenshot:async path=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(r.data,'base64'));}};
}
try{
 driver=await launchDesktop({extraArgs:[`--siren-test-root=${data}`,`--siren-test-project=${first.project.id}`]});result.ownedPid=driver.pid;
 await unlockDesktop(driver,{pin:'4826',autoSetup:true});
 assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.readonly'),true);
 assert.equal((await driver.evaluate(`window.sirenSource.getMetrics(${JSON.stringify({sourceId:a.sourceId,version:1})})`)).sha256,a.sha256);
 const pages=[],openedAt=Date.now();
 for(const request of [{role:'code',entityId:a.sourceId,version:1},{role:'code',entityId:b.sourceId,version:1},{role:'docs',entityId:'doc-a'}]){
  const opened=await driver.evaluate(`window.sirenWindow.openView(${JSON.stringify(request)})`);assert.equal(opened.ok,true);
  pages.push(await attachPage(`siren://app/windows/${request.role}.html?windowId=${opened.view.windowId}`));
 }
 await pages[0].waitFor("document.body.dataset.sourceReady==='true'");await pages[1].waitFor("document.body.dataset.sourceReady==='true'");
 const editorState=await pages[0].evaluate("(()=>({source:{...document.body.dataset},editors:document.querySelectorAll('.cm-editor').length,readonly:document.querySelector('.cm-content').getAttribute('contenteditable'),hiddenWrites:['undo','redo','save'].every(name=>document.querySelector('[data-command='+name+']').hidden),syntaxSpans:document.querySelectorAll('.cm-line span').length,theme:document.querySelector('.siren-code-editor').dataset.theme}))()");
 assert.equal(editorState.editors,1);assert.equal(editorState.readonly,'false');assert.equal(editorState.hiddenWrites,true);assert.ok(editorState.syntaxSpans>0);
 assert.equal(editorState.source.sourceId,a.sourceId);assert.equal(editorState.source.sourceVersion,'1');assert.equal(editorState.source.sourceSha256,a.sha256);assert.equal(Number(editorState.source.sourceUnits),text.length);
 result.editorReady={...editorState,elapsedMs:Date.now()-openedAt};
 await pages[0].click('[data-command=find]');await pages[0].click('.cm-search input[name=search]');
 await pages[0].send('Input.insertText',{text:'SIREN_NATIVE_EOF_300000'});await pages[0].key('Enter');
 await pages[0].waitFor(`document.querySelector('.cm-content').textContent.includes(${JSON.stringify(eof)})`);
 assert.ok(await pages[0].evaluate("document.querySelector('.cm-selectionBackground')!=null"));
 await pages[0].click('[data-command=wrap]');assert.equal(await pages[0].evaluate("document.querySelector('[data-command=wrap]').getAttribute('aria-pressed')"),'true');
 await pages[0].evaluate("document.querySelector('#codeTheme').focus()");await pages[0].key('End','End',35);await pages[0].key('Enter');
 await pages[0].waitFor("document.querySelector('.siren-code-editor').dataset.theme==='dark'");await pages[0].screenshot(join(evidence,'code-dark-eof.png'));
 await pages[0].evaluate("document.querySelector('#codeTheme').focus()");await pages[0].key('Home','Home',36);await pages[0].key('ArrowDown','ArrowDown',40);await pages[0].key('Enter');
 await pages[0].waitFor("document.querySelector('.siren-code-editor').dataset.theme==='light'");await pages[0].screenshot(join(evidence,'code-light-eof.png'));
 await pages[0].click('.cm-content');await pages[0].send('Input.insertText',{text:'FORBIDDEN_NATIVE_READONLY_EDIT'});
 assert.equal(await pages[0].evaluate("document.querySelector('.cm-content').textContent.includes('FORBIDDEN_NATIVE_READONLY_EDIT')"),false);
 result.cases.push({name:'actual 300k-line readonly Code editor, EOF Find outside initial viewport, Python highlighting, light/dark, Wrap and refused native text input',ok:true});
 await pages[2].waitFor("document.body.dataset.documentReady==='true'");
 const documentResult=await pages[2].evaluate('window.sirenDocsRead.getDocument()');assert.equal(documentResult.ok,true);assert.deepEqual(documentResult.document,doc);assert.equal(documentResult.sha256,hash(Buffer.from(JSON.stringify(doc))));
 assert.equal(await pages[2].evaluate("document.querySelector('#viewTitle').textContent"),doc.title);assert.equal(await pages[2].evaluate("document.body.dataset.documentSha256"),documentResult.sha256);
 await pages[2].click('#document-section-1 summary');await pages[2].waitFor("document.querySelector('#document-section-1').textContent.includes('Context investigator')");
 assert.equal(await pages[2].evaluate("document.querySelector('#documentContent').textContent.includes('Context connects the code to its purpose.')"),true);
 assert.equal(await pages[2].evaluate("document.querySelector('#documentContent img, #documentContent script')!==null||window.__docsInjected===true"),false);
 assert.equal(await pages[2].evaluate("document.body.textContent.includes('OTHER_DOC_PRIVATE_CONTENT')||document.body.textContent.includes('OTHER_SOURCE_PRIVATE_CONTENT')"),false);
 assert.equal((await pages[0].evaluate('window.sirenDocsRead.getDocument()')).code,'ACCESS_REFUSED');
 await pages[2].evaluate("document.querySelector('#documentTheme').focus()");await pages[2].key('Home','Home',36);await pages[2].key('ArrowDown','ArrowDown',40);await pages[2].key('Enter');
 await pages[2].waitFor("document.documentElement.style.colorScheme==='light'");await pages[2].screenshot(join(evidence,'docs-light.png'));
 await pages[2].evaluate("document.querySelector('#documentTheme').focus()");await pages[2].key('End','End',35);await pages[2].key('Enter');
 await pages[2].waitFor("document.documentElement.style.colorScheme==='dark'");await pages[2].screenshot(join(evidence,'docs-dark.png'));
 await pages[2].click('#retryDocument');await pages[2].waitFor("document.body.dataset.documentReady==='true'");
 result.cases.push({name:'actual scoped native Docs content, outline/lazy agent metadata, literal imported HTML, appearance and Refresh without foreign Docs/source bytes',ok:true});
 const metrics=await pages[0].evaluate(`window.sirenSource.getMetrics(${JSON.stringify({sourceId:a.sourceId,version:1})})`);
 assert.equal(metrics.ok,true);assert.equal(metrics.sha256,a.sha256);
 const range=await pages[0].evaluate(`window.sirenSource.readRange(${JSON.stringify({sourceId:a.sourceId,version:1,start:0,end:prefix.length})})`);assert.equal(range.text,prefix);
 assert.equal(await pages[0].evaluate('typeof window.sirenDesktopBootstrap'), 'undefined');
 assert.equal(await pages[0].evaluate('typeof window.sirenSource.applyEdit'), 'undefined');
 assert.equal(await pages[0].evaluate('typeof window.sirenSource.commitSource'), 'undefined');
 result.cases.push({name:'actual scoped Code reads exact selected CRLF and Unicode version with no project snapshot or writable bridge',ok:true});
 for(const [page,payload,code] of [[pages[0],{sourceId:b.sourceId,version:1},'ACCESS_REFUSED'],[pages[0],{sourceId:a.sourceId,version:2},'ACCESS_REFUSED'],[pages[0],{sourceId:a.sourceId},'REQUEST_REFUSED'],[pages[2],{sourceId:a.sourceId,version:1},'ACCESS_REFUSED']]){
  assert.equal((await page.evaluate(`window.sirenSource.getMetrics(${JSON.stringify(payload)})`)).code,code);
 }
 assert.equal((await pages[1].evaluate(`window.sirenSource.getMetrics(${JSON.stringify({sourceId:b.sourceId,version:1})})`)).sha256,b.sha256);
 result.cases.push({name:'native same-project sources, Docs role, explicit version and unselected future-draft boundaries',ok:true});
 assert.deepEqual(await projects.readProject(first.project.id),selected);
 assert.deepEqual(await sources.exportSource({projectId:first.project.id,sourceId:a.sourceId,version:1}),Buffer.from(text));
 result.closePreparation=await driver.evaluate('window.sirenDesktopRequestClose().then(()=>({ok:true})).catch(error=>({ok:false,message:error.message}))');
 result.lockReceipt=await driver.evaluate('window.sirenDesktop.lockPin()');assert.equal(result.lockReceipt.ok,true);
 assert.equal((await driver.evaluate(`window.sirenSource.getMetrics(${JSON.stringify({sourceId:a.sourceId,version:1})})`)).code,'ACCESS_REFUSED');
 const liveTargets=await driver.send('Target.getTargets');assert.equal(liveTargets.targetInfos.some(t=>t.url.startsWith('siren://app/windows/')),false);
 assert.deepEqual(await projects.readProject(first.project.id),selected);
 result.cases.push({name:'actual native Lock retires all satellite handles, refuses primary source bytes and preserves selected project',ok:true});
 result.status='COMPLETE';
}catch(error){result.error={message:error.message,stack:error.stack};if(driver)await driver.screenshot(join(evidence,'failure.png')).catch(()=>{});}
finally{
 if(driver){await writeFile(join(evidence,'electron.log'),driver.logs());await driver.close();}
 result.afterInputs=await capture();result.inputsUnchanged=JSON.stringify(inputs)===JSON.stringify(result.afterInputs);
 if(!result.inputsUnchanged)result.status='ADVERSE';await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({evidence,status:result.status,cases:result.cases.length,error:result.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;
}
