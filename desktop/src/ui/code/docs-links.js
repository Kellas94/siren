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
    if(!first.total){announce('Code was saved. No Docs row is linked to this source yet.');return;}
    dialog=node('dialog',document.body);dialog.className='code-docs-dialog';dialog.setAttribute('aria-labelledby','codeDocsLinkTitle');
    node('h2',dialog,'Link to Docs').id='codeDocsLinkTitle';
    node('p',dialog,`Source version ${sourceReceipt.version} is saved. Choose the Docs row that should use this version.`);
    const list=node('div',dialog);list.className='code-docs-targets';list.setAttribute('role','group');list.setAttribute('aria-label','Linked document rows');
    let selected=null,nextOffset=first.nextOffset,loading=false;
    const footer=node('div',dialog);footer.className='code-docs-actions';
    const more=node('button',footer,'Load more'),cancel=node('button',footer,'Cancel'),save=node('button',footer,'Update selected row');
    more.type=cancel.type=save.type='button';save.disabled=true;more.hidden=nextOffset===null;
    const message=node('p',dialog);message.className='code-docs-message';message.setAttribute('role','status');
    const append=targets=>{for(const target of targets){
     const label=node('label',list);label.className='code-docs-target';
     const radio=node('input',label);radio.type='radio';radio.name='docsLinkTarget';
     const captions=node('span',label);node('strong',captions,target.documentTitle);node('span',captions,target.rowTitle);
     radio.addEventListener('change',()=>{selected=target;save.disabled=false;});
    }};
    append(first.targets);
    more.addEventListener('click',async()=>{
     if(loading||nextOffset===null||!live(token))return;loading=true;more.disabled=true;
     try{const page=await window.sirenCodeDocs.listTargets({offset:nextOffset});if(!live(token)||!dialog)return;
      if(!page?.ok){message.textContent='The list changed or became unavailable. Close and reopen it to review current targets.';return;}
      append(page.targets);nextOffset=page.nextOffset;more.hidden=nextOffset===null;
     }catch{if(dialog&&live(token))message.textContent='More rows could not be loaded. Existing links were retained.';}
     finally{loading=false;more.disabled=false;}
    });
    const dismiss=()=>{if(busy)return;serial++;close();editorFor()?.focus();};
    cancel.addEventListener('click',dismiss);dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
    save.addEventListener('click',async()=>{
     if(busy||!selected||!live(token))return;busy=true;save.disabled=cancel.disabled=more.disabled=true;list.inert=true;message.textContent='Updating the selected document row…';
     try{
      const receipt=await window.sirenCodeDocs.commitCodeToDocs({operationId:crypto.randomUUID(),documentId:selected.documentId,rowId:selected.rowId,expectedDocumentVersion:selected.documentVersion,sourceReceipt});
      if(!live(token))return;
      if(receipt?.ok){announce(`Docs now links source version ${receipt.sourceRef.version}.${receipt.durability==='recovery-degraded'?' Saved; recovery checkpoint needs attention.':''}`);serial++;close();editorFor()?.focus();}
      else if(dialog){message.textContent=receipt?.code==='DOCUMENT_CONFLICT'?'The document changed. Close and reopen this list to review it before updating. Your source version is saved.':'The link was refused. Your saved source and existing Docs were retained.';}
     }catch{if(dialog&&live(token))message.textContent='The result could not be confirmed. Reopen Docs to check its selected version; your source is saved.';}
     finally{busy=false;if(dialog){cancel.disabled=false;more.disabled=false;list.inert=false;save.disabled=true;}}
    });
    dialog.showModal();
   }catch{announce('The Docs link could not be opened. Existing source and document versions were retained.');}
   finally{busy=false;button.disabled=false;}
  }
  button.addEventListener('click',open);
  return Object.freeze({pause(){serial++;close();},dispose(){disposed=true;serial++;close();button.removeEventListener('click',open);}});
 }});
})();
