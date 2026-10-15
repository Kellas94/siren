// Passive browser observer, serialized only into an owned native QA page.
// Importing it reads no DOM, starts no process, and changes no product callback.
export function observeNativeSourceOpen(){
 const status=document.getElementById('viewStatus');if(!status)throw Error('NATIVE_SOURCE_STATUS_REQUIRED');
 let resolveClick,resolveConflict,seen=false,disposed=false;
 const click=new Promise(resolve=>{resolveClick=resolve}),conflict=new Promise(resolve=>{resolveConflict=resolve});
 const observer=new MutationObserver(records=>{
  if(disposed||!seen)return;
  if(records.length>32){resolveConflict({error:'NATIVE_STATUS_RECORD_BUDGET'});return;}
  const texts=[];
  for(const record of records){
   if(record.target!==status&&!status.contains(record.target))continue;
   if(record.addedNodes?.length>16){resolveConflict({error:'NATIVE_STATUS_RECORD_BUDGET'});return;}
   for(const node of record.addedNodes??[])texts.push(node.textContent);
   if(typeof record.oldValue==='string')texts.push(record.oldValue);
  }
  texts.push(status.textContent);
  for(const text of texts){
   if(typeof text!=='string')continue;if(text.length>4096){resolveConflict({error:'NATIVE_STATUS_TEXT_BUDGET'});return;}
   if(text.includes('saved document changed')){resolveConflict(Object.freeze({status:text,documentVersion:document.body.dataset.documentVersion}));return;}
  }
 });
 const onClick=event=>{
  const button=event.target?.closest('.document-source-open');if(disposed||seen||!button)return;
  seen=true;observer.observe(status,{childList:true,subtree:true,characterData:true,characterDataOldValue:true});resolveClick(Object.freeze({documentVersion:document.body.dataset.documentVersion,readonly:document.body.dataset.documentReadonly,trusted:event.isTrusted===true,connected:button.isConnected===true,label:button.textContent}));
  document.removeEventListener('click',onClick,true);
 };
 document.addEventListener('click',onClick,{capture:true,passive:true});
 return Object.freeze({click,conflict,dispose(){disposed=true;document.removeEventListener('click',onClick,true);observer.disconnect();}});
}
