import { validId } from '../projects/paths.mjs';
import {WORKSPACE_ENTRIES} from './entries.mjs';

const entries=new Set(Object.values(WORKSPACE_ENTRIES));
/** Isolated native Home authority: main must invalidate synchronously for every
 * Lock/navigation/access transition before awaiting anything. No data grant or
 * production channel is created here, even when no project is selected. */
export class HomeAuthority {
  #workspace; #state; #epoch=1; #disabled=false; #captures=new WeakSet();
  constructor({workspace,state}) {
    if(!workspace || typeof state!=='function')throw new TypeError('Native Home owner required');
    this.#workspace=workspace;this.#state=state;
  }
  invalidate() {
    if(this.#epoch===Number.MAX_SAFE_INTEGER)this.#disabled=true;
    else this.#epoch++;
  }
  #identity(sender,frame) {
    try {
      const workspace=this.#workspace;
      return !this.#disabled && !workspace.isDestroyed() && sender===workspace.webContents && !sender.isDestroyed() &&
        frame===sender.mainFrame && entries.has(frame.url) && sender.getURL()===frame.url;
    } catch {return false;}
  }
  capture(event) {
    const sender=event?.sender,frame=event?.senderFrame;
    if(!this.#identity(sender,frame))return null;
    try {
      const state=this.#state();
      if(typeof state.unlocked!=='boolean' || !(state.projectId===null || validId(state.projectId)) ||
          !['normal','readonly','recovery'].includes(state.mode) || !Number.isSafeInteger(state.generation) || state.generation<0)return null;
      const grant=Object.freeze({sender,frame,url:frame.url,epoch:this.#epoch,projectId:state.projectId,mode:state.mode,generation:state.generation,unlocked:state.unlocked});
      this.#captures.add(grant);return grant;
    } catch {return null;}
  }
  isCurrent(grant) {
    if(!grant || !this.#captures.has(grant) || !grant.unlocked || grant.epoch!==this.#epoch || !this.#identity(grant.sender,grant.frame) || grant.frame.url!==grant.url)return false;
    try {
      const state=this.#state();return state.unlocked===true && state.projectId===grant.projectId && state.mode===grant.mode && state.generation===grant.generation;
    } catch {return false;}
  }
}
