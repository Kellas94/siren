import {navigationFields} from '../navigation/contracts.mjs';
import {appearanceRequest} from './contracts.mjs';
const fail=code=>({ok:false,code});
/** Metadata-only application chrome. Native capture must never admit Audience. */
export async function invokeShell({event,method,payload,capture,isCurrent,store,navigate,context=()=>null}){
 let grant;const sender=event?.sender,frame=event?.senderFrame;
 const current=()=>event?.sender===sender&&event?.senderFrame===frame&&isCurrent(grant)===true;
 try{
  grant=capture(event);if(!grant||!['workspace','docs','code','diagram','presenter'].includes(grant.role)||!current())return fail('ACCESS_REFUSED');
  let data;try{
   if(method==='getAppearance')data=navigationFields(payload??{},[]);
   else if(method==='setAppearance')data=appearanceRequest(payload);
   else if(method==='navigate'){data=navigationFields(payload,['surface'],['surface']);if(!['home','diagrams','docs','code','present','find'].includes(data.surface))throw Error();}
   else throw Error();
  }catch{return fail('REQUEST_REFUSED');}
  if(method==='navigate')return await navigate(data.surface,{isCurrent:current}); // Successful navigation can retire the captured frame.
  let result=await (method==='getAppearance'?store.read():store.set(data,{isCurrent:current}));
  if(!current())return fail('ACCESS_REFUSED');
  if(method==='getAppearance'){
   if(result?.code==='INVALID_APPEARANCE')result={ok:true,theme:'system',warning:'INVALID_APPEARANCE'};
   const name=context(grant)?.projectName;
   if(result.ok&&typeof name==='string')result={...result,projectName:name.toWellFormed().replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,120)};
  }
  return current()?result:fail('ACCESS_REFUSED');
 }catch{return fail('OPERATION_FAILED');}
}
