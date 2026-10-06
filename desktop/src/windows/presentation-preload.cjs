const {contextBridge,ipcRenderer}=require('electron');
if(location.pathname!=='/windows/audience.html')contextBridge.exposeInMainWorld('sirenShell',Object.freeze(Object.fromEntries(['getAppearance','setAppearance','navigate'].map(method=>[method,payload=>ipcRenderer.invoke('siren:shell',method,payload)]))));
const invoke=(method,payload)=>ipcRenderer.invoke('siren:presentation',method,payload);
const presentation=Object.fromEntries(['getPresenter','getPreview','navigate','refreshDeck','openAudience','getFrame','acknowledge','getDisplays','setFullscreen'].map(method=>[method,payload=>invoke(method,payload)]));
if(location.pathname==='/windows/presenter.html')presentation.editDeck=()=>ipcRenderer.invoke('siren:deck-navigation','edit',{});
if(location.pathname==='/windows/presenter.html')contextBridge.exposeInMainWorld('sirenPresenterExport',Object.freeze(Object.fromEntries(['exportNotes','revealExport'].map(method=>[method,payload=>ipcRenderer.invoke('siren:presenter-export',method,payload)]))));
presentation.onFrame=callback=>{
 if(typeof callback!=='function')throw TypeError('Expected callback');
 const listener=(_event,value)=>{
  if(!value||Object.keys(value).sort().join(',')!=='deckVersion,epoch,publicSlide,sequence,slideId'||!Number.isSafeInteger(value.epoch)||value.epoch<1||!Number.isSafeInteger(value.sequence)||value.sequence<1||typeof value.deckVersion!=='string'||!/^[a-f0-9]{64}$/.test(value.deckVersion)||typeof value.slideId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value.slideId))return;
  const slide=value.publicSlide;if(!slide||typeof slide.title!=='string'||slide.title.length>256)return;
  if(slide.kind==='image'?(Object.keys(slide).sort().join(',')!=='image,kind,title'||typeof slide.image!=='string'||slide.image.length>2800000||!slide.image.startsWith('data:image/png;base64,')):(slide.kind!=='text'||Object.keys(slide).sort().join(',')!=='body,kind,title'||typeof slide.body!=='string'||slide.body.length>65536))return;
  Promise.resolve(callback(value)).catch(()=>{});
 };ipcRenderer.on('siren:presentation-frame',listener);return()=>ipcRenderer.removeListener('siren:presentation-frame',listener);
};
presentation.onFullscreen=callback=>{if(typeof callback!=='function')throw TypeError('Expected callback');const listener=(_event,value)=>{if(value&&Object.keys(value).join(',')==='enabled'&&typeof value.enabled==='boolean')callback(Object.freeze({enabled:value.enabled}));};ipcRenderer.on('siren:presentation-fullscreen',listener);return()=>ipcRenderer.removeListener('siren:presentation-fullscreen',listener);};
contextBridge.exposeInMainWorld('sirenPresentation',Object.freeze(presentation));
contextBridge.exposeInMainWorld('sirenWindow',Object.freeze({getView:()=>ipcRenderer.invoke('siren:windows','getView'),closeView:payload=>ipcRenderer.invoke('siren:windows','closeView',payload),onReady:callback=>{if(typeof callback!=='function')throw TypeError('Expected callback');const listener=()=>callback();ipcRenderer.on('siren:view-ready',listener);return()=>ipcRenderer.removeListener('siren:view-ready',listener);}}));
let subscribed=false,active=false;
contextBridge.exposeInMainWorld('sirenViewControl',Object.freeze({
 onPrepare(callback){
  if(typeof callback!=='function'||subscribed)throw TypeError('One preparation callback required');subscribed=true;
  const listener=async(_event,ticket)=>{
   if(active||!ticket||Object.keys(ticket).sort().join(',')!=='nonce,requestId'||!['nonce','requestId'].every(key=>typeof ticket[key]==='string'&&/^[a-f0-9-]{36}$/.test(ticket[key])))return;
   active=true;let ok=false;try{ok=(await callback())?.ok===true;}finally{active=false;}
   return ipcRenderer.invoke('siren:view-ack',{requestId:ticket.requestId,ok});
  };ipcRenderer.on('siren:view-prepare',listener);return()=>{ipcRenderer.removeListener('siren:view-prepare',listener);subscribed=false;};
 },
 onResume(callback){if(typeof callback!=='function')throw TypeError('Expected callback');const listener=()=>callback();ipcRenderer.on('siren:view-resume',listener);return()=>ipcRenderer.removeListener('siren:view-resume',listener);}
}));
