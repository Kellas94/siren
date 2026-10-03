import { app, BrowserWindow } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createImportValidator } from '../../src/projects/import-validator-window.mjs';
import { validateImportedProject } from '../../src/projects/import-validation.mjs';
import { ProjectStore } from '../../src/projects/store.mjs';
import { parseLegacyImport } from '../../src/projects/migration.mjs';

const desktop=fileURLToPath(new URL('../../',import.meta.url));
const argument=process.argv.find(value=>value.startsWith('--siren-import-fixture='));
const root=resolve(argument?.slice('--siren-import-fixture='.length)||'');
const rel=relative(join(desktop,'evidence'),root);
if(!rel || rel.startsWith('..') || isAbsolute(rel))throw Error('OWNED_IMPORT_FIXTURE_REQUIRED');
app.setPath('userData',join(root,'owned-profile'));
// The owned probe has several sequential hidden windows; last-window closure
// must not end Electron before the final oracle and process exit are recorded.
app.on('window-all-closed',()=>{});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
app.whenReady().then(async()=>{
  const result={status:'ADVERSE',pid:process.pid,versions:process.versions,cases:[],windows:[],started:new Date().toISOString()};
  let input;
  try {
    input=JSON.parse(await readFile(join(root,'prepared.json'),'utf8'));
    const projects=new ProjectStore(join(root,'owned-data'));
    const original=await projects.readProject(input.original.project.id);
    class OwnedValidatorWindow {
      constructor(options){
        const window=new BrowserWindow(options);
        result.windows.push({id:window.id,sandbox:options.webPreferences.sandbox,contextIsolation:options.webPreferences.contextIsolation,nodeIntegration:options.webPreferences.nodeIntegration,preloadPresent:Object.hasOwn(options.webPreferences,'preload'),persistentPartition:options.webPreferences.partition.startsWith('persist:'),show:options.show});
        const record=result.windows.at(-1),wc=window.webContents;
        window.on('closed',()=>{record.closed=true;record.contentsDestroyedAtClosed=wc.isDestroyed();});
        wc.on('destroyed',()=>{record.contentsDestroyed=true;});return window;
      }
    }
    let lastWindow;
    const createValidator=async()=>{
      const validator=await createImportValidator({BrowserWindow:OwnedValidatorWindow,entryPath:join(root,'generated','import-validation.html'),entrySha256:input.build.entrySha256});
      lastWindow=BrowserWindow.getAllWindows()[0];
      const state=await lastWindow.webContents.executeJavaScript(`({bridge:typeof window.sirenDesktop,bootstrap:typeof window.sirenDesktopBootstrap,ready:window.sirenImportValidationReady,storedKeys:localStorage.length,previewExists:document.getElementById('diagram')!==null,previewChildren:document.getElementById('diagram')?.childElementCount})`);
      assert.equal(state.bridge,'undefined');assert.equal(state.bootstrap,'undefined');assert.equal(state.ready,true);assert.equal(state.storedKeys,0);assert.equal(state.previewExists,true);assert.equal(state.previewChildren,0);assert.equal(lastWindow.isVisible(),false);
      result.windows.at(-1).observed=state;return validator;
    };
    const valid={type:'siren-project',version:'1.131.0',state:{activeDiagramId:'diagram-a',diagrams:[{id:'diagram-a',name:'Native synthetic',source:'sequenceDiagram\n Alice->>Bob: Exact imported source'}],workpapers:[{id:'doc-a',title:'Imported claim',status:'approved',review:{state:'approved',decidedBy:'File Reviewer',decidedAt:'2026-10-03T00:00:00.000Z',approvedDigest:'synthetic-unmatched',trail:[]},blocks:[],signoffFromFile:{decidedBy:'FORGED_LOCAL_APPROVAL'}}]}};
    const bytes=Buffer.from(JSON.stringify(valid)),before=hash(bytes);
    const validated=await validateImportedProject({bytes,fileName:'chosen.siren'},{createValidator,isCurrent:()=>true});
    assert.equal(hash(bytes),before);
    const parsed=JSON.parse(validated),doc=parsed.state.workpapers[0];
    assert.equal(parsed.state.diagrams[0].source,valid.state.diagrams[0].source);
    assert.equal(doc.signoffFromFile.decidedBy,'File Reviewer');assert.equal(doc.signoffFromFile.digestHeld,false);assert.equal(doc.signoffFromFileAsWritten.records[0].decidedBy,'FORGED_LOCAL_APPROVAL');
    const imported=await projects.createProject({label:'Verified hidden import',json:parseLegacyImport(Buffer.from(validated))});
    assert.equal((await new ProjectStore(join(root,'owned-data')).readProject(imported.project.id)).json,imported.json);
    result.cases.push({name:'non-flowchart exact source and file-signoff provenance',status:'COMPLETE',inputSHA:before,outputSHA:hash(Buffer.from(validated)),importedProjectId:imported.project.id});
    for(const [name,value] of [['internal-cache',{source:'flowchart TD\nA-->B'}],['invalid-mermaid',{...valid,state:{...valid.state,diagrams:[{id:'diagram-a',source:'flowchart TD\n A[unclosed'}]}}],['malformed-record',{...valid,state:{...valid.state,diagrams:[null]}}]]) {
      await assert.rejects(validateImportedProject({bytes:Buffer.from(JSON.stringify(value)),fileName:name+'.siren'},{createValidator,isCurrent:()=>true}),{code:'IMPORT_INVALID'});
      result.cases.push({name,status:'COMPLETE'});
    }
    assert.deepEqual(await projects.readProject(original.project.id),original);
    assert.equal(BrowserWindow.getAllWindows().length,0);assert.ok(result.windows.every(window=>window.closed));
    result.originalUnchanged=true;result.status='COMPLETE';
  } catch(cause) {result.error={message:cause.message,code:cause.code,stack:cause.stack};}
  finally {
    for(const window of BrowserWindow.getAllWindows())try{window.destroy();}catch{}
    result.remainingWindows=BrowserWindow.getAllWindows().length;result.finished=new Date().toISOString();
    await writeFile(join(root,'native-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,status:result.status,error:result.error?.message,remainingWindows:result.remainingWindows}));
    app.exit(result.status==='COMPLETE'&&result.remainingWindows===0?0:1);
  }
});
