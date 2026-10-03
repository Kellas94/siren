import {HomeAuthority} from './authority.mjs';
import {WindowRegistry} from '../windows/registry.mjs';
import {NativeAllWorkspaceBarrier} from '../windows/source-barrier.mjs';
import {navigationFields} from './contracts.mjs';
import {ProjectStore} from '../projects/store.mjs';
import {readOwnedBytes} from '../projects/io.mjs';
import {join} from 'node:path';

const fail=()=>Object.freeze({ok:false,code:'TRANSITION_FAILED'});
const methods=new Set(['continueWork','openProject','createProject']);
/** Native-only acknowledgement of a prepared same-project entry handoff.
 * It conveys metadata, never fresh source authority to the retired caller.
 * Project-selection/no-selection completion requires its own native proof. */
export class HomeTransitionReceipts {
 #authority;#registry;#projects;#tickets=new Map();#receipts=new WeakMap();
 constructor({authority,registry,projects}){
  if(!(authority instanceof HomeAuthority)||!(registry instanceof WindowRegistry))throw TypeError('Native Home receipt owners required');
  if(projects!==undefined&&!(projects instanceof ProjectStore))throw TypeError('Native project owner required');
  this.#authority=authority;this.#registry=registry;this.#projects=projects;
 }
 begin(grant,method){
  if(!methods.has(method)||!HomeAuthority.prototype.isCurrent.call(this.#authority,grant)||this.#tickets.size>=64||
    [...this.#tickets.values()].some(item=>item.grant.sender===grant.sender))return null;
  const before=WindowRegistry.prototype.capturePrimary.call(this.#registry,{sender:grant.sender,senderFrame:grant.frame});
  if(!before&&!(this.#projects&&(grant.url==='siren://app/home.html'&&grant.projectId===null||grant.mode!=='normal')))return null;
  const ticket=Object.freeze({});this.#tickets.set(ticket,{grant,method,before});return ticket;
 }
 complete(ticket,input){
  const state=ticket&&this.#tickets.get(ticket);if(!state||state.receipt)return fail();
  try{
   const {barrier,proof,view}=navigationFields(input,['barrier','proof','view']);
   if(!NativeAllWorkspaceBarrier.prototype.isCompletedNavigation.call(barrier,proof,view)||
     HomeAuthority.prototype.isCurrent.call(this.#authority,state.grant)||WindowRegistry.prototype.isCurrent.call(this.#registry,state.before))return fail();
   const event={sender:state.grant.sender,senderFrame:state.grant.sender.mainFrame};
   const after=HomeAuthority.prototype.capture.call(this.#authority,event),native=WindowRegistry.prototype.capturePrimary.call(this.#registry,event);
   if(!after||!native||!HomeAuthority.prototype.isCurrent.call(this.#authority,after)||
     !state.before||native.windowId!==view.windowId||native.windowId===state.before.windowId||native.projectId!==state.before.projectId||
     after.projectId!==native.projectId||!Number.isSafeInteger(view.epoch)||view.epoch<1)return fail();
   const receipt=Object.freeze({ok:true,epoch:view.epoch});state.receipt=receipt;state.after=after;state.view=view;
   this.#receipts.set(receipt,{ticket,state});return receipt;
  }catch{return fail();}
 }
 // The only selection acknowledgement is derived from the actual owned pointer,
 // a verified project revision and fresh native Home captures. No renderer can
 // submit a selection proof, path, project snapshot or replacement authority.
 async completeSelection(ticket){
  const state=ticket&&this.#tickets.get(ticket);if(!state||state.receipt||!this.#projects)return fail();
  try{
   const event={sender:state.grant.sender,senderFrame:state.grant.sender.mainFrame};
   const after=HomeAuthority.prototype.capture.call(this.#authority,event),native=WindowRegistry.prototype.capturePrimary.call(this.#registry,event);
   if(!after||after.url!=='siren://app/home.html'||!native||native.projectId!==after.projectId||
      after.generation<=state.grant.generation||HomeAuthority.prototype.isCurrent.call(this.#authority,state.grant)||
      state.before&&WindowRegistry.prototype.isCurrent.call(this.#registry,state.before))return fail();
   const selected=JSON.parse((await readOwnedBytes(join(this.#projects.root,'session-selection.json'),65536)).toString('utf8'));
   if(selected.schema!==1||selected.projectId!==after.projectId)return fail();
   const snapshot=await ProjectStore.prototype.readProject.call(this.#projects,after.projectId);
   if(snapshot.project.id!==after.projectId||!HomeAuthority.prototype.isCurrent.call(this.#authority,after)||
      !WindowRegistry.prototype.isCurrent.call(this.#registry,native))return fail();
   const pointer=JSON.parse((await readOwnedBytes(join(this.#projects.root,'session-selection.json'),65536)).toString('utf8'));
   if(pointer.schema!==1||pointer.projectId!==after.projectId)return fail();
   const receipt=Object.freeze({ok:true,epoch:native.epoch});state.receipt=receipt;state.after=after;state.native=native;
   this.#receipts.set(receipt,{ticket,state});return receipt;
  }catch{return fail();}
 }
 completeEmptyRecovery(ticket,roster,entryUrl){
  const state=ticket&&this.#tickets.get(ticket);if(!state||state.receipt||state.before||!this.#projects)return fail();
  try{
   if(!WindowRegistry.prototype.isRosterCurrent.call(this.#registry,roster)||roster.grants.length!==0||HomeAuthority.prototype.isCurrent.call(this.#authority,state.grant))return fail();
   const event={sender:state.grant.sender,senderFrame:state.grant.sender.mainFrame},after=HomeAuthority.prototype.capture.call(this.#authority,event);
   if(!['siren://app/app.html','siren://app/home.html'].includes(entryUrl)||!after||after.url!==entryUrl||after.url===state.grant.url||!['readonly','recovery'].includes(after.mode)||after.mode!==state.grant.mode||
      after.projectId!==state.grant.projectId||after.generation!==state.grant.generation||after.frame===state.grant.frame||
      after.sender.isLoadingMainFrame()!==false||!HomeAuthority.prototype.isCurrent.call(this.#authority,after))return fail();
   const receipt=Object.freeze({ok:true,epoch:roster.epoch});state.receipt=receipt;state.after=after;state.emptyRecovery=true;
   this.#receipts.set(receipt,{ticket,state});return receipt;
  }catch{return fail();}
 }
 consume(receipt,{ticket,grant,method}){
  const proof=receipt&&this.#receipts.get(receipt),state=ticket&&this.#tickets.get(ticket);
  try{
   if(!proof||proof.ticket!==ticket||proof.state!==state||state.grant!==grant||state.method!==method||state.receipt!==receipt||
     !HomeAuthority.prototype.isCurrent.call(this.#authority,state.after)||
     !(state.emptyRecovery?WindowRegistry.prototype.listViews.call(this.#registry).length===0:state.native?WindowRegistry.prototype.isCurrent.call(this.#registry,state.native):WindowRegistry.prototype.isWorkspaceNavigationCurrent.call(this.#registry,state.view)))return false;
   this.#receipts.delete(receipt);this.#tickets.delete(ticket);return true;
  }catch{return false;}
 }
 cancel(ticket){
  const state=this.#tickets.get(ticket);if(!state)return false;
  if(state.receipt)this.#receipts.delete(state.receipt);this.#tickets.delete(ticket);return true;
 }
}
