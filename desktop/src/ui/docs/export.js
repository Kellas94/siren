(() => {
 'use strict';
 const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
 const extensions={html:'html',markdown:'md',json:'json'};
 window.SirenNativeDocsExportView=Object.freeze({create({button,revealButton,getContext,isReady,onStatus,bridge}){
  let paused=false,disposed=false,pending=null,generation=0,receipt=null,picker=null,format=null,confirm=null,cancel=null,disclosure=null;
  const context=()=>{const value=getContext();return value&&typeof value.documentId==='string'&&hash(value.version)&&hash(value.sha256)&&Number.isSafeInteger(value.projectRevision)&&value.projectRevision>=1?value:null;};
  const available=()=>!paused&&!disposed&&!pending&&isReady()&&context();
  const update=()=>{button.disabled=!available();revealButton.hidden=!receipt||paused||disposed;revealButton.disabled=!!pending||paused||disposed;};
  const close=()=>{if(picker?.open)picker.close();};
  const make=(tag,parent,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
  const say=text=>{if(!paused&&!disposed)onStatus(text);};
  const valid=(value,own,selected)=>value?.ok===true&&uuid(value.exportId)&&value.filename==='document-'+value.exportId+'.'+extensions[selected]&&value.format===selected&&value.entityId===own.documentId&&value.version===own.version&&value.entitySha256===own.sha256&&hash(value.sha256)&&Number.isSafeInteger(value.bytes)&&value.bytes>0&&value.bytes<=16*1024*1024&&Number.isSafeInteger(value.projectRevision)&&value.projectRevision>=own.projectRevision;
  const submit=()=>{
   if(!available()||!picker?.open||!Object.hasOwn(extensions,format.value))return;
   const own=context(),selected=format.value,token=generation;close();receipt=null;say('Exporting the saved document · Unsaved changes stay in this window.');
   const task=Promise.resolve().then(async()=>{try{
    const result=await bridge.exportSaved({format:selected,expectedVersion:own.version,expectedSha256:own.sha256});
    if(disposed||paused||generation!==token)return;
    if(!valid(result,own,selected)){say(result?.code==='DOCUMENT_VERSION_CHANGED'?'The saved document changed. Refresh or save explicitly before exporting. Your local changes are retained.':result?.code==='EXPORT_BUDGET'||result?.code==='DOCUMENT_BUDGET'?'This document exceeds the export limit. Your data and local changes are retained.':'Export could not be confirmed. Your document and local changes are retained.');return;}
    receipt={exportId:result.exportId};say('Saved document exported · '+selected.toUpperCase()+' · Linked assets remain references.'+(own.dirty?' Unsaved changes remain here; save explicitly to include them.':''));
   }catch{if(!disposed&&!paused&&generation===token)say('Export could not be confirmed. Your document and local changes are retained.');}
   finally{if(pending===task)pending=null;update();}});pending=task;update();
  };
  const open=()=>{
   if(!available())return false;
   if(!picker){
    picker=make('dialog',document.body);picker.id='documentExportPicker';picker.className='code-docs-dialog';picker.setAttribute('aria-labelledby','documentExportTitle');
    make('h2',picker,'Export saved document').id='documentExportTitle';disclosure=make('p',picker);disclosure.id='documentExportDisclosure';
    const label=make('label',picker,'Format');format=make('select',label);format.id='documentExportFormat';format.setAttribute('aria-label','Document export format');
    for(const [value,title]of [['html','HTML · Standalone reading page'],['markdown','Markdown · Text and code'],['json','JSON · Exact document data']]){const option=make('option',format,title);option.value=value;}format.value='html';
    make('p',picker,'All formats preserve the exact saved fields in an archive. Images are described and retained as data. PDF, Office and single-document reimport are not available in this export.');
    const actions=make('div',picker);actions.className='code-docs-actions';cancel=make('button',actions,'Cancel');cancel.id='documentExportCancel';cancel.type='button';cancel.addEventListener('click',close);confirm=make('button',actions,'Export saved');confirm.id='documentExportConfirm';confirm.type='button';confirm.addEventListener('click',submit);
   }
   disclosure.textContent=(context().dirty?'Unsaved changes are open. This exports the saved version; save explicitly first to include your edits. ':'This exports the saved version. ')+'Linked code, diagrams and documents remain references only. Use a project backup to include linked assets.';
   picker.showModal();return true;
  };
  const reveal=()=>{
   if(!available()||!receipt)return;const own=receipt,token=generation;
   const task=Promise.resolve().then(async()=>{try{const result=await bridge.revealExport({exportId:own.exportId});if(disposed||paused||token!==generation)return;if(result?.ok!==true){receipt=null;say('The export is no longer available to this window, or its file changed. Your document is retained.');}}catch{if(!disposed&&!paused&&token===generation){receipt=null;say('The export could not be shown. Your document is retained.');}}finally{if(pending===task)pending=null;update();}});pending=task;update();
  };
  const key=event=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&!event.altKey&&!event.isComposing&&event.key.toLowerCase()==='e'){event.preventDefault();if(!event.repeat)open();}};
  button.addEventListener('click',open);revealButton.addEventListener('click',reveal);window.addEventListener?.('keydown',key);update();
  return Object.freeze({open,update,reset(){generation++;receipt=null;close();update();},async pause(){paused=true;generation++;receipt=null;close();update();if(pending)await pending;},resume(){if(!disposed){paused=false;update();}},dispose(){disposed=true;paused=true;generation++;receipt=null;close();picker?.remove();button.removeEventListener('click',open);revealButton.removeEventListener('click',reveal);window.removeEventListener?.('keydown',key);update();}});
 }});
})();
