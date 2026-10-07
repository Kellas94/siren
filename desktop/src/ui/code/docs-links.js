(() => {
 'use strict';
 window.SirenNativeDocsLinks=Object.freeze({create({button,editorFor,isCurrent,onStatus}){
  let serial=0,disposed=false,dialog=null,busy=false;
  const close=()=>{dialog?.remove();dialog=null;};
  const live=token=>!disposed&&token===serial&&isCurrent();
  const node=(tag,parent,text)=>{const value=document.createElement(tag);if(text!==undefined)value.textContent=text;parent?.append(value);return value;};
  const announce=text=>{if(!disposed&&isCurrent())onStatus(text);};
  async function open(){
   if(disposed||busy||dialog||!isCurrent())return;
   const token=++serial;busy=true;button.disabled=true;
   try{
    const editor=editorFor(),sourceReceipt=await editor?.flush();
    if(!live(token)||editorFor()!==editor)return;
    if(!sourceReceipt?.ok){announce('Code was not linked. Source save was refused; your working text was retained.');return;}
    const first=await window.sirenCodeDocs.listTargets({offset:0});if(!live(token))return;
    if(!first?.ok){announce('Code was saved, but Docs targets could not be opened. Existing document links were retained.');return;}
    const initialMode=first.total?'update':'create';
    const initialPage=first.total?first:await window.sirenCodeDocs.listDocuments({offset:0});if(!live(token))return;
    if(!initialPage?.ok){announce('Code was saved, but document choices could not be opened.');return;}
    if(!initialPage.total){announce('Code was saved. Create a document in Docs before adding this source.');return;}
    dialog=node('dialog',document.body);dialog.className='code-docs-dialog';dialog.setAttribute('aria-labelledby','codeDocsLinkTitle');
    node('h2',dialog,'Link to Docs').id='codeDocsLinkTitle';
    node('p',dialog,`Source version ${sourceReceipt.version} is saved. Choose where to document it. Existing agent sections and history are retained.`);
    const actionLabel=node('label',dialog,'Link action'),action=node('select',actionLabel);action.id='codeDocsAction';
    for(const [value,text]of [['update','Update a linked row'],['create','Add source to a document']]){const option=node('option',action,text);option.value=value;option.disabled=value==='update'&&!first.total;}action.value=initialMode;
    const nameLabel=node('label',dialog,'Source name'),name=node('input',nameLabel);name.id='codeDocsSourceName';name.maxLength=160;name.value='Code source';name.placeholder='e.g. agent.py';
    const list=node('div',dialog);list.className='code-docs-targets';list.setAttribute('role','group');list.setAttribute('aria-label','Linked document rows');
    let selected=null,nextOffset=initialPage.nextOffset,loading=false,mode=initialMode,fenced=false;
    const footer=node('div',dialog);footer.className='code-docs-actions';
    const more=node('button',footer,'Load more'),cancel=node('button',footer,'Cancel'),save=node('button',footer,'Update selected row');
    more.type=cancel.type=save.type='button';save.disabled=true;more.hidden=nextOffset===null;nameLabel.hidden=mode!=='create';save.textContent=mode==='create'?'Add source':'Update selected row';
    const message=node('p',dialog);message.className='code-docs-message';message.setAttribute('role','status');
    const append=targets=>{for(const target of targets){
     const label=node('label',list);label.className='code-docs-target';
     const radio=node('input',label);radio.type='radio';radio.name='docsLinkTarget';
     const captions=node('span',label);node('strong',captions,target.documentTitle);if(target.rowTitle!==undefined)node('span',captions,target.rowTitle);
     radio.addEventListener('change',()=>{selected=target;save.disabled=fenced||mode==='create'&&!name.value.trim();});
    }};
    append(mode==='create'?initialPage.documents:initialPage.targets);
    name.addEventListener('input',()=>{save.disabled=fenced||!selected||busy||loading||!name.value.trim();});
    action.addEventListener('change',async()=>{
     if(busy||loading||!live(token))return;loading=true;action.disabled=more.disabled=save.disabled=true;list.inert=true;selected=null;list.replaceChildren();
     try{
      mode=action.value==='create'?'create':'update';nameLabel.hidden=mode!=='create';save.textContent=mode==='create'?'Add source':'Update selected row';
      const page=await window.sirenCodeDocs[mode==='create'?'listDocuments':'listTargets']({offset:0});if(!live(token)||!dialog)return;
      if(!page?.ok){message.textContent='Document choices became unavailable. Close and reopen to review them.';return;}
      append(mode==='create'?page.documents:page.targets);nextOffset=page.nextOffset;more.hidden=nextOffset===null;message.textContent=page.total?'':'No matching choices. Create a document in Docs first.';
     }catch{if(dialog&&live(token))message.textContent='Document choices could not be opened. Existing Docs were retained.';}
     finally{loading=false;if(dialog){action.disabled=false;more.disabled=false;list.inert=false;}}
    });
    more.addEventListener('click',async()=>{
     if(loading||nextOffset===null||!live(token))return;loading=true;more.disabled=action.disabled=true;
     try{const page=await window.sirenCodeDocs[mode==='create'?'listDocuments':'listTargets']({offset:nextOffset});if(!live(token)||!dialog)return;
      if(!page?.ok){message.textContent='The list changed or became unavailable. Close and reopen it to review current targets.';return;}
      append(mode==='create'?page.documents:page.targets);nextOffset=page.nextOffset;more.hidden=nextOffset===null;
     }catch{if(dialog&&live(token))message.textContent='More rows could not be loaded. Existing links were retained.';}
     finally{loading=false;more.disabled=action.disabled=false;}
    });
    const dismiss=()=>{if(busy)return;serial++;close();editorFor()?.focus();};
    cancel.addEventListener('click',dismiss);dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
    save.addEventListener('click',async()=>{
     if(fenced||busy||loading||!selected||!live(token)||mode==='create'&&!name.value.trim())return;busy=true;fenced=true;save.disabled=cancel.disabled=more.disabled=action.disabled=name.disabled=true;list.inert=true;message.textContent=mode==='create'?'Adding this source to the selected document…':'Updating the selected document row…';
     try{
      const request={operationId:crypto.randomUUID(),documentId:selected.documentId,expectedDocumentVersion:selected.documentVersion,sourceReceipt};
      const receipt=await window.sirenCodeDocs[mode==='create'?'createCodeToDocs':'commitCodeToDocs']({...request,...(mode==='create'?{rowTitle:name.value}:{rowId:selected.rowId})});
      if(!live(token))return;
      if(receipt?.ok){announce(`Docs now ${mode==='create'?'includes':'links'} source version ${receipt.sourceRef.version}.${receipt.durability==='recovery-degraded'?' Saved; recovery checkpoint needs attention.':''}`);serial++;close();editorFor()?.focus();}
      else if(dialog){message.textContent=receipt?.code==='DOCUMENT_CONFLICT'?'The document changed. Close and reopen this list to review it before updating. Your source version is saved.':'The link was refused. Your saved source and existing Docs were retained.';}
     }catch{if(dialog&&live(token))message.textContent='The result could not be confirmed. Reopen Docs to check its selected version; your source is saved.';}
     finally{busy=false;if(dialog){cancel.disabled=false;more.disabled=false;action.disabled=false;name.disabled=false;list.inert=false;save.disabled=true;}}
    });
    dialog.showModal();
   }catch{announce('The Docs link could not be opened. Existing source and document versions were retained.');}
   finally{busy=false;button.disabled=false;}
  }
  button.addEventListener('click',open);
  return Object.freeze({pause(){serial++;close();},dispose(){disposed=true;serial++;close();button.removeEventListener('click',open);}});
 }});
})();
