import { validId } from '../projects/paths.mjs';
import { navigationFields as fields, navigationArray as array, normalizeLocation } from './contracts.mjs';

const fail=code=>Object.freeze({ok:false,code});
const codes=new Set(['ACCESS_REFUSED','CANCELLED','PROJECT_UNAVAILABLE','ENTITY_UNAVAILABLE','SOURCE_VERSION_UNAVAILABLE','RECOVERY_REQUIRED','NAVIGATION_LIMIT','INVALID_NAVIGATION','NAVIGATION_WRITE_FAILED','TRANSITION_FAILED','UNAVAILABLE']);
const methods=new Set(['getHomeState','continueWork','openProject','createProject','recordLocation']);
const stamp=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString()===value;
const label=value=>typeof value==='string' && value.length<=256;
const invalid=()=>{throw Error('Invalid Home result');};
function request(method,input,projectId) {
  if(method==='recordLocation') {
    // Validate/copy even for no-selection requests, but derive project in native
    // scope. A client never submits its own project, epoch or filesystem path.
    const value=normalizeLocation(input,{projectId:projectId ?? 'validation-only'});
    const {schema,projectId:ignored,...payload}=value;return payload;
  }
  if(method==='openProject') {
    const value=fields(input,['projectId']);if(!validId(value.projectId))invalid();return value;
  }
  if(method==='createProject') {
    const value=fields(input,['label']);if(!label(value.label)||value.label.length>200)invalid();return value;
  }
  return fields(input,[]);
}
function homeState(input,grant) {
  const value=fields(input,['mode','selectedProjectId','projects','continuation','views','capabilities']);
  if(value.mode!==grant.mode || value.selectedProjectId!==grant.projectId)invalid();
  const projects=array(value.projects,12).map(input=>{
    const item=fields(input,['projectId','label','availability','lastVisited'],['projectId','label','availability']);
    if(!validId(item.projectId)||!label(item.label)||!['cached','verified','missing','recovery'].includes(item.availability)||Object.hasOwn(item,'lastVisited')&&!stamp(item.lastVisited))invalid();return item;
  });
  if(new Set(projects.map(item=>item.projectId)).size!==projects.length)invalid();
  const views=array(value.views,16).map(input=>{
    const item=fields(input,['windowId','role','entityId','label','state']);
    if(!validId(item.windowId)||!validId(item.entityId)||!label(item.label)||!['diagram','docs','code','presenter','audience'].includes(item.role)||!['open','minimized'].includes(item.state))invalid();return item;
  });
  if(new Set(views.map(item=>item.windowId)).size!==views.length)invalid();
  const capabilities=fields(value.capabilities,['diagrams','docs','code','present']);
  if(!Object.values(capabilities).every(item=>typeof item==='boolean'))invalid();
  let continuation=null;
  if(value.continuation!==null) {
    const item=fields(value.continuation,['location','availability','reason'],['location','availability']);
    const stored=fields(item.location,['schema','projectId','surface','entityId','sourceRef','cursor','scroll','layouts'],['schema','projectId','surface']);
    if(stored.schema!==1 || !projects.some(project=>project.projectId===stored.projectId) || !['cached','saved','private-draft','recovery','missing'].includes(item.availability) || Object.hasOwn(item,'reason')&&!['ENTITY_UNAVAILABLE','SOURCE_VERSION_UNAVAILABLE','PROJECT_UNAVAILABLE'].includes(item.reason))invalid();
    const {schema,projectId,...location}=stored;
    continuation={...item,location:normalizeLocation(location,{projectId})};
  }
  return {mode:value.mode,selectedProjectId:value.selectedProjectId,projects,continuation,views,capabilities};
}
/** No main/preload channel installed. Trusted services must use scope.isCurrent
 * at every native commit boundary; checking the result alone cannot undo writes. */
export async function invokeHome({event,method,payload,authority,services,transitions}) {
  let grant,isCurrent,ticket;
  try {
    if(typeof method!=='string'||!methods.has(method))return fail('REQUEST_REFUSED');
    grant=authority.capture(Object.freeze({sender:event?.sender,senderFrame:event?.senderFrame}));
    if(!grant)return fail('SENDER_REFUSED');
    isCurrent=()=>{try{return authority.isCurrent(grant)===true;}catch{return false;}};
    let input;try{input=request(method,payload,grant.projectId);}catch{return fail('REQUEST_REFUSED');}
    if(!isCurrent() || method==='recordLocation'&&grant.projectId===null)return fail('ACCESS_REFUSED');
    if(!services || !Object.hasOwn(services,method) || typeof services[method]!=='function')return fail('UNAVAILABLE');
    if(transitions&&['continueWork','openProject','createProject'].includes(method))ticket=transitions.begin(grant,method);
    const scope=Object.freeze({projectId:grant.projectId,mode:grant.mode,isCurrent,...(ticket?{transition:ticket}:{})});
    const result=await services[method](input,scope);
    if(!isCurrent())return ticket&&transitions.consume(result,{ticket,grant,method})===true?{ok:true,epoch:result.epoch}:fail('ACCESS_REFUSED');
    try {
      if(method==='getHomeState')return {ok:true,state:homeState(result,grant)};
      const receipt=fields(result,['ok','code','epoch'],['ok']);
      if(receipt.ok!==true)return fail(codes.has(receipt.code)?receipt.code:'HOME_OPERATION_FAILED');
      if(method==='recordLocation') {if(Object.hasOwn(receipt,'epoch')||Object.hasOwn(receipt,'code'))invalid();return {ok:true};}
      if(!Number.isSafeInteger(receipt.epoch)||receipt.epoch<1 || Object.hasOwn(receipt,'code'))invalid();
      return {ok:true,epoch:receipt.epoch};
    } catch {return fail('HOME_RESULT_REFUSED');}
  } catch {return fail(grant&&isCurrent&&!isCurrent()?'ACCESS_REFUSED':'HOME_OPERATION_FAILED');}
  finally{if(ticket)try{transitions.cancel(ticket);}catch{/* No receipt can restore a retired grant. */}}
}
