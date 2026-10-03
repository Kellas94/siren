import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {nativeSourceContext} from './fixtures/source-main-context.mjs';
import {allowedAppFile} from '../scripts/package.mjs';

test('actual main control seals a selected readonly Code version and refuses satellite primary draining',async()=>{
 const f=await nativeSourceContext(),ref=f.refs[0];
 await f.registry.openView({role:'code',entityId:ref.sourceId,version:1});
 const event=f.event(2),grant=f.registry.capture(event);
 vm.runInContext('globalThis.nativeControl=viewControl;',f.context);
 let ticket;event.sender.send=(_channel,value)=>{ticket=value};
 f.context.owner.pause('actual-main-test');
 const pending=f.context.nativeControl.flushView(grant);assert.ok(ticket);
 assert.equal((await f.handlers.get('siren:workspace-flush')(event,'sealReadonly',{nonce:ticket.nonce})).code,'ACCESS_REFUSED');
 const ack=await f.handlers.get('siren:view-ack')(event,{requestId:ticket.requestId,ok:true});
 assert.equal(ack.ok,true);const sealed=await pending;assert.equal(sealed.ok,true);
 assert.equal(sealed.receipts[0].version,1);assert.equal(sealed.receipts[0].sha256,ref.sha256);assert.equal(sealed.receipts[0].durability,'readonly');
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 assert.equal((await f.handlers.get('siren:view-ack')(event,{requestId:ticket.requestId,ok:true})).code,'CONTROL_STALE');
 f.context.nativeControl.dispose();
});
test('production package includes the mounted control, barrier and immutable proof modules',()=>{
 for(const file of ['control','source-barrier','readonly-seals'])assert.equal(allowedAppFile(`src/windows/${file}.mjs`,new Set()),true,file);
});
