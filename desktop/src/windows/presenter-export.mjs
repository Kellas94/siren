import {randomUUID} from 'node:crypto';
import {open,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {WindowRegistry} from './registry.mjs';
import {PresentationSession} from './presentation.mjs';
import {ProjectStore} from '../projects/store.mjs';
import {navigationFields} from '../navigation/contracts.mjs';
import {childDirectory,ownedDirectory,ownedFile} from '../projects/paths.mjs';
import {readOwnedBytes} from '../projects/io.mjs';
import {digest} from '../projects/atomic.mjs';
import {formatPresentationNotes} from '../documents/presentation-notes.mjs';
const fail=code=>Object.freeze({ok:false,code});
const refused=()=>{throw Object.assign(Error('ACCESS_REFUSED'),{code:'ACCESS_REFUSED'});};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),maximum=8*1024*1024;
/** Private captured notes are main-owned. No renderer text/path, no Audience
 * authority. Capture version/session, not playback position; join all transitions. */
export class NativePresenterExports{
 #registry;#session;#projects;#format;#reveal;#paused=false;#disposed=false;#generation=0;#failed=false;#pending=new Set();#receipts=new Map();
 constructor({registry,sessionFor,projects,format=formatPresentationNotes,reveal}){
  if(!(registry instanceof WindowRegistry)||!(projects instanceof ProjectStore)||[sessionFor,format,reveal].some(v=>typeof v!=='function'))throw TypeError('NATIVE_PRESENTER_EXPORT_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#session=sessionFor;this.#projects=projects;this.#format=format;this.#reveal=reveal;
 }
 #capture(event){const g=this.#registry.capture(event);return g?.role==='presenter'&&g.entityIds.length===1&&this.#registry.isCurrent(g)&&g.mainFrameUrl==='siren://app/windows/presenter.html?windowId='+g.windowId?g:null;}
 pause(){this.#paused=true;this.#generation++;this.#receipts.clear();for(const job of this.#pending)job.controller.abort();}
 resume(){if(!this.#disposed)this.#paused=false;}
 async drain(){await Promise.all([...this.#pending].map(j=>j.promise));if(!this.isIdle())throw Error('PRESENTER_EXPORT_NOT_IDLE');}
 isIdle(){return !this.#pending.size&&!this.#failed;}
 dispose(){this.pause();this.#disposed=true;}
 async invoke({event,method,payload}){
  let request;try{
   if(method==='exportNotes'){request=navigationFields(payload,['deckVersion']);if(!hash(request.deckVersion))return fail('REQUEST_REFUSED');}
   else if(method==='revealExport'){request=navigationFields(payload,['exportId']);if(typeof request.exportId!=='string'||!/^[a-f0-9-]{36}$/.test(request.exportId))return fail('REQUEST_REFUSED');}
   else return fail('REQUEST_REFUSED');
  }catch{return fail('REQUEST_REFUSED');}
  const grant=this.#capture(event),session=this.#session(),generation=this.#generation;
  if(!grant||!(session instanceof PresentationSession)||this.#paused||this.#disposed||this.#failed)return fail('ACCESS_REFUSED');
  const captured=session.getPresenter(grant);if(!captured?.ok||captured.deck.deckId!==grant.entityIds[0])return fail('ACCESS_REFUSED');
  const version=captured.deck.version;
  if(method==='exportNotes'&&request.deckVersion!==version)return fail('PRESENTATION_VERSION_CHANGED');
  const current=()=>{
   const actual=this.#capture(event);if(this.#paused||this.#disposed||this.#failed||generation!==this.#generation||this.#session()!==session||actual?.windowId!==grant.windowId||actual?.epoch!==grant.epoch)return false;
   const state=session.getPresenter(grant);return state?.ok===true&&state.deck.deckId===captured.deck.deckId&&state.deck.version===version;
  };
  if(!current())return fail('ACCESS_REFUSED');
  if(this.#pending.size>=2||[...this.#pending].some(j=>j.windowId===grant.windowId))return fail('EXPORT_BUSY');
  const job={windowId:grant.windowId,controller:new AbortController(),promise:null},live=()=>current()&&!job.controller.signal.aborted;
  const work=async()=>{
   if(method==='revealExport'){
    const receipt=this.#receipts.get(request.exportId);if(!receipt||receipt.windowId!==grant.windowId||receipt.epoch!==grant.epoch||receipt.projectId!==grant.projectId||receipt.session!==session||receipt.deckVersion!==version)return fail('ACCESS_REFUSED');
    const path=await ownedFile(receipt.path),bytes=await readOwnedBytes(path,maximum);if(!live()||digest(bytes)!==receipt.sha256)return fail('EXPORT_CHANGED');this.#reveal(path);return Object.freeze({ok:true});
   }
   if(!live())refused();const output=await this.#format(captured.deck,{isCurrent:live,signal:job.controller.signal});
   if(!live())refused();if(!Buffer.isBuffer(output?.bytes)||output.bytes.length<1||output.bytes.length>maximum||output.extension!=='txt')return fail('EXPORT_FORMAT_REFUSED');
   const bytes=Buffer.from(output.bytes),parent=await this.#projects.directory(grant.projectId);if(!live())refused();const directory=await childDirectory(parent,'exports',{create:true});if(!live())refused();
   const exportId=randomUUID(),filename='presentation-notes-'+exportId+'.txt',path=join(directory,filename),temporary=join(directory,'pending-'+exportId+'.tmp');let handle,published=false,retained=false,outcome;
   try{
    if(!live())refused();handle=await open(temporary,'wx',0o600);if(!live())refused();await handle.writeFile(bytes);if(!live())refused();await handle.sync();await handle.close();handle=null;if(!live())refused();
    await ownedDirectory(directory);if(!live())refused();await rename(temporary,path);published=true;if(!live())refused();const actual=await readOwnedBytes(path,maximum);if(!bytes.equals(actual))throw Error('PRESENTER_EXPORT_READBACK_FAILED');if(!live())refused();
    const sha256=digest(actual);if(this.#receipts.size>=32)this.#receipts.delete(this.#receipts.keys().next().value);this.#receipts.set(exportId,{windowId:grant.windowId,epoch:grant.epoch,projectId:grant.projectId,session,deckVersion:version,path,sha256});retained=true;
    outcome=Object.freeze({ok:true,exportId,filename,bytes:actual.length,sha256,deckId:captured.deck.deckId,deckVersion:version});
   }finally{
    let cleanupFailed=false;try{await handle?.close();}catch{cleanupFailed=true;}
    for(const cleanup of [temporary,...(published&&!retained?[path]:[])])try{await unlink(await ownedFile(cleanup));}catch(e){if(e.code!=='ENOENT')cleanupFailed=true;}
    if(cleanupFailed){this.#failed=true;throw Error('PRESENTER_EXPORT_CLEANUP_FAILED');}
   }
   // Cleanup itself awaits ownership checks. A later revoke retains a file
   // already accepted above, but must never deliver its now-stale success.
   if(!live()){this.#receipts.delete(exportId);refused();}return outcome;
  };
  job.promise=Promise.resolve().then(work).catch(cause=>fail(['ACCESS_REFUSED','PRESENTATION_NOTES_BUDGET'].includes(cause.code)?cause.code:'PRESENTER_EXPORT_FAILED')).finally(()=>this.#pending.delete(job));this.#pending.add(job);return job.promise;
 }
}
