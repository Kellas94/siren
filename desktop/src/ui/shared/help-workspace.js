(() => {
 'use strict';
 if(!window.sirenShell||!window.SirenHelp||document.body?.dataset.role==='audience')return;
 let disposed=false,covered=false,epoch=Object.freeze({});const offered=new WeakMap(),liveOffers=new Set();
 const available=()=>!disposed&&!covered&&!document.body.inert&&document.documentElement.style.visibility!=='hidden'&&document.documentElement.dataset.desktopLocked!=='true'&&window.sirenDesktopStorageLocked!==true&&document.getElementById('sirenAppNavigation')?.hidden===false;
 const view=window.SirenHelp.create({document,isAvailable:available});
 const open=options=>view.open(options);
 const retireOffers=()=>{epoch=Object.freeze({});for(const entry of liveOffers){entry.button.remove();offered.delete(entry.host);}liveOffers.clear();};
 const cover=()=>{covered=true;retireOffers();view.close();};
 const offHelp=window.sirenShell.onHelp?.(()=>open());
 const offResume=window.sirenViewControl?.onResume(()=>{if(!disposed)covered=false;});
 const observer=typeof MutationObserver==='function'?new MutationObserver(()=>{if(!available())view.close();}):null;
 observer?.observe(document.body,{attributes:true,attributeFilter:['inert']});observer?.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-desktop-locked']});
 function offer(host,article,safe,context){
  if(context!==epoch||!host||typeof host.append!=='function')return;const prior=offered.get(host);prior?.button.remove();liveOffers.delete(prior);offered.delete(host);if(!article||!available())return;
  for(const entry of liveOffers)if(!entry.button.isConnected){liveOffers.delete(entry);offered.delete(entry.host);}
  if(liveOffers.size>=64){const oldest=liveOffers.values().next().value;oldest.button.remove();liveOffers.delete(oldest);offered.delete(oldest.host);}
  const button=document.createElement('button');button.type='button';button.textContent='Explain error';button.className='siren-help-error';
  button.addEventListener('click',()=>{if(context===epoch&&button.isConnected&&available())open({articleId:article.id,...(safe?{errorIdentity:safe}:{}),initiator:button});});host.append(button);const entry={host,button};offered.set(host,entry);liveOffers.add(entry);
 }
 function safeIdentity(identity){try{if(!identity||Reflect.ownKeys(identity).length!==3)return null;const result={};for(const key of ['namespace','operation','code']){const d=Object.getOwnPropertyDescriptor(identity,key);if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='string'||!(key==='code'?/^[A-Z][A-Z0-9_]{0,95}$/:/^[a-z][a-z0-9-]{0,79}$/).test(d.value))return null;result[key]=d.value;}return result;}catch{return null;}}
 function explain(host,identity,context=epoch){const article=identity?window.SirenHelpResolver.resolve(identity):null;offer(host,article,safeIdentity(identity),context);}
 function article(host,id,context=epoch){offer(host,window.SirenHelpResolver.get(id),null,context);}
 const dispose=()=>{if(disposed)return;covered=true;retireOffers();view.dispose();disposed=true;offHelp?.();offResume?.();observer?.disconnect();};
 window.SirenHelpWorkspace=Object.freeze({open,close:()=>view.close(),cover,resume:()=>{if(!disposed)covered=false;},capture:()=>epoch,isCurrent:context=>context===epoch&&available(),explain,article,dispose});
 window.addEventListener('pagehide',dispose,{once:true});
})();
