import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('actual Presenter preload alone exposes finite notes export/reveal; Audience receives no private delivery bridge',async()=>{
 const source=await readFile(new URL('../src/windows/presentation-preload.cjs',import.meta.url),'utf8');
 for(const role of ['presenter','audience']){
  const exposed={},calls=[];runInNewContext(source,{location:{pathname:'/windows/'+role+'.html'},require:()=>({contextBridge:{exposeInMainWorld:(name,value)=>exposed[name]=value},ipcRenderer:{on(){},removeListener(){},invoke:async(...args)=>{calls.push(args);return{ok:true};}}})});
  if(role==='audience'){assert.equal('sirenPresenterExport'in exposed,false);continue;}
  assert.deepEqual(Object.keys(exposed.sirenPresenterExport??{}).sort(),['exportNotes','revealExport']);assert.equal(Object.isFrozen(exposed.sirenPresenterExport),true);
  const payload={deckVersion:'a'.repeat(64)};await exposed.sirenPresenterExport.exportNotes(payload);await exposed.sirenPresenterExport.revealExport({exportId:'00000000-0000-4000-8000-000000000001'});assert.deepEqual(calls,[['siren:presenter-export','exportNotes',payload],['siren:presenter-export','revealExport',{exportId:'00000000-0000-4000-8000-000000000001'}]]);
 }
});
