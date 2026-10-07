import {WindowRegistry} from './registry.mjs';
import {navigationFields} from '../navigation/contracts.mjs';
import {validId} from '../projects/paths.mjs';

const fail=code=>Object.freeze({ok:false,code});
const refuse=()=>{throw Error('PRESENTATION_DATA_REFUSED');};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const text=(value,limit)=>typeof value==='string'&&value.length<=limit&&value.isWellFormed();
function copy(value,depth=0,budget={nodes:0,bytes:0}){
 if(depth>32||++budget.nodes>50000)refuse();
 if(typeof value==='string'){if(!value.isWellFormed()||(budget.bytes+=Buffer.byteLength(value))>8*1024*1024)refuse();return value;}
 if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(!value||typeof value!=='object')refuse();
 const array=Array.isArray(value),proto=Object.getPrototypeOf(value);if(array?proto!==Array.prototype:![Object.prototype,null].includes(proto))refuse();
 const fields=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(fields);
 if(array){const length=fields.length.value;if(length>50000||keys.length!==length+1)refuse();return Array.from({length},(_,index)=>{if(!fields[index]||!('value'in fields[index]))refuse();return copy(fields[index].value,depth+1,budget);});}
 return Object.fromEntries(keys.map(key=>{const field=fields[key];if(typeof key!=='string'||!('value'in field)||!field.enumerable||(budget.bytes+=Buffer.byteLength(key))>8*1024*1024)refuse();return [key,copy(field.value,depth+1,budget)];}));
}
function deckFor(value,grant){
 const deck=navigationFields(copy(value),['projectId','deckId','version','title','slides','render'],['projectId','deckId','version','title','slides']);
 if(deck.projectId!==grant.projectId||deck.deckId!==grant.entityIds[0]||!hash(deck.version)||!text(deck.title,256)||!Array.isArray(deck.slides)||!deck.slides.length||deck.slides.length>600)refuse();
 const ids=new Set();for(const item of deck.slides){const slide=navigationFields(item,['id','title','notes','render']);if(!validId(slide.id)||ids.has(slide.id)||!text(slide.title,256)||!text(slide.notes,65536))refuse();ids.add(slide.id);}
 return deck;
}
function publicSlide(value){
 const shape=navigationFields(value,['kind','title','body','image'],['kind','title']);
 if(!text(shape.title,256))refuse();
 if(shape.kind==='text'){
  if(!text(shape.body,65536)||Object.hasOwn(shape,'image'))refuse();return Object.freeze({kind:'text',title:shape.title,body:shape.body});
 }
 if(shape.kind!=='image'||Object.hasOwn(shape,'body')||typeof shape.image!=='string'||shape.image.length>2800000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(shape.image))refuse();
 const encoded=shape.image.slice(22),bytes=Buffer.from(encoded,'base64');
 // Public images come from the trusted render adapter, never remote URLs/SVG.
 // Bound encoded bytes and PNG geometry before any Audience decoder is used.
 if(bytes.length>2*1024*1024||bytes.length<33||bytes.toString('base64')!==encoded||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')refuse();
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(!width||!height||width>8192||height>8192||width*height>16*1024*1024)refuse();
 return Object.freeze({kind:'image',title:shape.title,image:shape.image});
}
const presenterState=entry=>Object.freeze({ok:true,slideId:entry.slideId,sequence:entry.sequence,deck:{deckId:entry.deck.deckId,version:entry.deck.version,title:entry.deck.title,slides:entry.deck.slides.map(({id,title,notes})=>({id,title,notes}))}});

/** Main-only versioned presentation transport. Adapters must load a verified
 * native deck and render its public content; no renderer-supplied deck/frame.
 * This boundary alone does not mount windows, grant Lock seals or qualify a
 * diagram/media renderer. Audience has no source/notes or edit capability. */
export class PresentationSession{
 #registry;#load;#render;#send;#entries=new Map();#audiences=new Map();#loads=new Map();#jobs=new Set();#pending=new Set();#generation=0;#paused=false;#disposed=false;
 constructor({registry,loadDeck,renderPublicSlide,sendFrame}){
  if(!(registry instanceof WindowRegistry)||[loadDeck,renderPublicSlide,sendFrame].some(value=>typeof value!=='function'))throw TypeError('NATIVE_PRESENTATION_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#load=loadDeck;this.#render=renderPublicSlide;this.#send=sendFrame;
 }
 #valid(grant,role){try{return !this.#disposed&&!this.#paused&&grant?.role===role&&this.#registry.isCurrent(grant)&&grant.entityIds.length===(role==='audience'?0:1)&&this.#registry.presentationScope(grant)!==null&&grant.mainFrameUrl===`siren://app/windows/${role}.html?windowId=${grant.windowId}`;}catch{return false;}}
 #entry(grant){const entry=this.#entries.get(grant?.windowId);return entry&&this.#valid(grant,'presenter')&&this.#valid(entry.grant,'presenter')&&entry.grant.projectId===grant.projectId&&entry.grant.epoch===grant.epoch?entry:null;}
 #audience(grant){const audience=this.#audiences.get(grant?.windowId);return audience&&this.#valid(grant,'audience')&&this.#valid(audience.grant,'audience')&&this.#entry(audience.owner.grant)===audience.owner?audience:null;}
 #track(){let resolve;const done=new Promise(finish=>resolve=finish);this.#pending.add(done);return()=>{this.#pending.delete(done);resolve();};}
 async drain(){while(this.#pending.size)await Promise.all([...this.#pending]);}
 isIdle(){return this.#paused&&this.#pending.size===0&&this.#jobs.size===0&&this.#loads.size===0;}
 async admit(grant){
  if(!this.#valid(grant,'presenter'))return fail('ACCESS_REFUSED');
  for(const [id,entry]of this.#entries)if(!this.#valid(entry.grant,'presenter'))this.#retire(id);
  if(this.#entries.has(grant.windowId))return fail('PRESENTATION_ALREADY_ADMITTED');if(this.#entries.size>=64)return fail('PRESENTATION_BUDGET');
  const token=++this.#generation;this.#loads.set(grant.windowId,token);const finish=this.#track(),current=()=>this.#valid(grant,'presenter')&&this.#loads.get(grant.windowId)===token;
  try{const actual=await this.#load(grant,{isCurrent:current});if(!current())return fail('ACCESS_REFUSED');const deck=deckFor(actual,grant);if(!current())return fail('ACCESS_REFUSED');const entry={grant,deck,slideId:deck.slides[0].id,sequence:0,generation:0};this.#entries.set(grant.windowId,entry);return presenterState(entry);}
  catch{return fail(current()?'PRESENTATION_DECK_REFUSED':'ACCESS_REFUSED');}finally{if(this.#loads.get(grant.windowId)===token)this.#loads.delete(grant.windowId);finish();}
 }
 getPresenter(grant){const entry=this.#entry(grant);return entry?presenterState(entry):fail('ACCESS_REFUSED');}
 getPreview(grant){const entry=this.#entry(grant);return entry?.frame?Object.freeze({ok:true,frame:structuredClone(entry.frame)}):fail(entry?'PRESENTATION_PREVIEW_UNAVAILABLE':'ACCESS_REFUSED');}
 bindAudience(presenter,audience){
  const owner=this.#entry(presenter);if(!owner||!this.#valid(audience,'audience')||audience.projectId!==presenter.projectId||audience.epoch!==presenter.epoch||this.#registry.presentationScope(audience)?.deckId!==owner.deck.deckId)return fail('ACCESS_REFUSED');
  for(const [id,bound]of this.#audiences)if(!this.#audience(bound.grant))this.#audiences.delete(id);
  if(this.#audiences.has(audience.windowId))return fail('AUDIENCE_ALREADY_BOUND');if(this.#audiences.size>=64)return fail('PRESENTATION_BUDGET');
  this.#audiences.set(audience.windowId,{grant:audience,owner,inFlight:null,latest:null,last:null});return Object.freeze({ok:true});
 }
 #deliver(audience,frame){
  if(!this.#audience(audience.grant))return false;
  if(audience.inFlight){audience.latest=frame;return true;}
  audience.inFlight=frame;
  try{if(this.#send(audience.grant,structuredClone(frame))!==true||!this.#audience(audience.grant)){audience.inFlight=null;return false;}audience.last=frame;return true;}
  catch{audience.inFlight=null;return false;}
 }
 async navigate(grant,input){
  const entry=this.#entry(grant);if(!entry)return fail('ACCESS_REFUSED');let request;
  try{request=navigationFields(input,['deckVersion','sequence','slideId']);if(request.deckVersion!==entry.deck.version||!Number.isSafeInteger(request.sequence)||request.sequence<1||request.sequence<=entry.sequence||!validId(request.slideId)||!entry.deck.slides.some(slide=>slide.id===request.slideId))return fail('PRESENTATION_POSITION_REFUSED');}catch{return fail('REQUEST_REFUSED');}
  if(this.#jobs.size>=8||[...this.#jobs].filter(job=>job.entry===entry).length>=2)return fail('PRESENTATION_RENDER_BUSY');
  this.#cancel(entry);const job={entry,controller:new AbortController()},finish=this.#track();this.#jobs.add(job);
  const sequence=request.sequence,generation=++entry.generation;entry.sequence=sequence;
  const current=()=>this.#entry(grant)===entry&&entry.generation===generation&&entry.deck.version===request.deckVersion;
  try{
   const slide=entry.deck.slides.find(slide=>slide.id===request.slideId),{notes,...renderable}=slide;
   const rendered=await this.#render({slide:structuredClone(renderable),context:structuredClone(entry.deck.render??null),deckId:entry.deck.deckId,deckVersion:entry.deck.version},{isCurrent:current,signal:job.controller.signal});if(!current())return fail('PRESENTATION_SUPERSEDED');
   let content;try{content=publicSlide(rendered);}catch{return fail('PUBLIC_SLIDE_REFUSED');}if(!current())return fail('PRESENTATION_SUPERSEDED');
   const frame=Object.freeze({epoch:grant.epoch,sequence,deckVersion:entry.deck.version,slideId:request.slideId,publicSlide:content});entry.slideId=request.slideId;entry.frame=frame;
   let delivered=true;for(const audience of this.#audiences.values())if(audience.owner===entry&&!this.#deliver(audience,frame))delivered=false;
   return current()&&delivered?Object.freeze({ok:true,sequence,slideId:entry.slideId,deckVersion:entry.deck.version}):fail(current()?'PRESENTATION_SEND_FAILED':'ACCESS_REFUSED');
  }catch{return fail(current()?'PUBLIC_SLIDE_REFUSED':'PRESENTATION_SUPERSEDED');}finally{this.#jobs.delete(job);finish();}
 }
 getFrame(grant){const audience=this.#audience(grant);return audience?.last?Object.freeze({ok:true,frame:structuredClone(audience.last)}):fail(audience?'AUDIENCE_FRAME_UNAVAILABLE':'ACCESS_REFUSED');}
 acknowledge(grant,input){
  const audience=this.#audience(grant);if(!audience)return fail('ACCESS_REFUSED');let request;
  try{request=navigationFields(input,['deckVersion','sequence']);}catch{return fail('REQUEST_REFUSED');}
  if(!audience.inFlight||request.deckVersion!==audience.owner.deck.version||request.deckVersion!==audience.inFlight.deckVersion||request.sequence!==audience.inFlight.sequence)return fail('AUDIENCE_ACK_REFUSED');
  audience.inFlight=null;const next=audience.latest;audience.latest=null;if(next&&!this.#deliver(audience,next))return fail('PRESENTATION_SEND_FAILED');return Object.freeze({ok:true});
 }
 async refreshDeck(grant,input){
  const entry=this.#entry(grant);if(!entry)return fail('ACCESS_REFUSED');let expected;
  try{expected=navigationFields(input,['deckVersion']).deckVersion;if(expected!==entry.deck.version)return fail('PRESENTATION_VERSION_REFUSED');}catch{return fail('REQUEST_REFUSED');}
  const token=++this.#generation,generation=entry.generation,finish=this.#track();this.#loads.set(grant.windowId,token);
  const current=()=>this.#entry(grant)===entry&&this.#loads.get(grant.windowId)===token&&entry.generation===generation&&entry.deck.version===expected;
  try{
   const actual=await this.#load(grant,{isCurrent:current});if(!current())return fail('ACCESS_REFUSED');const deck=deckFor(actual,grant);if(!current())return fail('ACCESS_REFUSED');
   if(deck.version===expected)return Object.freeze({ok:true,unchanged:true});
   this.#cancel(entry);entry.deck=deck;entry.generation++;entry.frame=null;if(!deck.slides.some(slide=>slide.id===entry.slideId))entry.slideId=deck.slides[0].id;
   for(const audience of this.#audiences.values())if(audience.owner===entry){audience.inFlight=null;audience.latest=null;audience.last=null;}
   return presenterState(entry);
  }catch{return fail(current()?'PRESENTATION_DECK_REFUSED':'ACCESS_REFUSED');}finally{if(this.#loads.get(grant.windowId)===token)this.#loads.delete(grant.windowId);finish();}
 }
 #cancel(entry){for(const job of this.#jobs)if(entry===undefined||job.entry===entry)job.controller.abort();}
 #retire(id){const entry=this.#entries.get(id);if(entry){this.#cancel(entry);entry.generation++;}this.#entries.delete(id);this.#loads.delete(id);for(const [key,audience]of this.#audiences)if(audience.owner===entry)this.#audiences.delete(key);}
 pause(){if(this.#disposed)return;this.#paused=true;this.#cancel();this.#loads.clear();for(const entry of this.#entries.values()){entry.generation++;entry.frame=null;}for(const audience of this.#audiences.values()){audience.inFlight=null;audience.latest=null;audience.last=null;}}
 resume(){if(!this.#disposed)this.#paused=false;}
 dispose(){if(this.#disposed)return;this.#disposed=true;this.#paused=true;this.#cancel();this.#loads.clear();for(const entry of this.#entries.values())entry.generation++;this.#entries.clear();this.#audiences.clear();}
}
