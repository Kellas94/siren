import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('actual native Docs export preload has only finite delivery/reveal and never borrows a private flush ticket',async()=>{
 const exposed={},listeners=new Map(),calls=[];const electron={contextBridge:{exposeInMainWorld:(name,value)=>exposed[name]=value},ipcRenderer:{on:(name,fn)=>listeners.set(name,fn),removeListener(){},invoke:async(...args)=>{calls.push(args);return {ok:true};}}};
 runInNewContext(await readFile(new URL('../src/windows/preload.cjs',import.meta.url),'utf8'),{require:()=>electron});
 assert.deepEqual(Object.keys(exposed.sirenDocsExport??{}).sort(),['exportSaved','revealExport']);assert.equal(Object.isFrozen(exposed.sirenDocsExport),true);
 const request={format:'json',expectedVersion:'a'.repeat(64),expectedSha256:'b'.repeat(64)};await exposed.sirenDocsExport.exportSaved(request);await exposed.sirenDocsExport.revealExport({exportId:'00000000-0000-4000-8000-000000000001'});
 assert.deepEqual(calls,[['siren:docs-export','exportSaved',request],['siren:docs-export','revealExport',{exportId:'00000000-0000-4000-8000-000000000001'}]]);
 exposed.sirenViewControl.onPrepare(async()=>{await exposed.sirenDocsExport.exportSaved(request);return {ok:false};});
 await listeners.get('siren:view-prepare')({}, {requestId:'00000000-0000-4000-8000-000000000001',nonce:'00000000-0000-4000-8000-000000000002'});assert.deepEqual(calls[2],['siren:docs-export','exportSaved',request]);
});
