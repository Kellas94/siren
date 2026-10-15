(() => {
 'use strict';
 window.createDiagramDocsTransfer=({api,getContext,inspect,onStatus=()=>{}})=>{
  let generation=0,paused=false,disposed=false,dialog=null;const pending=new Set();
  const make=(tag,parent,text,action,id)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(action)n.dataset.embedAction=action;if(id)n.dataset.embedId=id;parent?.append(n);return n;};
  const ready=()=>{const c=getContext();if(paused||disposed||!c||c.dirty||c.pending||c.fenced||c.paused||c.disposed){onStatus('Save your diagram and finish pending fields before sending to Docs.');return null;}return c;};
  const track=fn=>{const token=generation,operation=Promise.resolve().then(()=>token===generation&&!paused&&!disposed?fn(token):undefined).catch(()=>{if(token===generation&&!paused&&!disposed)onStatus('Docs could not open. Your saved diagram is retained.');});pending.add(operation);operation.finally(()=>pending.delete(operation));return operation;};
  const close=()=>{dialog?.close();dialog?.remove();dialog=null;};
  function open(){
   const context=ready();if(!context)return;close();const own=dialog=make('dialog',document.body);own.className='document-diagram-picker';make('h2',own,'Bring this flow into Docs');make('p',own,'Choose a document. Review and insert there; this step keeps its text unchanged.');
   const docs=make('select',own,undefined,'send-document');docs.setAttribute('aria-label','Destination document');const more=make('button',own,'More documents','send-more');more.type='button';more.hidden=true;
   const scope=make('select',own,undefined,'send-scope');scope.setAttribute('aria-label','Diagram content');for(const [value,text]of [['whole','Whole diagram'],['selection','Selected steps']]){const option=make('option',scope,text);option.value=value;}scope.value='whole';
   const model=inspect(),list=make('fieldset',own);list.className='document-diagram-selection';list.hidden=true;const ids=new Set(),message=make('p',own);message.setAttribute('role','status');
   for(const n of model.ok?model.nodes:[]){const label=make('label',list),input=make('input',label,undefined,'send-node',n.id);input.type='checkbox';make('span',label,n.id+' · '+n.label);input.addEventListener('change',()=>{if(input.checked)ids.add(n.id);else ids.delete(n.id);});}
   scope.addEventListener('change',()=>{if(scope.value==='selection'&&!model.ok){scope.value='whole';message.textContent='Use the whole diagram for this syntax. Selected steps are not yet qualified.';}list.hidden=scope.value!=='selection';});
   const actions=make('div',own);actions.className='document-diagram-tools';const cancel=make('button',actions,'Cancel','send-cancel'),send=make('button',actions,'Continue in Docs','send-confirm');cancel.type=send.type='button';cancel.addEventListener('click',close);
   let cursor=0;function page(){more.disabled=true;void track(async token=>{const result=await api.listDocuments(cursor?{cursor}:{});if(token!==generation||dialog!==own)return;if(!result?.ok){message.textContent='Documents could not be listed.';return;}for(const row of result.items??[]){const option=make('option',docs,row.label);option.value=row.id;}cursor=result.nextCursor??cursor+(result.items??[]).length;more.hidden=!result.hasMore;more.disabled=false;message.textContent=docs.children.length?'Choose a saved document.':'Create a document in Docs first.';});}more.addEventListener('click',()=>{if(!more.disabled&&!more.hidden)page();});
   send.addEventListener('click',()=>{if(send.disabled||dialog!==own||!docs.value)return;const c=ready();if(!c||c.version!==context.version||c.sha256!==context.sha256)return;if(scope.value==='selection'&&!ids.size){message.textContent='Select at least one step.';return;}const request={documentId:docs.value,scope:scope.value,nodeIds:scope.value==='selection'?[...ids]:[],expectedVersion:context.version,expectedSha256:context.sha256};send.disabled=true;void track(async token=>{const latest=ready();if(!latest||latest.version!==context.version||latest.sha256!==context.sha256)return;const result=await api.sendToDocs(request);if(token!==generation||dialog!==own)return;if(!result?.ok){send.disabled=false;message.textContent='Could not send this saved version. Refresh and try again.';return;}close();onStatus('Opened Docs. Edit its working copy, preview the proposed diagram, then insert.');});});
   own.showModal();page();
  }
  const drain=async()=>{while(pending.size)await Promise.all([...pending]);};
  return Object.freeze({open,drain,pause:async()=>{paused=true;generation++;close();await drain();},resume:()=>{if(!disposed){paused=false;generation++;}},dispose:()=>{disposed=true;paused=true;generation++;close();}});
 };
})();
