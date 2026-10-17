// Passive browser observer, serialized only into an owned native QA page.
// Importing it reads no DOM, starts no process, and changes no product callback.
export function observeNativeSourceOpen(){
 const status=document.getElementById('viewStatus');if(!status)throw Error('NATIVE_SOURCE_STATUS_REQUIRED');
 let resolveClick,resolveConflict,seen=false,disposed=false,clicked=null,opening=null,actualConflict=null,error=null,recordCount=0,initialStatus='';const receipts=[];
 const click=new Promise(resolve=>{resolveClick=resolve}),conflict=new Promise(resolve=>{resolveConflict=resolve});
 const fail=code=>{if(error)return;error=code;actualConflict=Object.freeze({error:code});resolveConflict(actualConflict);observer.disconnect();};
 const retain=(text,origin)=>{
  if(typeof text!=='string'||error)return;if(text.length>4096){fail('NATIVE_STATUS_TEXT_BUDGET');return;}
  // The first oldValue can predate the click; it is not a post-click receipt.
  if(origin==='oldValue'&&text===initialStatus&&!opening)return;
  if(receipts.at(-1)?.status===text)return;
  if(receipts.length>=64){fail('NATIVE_STATUS_RECEIPT_BUDGET');return;}
  const receipt=Object.freeze({status:text,documentVersion:document.body.dataset.documentVersion,origin});receipts.push(receipt);
  if(!opening&&/^Opening saved code version [1-9][0-9]*…$/.test(text))opening=receipt;
  if(!actualConflict&&text.includes('saved document changed')){actualConflict=receipt;resolveConflict(receipt);}
 };
 const observer=new MutationObserver(records=>{
  if(disposed||!seen||error)return;
  recordCount+=records.length;if(records.length>32||recordCount>128){fail('NATIVE_STATUS_RECORD_BUDGET');return;}
  for(const record of records){
   if(record.target!==status&&!status.contains(record.target))continue;
   if(record.addedNodes?.length>16){fail('NATIVE_STATUS_RECORD_BUDGET');return;}
   if(typeof record.oldValue==='string')retain(record.oldValue,'oldValue');
   for(const node of record.addedNodes??[])retain(node.textContent,'addedNode');
  }
  retain(status.textContent,'currentStatus');
 });
 const onClick=event=>{
  const button=event.target?.closest('.document-source-open');if(disposed||seen||!button)return;
  seen=true;initialStatus=status.textContent;observer.observe(status,{childList:true,subtree:true,characterData:true,characterDataOldValue:true});clicked=Object.freeze({documentVersion:document.body.dataset.documentVersion,readonly:document.body.dataset.documentReadonly,trusted:event.isTrusted===true,connected:button.isConnected===true,label:button.textContent});resolveClick(clicked);
  document.removeEventListener('click',onClick,true);
 };
 document.addEventListener('click',onClick,{capture:true,passive:true});
 return Object.freeze({click,conflict,snapshot(){const text=status.textContent;if(typeof text!=='string'||text.length>4096)fail('NATIVE_STATUS_TEXT_BUDGET');return Object.freeze({click:clicked,observedOpening:opening,actualConflict,error,records:Object.freeze([...receipts]),status:Object.freeze({text:typeof text==='string'?text.slice(0,4096):'',documentVersion:document.body.dataset.documentVersion}),disposed});},dispose(){disposed=true;document.removeEventListener('click',onClick,true);observer.disconnect();}});
}

// The native consumer uses this same pure policy; unit tests can invalidate its
// receipts without launching Electron or replacing a product handler.
export function classifyNativeSourceOpen({snapshot,viewsBefore,views,oldDocumentVersion,savedDocumentVersion}){
 const answer=(disposition,reason,extra={})=>({disposition,reason,...extra});
 if(snapshot?.error||snapshot?.actualConflict?.error)return answer('adverse','observer-budget-or-error');
 if(!Array.isArray(viewsBefore)||!Array.isArray(views)||new Set(views.map(v=>v.windowId)).size!==views.length||new Set(viewsBefore.map(v=>v.windowId)).size!==viewsBefore.length)return answer('adverse','invalid-window-roster');
 if(!viewsBefore.every(old=>views.some(v=>v.windowId===old.windowId&&v.role===old.role)))return answer('adverse','existing-window-changed');
 const newViews=views.filter(v=>!viewsBefore.some(old=>old.windowId===v.windowId)),clicked=snapshot?.click;
 if(!clicked)return answer(newViews.length?'adverse':'nonqualifying','click-not-observed');
 if(clicked.trusted!==true||clicked.connected!==true||clicked.readonly!=='true')return answer('adverse','invalid-click-receipt');
 if(clicked.documentVersion!==oldDocumentVersion&&clicked.documentVersion!==savedDocumentVersion)return answer('adverse','wrong-document-version');
 if(clicked.documentVersion===oldDocumentVersion){
  if(newViews.length)return answer('adverse','stale-click-opened-window');
  if(snapshot.observedOpening&&typeof snapshot.actualConflict?.status==='string'&&snapshot.actualConflict.status.includes('saved document changed'))return answer('stale-refused','observed-conflict');
  return answer('nonqualifying',snapshot.observedOpening?'accepted-without-terminal-receipt':'suppressed-or-unobserved');
 }
 if(newViews.length>1||newViews.some(v=>v.role!=='code'))return answer('adverse','unexpected-new-views');
 if(snapshot.actualConflict)return answer('adverse','refreshed-click-conflict');
 if(newViews.length===1){if(!snapshot.observedOpening)return answer('adverse','new-view-without-observed-acceptance');return answer('verify-historical-code','one-refreshed-code-view',{windowId:newViews[0].windowId});}
 return answer('nonqualifying',snapshot.observedOpening?'accepted-without-terminal-receipt':'suppressed-or-unobserved');
}
