import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {ownedDirectory,ownedFile,validId} from '../projects/paths.mjs';
import {readOwnedBytes} from '../projects/io.mjs';
import {atomicWrite} from '../projects/atomic.mjs';
import {restoreBounds} from './geometry.mjs';
const keyValid=key=>key==='main'||typeof key==='string'&&/^[a-f0-9]{64}\.(?:[0-9]|[1-5][0-9]|6[0-3])$/.test(key);
function shape(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('INVALID_LAYOUT');
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(descriptors).length!==keys.length||keys.some(k=>!descriptors[k]||!Object.hasOwn(descriptors[k],'value')))throw Error('INVALID_LAYOUT');
 return value;
}
function normalize(value){
 shape(value,['normalBounds','displayId','maximized','fullscreen']);const b=shape(value.normalBounds,['x','y','width','height']);
 if(![b.x,b.y,b.width,b.height].every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=10000000)||b.width<1||b.height<1||b.width>32768||b.height>32768||typeof value.maximized!=='boolean'||typeof value.fullscreen!=='boolean'||!(Number.isSafeInteger(value.displayId)||typeof value.displayId==='string'&&value.displayId.length>0&&value.displayId.length<=128))throw Error('INVALID_LAYOUT');
 return {normalBounds:{x:b.x,y:b.y,width:b.width,height:b.height},displayId:value.displayId,maximized:value.maximized,fullscreen:value.fullscreen};
}
/** Main-owned bounded UI metadata. Never reads/writes project or source files. */
export class WindowLayoutStore{
 #root;#entries=new Map();#ready=false;#dirty=0;#saved=0;#writing=Promise.resolve(true);
 constructor(root){this.#root=resolve(root);this.diagnostic=null;}
 async initialize(){
  try{
   await ownedDirectory(this.#root);const bytes=await readOwnedBytes(await ownedFile(join(this.#root,'UI/window-layout.json')),65536);
   const record=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));shape(record,['schema','entries']);
   if(record.schema!==1||!Array.isArray(record.entries)||record.entries.length>128)throw Error('INVALID_LAYOUT');
   const entries=new Map();for(const item of record.entries){shape(item,['key','layout']);if(!keyValid(item.key)||entries.has(item.key))throw Error('INVALID_LAYOUT');entries.set(item.key,normalize(item.layout));}
   this.#entries=entries;this.#ready=true;return true;
  }catch(error){if(error.code==='ENOENT'){this.#ready=true;return true;}this.diagnostic='INVALID_LAYOUT';return false;}
 }
 get(key){const value=this.#entries.get(key);return value?normalize(value):undefined;}
 remember(key,value){
  try{if(!this.#ready||!keyValid(key))return false;const next=normalize(value);if(JSON.stringify(next)===JSON.stringify(this.#entries.get(key)))return true;
   this.#entries.delete(key);this.#entries.set(key,next);while(this.#entries.size>128)this.#entries.delete(this.#entries.keys().next().value);this.#dirty++;return true;
  }catch{return false;}
 }
 flush(){
  if(!this.#ready)return Promise.resolve(false);
  this.#writing=this.#writing.catch(()=>false).then(async()=>{
   if(this.#saved===this.#dirty)return true;const version=this.#dirty;
   try{
    await ownedDirectory(this.#root);const dir=join(this.#root,'UI');try{await mkdir(dir);}catch(e){if(e.code!=='EEXIST')throw e;}await ownedDirectory(dir);
    const bytes=Buffer.from(JSON.stringify({schema:1,entries:[...this.#entries].map(([key,layout])=>({key,layout}))}));if(bytes.length>65536)throw Error('LAYOUT_LIMIT');
    await atomicWrite(join(dir,'window-layout.json'),bytes);this.#saved=version;this.diagnostic=null;return true;
   }catch{this.diagnostic='LAYOUT_WRITE_FAILED';return false;}
  });return this.#writing;
 }
}
const events=['move','resize','maximize','unmaximize','enter-full-screen','leave-full-screen','restore'];
export class NativeLayoutMemory{
 #store;#displays;#reserved=new Map();#tracks=new Map();#timer=null;#disposed=false;
 constructor({store,displays}){this.#store=store;this.#displays=displays;}
 reserve(options){
  if(this.#disposed||this.#reserved.size>=64)throw Error('LAYOUT_RESERVATION_LIMIT');
  const main=options.role==='workspace';if(!main&&(!['code','docs','diagram','presenter','audience'].includes(options.role)||!validId(options.projectId)||typeof options.entityId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(options.entityId)||options.version!==undefined&&(!Number.isSafeInteger(options.version)||options.version<1)))throw Error('INVALID_LAYOUT_IDENTITY');
  const prefix=main?'main':createHash('sha256').update(JSON.stringify([options.projectId,options.role,options.entityId,options.version??null])).digest('hex');let key=prefix;
  if(main&&[...this.#reserved.values()].includes(key))throw Error('LAYOUT_MAIN_ALREADY_RESERVED');
  if(!main){let slot=0;while([...this.#reserved.values()].includes(prefix+'.'+slot))slot++;if(slot>63)throw Error('LAYOUT_SLOT_LIMIT');key=prefix+'.'+slot;}
  const ticket=Object.freeze({key,layout:restoreBounds(this.#store.get(key)??{},this.#displays())});this.#reserved.set(ticket,key);return ticket;
 }
 release(ticket){this.#reserved.delete(ticket);}
 #schedule(){if(this.#timer)clearTimeout(this.#timer);this.#timer=setTimeout(()=>{this.#timer=null;void this.#store.flush();},200);this.#timer.unref?.();}
 track(window,ticket,{isCurrent=()=>true}={}){
  if(this.#disposed||!this.#reserved.has(ticket)||this.#tracks.has(window))throw Error('LAYOUT_TRACK_REFUSED');
  const state={suspended:0,normal:ticket.layout.normalBounds};
  const capture=()=>{try{if(this.#disposed||state.suspended||window.isDestroyed()||!isCurrent())return;
   if(!window.isMaximized()&&!window.isFullScreen()&&!(window.isMinimized?.())||typeof window.getBounds!=='function')state.normal=typeof window.getBounds==='function'?window.getBounds():window.getNormalBounds();
   const layout=restoreBounds({normalBounds:state.normal,maximized:window.isMaximized(),fullscreen:window.isFullScreen()},this.#displays());if(this.#store.remember(ticket.key,layout))this.#schedule();}catch{}};
  const close=()=>{for(const event of events)window.off(event,capture);window.off('closed',close);this.#tracks.delete(window);this.release(ticket);};
  for(const event of events)window.on(event,capture);window.on('closed',close);this.#tracks.set(window,{capture,close,state});capture();
 }
 beginPlacement(window){
  const track=this.#tracks.get(window);if(!track||this.#disposed)return ()=>{};
  track.capture();track.state.suspended++;let finished=false;
  return (complete,bounds)=>{if(finished)return;finished=true;track.state.suspended--;if(complete===true&&this.#tracks.get(window)===track){if(bounds)track.state.normal={...bounds};track.capture();}};
 }
 async flush(){if(this.#timer){clearTimeout(this.#timer);this.#timer=null;}for(const {capture} of this.#tracks.values())capture();if(this.#timer){clearTimeout(this.#timer);this.#timer=null;}return this.#store.flush();}
 dispose(){this.#disposed=true;if(this.#timer)clearTimeout(this.#timer);this.#timer=null;for(const {close} of [...this.#tracks.values()])close();this.#reserved.clear();}
}
