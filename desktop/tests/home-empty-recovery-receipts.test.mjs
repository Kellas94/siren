import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {HomeAuthority} from '../src/navigation/authority.mjs';
import {HomeTransitionReceipts} from '../src/navigation/transition-receipts.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';

async function fixture(mode='readonly') {
 const projects=new ProjectStore(await mkdtemp(join(tmpdir(),'siren-empty-recovery-')));
 let unlocked=true;
 const window=new EventEmitter();window.id=100;window.isDestroyed=()=>false;window.webContents=new EventEmitter();
 const wc=window.webContents;Object.assign(wc,{id:200,mainFrame:{url:'siren://app/home.html'},getURL:()=>wc.mainFrame.url,isDestroyed:()=>false,isLoadingMainFrame:()=>false});
 const registry=new WindowRegistry({authorize:()=>null,createWindow:()=>assert.fail('Recovery has no data views')});registry.bindWorkspace(window);
 const authority=new HomeAuthority({workspace:window,state:()=>({unlocked,projectId:null,mode,generation:0})});
 const receipts=new HomeTransitionReceipts({registry,authority,projects});
 const grant=authority.capture({sender:wc,senderFrame:wc.mainFrame}),ticket=receipts.begin(grant,'continueWork');
 const navigate=()=>{authority.invalidate();wc.mainFrame={url:'siren://app/app.html'};};
 return {registry,authority,receipts,grant,ticket,navigate,wc,lock:()=>{unlocked=false;}};
}

test('empty readonly Recovery acknowledges a real retired frame and genuine native roster once',async()=>{
 const f=await fixture(),roster=f.registry.freezeRoster();f.navigate();
 const receipt=f.receipts.completeEmptyRecovery(f.ticket,roster,'siren://app/app.html');
 assert.equal(receipt.ok,true);assert.equal(f.registry.releaseRoster(roster),true);
 assert.equal(f.authority.isCurrent(f.grant),false);assert.equal(f.registry.listViews().length,0);
 const scope={ticket:f.ticket,grant:f.grant,method:'continueWork'};
 assert.equal(f.receipts.consume({...receipt},scope),false);
 assert.equal(f.receipts.consume(receipt,scope),true);assert.equal(f.receipts.consume(receipt,scope),false);
});

test('copied native roster, URL-only mutation and loading Recovery cannot manufacture an acknowledgement',async()=>{
 for(const defect of ['roster','frame','loading','url']) {
  const f=await fixture(),roster=f.registry.freezeRoster();
  if(defect==='frame'){f.authority.invalidate();f.wc.mainFrame.url='siren://app/app.html';}else f.navigate();
  if(defect==='loading')f.wc.isLoadingMainFrame=()=>true;
  const receipt=f.receipts.completeEmptyRecovery(f.ticket,defect==='roster'?{...roster}:roster,defect==='url'?'siren://app/app.html?forged':'siren://app/app.html');
  assert.equal(receipt.ok,false,defect);assert.equal(f.registry.releaseRoster(roster),true);
 }
});

test('normal no-project Home and Lock during a readonly transition cannot authorize Recovery',async()=>{
 const normal=await fixture('normal'),roster=normal.registry.freezeRoster();normal.navigate();
 assert.equal(normal.receipts.completeEmptyRecovery(normal.ticket,roster,'siren://app/app.html').ok,false);normal.registry.releaseRoster(roster);
 const f=await fixture(),proof=f.registry.freezeRoster();f.navigate();
 const receipt=f.receipts.completeEmptyRecovery(f.ticket,proof,'siren://app/app.html');assert.equal(receipt.ok,true);f.registry.releaseRoster(proof);f.lock();
 assert.equal(f.receipts.consume(receipt,{ticket:f.ticket,grant:f.grant,method:'continueWork'}),false);
});
