(() => {
 'use strict';
 const names={table:'Table',checklist:'Checklist',prompt:'Agent instructions',settings:'Settings'};
 const defaults={table:{headerRow:true,rows:[['Column 1','Column 2'],['','']]},checklist:{items:[{text:'',done:false}]},prompt:{label:'Agent instructions',model:'',text:'',reasoningEffort:'',updatedAt:'',copiedAt:'',history:[]},settings:{rows:[{key:'Model',value:''},{key:'Temperature',value:''},{key:'Tools / plugins',value:''},{key:'Knowledge sources',value:''},{key:'Trigger',value:''}]}};
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const exact=(value,keys)=>record(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
 const string=(value,max)=>typeof value==='string'&&value.length<=max&&value.isWellFormed();
 function createBlock(kind){if(!Object.hasOwn(defaults,kind))throw TypeError('Unsupported structured section');return {id:crypto.randomUUID(),kind,...structuredClone(defaults[kind])};}
 function isEditableBlock(block){
  if(!record(block)||!Object.hasOwn(defaults,block.kind)||!string(block.id,2000)||!block.id)return false;
  const keys=['id','kind',...Object.keys(defaults[block.kind])];
  if(Object.hasOwn(block,'role')){if(!['purpose','boundaries','capabilities','test-cases'].includes(block.role))return false;keys.push('role');}
  if(!exact(block,keys))return false;
  if(block.kind==='table')return typeof block.headerRow==='boolean'&&Array.isArray(block.rows)&&block.rows.length>0&&block.rows.length<=500&&Array.isArray(block.rows[0])&&block.rows[0].length>0&&block.rows[0].length<=12&&block.rows.every(row=>Array.isArray(row)&&row.length===block.rows[0].length&&row.every(cell=>string(cell,8000)));
  if(block.kind==='checklist')return Array.isArray(block.items)&&block.items.length>0&&block.items.length<=200&&block.items.every(item=>exact(item,['text','done'])&&string(item.text,500)&&typeof item.done==='boolean');
  if(block.kind==='settings')return Array.isArray(block.rows)&&block.rows.length>0&&block.rows.length<=80&&block.rows.every(row=>exact(row,['key','value'])&&string(row.key,80)&&string(row.value,4000));
  return string(block.label,120)&&!!block.label&&string(block.model,80)&&string(block.text,200000)&&string(block.reasoningEffort,400)&&typeof block.updatedAt==='string'&&typeof block.copiedAt==='string'&&Array.isArray(block.history)&&block.history.length<=60&&block.history.every(entry=>exact(entry,['at','text'])&&typeof entry.at==='string'&&string(entry.text,200000));
 }
 function renderEditor({parent,draft,index,canEdit,onRemove,onOpen,preserved,focus=false,focusField=null}){
  const original=draft.getContent().blocks[index];if(!isEditableBlock(original))throw TypeError('Exact structured block required');
  const doc=parent.ownerDocument,make=(tag,holder,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;holder.append(node);return node;};
  const details=make('details',parent);details.className='document-group document-structured';details.dataset.structuredId=original.id;
  const summary=make('summary',details,names[original.kind]);summary.dataset.structuredSummary=original.id;const body=make('div',details);const row=typeof focusField==='string'?/^(?:cell:|done:|text:|key:|value:)(\d+)/.exec(focusField):null;let page=row?Math.floor(Number(row[1])/20):0;
  const target=()=>{const state=draft.getStatus();if(!details.isConnected||!canEdit()||state.pending||state.paused||state.fenced||state.disposed||state.readonly)return null;const next=draft.getContent(),block=next.blocks[index];return block?.id===original.id&&block.kind===original.kind&&isEditableBlock(block)?{next,block}:null;};
  const write=(node,mutate)=>{if(!node.isConnected)return false;const own=target();if(!own)return false;mutate(own.block);if(!isEditableBlock(own.block))return false;return draft.setContent(own.next,{historyGroup:node.dataset.structuredField?'structured:'+original.id+':'+node.dataset.structuredField:null})?.ok===true;};
  const button=(holder,title,action,handler,limited=false)=>{const node=make('button',holder,title);node.type='button';node.className='document-edit';node.dataset.structuredAction=action;node.dataset.documentAtLimit=String(limited);node.disabled=limited;node.addEventListener('click',()=>{if(!node.isConnected||limited||!target())return;handler(node);});return node;};
  const input=(holder,title,value,max,key,apply,{area=false,check=false}={})=>{
   const label=make('label',holder,title),node=make(area?'textarea':'input',label);node.className='document-edit';node.dataset.structuredField=key;node.setAttribute('aria-label',title);
   if(check){node.type='checkbox';node.checked=value;}else{node.value=value;node.maxLength=max;if(area)node.rows=key==='text'?10:2;}
   let accepted=value;node.addEventListener(check?'change':'input',()=>{const value=check?node.checked:node.value;if(write(node,block=>apply(block,value)))accepted=value;else if(check)node.checked=accepted;else node.value=accepted;});return node;
  };
  function paint(){
   body.replaceChildren();const block=draft.getContent().blocks[index];if(block?.id!==original.id||!isEditableBlock(block))return;
   make('p',body,'Local document section · Save document when ready.').className='document-caption';
   if(block.kind==='prompt'){
    make('p',body,'Instructions are documentation. Editing here does not execute code or activate AI.').className='document-caption';
    for(const [key,title,max,area]of [['label','Section label',120,false],['model','Model',80,false],['text','Instructions',200000,true],['reasoningEffort','Reasoning notes',400,true]])input(body,title,block[key],max,key,(b,value)=>{b[key]=value;},{area});
    if(block.updatedAt||block.copiedAt||block.history.length)preserved(body,'Saved history and dates',{updatedAt:block.updatedAt,copiedAt:block.copiedAt,history:block.history},0);
   }else{
    const table=block.kind==='table',key=block.kind==='checklist'?'items':'rows',rows=block[key],limit=table?500:block.kind==='checklist'?200:80;
    page=Math.min(page,Math.floor((rows.length-1)/20));const start=page*20,end=Math.min(start+20,rows.length);
    if(table)input(body,'First row is a header',block.headerRow,0,'headerRow',(b,value)=>{b.headerRow=value;},{check:true});
    const paging=make('div',body);paging.className='document-structured-actions';button(paging,'Previous','previous',()=>{page--;paint();},page===0);make('span',paging,`${start+1}–${end} of ${rows.length} rows`).setAttribute('aria-live','polite');button(paging,'Next','next',()=>{page++;paint();},end===rows.length);
    const grid=make('div',body);grid.className=table?'document-table-grid':'document-structured-rows';
    // Grid width is bounded by the frozen 12-column schema. Controls stay lazy.
    if(table)grid.setAttribute('style','--document-columns:'+rows[0].length);
    for(let row=start;row<end;row++){
     const group=make(table?'div':'fieldset',grid);group.className=table?'document-table-row':'document-structured-row';if(!table)make('legend',group,(block.kind==='checklist'?'Item ':'Setting ')+(row+1));
     if(table){for(let column=0;column<rows[row].length;column++){const node=input(group,`Row ${row+1}, column ${column+1}`,rows[row][column],8000,`cell:${row}:${column}`,(b,value)=>{b.rows[row][column]=value;},{area:true});node.dataset.structuredCell=`${row}:${column}`;}}
     else if(block.kind==='checklist'){input(group,'Completed item '+(row+1),rows[row].done,0,'done:'+row,(b,value)=>{b.items[row].done=value;},{check:true});input(group,'Item '+(row+1),rows[row].text,500,'text:'+row,(b,value)=>{b.items[row].text=value;},{area:true});}
     else{input(group,'Setting name '+(row+1),rows[row].key,80,'key:'+row,(b,value)=>{b.rows[row].key=value;});input(group,'Setting value '+(row+1),rows[row].value,4000,'value:'+row,(b,value)=>{b.rows[row].value=value;},{area:true});}
    }
    const actions=make('div',body);actions.className='document-structured-actions';
    button(actions,'Add row','add-row',node=>{if(write(node,b=>{b[key].push(table?Array(b.rows[0].length).fill(''):block.kind==='checklist'?{text:'',done:false}:{key:'',value:''});})){page=Math.floor(rows.length/20);paint();}},rows.length>=limit);
    button(actions,'Remove last row…','remove-row',node=>{if(!doc.defaultView.confirm('Remove the last row from this local section? Save document to commit the change.'))return;if(write(node,b=>{b[key].pop();}))paint();},rows.length<=1);
    if(table){button(actions,'Add column','add-column',node=>{if(write(node,b=>{for(const row of b.rows)row.push('');}))paint();},rows[0].length>=12);button(actions,'Remove last column…','remove-column',node=>{if(!doc.defaultView.confirm('Remove the last column from this local table? Save document to commit the change.'))return;if(write(node,b=>{for(const row of b.rows)row.pop();}))paint();},rows[0].length<=1);}
   }
   const actions=make('div',body);actions.className='document-structured-actions';button(actions,'Remove section…','remove-section',()=>onRemove());
  }
  details.addEventListener('toggle',()=>{if(!details.open){body.replaceChildren();return;}if(!details.isConnected)return;onOpen(details);if(!body.children.length)paint();});
  if(focus){details.open=true;onOpen(details);paint();const first=body.querySelector?.('input,textarea');first?.focus();}
  return details;
 }
 window.SirenStructuredDocs=Object.freeze({createBlock,isEditableBlock,renderEditor,names:Object.freeze(names)});
})();
