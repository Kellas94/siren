import {TERMINAL_METHODS} from './contracts.mjs';
// Pure synchronous policy for future native wiring. Native registry identity,
// PIN, mode and lease callbacks must be supplied by main; default is refusal.
// No caller grant is made from IPC fields, URL similarity or a role string.
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const eligible=new Set(['workspace','terminal']);
const terminalOnly=new Set(['terminalAttach','terminalInput','terminalResize','terminalAck','terminalDetach']);
const leased=new Set(['terminalInput','terminalResize','terminalAck','terminalDetach']);
const sessionMethods=new Set([...terminalOnly,'terminalStop']);
const passive=new Set(['terminalList','terminalListProfiles']);
const refuse=code=>Object.freeze({ok:false,code});
export class TerminalPolicy {
  #current;#unlocked;#mode;#lease;#execute;
  constructor({isCurrentGrant,isUnlocked,getMode,isCurrentLease,canExecute}={}){
    this.#current=typeof isCurrentGrant==='function'?isCurrentGrant:()=>false;
    this.#unlocked=typeof isUnlocked==='function'?isUnlocked:()=>false;
    this.#mode=typeof getMode==='function'?getMode:()=>null;
    this.#lease=typeof isCurrentLease==='function'?isCurrentLease:()=>false;
    this.#execute=typeof canExecute==='function'?canExecute:()=>false;
  }
  authorize({grant,method,session,lease,epoch}={}){
    try{
      if(!grant||![grant.windowId,grant.projectId].every(id)||!Number.isSafeInteger(grant.epoch)||grant.epoch<1||!eligible.has(grant.role)||this.#current(grant)!==true)return refuse('SENDER_REFUSED');
      if(typeof method!=='string'||!Object.hasOwn(TERMINAL_METHODS,method))return refuse('REQUEST_REFUSED');
      if(terminalOnly.has(method)&&grant.role!=='terminal')return refuse('SENDER_REFUSED');
      if(this.#unlocked()!==true)return refuse('PIN_REQUIRED');
      if(!Number.isSafeInteger(epoch)||epoch!==grant.epoch)return refuse('EPOCH_STALE');
      const mode=this.#mode(grant);if(!['normal','readonly','recovery'].includes(mode)||mode!=='normal'&&!passive.has(method)||!passive.has(method)&&this.#execute(grant)!==true)return refuse('READONLY');
      if(sessionMethods.has(method)&&(!session||!id(session.sessionId)||session.projectId!==grant.projectId))return refuse('SESSION_REFUSED');
      if(leased.has(method)&&(!lease||lease.sessionId!==session.sessionId||lease.projectId!==grant.projectId||lease.windowId!==grant.windowId||lease.epoch!==grant.epoch||!id(lease.leaseId)||!Number.isSafeInteger(lease.generation)||lease.generation<0||this.#lease(lease,grant,session)!==true))return refuse('LEASE_STALE');
      return Object.freeze({ok:true});
    }catch{return refuse('SENDER_REFUSED');}
  }
}
