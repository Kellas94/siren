import {WindowRegistry} from './registry.mjs';
import {navigationFields} from '../navigation/contracts.mjs';
import {workspaceEntities,validEntityId} from './entities.mjs';
import {verifySnapshot} from '../projects/store.mjs';
import {validId} from '../projects/paths.mjs';
const fail=code=>({ok:false,code});
/** A metadata-only Home can ask native to open a verified saved entity. Its own
 * source/entity grant remains empty. Selected content never crosses this API. */
export async function invokeHomeWindow({event,payload,registry,snapshot}){
 let grant;
 try{
  if(!(registry instanceof WindowRegistry))return fail('ACCESS_REFUSED');
  grant=WindowRegistry.prototype.capturePrimary.call(registry,event);
  if(!grant||grant.mainFrameUrl!=='siren://app/home.html'||!WindowRegistry.prototype.isCurrent.call(registry,grant))return fail('ACCESS_REFUSED');
  let request;try{
   request=navigationFields(payload,['role','entityId','version'],['role','entityId']);
   if(!['code','docs','diagram','presenter'].includes(request.role)||!(request.role==='code'?validId(request.entityId):validEntityId(request.entityId))||
     request.role==='code'&&(!Number.isSafeInteger(request.version)||request.version<1)||
     request.role!=='code'&&Object.hasOwn(request,'version'))return fail('REQUEST_REFUSED');
  }catch{return fail('REQUEST_REFUSED');}
  verifySnapshot(snapshot);
  if(snapshot.project.id!==grant.projectId||!workspaceEntities(snapshot)[request.role==='presenter'?'diagram':request.role].includes(request.entityId))return fail('ACCESS_REFUSED');
  if(request.role==='code'&&(snapshot.schema!==2||!snapshot.sourceRefs.some(ref=>ref.sourceId===request.entityId&&ref.version===request.version)))return fail('ACCESS_REFUSED');
  const opened=await WindowRegistry.prototype.openView.call(registry,request);
  if(!WindowRegistry.prototype.isCurrent.call(registry,grant)){
   return fail(await WindowRegistry.prototype.discardViewAsync.call(registry,opened.windowId)?'SENDER_REFUSED':'WINDOW_DESTROY_FAILED');
  }
  return {ok:true,view:{windowId:opened.windowId,role:opened.role,projectId:opened.projectId,epoch:opened.epoch,entityId:opened.entityId,state:opened.state}};
 }catch(cause){return fail(cause?.code==='WINDOW_DESTROY_FAILED'?'WINDOW_DESTROY_FAILED':grant&&!WindowRegistry.prototype.isCurrent.call(registry,grant)?'SENDER_REFUSED':'ACCESS_REFUSED');}
}
