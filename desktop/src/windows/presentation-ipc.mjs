import {WindowRegistry} from './registry.mjs';
import {navigationFields} from '../navigation/contracts.mjs';
const fail=code=>Object.freeze({ok:false,code});
const empty=value=>navigationFields(value??{},[]);
/** Finite native presentation requests. Source/deck bytes never come from IPC;
 * only native adapters open audiences, render frames and control displays. */
export class NativePresentationIPC{
 #registry;#session;#open;#display;#fullscreen;
 constructor({registry,sessionFor,openAudience,displays,setFullscreen}){
  if(!(registry instanceof WindowRegistry)||[sessionFor,openAudience,displays,setFullscreen].some(value=>typeof value!=='function'))throw TypeError('NATIVE_PRESENTATION_IPC_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#session=sessionFor;this.#open=openAudience;this.#display=displays;this.#fullscreen=setFullscreen;
 }
 async invoke({event,method,payload}){
  const grant=this.#registry.capture(event),session=this.#session();
  const current=()=>{try{const now=this.#registry.capture(event);return now&&this.#registry.isCurrent(grant)&&now.windowId===grant.windowId&&now.epoch===grant.epoch&&now.mainFrameUrl===grant.mainFrameUrl&&this.#session()===session;}catch{return false;}};
  if(!grant||!['presenter','audience'].includes(grant.role)||!current())return fail('ACCESS_REFUSED');
  try{
   let result;
   if(method==='getPresenter'&&grant.role==='presenter'){empty(payload);result=session.getPresenter(grant);if(!result.ok)result=await session.admit(grant);}
   else if(method==='getPreview'&&grant.role==='presenter'){empty(payload);result=session.getPreview(grant);}
   else if(method==='navigate'&&grant.role==='presenter')result=await session.navigate(grant,payload);
   else if(method==='refreshDeck'&&grant.role==='presenter')result=await session.refreshDeck(grant,payload);
   else if(method==='getFrame'&&grant.role==='audience'){empty(payload);result=session.getFrame(grant);}
   else if(method==='acknowledge'&&grant.role==='audience')result=session.acknowledge(grant,payload);
   else if(method==='setFullscreen'){
    const request=navigationFields(payload,['enabled']);if(typeof request.enabled!=='boolean')return fail('REQUEST_REFUSED');
    result=await this.#fullscreen(grant,request.enabled,{isCurrent:current});
   }else if(method==='getDisplays'&&grant.role==='presenter'){
    empty(payload);const displays=await this.#display(grant,{isCurrent:current});
    if(!Array.isArray(displays)||displays.length>32||displays.some(d=>typeof d.id!=='string'||!/^[-0-9]{1,20}$/.test(d.id)||typeof d.label!=='string'||d.label.length>160))return fail('DISPLAY_REFUSED');
    result={ok:true,displays:displays.map(({id,label})=>({id,label}))};
   }else if(method==='openAudience'&&grant.role==='presenter'){
    const request=navigationFields(payload??{},['displayId'],[]);if(Object.hasOwn(request,'displayId')&&(typeof request.displayId!=='string'||!/^[-0-9]{1,20}$/.test(request.displayId)))return fail('REQUEST_REFUSED');
    const state=session.getPresenter(grant);if(!state.ok)return state;
    const opened=await this.#open(grant,{deckId:state.deck.deckId,...request},{isCurrent:current});
    if(!opened?.view||!opened.grant)return fail('AUDIENCE_OPEN_FAILED');
    if(!current()||session.bindAudience(grant,opened.grant).ok!==true){if(await this.#registry.discardViewAsync(opened.view.windowId)!==true)return fail('WINDOW_DESTROY_FAILED');return fail('ACCESS_REFUSED');}
    const {windowId,role,epoch,state:viewState}=opened.view;result={ok:true,view:{windowId,role,epoch,state:viewState}};
   }else return fail('REQUEST_REFUSED');
   return current()?result:fail('ACCESS_REFUSED');
  }catch{return fail(current()?'PRESENTATION_OPERATION_FAILED':'ACCESS_REFUSED');}
 }
}
