(() => {
 'use strict';
 const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const make=(tag,parent,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 const code=value=>typeof value==='string'&&/^[A-Z0-9_]{1,80}$/.test(value)?value:'ACTIVITY_UNAVAILABLE';
 window.SirenNativeDocsActivity=Object.freeze({create({host,button,enabled=()=>true,onJump,onCompare,onStatus=()=>{}}){
  const model=window.SirenDocumentActivity;
  let context=null,section='comments',filter='all',cursor=0,previous=[],opened=false,paused=false,disposed=false,generation=0,pending=null,comparison=null,comparePage=0,against='saved';
  const ready=()=>{try{return !paused&&!disposed&&context!==null&&enabled()===true;}catch{return false;}};
  const say=text=>{if(ready())onStatus(text);};
  host.id=host.id||'documentActivity';host.className+=' document-section document-activity';host.setAttribute('role','region');host.setAttribute('aria-label','Document activity');
  button.type='button';button.setAttribute('aria-controls',host.id);button.setAttribute('aria-expanded','false');
  const clear=()=>{host.replaceChildren();host.hidden=true;button.setAttribute('aria-expanded','false');};
  const retire=()=>{generation++;pending=null;comparison=null;comparePage=0;};
  const preserve=event=>{if(event.button===0)event.preventDefault();};
  const action=(parent,id,title,run)=>{const token=generation,own=context,node=make('button',parent,title);node.id=id;node.type='button';node.disabled=!ready()||!!pending;node.addEventListener('pointerdown',preserve);node.addEventListener('click',()=>{if(ready()&&!pending&&generation===token&&context===own&&host.contains(node)&&!node.disabled)run();});return node;};
  const select=(parent,id,label,options,value,run)=>{const token=generation,own=context,field=make('label',parent,label),node=make('select',field);node.id=id;node.setAttribute('aria-label',label);node.disabled=!ready()||!!pending;for(const [key,title]of options){const option=make('option',node,title);option.value=key;}node.value=value;node.addEventListener('change',()=>{if(ready()&&!pending&&generation===token&&context===own&&host.contains(node)&&options.some(([key])=>key===node.value))run(node.value);});return node;};
  const resetPage=()=>{cursor=0;previous=[];retire();};
  const notice=(parent,text,id)=>{const node=make('p',parent,text);node.className='document-caption';if(id)node.id=id;return node;};
  const changeSection=value=>{section=value;resetPage();paint();};
  const changeFilter=value=>{filter=value;resetPage();paint();};
  function perform(kind,request){
   if(!ready()||pending)return;
   const token=generation,own=context;
   const task=Promise.resolve().then(async()=>{
    if(!ready()||generation!==token||context!==own)return;
    try{
     const result=await (kind==='jump'?onJump(request):onCompare(request));
     if(!ready()||generation!==token||context!==own)return;
     if(kind==='jump'){if(result?.ok!==true)say('Block jump refused · '+code(result?.code)+' · Document and local edits retained.');}
     else{
      comparison=result?.ok===true&&Array.isArray(result.rows)&&result.rows.length<=512?{...result,against:request.against,position:request.position,dirty:own.dirty}:{ok:false,code:code(result?.code)};comparePage=0;
      if(comparison.ok!==true)say('Comparison unavailable · '+comparison.code+' · Recorded data and local edits retained.');
     }
    }catch{
     if(ready()&&generation===token&&context===own){if(kind==='compare')comparison={ok:false,code:'ACTIVITY_UNAVAILABLE'};say((kind==='jump'?'Block jump refused':'Comparison unavailable')+' · Recorded data and local edits retained.');}
    }finally{if(pending===task){pending=null;if(ready()&&generation===token&&context===own&&opened)paint();}}
   });pending=task;paint();
  }
  function paintComparison(){
   if(!comparison)return;
   const area=make('section',host);area.setAttribute('aria-label','Revision comparison');
   if(comparison.ok!==true){notice(area,'Comparison unavailable · '+code(comparison.code)+' · No equality was established.');return;}
   make('h3',area,comparison.against==='working'?(comparison.dirty?'Unsaved working content':'Working current content · No unsaved edits')+' compared with Revision '+(comparison.position+1):'Saved current content compared with Revision '+(comparison.position+1)).setAttribute('aria-live','polite');
   notice(area,'Complete block values within the comparison budget · Source references compare pointers, not executed code, source bytes or test results.');
   notice(area,comparison.identical===true?'No differences in the compared block values.':'Differences in the compared block values.');
   const rows=make('div',area);rows.id='documentActivityCompareRows';const start=comparePage*20,end=Math.min(start+20,comparison.rows.length);
   for(let at=start;at<end;at++){
    const item=comparison.rows[at],row=make('div',rows);row.dataset.activityComparisonRow='true';
    make('strong',row,typeof item?.id==='string'?item.id.slice(0,200):'Unsupported block identity');
    notice(row,(['added','removed','changed','unchanged'].includes(item?.change)?item.change:'unsupported change')+(item?.reordered===true?' · reordered':'')+' · Archived index '+(Number.isSafeInteger(item?.beforeIndex)?item.beforeIndex+1:'—')+' · Current index '+(Number.isSafeInteger(item?.afterIndex)?item.afterIndex+1:'—'));
   }
   const nav=make('div',area);nav.className='code-docs-actions';
   action(nav,'documentActivityComparePrevious','Previous comparison rows',()=>{comparePage--;paint();}).disabled=!!pending||comparePage===0;
   notice(nav,(comparison.rows.length?start+1:0)+'–'+end+' of '+comparison.rows.length+' comparison rows');
   action(nav,'documentActivityCompareNext','Next comparison rows',()=>{comparePage++;paint();}).disabled=!!pending||end===comparison.rows.length;
  }
  function paint(){
   button.disabled=!ready();button.setAttribute('aria-expanded',String(opened&&ready()));
   if(!opened||!ready()){clear();return;}
   const active=document.activeElement,focusId=host.contains?.(active)?active.id:null;
   host.replaceChildren();host.hidden=false;
   const toolbar=make('div',host);toolbar.className='code-docs-actions';
   select(toolbar,'documentActivitySection','Activity section',[['comments','Comments'],['revisions','Changes'],['review','Review & releases']],section,changeSection);
   if(section==='comments')select(toolbar,'documentActivityFilter','Comment filter',[['all','All'],['open','Open'],['resolved','Resolved']],filter,changeFilter);
   if(section==='revisions')select(toolbar,'documentActivityAgainst','Compare revision against',[['saved','Saved current content'],['working','Working content'+(context.dirty?' · Unsaved':' · No unsaved edits')]],against,value=>{against=value;retire();paint();});
   notice(host,'Recorded activity · '+(context.readonly?'Read only':'Working window')+' · Saved version '+context.version.slice(0,12)+'…'+(context.dirty?' · Unsaved changes remain in this window.':' · No unsaved changes reported.'),'documentActivityContext');
   notice(host,'Review, release, author, timestamp and fingerprint values are recorded claims, not independently verified approvals, signatures or tests. Unknown fields remain in Preserved fields and the exact archive.');
   const page=model.page(context.document,{section,filter,cursor,limit:20});
   if(page?.ok!==true){notice(host,'Activity unavailable · '+code(page?.code)+' · Original records remain in Preserved fields.','documentActivityPageNotice');return;}
   const list=make('div',host);list.id='documentActivityRows';
   for(const row of page.rows){
    const card=make('section',list);card.dataset.activityPosition=String(row.position);card.dataset.activityKind=row.kind;
    make('h3',card,row.title);if(row.kind==='comment')notice(card,'Recorded resolution: '+row.state);
    if(row.kind==='revision'&&Number.isSafeInteger(row.blockCount))notice(card,row.blockCount+' captured blocks');
    const fields=make('dl',card);for(const field of row.fields){make('dt',fields,field.key);make('dd',fields,field.text);if(field.truncated)notice(fields,'Shortened display · Full recorded value remains in Preserved fields.');}
    if(row.kind==='comment'&&row.blockId)action(card,'documentActivityJump'+row.position,'Jump to block',()=>perform('jump',row.blockId));
    if(row.kind==='revision'){const compare=action(card,'documentActivityCompare'+row.position,'Compare revision',()=>perform('compare',{position:row.position,against}));compare.disabled=!!pending||row.canCompare!==true;if(row.canCompare!==true)notice(card,'Comparison unavailable for this recorded block set or its block limit.');}
   }
   if(!page.rows.length)notice(host,'No matching records on this scanned page.');
   notice(host,page.total+' source positions · Scanned '+page.scanned+' from position '+cursor+(page.limited?' · Display or scan limit reached; full records are retained.':''),'documentActivityPageNotice');
   const nav=make('div',host);nav.className='code-docs-actions';
   action(nav,'documentActivityPrevious','Previous records',()=>{cursor=previous.pop();retire();paint();}).disabled=!!pending||!previous.length;
   action(nav,'documentActivityNext','Next records',()=>{previous.push(cursor);cursor=page.nextCursor;retire();paint();}).disabled=!!pending||page.nextCursor===null;
   paintComparison();
   if(focusId){const find=node=>node.id===focusId?node:Array.from(node.children).map(find).find(Boolean);find(host)?.focus({preventScroll:true});}
  }
  const toggle=()=>{if(!ready())return;opened=!opened;if(!opened)retire();paint();};
  button.addEventListener('pointerdown',preserve);button.addEventListener('click',toggle);clear();button.disabled=true;
  return Object.freeze({
   setContext(value){if(disposed)return;retire();context=value?.document&&typeof value.document.id==='string'&&hash(value.version)&&hash(value.sha256)&&typeof value.dirty==='boolean'&&typeof value.readonly==='boolean'?{document:value.document,version:value.version,sha256:value.sha256,dirty:value.dirty,readonly:value.readonly}:null;cursor=0;previous=[];paint();},
   updateState({dirty}={}){if(disposed)return;if(context&&typeof dirty==='boolean')context.dirty=dirty;retire();paint();},
   invalidate(){if(disposed)return;retire();context=null;opened=false;clear();button.disabled=true;},
   pause(){if(disposed)return;paused=true;retire();clear();button.disabled=true;},
   resume(){if(disposed)return;paused=false;paint();},
   dispose(){if(disposed)return;disposed=true;paused=true;retire();context=null;opened=false;clear();button.disabled=true;button.removeEventListener('pointerdown',preserve);button.removeEventListener('click',toggle);},
  });
 }});
})();
