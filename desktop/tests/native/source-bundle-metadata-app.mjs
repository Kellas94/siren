import {app,BrowserWindow} from 'electron';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createImportValidator} from '../../src/projects/import-validator-window.mjs';
import {validateImportedBundleMetadata} from '../../src/projects/import-validation.mjs';
import {verifySourceManifest} from '../../src/sources/manifest.mjs';

const desktop=fileURLToPath(new URL('../../',import.meta.url)),argument=process.argv.find(v=>v.startsWith('--siren-bundle-metadata-fixture=')),root=resolve(argument?.slice('--siren-bundle-metadata-fixture='.length)||''),rel=relative(join(desktop,'evidence'),root);
if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('OWNED_BUNDLE_METADATA_FIXTURE_REQUIRED');
app.setPath('userData',join(root,'owned-profile'));app.on('window-all-closed',()=>{});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
app.whenReady().then(async()=>{
 const result={status:'ADVERSE',pid:process.pid,versions:process.versions,cases:[],windows:[],started:new Date().toISOString()};
 try{
  const input=JSON.parse(await readFile(join(root,'prepared.json'),'utf8')),bytes=await readFile(join(root,'actual-export.siren-backup')),bundle=JSON.parse(bytes);
  assert.equal(hash(bytes),input.exportSHA);verifySourceManifest(bundle.snapshot);assert.deepEqual(bundle.snapshot,input.snapshot);
  for(const source of bundle.sources)assert.equal(hash(Buffer.from(source.base64,'base64')),source.ref.sha256);
  class OwnedWindow{constructor(options){const w=new BrowserWindow(options),wc=w.webContents,record={id:w.id,show:options.show,sandbox:options.webPreferences.sandbox,preloadPresent:Object.hasOwn(options.webPreferences,'preload')};result.windows.push(record);w.on('closed',()=>{record.closed=true;});wc.on('destroyed',()=>{record.contentsDestroyed=true;});return w;}}
  const createValidator=async()=>{let validator;try{validator=await createImportValidator({BrowserWindow:OwnedWindow,entryPath:join(root,'generated','import-validation.html'),entrySha256:input.build.entrySha256});}catch(cause){(result.validatorErrors??=[]).push({phase:'creation',message:cause.message,stack:cause.stack});throw cause;}return {...validator,validateBundleMetadata:async(...args)=>{try{return await validator.validateBundleMetadata(...args);}catch(cause){(result.validatorErrors??=[]).push({phase:'validation',message:cause.message,stack:cause.stack});throw cause;}}};};
  const invoke=json=>validateImportedBundleMetadata({json,fileName:'actual-export.siren-backup'},{createValidator,isCurrent:()=>true});
  const original=JSON.parse(bundle.snapshot.json),key='t-industries-siren-v23-state',workspace=JSON.parse(original.storage[key]);
  const admitted=JSON.parse(await invoke(bundle.snapshot.json)),actual=JSON.parse(admitted.storage[key]);
  assert.deepEqual(actual.diagrams,workspace.diagrams);assert.deepEqual(actual.codeFiles,workspace.codeFiles);assert.deepEqual(actual.codeWorkspace,workspace.codeWorkspace);assert.deepEqual(actual.workpapers[0],workspace.workpapers[0]);
  const claim=actual.workpapers[1];if(claim){assert.equal(claim.signoffFromFile.decidedBy,'File reviewer');assert.equal(claim.signoffFromFile.digestHeld,false);assert.deepEqual(claim.signoffFromFileAsWritten.records,[{opaque:'previous claim'}]);}
  const withoutSignoff=value=>Object.fromEntries(Object.entries(value).filter(([k])=>!['signoffFromFile','signoffFromFileAsWritten'].includes(k)));
  if(claim)assert.deepEqual(withoutSignoff(claim),withoutSignoff(workspace.workpapers[1]));assert.equal(admitted.storage['opaque-storage'],original.storage['opaque-storage']);assert.deepEqual(admitted.opaque,original.opaque);
  result.cases.push({name:input.zeroDiagrams?'actual zero-diagram Code-only export: exact sources, base/draft pointers and opaque metadata':'actual native export: sparse Docs, Table/title/text whitespace, linked sources, revision, superseded release, drafts and file claims',status:'COMPLETE',inputSHA:input.exportSHA,metadataSHA:bundle.snapshot.sha256,admittedMetadataSHA:hash(Buffer.from(JSON.stringify(admitted)))});
  if(input.zeroDiagrams){const wire=await readFile(join(root,'actual-docs-only.siren-backup'));assert.equal(hash(wire),input.docsOnlyExportSHA);const docsBundle=JSON.parse(wire);verifySourceManifest(docsBundle.snapshot);const docsOriginal=JSON.parse(docsBundle.snapshot.json),docsWorkspace=JSON.parse(docsOriginal.storage[key]),docsAdmitted=JSON.parse(await invoke(docsBundle.snapshot.json)),docsActual=JSON.parse(docsAdmitted.storage[key]);assert.deepEqual(docsActual.diagrams,[]);assert.deepEqual(docsActual.codeFiles,[]);assert.equal(Object.hasOwn(docsActual,'activeDiagramId'),false);assert.deepEqual(docsActual.workpapers[0],docsWorkspace.workpapers[0]);assert.deepEqual(withoutSignoff(docsActual.workpapers[1]),withoutSignoff(docsWorkspace.workpapers[1]));assert.equal(docsActual.workpapers[1].signoffFromFile.decidedBy,'File reviewer');assert.equal(hash(await readFile(join(root,'actual-docs-only.siren-backup'))),input.docsOnlyExportSHA);result.cases.push({name:'actual zero-diagram Docs-only export: current/revision/release linked rows and file claims',status:'COMPLETE',inputSHA:input.docsOnlyExportSHA});}
  const bad=[
   ['unsafe Docs HTML',w=>w.workpapers[0].blocks=[{id:'unsafe',kind:'text',html:'<p onclick="alert(1)">visible<script>alert(1)</script></p>'}]],
   ['unsafe presentation HTML',w=>{w.diagrams[0].presentation.sequence[1].card.html='<img src="https://example.invalid/x" onerror="alert(1)">';}],
   ['explicit document truncation',w=>{w.workpapers[0].title='x'.repeat(161);}],
   ['unknown block kind',w=>{w.workpapers[0].blocks=[{id:'future',kind:'future-kind',html:'<p>unvalidated</p>'}];}],
   ['test evidence row dropping',w=>{w.workpapers[1].blocks[1].rows=[{verdict:'not-run'}];}],
   ['release draft approval loss',w=>{w.workpapers[1].releases[0].status='draft';}],
   ['revision truncation',w=>{w.workpapers[1].revisions=Array.from({length:7},()=>structuredClone(w.workpapers[1].revisions[0]));}],
   ['81 Code files',w=>{w.codeFiles=Array.from({length:81},(_,i)=>({...w.codeFiles[0],id:'file-'+i}));}],
   ['duplicate document identity',w=>{w.workpapers[1].id=w.workpapers[0].id;}],
   ['invalid Mermaid',w=>{w.diagrams[0].source='flowchart TD\nA[unclosed';}],
   ['inline source collision',w=>{w.codeFiles[0].content='payload must not enter validator';}],
   ['draft inline history',w=>{w.codeWorkspace.drafts[0].history=['secret text'];}],
  ];
  if(input.zeroDiagrams)bad.push(['newer major version without diagrams',w=>{w.version='999.0.0';}],['dangling active diagram without diagrams',w=>{w.activeDiagramId='missing-diagram';}]);
  for(const [name,mutate]of bad){const changed=structuredClone(workspace);if(input.zeroDiagrams){changed.workpapers=structuredClone(input.documentTemplates);if(['unsafe presentation HTML','invalid Mermaid'].includes(name))changed.diagrams=[structuredClone(input.diagramTemplate)];}mutate(changed);if(input.zeroDiagrams)for(const doc of changed.workpapers)for(const link of doc.links??[])if(link.kind==='diagram')link.dangling=!changed.diagrams.some(diagram=>diagram.id===link.diagramId);const bag=structuredClone(original);bag.storage[key]=JSON.stringify(changed);await assert.rejects(invoke(JSON.stringify(bag)),{code:'IMPORT_INVALID'});result.cases.push({name,status:'COMPLETE'});}
  assert.equal(hash(await readFile(join(root,'actual-export.siren-backup'))),input.exportSHA);assert.equal(BrowserWindow.getAllWindows().length,0);assert.ok(result.windows.every(w=>w.closed&&w.contentsDestroyed&&w.show===false&&w.sandbox===true&&!w.preloadPresent));result.originalExportUnchanged=true;result.status='COMPLETE';
 }catch(cause){result.error={message:cause.message,code:cause.code,stack:cause.stack};}
 finally{for(const w of BrowserWindow.getAllWindows())try{w.destroy();}catch{}result.remainingWindows=BrowserWindow.getAllWindows().length;result.finished=new Date().toISOString();await writeFile(join(root,'native-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,status:result.status,error:result.error?.message}));app.exit(result.status==='COMPLETE'&&result.remainingWindows===0?0:1);}
});
