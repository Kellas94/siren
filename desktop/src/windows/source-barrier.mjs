const fail=code=>Object.freeze({ok:false,code});

/** Native-only Code roster preparation. It deliberately refuses other roles:
 * general Docs/Diagram/legacy workspace saving is not established by sources.
 * No PIN, project selection, destruction or clean-close journal is changed. */
export class NativeSourceBarrier {
  #registry;#owner;#control;#cover;#timeout;#roles;#active=null;#disposed=false;
  constructor({registry,owner,control,cover,timeoutMs=10000},roles=['code']) {
    for(const [adapter,methods] of [[registry,['freezeRoster','isRosterCurrent','releaseRoster']],[owner,['pause','resume','drain','reconcileSourceReceipts','captureQuiescence','isQuiescent']],[control,['flushView','cancelView']]])
      if(!adapter || !methods.every(key=>typeof adapter[key]==='function'))throw TypeError('Native source barrier adapters required');
    if(typeof cover!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw TypeError('Native source barrier deadline required');
    if(!Array.isArray(roles)||!roles.length||roles.some(role=>!['workspace','code','docs','diagram'].includes(role))||(roles.length>1||roles.includes('workspace'))&&typeof owner.reconcileWorkspaceReceipts!=='function')throw TypeError('Native domain barrier adapters required');
    this.#registry=registry;this.#owner=owner;this.#control=control;this.#cover=cover;this.#timeout=timeoutMs;this.#roles=new Set(roles);
  }
  async prepare(reason) {
    if(this.#disposed)return fail('BARRIER_DISPOSED');if(this.#active)return fail('BARRIER_BUSY');
    if(typeof reason!=='string'||reason.length<1||reason.length>128)return fail('REQUEST_REFUSED');
    let roster;try{roster=this.#registry.freezeRoster();}catch(cause){return fail(cause.code==='ROSTER_BUSY'?'BARRIER_BUSY':'ROSTER_REFUSED');}
    if(!roster.grants.length || roster.grants.some(grant=>!this.#roles.has(grant.role))){this.#registry.releaseRoster(roster);return fail('VIEW_ROLE_UNSUPPORTED');}
    const ticket={roster,prepared:false,cancelled:false};this.#active=ticket;
    const current=()=>this.#active===ticket && !ticket.cancelled && !this.#disposed && this.#registry.isRosterCurrent(roster);
    let timer;
    try {
      this.#owner.pause(reason);
      for(const grant of roster.grants)this.#cover(grant);
      // Start drain before sending preparation: already admitted failures must
      // not disappear from the finite snapshot when a fast operation finishes.
      const draining=this.#owner.drain();
      const work=(async()=>{
        const settled=await Promise.allSettled(roster.grants.map(grant=>this.#control.flushView(grant)));
        const drained=await draining;
        if(!current())return fail('ROSTER_CHANGED');
        if(settled.some(item=>item.status!=='fulfilled'||item.value?.ok!==true))return fail('VIEW_FLUSH_FAILED');
        const receipts=[...drained,...settled.flatMap(item=>item.value.receipts??[])];
        const reconciled=await this.#owner[this.#roles.size===1&&!this.#roles.has('workspace')?'reconcileSourceReceipts':'reconcileWorkspaceReceipts'](roster.grants,receipts,current);
        if(!current())return fail('ROSTER_CHANGED');
        if(reconciled.ok!==true)return reconciled;
        ticket.quiescence=this.#owner.captureQuiescence();
        const proof=Object.freeze({epoch:roster.epoch,refs:reconciled.refs});ticket.proof=proof;ticket.prepared=true;
        return Object.freeze({ok:true,proof});
      })();
      const result=await Promise.race([work,new Promise(resolve=>{timer=setTimeout(()=>resolve(fail('BARRIER_TIMEOUT')),this.#timeout);})]);
      if(result.ok!==true){ticket.cancelled=true;for(const grant of roster.grants)this.#control.cancelView(grant);}
      return result;
    } catch {ticket.cancelled=true;for(const grant of roster.grants)this.#control.cancelView(grant);return fail('BARRIER_FAILED');}
    finally {clearTimeout(timer);}
  }
  isPrepared(proof) {
    const ticket=this.#active;
    return Boolean(proof && !this.#disposed && ticket?.prepared && !ticket.cancelled && ticket.proof===proof && this.#registry.isRosterCurrent(ticket.roster) && this.#owner.isQuiescent(ticket.quiescence));
  }
  // Native-only same-project hand-off. The renderer cannot replace persistence
  // preparation with a URL/roster, or release the owner during an unfinished
  // load. Main awaits genuine entry readiness before finishing this hand-off.
  beginWorkspaceNavigation(proof,options) {
    const ticket=this.#active;
    if(!this.isPrepared(proof)||ticket.navigation||typeof this.#registry.beginWorkspaceNavigation!=='function'||
      typeof this.#registry.finishWorkspaceNavigation!=='function'||typeof this.#registry.cancelWorkspaceNavigation!=='function'||
      typeof this.#registry.isWorkspaceNavigationCurrent!=='function')return fail('NAVIGATION_REFUSED');
    try{
      ticket.navigation=this.#registry.beginWorkspaceNavigation(ticket.roster,options);
      return Object.freeze({ok:true,navigation:ticket.navigation});
    }catch{return fail('NAVIGATION_REFUSED');}
  }
  finishWorkspaceNavigation(proof,navigation) {
    const ticket=this.#active;
    if(this.#disposed||!ticket||ticket.cancelled||!ticket.prepared||ticket.proof!==proof||!navigation||ticket.navigation!==navigation||ticket.navigationRecord||
      !this.#owner.isQuiescent(ticket.quiescence))return fail('NAVIGATION_REFUSED');
    try{
      ticket.navigationRecord=this.#registry.finishWorkspaceNavigation(navigation);
      if(!this.#registry.isWorkspaceNavigationCurrent(ticket.navigationRecord))return fail('NAVIGATION_REFUSED');
      return Object.freeze({ok:true,view:ticket.navigationRecord});
    }catch{return fail('NAVIGATION_REFUSED');}
  }
  // A native receipt issuer may attest this exact completed handoff before
  // release. Cloned records, unfinished loads and retired owners cannot qualify.
  isCompletedNavigation(proof,record) {
    const ticket=this.#active;
    return Boolean(!this.#disposed&&ticket&&!ticket.cancelled&&ticket.prepared&&ticket.proof===proof&&
      ticket.navigationRecord===record&&this.#owner.isQuiescent(ticket.quiescence)&&
      this.#registry.isWorkspaceNavigationCurrent(record));
  }
  // Main explicitly decides whether to resume view adapters; releasing only
  // lifts native admission. Failed optimistic editors stay fenced themselves.
  release(proof) {
    if(!proof || this.#active?.proof!==proof)return false;
    const active=this.#active;
    if(active.navigation&&(!active.navigationRecord||!this.#registry.isWorkspaceNavigationCurrent(active.navigationRecord)||!this.#owner.isQuiescent(active.quiescence)))return false;
    const ticket=this.#active;if(!this.#registry.releaseRoster(ticket.roster))return false;
    ticket.cancelled=true;this.#active=null;this.#owner.resume();return true;
  }
  dispose() {
    if(this.#disposed)return;this.#disposed=true;
    const ticket=this.#active;if(!ticket)return;ticket.cancelled=true;
    if(ticket.navigation)this.#registry.cancelWorkspaceNavigation(ticket.navigation);
    for(const grant of ticket.roster.grants)this.#control.cancelView(grant);
    this.#registry.releaseRoster(ticket.roster);this.#active=null;
    // Disposal never resumes writes or manufactures successful preparation.
  }
}
// General domain roster still refuses the legacy primary workspace and
// presentation until their distinct adapters are installed and qualified.
export class NativeWorkspaceBarrier extends NativeSourceBarrier {constructor(options){super(options,['code','docs','diagram']);}}
export class NativeAllWorkspaceBarrier extends NativeSourceBarrier {constructor(options){super(options,['workspace','code','docs','diagram']);}}
