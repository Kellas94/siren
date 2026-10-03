import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {invokeHomeWindow} from '../src/windows/home-admission.mjs';
async function fixture(){
 const f=await sourceReadFixture(),primary=new EventEmitter();primary.id=900;primary.isDestroyed=()=>false;primary.isMinimized=()=>false;
 const wc=primary.webContents=new EventEmitter();Object.assign(wc,{id:901,mainFrame:{url:'siren://app/home.html'},getURL:()=>wc.mainFrame.url,isDestroyed:()=>false});
 f.registry.bindWorkspace(primary);f.registry.activateWorkspace({entryUrl:wc.getURL()});const event={sender:wc,senderFrame:wc.mainFrame};
 return {...f,primary,event,call:payload=>invokeHomeWindow({event,payload,registry:f.registry,snapshot:f.selected})};
}
test('Home opens actual saved Docs and selected immutable Code without acquiring entity or source authority',async()=>{
 const f=await fixture();assert.deepEqual(f.registry.capturePrimary(f.event).entityIds,[]);
 for(const payload of [{role:'docs',entityId:'doc-a'},{role:'code',entityId:f.refs[0].sourceId,version:1}]){
  const result=await f.call(payload);assert.equal(result.ok,true);assert.equal(result.view.entityId,payload.entityId);assert.deepEqual(f.registry.capturePrimary(f.event).entityIds,[]);
  assert.equal(JSON.stringify(result).includes('foreign secret'),false);
 }
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('unselected versions, unknown entities, copied Home frames and caller authority fields are refused before opening',async()=>{
 const f=await fixture(),before=f.registry.listViews().length;
 for(const payload of [{role:'code',entityId:f.refs[0].sourceId,version:2},{role:'docs',entityId:'missing'},{role:'code',entityId:'doc-a',version:1},{role:'docs',entityId:'doc-a',projectId:f.selected.project.id},{role:'docs',entityId:'doc-a',version:1}])assert.equal((await f.call(payload)).ok,false);
 assert.equal((await invokeHomeWindow({event:{sender:f.event.sender,senderFrame:{...f.event.senderFrame}},payload:{role:'docs',entityId:'doc-a'},registry:f.registry,snapshot:f.selected})).ok,false);
 assert.equal(f.registry.listViews().length,before);f.lock();assert.equal((await f.call({role:'docs',entityId:'doc-a'})).ok,false);
});
