import {randomUUID} from 'node:crypto';
import {open,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {WindowRegistry} from './registry.mjs';
import {WorkspaceCoordinator} from './coordinator.mjs';
import {NativeDocsReads} from './docs-reads.mjs';
import {ProjectStore} from '../projects/store.mjs';
import {navigationFields} from '../navigation/contracts.mjs';
import {childDirectory,ownedDirectory,ownedFile} from '../projects/paths.mjs';
import {readOwnedBytes} from '../projects/io.mjs';
import {digest} from '../projects/atomic.mjs';
import {formatSavedDocument} from '../documents/export.mjs';
const fail=code=>Object.freeze({ok:false,code});
const refused=()=>{throw Object.assign(Error('ACCESS_REFUSED'),{code:'ACCESS_REFUSED'});};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const maximum=16*1024*1024,extensions={json:'json',markdown:'md',html:'html'};

/** Own saved-document delivery. Renderer supplies neither document, project nor
 * destination. Pending work joins native preparation; unretained output is
 * removed before drain, and uncertain cleanup permanently fences this service. */
export class NativeDocsExports{
 #registry;#owner;#reads;#projects;#format;#reveal;#paused=false;#disposed=false;#pending=new Set();#receipts=new Map();#generation=0;#failed=false;
 constructor({registry,owner,reads,projects,format=formatSavedDocument,reveal}){
  if(!(registry instanceof WindowRegistry)||!(owner instanceof WorkspaceCoordinator)||!(reads instanceof NativeDocsReads)||!(projects instanceof ProjectStore)||typeof format!=='function'||typeof reveal!=='function')throw TypeError('NATIVE_DOCS_EXPORT_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#reads=reads;this.#projects=projects;this.#format=format;this.#reveal=reveal;
 }
 #capture(event){const grant=this.#registry.capture(event);return grant?.role==='docs'&&grant.entityIds.length===1&&grant.mainFrameUrl==='siren://app/windows/docs.html?windowId='+grant.windowId&&this.#registry.isCurrent(grant)&&this.#owner.canReadDomain(grant,'docs',grant.entityIds[0])?grant:null;}
 #current(event,grant,generation){const actual=this.#capture(event);return !this.#paused&&!this.#disposed&&!this.#failed&&generation===this.#generation&&actual?.windowId===grant.windowId&&actual?.epoch===grant.epoch;}
 pause(){this.#paused=true;this.#generation++;this.#receipts.clear();for(const job of this.#pending)job.controller.abort();}
 resume(){if(!this.#disposed)this.#paused=false;}
 async drain(){await Promise.all([...this.#pending].map(job=>job.promise));if(!this.isIdle())throw Error('DOCS_EXPORT_NOT_IDLE');}
 isIdle(){return !this.#pending.size&&!this.#failed;}
 dispose(){this.pause();this.#disposed=true;}
 async invoke({event,method,payload}){
  let request;try{
   if(method==='exportSaved'){request=navigationFields(payload,['format','expectedVersion','expectedSha256']);if(typeof request.format!=='string'||!Object.hasOwn(extensions,request.format)||!hash(request.expectedVersion)||!hash(request.expectedSha256))return fail('REQUEST_REFUSED');}
   else if(method==='revealExport'){request=navigationFields(payload,['exportId']);if(typeof request.exportId!=='string'||!/^[a-f0-9-]{36}$/.test(request.exportId))return fail('REQUEST_REFUSED');}
   else return fail('REQUEST_REFUSED');
  }catch{return fail('REQUEST_REFUSED');}
  const grant=this.#capture(event),generation=this.#generation;if(!grant||!this.#current(event,grant,generation))return fail('ACCESS_REFUSED');
  if(this.#pending.size>=2||[...this.#pending].some(job=>job.windowId===grant.windowId))return fail('EXPORT_BUSY');
  const job={windowId:grant.windowId,controller:new AbortController(),promise:null},current=()=>this.#current(event,grant,generation)&&!job.controller.signal.aborted;
  const work=async()=>{
   if(method==='revealExport'){
    const receipt=this.#receipts.get(request.exportId);if(!receipt||receipt.windowId!==grant.windowId||receipt.epoch!==grant.epoch||receipt.projectId!==grant.projectId)return fail('ACCESS_REFUSED');
    const path=await ownedFile(receipt.path),bytes=await readOwnedBytes(path,maximum);if(!current()||digest(bytes)!==receipt.sha256)return fail('EXPORT_CHANGED');this.#reveal(path);return Object.freeze({ok:true});
   }
   const read=async()=>{if(!current())refused();const actual=await this.#reads.invoke({event,method:'getDocument'});if(!current()||actual.ok!==true)refused();if(actual.version!==request.expectedVersion||actual.sha256!==request.expectedSha256)throw Object.assign(Error('DOCUMENT_VERSION_CHANGED'),{code:'DOCUMENT_VERSION_CHANGED'});return actual;};
   const saved=await read(),output=await this.#format({format:request.format,projectId:grant.projectId,document:saved.document,version:saved.version,sha256:saved.sha256,projectRevision:saved.projectRevision,exportedAt:new Date().toISOString()},{isCurrent:current,signal:job.controller.signal});
   if(!current())refused();if(!Buffer.isBuffer(output?.bytes)||output.bytes.length<1||output.bytes.length>maximum||output.extension!==extensions[request.format])return fail('EXPORT_FORMAT_REFUSED');
   const bytes=Buffer.from(output.bytes);await read();const parent=await this.#projects.directory(grant.projectId);if(!current())refused();const directory=await childDirectory(parent,'exports',{create:true});if(!current())refused();
   const exportId=randomUUID(),filename='document-'+exportId+'.'+output.extension,path=join(directory,filename),temporary=join(directory,'pending-'+exportId+'.tmp');let handle,published=false,retained=false;
   try{
    if(!current())refused();handle=await open(temporary,'wx',0o600);if(!current())refused();await handle.writeFile(bytes);if(!current())refused();await handle.sync();await handle.close();handle=null;if(!current())refused();
    await ownedDirectory(directory);if(!current())refused();await rename(temporary,path);published=true;if(!current())refused();const actual=await readOwnedBytes(path,maximum);if(!bytes.equals(actual))throw Error('DOCS_EXPORT_READBACK_FAILED');await read();if(!current())refused();
    const sha256=digest(actual);if(this.#receipts.size>=32)this.#receipts.delete(this.#receipts.keys().next().value);this.#receipts.set(exportId,{windowId:grant.windowId,epoch:grant.epoch,projectId:grant.projectId,path,sha256});retained=true;
    return Object.freeze({ok:true,exportId,filename,bytes:actual.length,sha256,entityId:saved.document.id,version:saved.version,entitySha256:saved.sha256,projectRevision:saved.projectRevision,format:request.format});
   }finally{
    let cleanupFailed=false;try{await handle?.close();}catch{cleanupFailed=true;}
    for(const cleanup of [temporary,...(published&&!retained?[path]:[])])try{await unlink(await ownedFile(cleanup));}catch(e){if(e.code!=='ENOENT')cleanupFailed=true;}
    if(cleanupFailed){this.#failed=true;throw Error('DOCS_EXPORT_CLEANUP_FAILED');}
   }
  };
  job.promise=Promise.resolve().then(work).catch(cause=>fail(['DOCUMENT_VERSION_CHANGED','ACCESS_REFUSED','DOCUMENT_BUDGET','EXPORT_BUDGET'].includes(cause.code)?cause.code:'DOCS_EXPORT_FAILED')).finally(()=>this.#pending.delete(job));this.#pending.add(job);return job.promise;
 }
}
