import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {nativeSourceContext,mainSlice} from './fixtures/source-main-context.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {documentVersion} from '../src/windows/docs.mjs';
test('actual main opens a genuine saved Docs pointer in readonly Code, tracks lifecycle and rejects Lock without a window',async()=>{
 const f=await nativeSourceContext(),point={sourceId:f.refs[0].sourceId,version:1,sha256:f.refs[0].sha256};
 const metadata={workpapers:[{id:'doc-a',title:'Native agent',blocks:[{id:'knowledge-a',kind:'knowledge',rows:[{id:'row-a',sourceRef:point}]}]}]};
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:2,sourceRefs:f.refs,metadata,operationId:'actual-docs-source'})).ok,true);const before=await f.projects.readProject(f.selected.project.id);f.context.snapshot=before;
 const original=f.registry.openView.bind(f.registry);let shows=0,ready=0;f.registry.openView=async request=>{const opened=await original(request),window=f.windows.at(-1);window.show=()=>shows++;window.webContents.send=channel=>{assert.equal(channel,'siren:view-ready');ready++;};f.context.nativeShells.set(opened.windowId,window);return opened;};
 vm.runInContext(mainSlice("ipcMain.handle('siren:source-readers'","const invokeNativeWindow="),f.context);const handler=f.handlers.get('siren:docs-sources');assert.equal(typeof handler,'function');
 const input={blockId:'knowledge-a',rowId:'row-a',expectedDocumentVersion:documentVersion(before,'doc-a')};assert.equal((await handler(f.event(0),'openLinkedSource',input)).code,'ACCESS_REFUSED');
 const result=await handler(f.event(1),'openLinkedSource',input);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(shows,1);assert.equal(ready,1);assert.equal(f.context.writes.size,0);assert.equal(f.registry.sourceScope(f.registry.capture(f.event(2))).version,1);
 assert.equal((await f.handlers.get('siren:source-mutations')(f.event(2),'applyEdit',{sourceId:point.sourceId,expectedVersion:1,operationId:'forbidden-write',start:0,end:0,insertedText:'oops'})).code,'ACCESS_REFUSED');
 f.context.pinTransition=true;assert.equal((await handler(f.event(1),'openLinkedSource',input)).code,'ACCESS_REFUSED');assert.equal(shows,1);assert.equal(f.registry.listViews().length,3);assert.deepEqual(await f.projects.readProject(before.project.id),before);
});
test('satellite preload exposes one finite Docs source opener without copying the private flush nonce',async()=>{
 const exposed={},calls=[],source=await readFile(new URL('../src/windows/preload.cjs',import.meta.url),'utf8');
 vm.runInNewContext(source,{require:()=>({contextBridge:{exposeInMainWorld:(name,api)=>{exposed[name]=api;}},ipcRenderer:{on(){},removeListener(){},invoke:async(...args)=>{calls.push(args);return {ok:true};}}})});
 assert.deepEqual(Object.keys(exposed.sirenDocsSources),['openLinkedSource']);const payload={blockId:'block-a',rowId:'row-a',expectedDocumentVersion:'a'.repeat(64)};await exposed.sirenDocsSources.openLinkedSource(payload);assert.deepEqual(calls.at(-1),['siren:docs-sources','openLinkedSource',payload]);
});
