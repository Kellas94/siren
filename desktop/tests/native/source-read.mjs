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
const paths=['src/main.mjs','src/preload.cjs','src/windows/preload.cjs','src/windows/registry.mjs','src/windows/coordinator.mjs','src/windows/source-bridge.mjs','src/sources/ipc.mjs','tests/native/source-read.mjs','tests/native/drive.mjs'];
const capture=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(p))])));
const inputs=await capture(),projects=new ProjectStore(data),sources=new SourceRepository(data);
const first=await projects.createProject({label:'Owned exact native source reads',json:'{}'});
const text='from dataclasses import dataclass\r\n\r\n@dataclass\r\nclass Agent:\r\n    name: str = "Ș😀"\r\n';
const a=await sources.importSource({projectId:first.project.id,bytes:Buffer.from(text)});
const b=await sources.importSource({projectId:first.project.id,bytes:Buffer.from('OTHER_SOURCE_PRIVATE_CONTENT\n')});
assert.equal((await commitManifest({projects,repository:sources,projectId:first.project.id,baseRevision:1,sourceRefs:[a,b],metadata:{workpapers:[{id:'doc-a',content:'DOCS_PRIVATE_CONTENT'}]},operationId:'initial-native-read'})).ok,true);
const selected=await projects.readProject(first.project.id);
assert.equal((await sources.applyEdit({projectId:first.project.id,edit:{sourceId:a.sourceId,expectedVersion:1,operationId:'unselected-future-draft',start:0,end:0,insertedText:'UNSELECTED_PRIVATE_DRAFT\n'}})).ok,true);
const result={status:'ADVERSE',scope:'Actual production main/preloads and native Code/Docs handles with protected PIN; read-only transport, no editor or source write admission',inputs,cases:[],build:JSON.parse(await readFile('generated/build.json','utf8'))};
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
 return {evaluate:async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}};
}
try{
 driver=await launchDesktop({extraArgs:[`--siren-test-root=${data}`,`--siren-test-project=${first.project.id}`]});result.ownedPid=driver.pid;
 await unlockDesktop(driver,{pin:'4826',autoSetup:true});
 assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.readonly'),true);
 assert.equal((await driver.evaluate(`window.sirenSource.getMetrics(${JSON.stringify({sourceId:a.sourceId,version:1})})`)).sha256,a.sha256);
 const pages=[];
 for(const request of [{role:'code',entityId:a.sourceId,version:1},{role:'code',entityId:b.sourceId,version:1},{role:'docs',entityId:'doc-a'}]){
  const opened=await driver.evaluate(`window.sirenWindow.openView(${JSON.stringify(request)})`);assert.equal(opened.ok,true);
  pages.push(await attachPage(`siren://app/windows/${request.role}.html?windowId=${opened.view.windowId}`));
 }
 const metrics=await pages[0].evaluate(`window.sirenSource.getMetrics(${JSON.stringify({sourceId:a.sourceId,version:1})})`);
 assert.equal(metrics.ok,true);assert.equal(metrics.sha256,a.sha256);
 const range=await pages[0].evaluate(`window.sirenSource.readRange(${JSON.stringify({sourceId:a.sourceId,version:1,start:0,end:metrics.utf16Units})})`);assert.equal(range.text,text);
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
