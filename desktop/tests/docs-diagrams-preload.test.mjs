import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('pending diagram events expose only validated identifiers and never evaluate accessors or carry write authority',async()=>{
 const exposed={},listeners=new Map(),electron={contextBridge:{exposeInMainWorld:(name,api)=>exposed[name]=api},ipcRenderer:{on:(name,fn)=>listeners.set(name,fn),removeListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);},invoke:async()=>{throw Error('Event must not write');}}};runInNewContext(await readFile(new URL('../src/windows/preload.cjs',import.meta.url),'utf8'),{require:()=>electron,Object});assert.equal(typeof exposed.sirenDocsDiagramEvents?.onPending,'function');let count=0,accessed=false;const off=exposed.sirenDocsDiagramEvents.onPending(()=>count++),listener=listeners.get('siren:docs-diagram-pending');listener(null,{documentId:'doc-a',diagramId:'flow-a',reason:'working-draft'});await Promise.resolve();assert.equal(count,1);listener(null,{documentId:'doc-a',diagramId:'flow-a',reason:'working-draft',bytes:'forged'});listener(null,{documentId:'doc-a',diagramId:'flow-a',get reason(){accessed=true;return 'working-draft';}});assert.equal(count,1);assert.equal(accessed,false);off();assert.equal(listeners.has('siren:docs-diagram-pending'),false);
});
test('actual Docs preload exposes finite metadata/receipt operations without private publication or byte storage',async()=>{
 const exposed={},calls=[],electron={contextBridge:{exposeInMainWorld:(name,api)=>exposed[name]=api},ipcRenderer:{on(){},removeListener(){},invoke:async(...args)=>{calls.push(args);return {ok:true};}}};
 runInNewContext(await readFile(new URL('../src/windows/preload.cjs',import.meta.url),'utf8'),{require:()=>electron});
 assert.ok(exposed.sirenDocsDiagrams,'Missing Docs diagram bridge');const methods=['listDocuments','sendToDocs','getProposal','listDiagrams','inspectSelection','preview','insert','readEmbed','openSource','setMode','update'];assert.deepEqual(Object.keys(exposed.sirenDocsDiagrams).sort(),methods.sort());
 for(const method of methods){const payload={opaque:'caller request'};assert.equal((await exposed.sirenDocsDiagrams[method](payload)).ok,true);assert.deepEqual(calls.pop(),['siren:docs-diagrams',method,payload]);}
 assert.equal(exposed.sirenDocsDiagrams.commitDiagramEmbed,undefined);assert.equal(exposed.sirenDocsDiagrams.put,undefined);
});
