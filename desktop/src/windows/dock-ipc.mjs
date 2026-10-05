import {navigationFields} from '../navigation/contracts.mjs';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const failure=code=>({ok:false,code});
/** Only native registry handles can move. Metadata never conveys source access,
 * project contents, a new grant, or authority over another satellite. */
export function invokeDock({registry,event,method,payload}){
 let grant,sender,frame;
 const current=()=>event.sender===sender&&event.senderFrame===frame&&registry.isCurrent(grant);
 try{
  grant=registry.capture(event);if(!grant||!['workspace','code','docs'].includes(grant.role))return failure('ACCESS_REFUSED');
  sender=event.sender;frame=event.senderFrame;
  if(!['getShelf','attach','detach','showWorkspace'].includes(method))return failure('REQUEST_REFUSED');
  let data;try{data=navigationFields(payload??{},method==='attach'||method==='detach'?['windowId']:[],method==='attach'||method==='detach'?['windowId']:[]);}
  catch{return failure('REQUEST_REFUSED');}
  const rows=registry.surfaceRecords().slice(0,64).filter(row=>id(row.windowId)&&id(row.entityId)
    &&['code','docs'].includes(row.role)&&['attached','detached'].includes(row.placement)&&typeof row.selected==='boolean'
    &&(grant.role==='workspace'||row.windowId===grant.windowId));
  if(!current())return failure('ACCESS_REFUSED');
  if(method==='getShelf')return {ok:true,items:rows.map(({windowId,role,entityId,placement,selected})=>({windowId,role,entityId,placement,selected}))};
  if(method==='showWorkspace'){
    if(grant.role!=='workspace')return failure('ACCESS_REFUSED');
    return registry.showWorkspace()===true&&current()?{ok:true}:failure('VIEW_REFUSED');
  }
  if(!id(data.windowId))return failure('REQUEST_REFUSED');
  if(grant.role!=='workspace'&&data.windowId!==grant.windowId)return failure('ACCESS_REFUSED');
  if(!rows.some(row=>row.windowId===data.windowId))return failure('VIEW_REFUSED');
  const performed=registry[method==='attach'?'attachView':'detachView'](data.windowId);
  return current()&&performed===true?{ok:true}:failure('VIEW_REFUSED');
 }catch{return failure(grant&&!current()?'ACCESS_REFUSED':'OPERATION_FAILED');}
}
