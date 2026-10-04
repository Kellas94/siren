import {randomUUID} from 'node:crypto';
import {open,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {WindowRegistry} from './registry.mjs';
import {WorkspaceCoordinator} from './coordinator.mjs';
import {NativeDiagramReads} from './diagram-reads.mjs';
import {ProjectStore} from '../projects/store.mjs';
import {navigationFields} from '../navigation/contracts.mjs';
import {childDirectory,ownedDirectory,ownedFile} from '../projects/paths.mjs';
import {readOwnedBytes} from '../projects/io.mjs';
import {digest} from '../projects/atomic.mjs';
const fail=code=>Object.freeze({ok:false,code});
const refused=()=>{throw Object.assign(Error('ACCESS_REFUSED'),{code:'ACCESS_REFUSED'});};
const MAX_SVG=2*1024*1024;

/** Main-owned saved-entity export. No renderer source/SVG/path authority and no
 * file chooser that could hold all-window Lock open indefinitely. Export copies
 * are separate ordinary files under the actual project's exports directory. */
export class NativeDiagramExports {
 #registry;#owner;#reads;#projects;#render;#reveal;#paused=false;#disposed=false;#pending=new Set();#receipts=new Map();#generation=0;#failed=false;
 constructor({registry,owner,reads,projects,render,reveal}){
  if(!(registry instanceof WindowRegistry)||!(owner instanceof WorkspaceCoordinator)||!(reads instanceof NativeDiagramReads)||!(projects instanceof ProjectStore)||typeof render!=='function'||typeof reveal!=='function')throw TypeError('NATIVE_DIAGRAM_EXPORT_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#reads=reads;this.#projects=projects;this.#render=render;this.#reveal=reveal;
 }
 #capture(event){const grant=this.#registry.capture(event);return grant?.role==='diagram'&&grant.entityIds.length===1&&grant.mainFrameUrl==='siren://app/windows/diagram.html?windowId='+grant.windowId&&this.#registry.isCurrent(grant)&&this.#owner.canReadDomain(grant,'diagram',grant.entityIds[0])?grant:null;}
 #current(event,grant,generation){const actual=this.#capture(event);return !this.#paused&&!this.#disposed&&!this.#failed&&generation===this.#generation&&actual?.windowId===grant.windowId&&actual?.epoch===grant.epoch;}
 pause(){this.#paused=true;this.#generation++;this.#receipts.clear();for(const job of this.#pending)job.controller.abort();}
 resume(){if(!this.#disposed)this.#paused=false;}
 async drain(){await Promise.all([...this.#pending].map(job=>job.promise));if(!this.isIdle())throw Error('DIAGRAM_EXPORT_NOT_IDLE');}
 isIdle(){return !this.#pending.size&&!this.#failed;}
 dispose(){this.pause();this.#disposed=true;}
 async invoke({event,method,payload}){
  let request;try{
   if(method==='exportSvg'){request=navigationFields(payload,['expectedVersion','expectedSha256','appearance']);if(!Number.isSafeInteger(request.expectedVersion)||request.expectedVersion<1||typeof request.expectedSha256!=='string'||!/^[a-f0-9]{64}$/.test(request.expectedSha256)||!['light','dark'].includes(request.appearance))return fail('REQUEST_REFUSED');}
   else if(method==='revealExport'){request=navigationFields(payload,['exportId']);if(typeof request.exportId!=='string'||!/^[a-f0-9-]{36}$/.test(request.exportId))return fail('REQUEST_REFUSED');}
   else return fail('REQUEST_REFUSED');
  }catch{return fail('REQUEST_REFUSED');}
  const grant=this.#capture(event),generation=this.#generation;if(!grant||!this.#current(event,grant,generation))return fail('ACCESS_REFUSED');
  if(this.#pending.size>=2||[...this.#pending].some(job=>job.windowId===grant.windowId))return fail('EXPORT_BUSY');
  const job={windowId:grant.windowId,controller:new AbortController(),promise:null};
  const current=()=>this.#current(event,grant,generation)&&!job.controller.signal.aborted;
  const work=async()=>{
   if(method==='revealExport'){
    const receipt=this.#receipts.get(request.exportId);if(!receipt||receipt.windowId!==grant.windowId||receipt.epoch!==grant.epoch||receipt.projectId!==grant.projectId)return fail('ACCESS_REFUSED');
    const path=await ownedFile(receipt.path),bytes=await readOwnedBytes(path,MAX_SVG);if(!current()||digest(bytes)!==receipt.sha256)return fail('EXPORT_CHANGED');this.#reveal(path);return Object.freeze({ok:true});
   }
   const read=async()=>{if(!current())refused();const actual=await this.#reads.invoke({event,method:'getDiagram'});if(!current()||actual.ok!==true)refused();if(actual.version!==request.expectedVersion||actual.sha256!==request.expectedSha256)throw Object.assign(Error('DIAGRAM_VERSION_CHANGED'),{code:'DIAGRAM_VERSION_CHANGED'});return actual;};
   const saved=await read(),svg=await this.#render({diagram:saved.diagram,appearance:request.appearance},{isCurrent:current,signal:job.controller.signal});
   if(!current())refused();if(typeof svg!=='string'||Buffer.byteLength(svg)>MAX_SVG||!/^<svg\b/.test(svg)||!svg.endsWith('</svg>'))return fail('SVG_RENDER_REFUSED');
   await read();const parent=await this.#projects.directory(grant.projectId);if(!current())refused();const directory=await childDirectory(parent,'exports',{create:true});if(!current())refused();
   const exportId=randomUUID(),filename='diagram-'+exportId+'.svg',path=join(directory,filename),temporary=join(directory,'pending-'+exportId+'.tmp'),bytes=Buffer.from(svg);let handle,published=false,retained=false;
   try{
    if(!current())refused();handle=await open(temporary,'wx',0o600);if(!current())refused();await handle.writeFile(bytes);if(!current())refused();await handle.sync();await handle.close();handle=null;if(!current())refused();
    await ownedDirectory(directory);if(!current())refused();await rename(temporary,path);published=true;if(!current())refused();const actual=await readOwnedBytes(path,MAX_SVG);if(!bytes.equals(actual))throw Error('SVG_READBACK_FAILED');await read();if(!current())refused();
    const sha256=digest(actual);if(this.#receipts.size>=32)this.#receipts.delete(this.#receipts.keys().next().value);this.#receipts.set(exportId,{windowId:grant.windowId,epoch:grant.epoch,projectId:grant.projectId,path,sha256});retained=true;
    return Object.freeze({ok:true,exportId,filename,bytes:actual.length,sha256,entityId:saved.diagram.id,version:saved.version,entitySha256:saved.sha256});
   }finally{
    let cleanupFailed=false;try{await handle?.close();}catch{cleanupFailed=true;}
    for(const cleanup of [temporary,...(published&&!retained?[path]:[])])try{await unlink(await ownedFile(cleanup));}catch(e){if(e.code!=='ENOENT')cleanupFailed=true;}
    if(cleanupFailed){this.#failed=true;throw Error('SVG_CLEANUP_FAILED');}
   }
  };
  job.promise=Promise.resolve().then(work).catch(cause=>fail(['DIAGRAM_VERSION_CHANGED','ACCESS_REFUSED'].includes(cause.code)?cause.code:'SVG_EXPORT_FAILED')).finally(()=>this.#pending.delete(job));this.#pending.add(job);return job.promise;
 }
}
