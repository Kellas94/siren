import {randomUUID} from 'node:crypto';
import {navigationFields} from '../navigation/contracts.mjs';
const fail=code=>Object.freeze({ok:false,code});

/** Main-owned Code-only preparation transport. Main supplies a captured grant
 * and a synchronous sender adapter. No IPC channel/preload or all-view Lock is
 * installed here. A renderer ACK merely requests sealing actual owner receipts. */
export class NativeCodeControl {
  #registry;#owner;#send;#timeout;#pending=new Map();#disposed=false;
  constructor({registry,owner,send,timeoutMs=10000}) {
    if(!registry || !['capture','eventFor','isCurrent'].every(key=>typeof registry[key]==='function') || !owner ||
      !['beginViewFlush','finishViewFlush','cancelViewFlush'].every(key=>typeof owner[key]==='function') || typeof send!=='function')throw TypeError('Native view control adapters required');
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw TypeError('Native view deadline refused');
    this.#registry=registry;this.#owner=owner;this.#send=send;this.#timeout=timeoutMs;
  }
  #settle(ticket,result) {
    if(this.#pending.get(ticket.requestId)!==ticket)return false;
    this.#pending.delete(ticket.requestId);clearTimeout(ticket.timer);
    for(const [name,callback] of ticket.listeners)ticket.event.sender.off(name,callback);
    if(result.ok!==true)try{this.#owner.cancelViewFlush(ticket.grant,ticket.nonce);}catch{ /* Authority remains fenced; never turn cancellation failure into success. */ }
    ticket.resolve(result);return true;
  }
  flushView(grant) {
    if(this.#disposed)return Promise.resolve(fail('CONTROL_DISPOSED'));
    if(grant?.role!=='code' || !this.#registry.isCurrent(grant))return Promise.resolve(fail('ACCESS_REFUSED'));
    if(this.#pending.size>=64 || [...this.#pending.values()].some(item=>item.grant.windowId===grant.windowId))return Promise.resolve(fail('VIEW_BUSY'));
    const event=this.#registry.eventFor(grant);
    if(!event || typeof event.sender?.on!=='function' || typeof event.sender?.off!=='function')return Promise.resolve(fail('ACCESS_REFUSED'));
    let nonce;try{nonce=this.#owner.beginViewFlush(grant);}catch{return Promise.resolve(fail('VIEW_FLUSH_REFUSED'));}
    const requestId=randomUUID();let resolve;const promise=new Promise(done=>{resolve=done;});
    const ticket={requestId,nonce,grant,event,resolve,listeners:[],sealing:false};this.#pending.set(requestId,ticket);
    const retired=()=>this.#settle(ticket,fail('VIEW_RETIRED'));
    for(const name of ['destroyed','render-process-gone','did-start-navigation']){event.sender.on(name,retired);ticket.listeners.push([name,retired]);}
    ticket.timer=setTimeout(()=>this.#settle(ticket,fail('VIEW_TIMEOUT')),this.#timeout);
    try{this.#send(event,Object.freeze({requestId,nonce}));}catch{this.#settle(ticket,fail('VIEW_TRANSPORT_FAILED'));}
    return promise;
  }
  async acknowledge(event,input) {
    if(this.#disposed)return fail('CONTROL_DISPOSED');
    let payload;try{payload=navigationFields(input,['requestId','ok','code'],['requestId','ok']);}catch{return fail('REQUEST_REFUSED');}
    if(typeof payload.requestId!=='string'||typeof payload.ok!=='boolean'||Object.hasOwn(payload,'code') &&
      (typeof payload.code!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(payload.code)) || payload.ok && Object.hasOwn(payload,'code'))return fail('REQUEST_REFUSED');
    const ticket=this.#pending.get(payload.requestId);if(!ticket)return fail('CONTROL_STALE');
    const caller=this.#registry.capture(event);
    if(!this.#registry.isCurrent(caller) || !this.#registry.isCurrent(ticket.grant) || event.sender!==ticket.event.sender || event.senderFrame!==ticket.event.senderFrame)return fail('ACCESS_REFUSED');
    if(ticket.sealing)return fail('VIEW_BUSY');
    if(!payload.ok){const result=fail('VIEW_FLUSH_FAILED');this.#settle(ticket,result);return result;}
    ticket.sealing=true;let result;
    try{result=await this.#owner.finishViewFlush(caller,ticket.nonce);}catch{result=fail('VIEW_FLUSH_FAILED');}
    if(this.#pending.get(payload.requestId)!==ticket)return fail('CONTROL_STALE');
    if(!this.#registry.isCurrent(ticket.grant))result=fail('VIEW_RETIRED');
    if(result?.ok!==true)result=fail('VIEW_FLUSH_FAILED');
    this.#settle(ticket,result);return result;
  }
  dispose() {
    if(this.#disposed)return;this.#disposed=true;
    for(const ticket of [...this.#pending.values()])this.#settle(ticket,fail('CONTROL_DISPOSED'));
  }
  // Trusted main rollback/failure adapter, not a renderer cancellation channel.
  cancelView(grant) {
    const ticket=[...this.#pending.values()].find(item=>item.grant===grant);
    if(!ticket)return fail('CONTROL_STALE');
    this.#settle(ticket,fail('VIEW_CANCELLED'));return Object.freeze({ok:true});
  }
}
