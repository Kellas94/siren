import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,rm} from 'node:fs/promises';
import {nativeSourceContext,mainSlice} from './fixtures/source-main-context.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {documentVersion} from '../src/windows/docs.mjs';

test('actual main mounts explicit Code/Docs channel, refuses readonly, refreshes selected native metadata only after a genuine manifest commit',async t=>{
 const f=await nativeSourceContext();t.after(()=>rm(f.root,{recursive:true,force:true}));
 vm.runInContext(mainSlice("ipcMain.handle('siren:source-readers'","const invokeNativeWindow="),f.context);
 const handler=f.handlers.get('siren:code-docs');assert.equal(typeof handler,'function');
 assert.equal((await handler(f.event(0),'listTargets',{})).code,'ACCESS_REFUSED');
 const ref=f.refs[0],point={sourceId:ref.sourceId,version:1,sha256:ref.sha256};
 const metadata={workpapers:[{id:'doc-a',title:'Native linked agent',private:'PRIVATE_BODY',blocks:[{kind:'knowledge',rows:[{id:'row-a',sourceRef:point}]}]}]};
 const initialized=await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:2,sourceRefs:f.refs,metadata,operationId:'actual-main-docs-fixture'});assert.equal(initialized.ok,true);
 const before=await f.projects.readProject(f.selected.project.id);f.context.snapshot=before;f.context.mode='normal';f.context.nativeReadonly=false;
 vm.runInContext('workingSources=new NativeWorkingSources({registry:windowRegistry,owner:workspaceOwner,enabled:workingEnabled,snapshotFor:()=>snapshot});globalThis.working=workingSources;',f.context);
 assert.equal((await f.context.working.admit(f.registry.capture(f.event(0)))).ok,true);
 const targets=await handler(f.event(0),'listTargets',{});assert.equal(targets.ok,true);assert.equal(targets.targets.length,1);assert.equal(JSON.stringify(targets).includes('PRIVATE_BODY'),false);
 const mutate=f.handlers.get('siren:source-mutations');assert.equal((await mutate(f.event(0),'applyEdit',{sourceId:ref.sourceId,expectedVersion:1,operationId:'native-docs-edit',start:0,end:1,insertedText:'X'})).ok,true);
 const sourceReceipt=await mutate(f.event(0),'commitSource',{sourceId:ref.sourceId,expectedVersion:2,operationId:'native-docs-save'});assert.equal(sourceReceipt.ok,true);assert.deepEqual(await f.projects.readProject(before.project.id),before);
 const request={operationId:'native-docs-link',documentId:'doc-a',rowId:'row-a',expectedDocumentVersion:documentVersion(before,'doc-a'),sourceReceipt};
 const result=await handler(f.event(0),'commitCodeToDocs',request);assert.equal(result.ok,true,JSON.stringify(result));
 const current=await f.projects.readProject(before.project.id);assert.deepEqual(f.context.snapshot,current);assert.deepEqual(f.context.bootstrap.snapshot,current);assert.equal(current.revision,before.revision+1);
 assert.equal(JSON.parse(current.json).workpapers[0].blocks[0].rows[0].sourceRef.version,2);
 assert.equal((await handler(f.event(1),'listTargets',{})).code,'ACCESS_REFUSED');
 f.context.pinTransition=true;assert.equal((await handler(f.event(0),'listTargets',{})).code,'ACCESS_REFUSED');
 assert.deepEqual(await f.projects.readProject(before.project.id),current);
});

test('satellite preload exposes only finite explicit link methods and never a Docs snapshot or transition nonce',async()=>{
 const source=await readFile(new URL('../src/windows/preload.cjs',import.meta.url),'utf8'),exposed={},calls=[];
 vm.runInNewContext(source,{require:()=>({contextBridge:{exposeInMainWorld:(name,api)=>{exposed[name]=api;}},ipcRenderer:{on(){},removeListener(){},invoke:async(...args)=>{calls.push(args);return {ok:true};}}})});
 assert.deepEqual(Object.keys(exposed.sirenCodeDocs).sort(),['commitCodeToDocs','listTargets']);
 await exposed.sirenCodeDocs.listTargets({offset:64});assert.deepEqual(calls.at(-1),['siren:code-docs','listTargets',{offset:64}]);
 const request={operationId:'native-explicit'};await exposed.sirenCodeDocs.commitCodeToDocs(request);assert.deepEqual(calls.at(-1),['siren:code-docs','commitCodeToDocs',request]);
 assert.equal(exposed.sirenCodeDocs.nonce,undefined);assert.equal(exposed.sirenCodeDocs.saveProject,undefined);
});
