(() => {
 'use strict';
 window.SirenNativeDiagramBuildView=Object.freeze({create({host,sourceFor,editable,onSource,onStatus,onPending=()=>{}}){
  let selected='',targets=[],disposed=false,editingSource=null;const pending=new Set();
  const make=(tag,parent,text)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;parent.append(item);return item;};
  const field=(name,id,type='text')=>{const wrap=make('label',host,name),input=make(type==='select'?'select':'input',wrap);input.id=id;if(type!=='select'){input.type=type;input.maxLength=160;}return input;};
  const target=field('Block','diagramBuildTarget','select'),label=field('Label','diagramBuildLabel'),shape=field('Shape','diagramBuildShape','select');for(const value of window.SirenNativeDiagramBuild.shapes){const option=make('option',shape,value);option.value=value;}
  const apply=make('button',host,'Apply block');apply.id='diagramBuildApply';
  const direction=field('Direction','diagramBuildDirection','select');for(const value of ['TD','BT','LR','RL']){const option=make('option',direction,value);option.value=value;}
  const newId=field('New ID','diagramBuildNewId'),newLabel=field('New label','diagramBuildNewLabel'),add=make('button',host,'Add block');add.id='diagramBuildAdd';
  const to=field('Connect to','diagramBuildTo','select'),edgeLabel=field('Connection label','diagramBuildEdgeLabel'),connect=make('button',host,'Connect');connect.id='diagramBuildConnect';
  const cancel=make('button',host,'Cancel fields');cancel.id='diagramBuildCancel';const note=make('p',host,'');note.className='diagram-style-note';
  const model=()=>window.SirenNativeDiagramBuild.inspect(sourceFor());
  function paint(){if(disposed)return;const read=model(),supported=read.ok===true,enabled=editable()&&supported,node=supported?read.nodes.find(item=>item.id===selected):null;
   for(const input of [target,label,shape,apply,direction,newId,newLabel,add,to,edgeLabel,connect])input.disabled=!enabled;
   label.disabled=shape.disabled=apply.disabled=!enabled||!node;connect.disabled=!enabled||!node||!to.value;
   if(!pending.has(label))label.value=node?.label||'';if(!pending.has(shape))shape.value=node?.shape||'rect';if(supported)direction.value=read.direction==='TB'?'TD':read.direction;
   note.textContent=!supported?'This diagram uses Mermaid code editing. Text and Guided retain its exact source.':!node?'Choose a rendered block, or add a new block.':'Click a block to edit · Apply to preview, then Save diagram · Esc cancels fields';
  }
  function applyRequest(request,fields=[]){if(disposed||!editable())return false;const source=sourceFor(),result=window.SirenNativeDiagramBuild.edit(source,{...request,expectedSource:editingSource??source});
   if(!result.ok||onSource(result.source)!==true){for(const input of fields)input.setAttribute('aria-invalid','true');onStatus('Build edit refused · Correct the fields, or press Esc to cancel. Your source is retained.');return false;}
   for(const input of fields){pending.delete(input);input.removeAttribute('aria-invalid');}if(!pending.size)editingSource=null;paint();onPending();return true;
  }
  function commit(){if(!pending.size)return true;if([newId,newLabel,to,edgeLabel].some(input=>pending.has(input))){onStatus('Finish Add block or Connect, or press Esc to cancel the pending fields');return false;}
   return applyRequest({action:'edit-node',id:selected,label:label.value,shape:shape.value},[label,shape]);
  }
  function cancelFields(){pending.clear();editingSource=null;newId.value=newLabel.value=edgeLabel.value='';for(const input of [label,shape,newId,newLabel,to,edgeLabel])input.removeAttribute('aria-invalid');paint();onPending();}
  for(const input of [label,shape,newId,newLabel,to,edgeLabel]){const changed=()=>{if(!editable())return;if(editingSource===null)editingSource=sourceFor();pending.add(input);onPending();};input.addEventListener('input',changed);if(input===shape||input===to)input.addEventListener('change',changed);input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();cancelFields();}else if(event.key==='Enter'&&[label,shape].includes(input)){event.preventDefault();commit();}});}
  target.addEventListener('change',()=>{const id=target.value;if(!commit()){target.value=selected;return;}selected=id;paint();});apply.addEventListener('click',commit);cancel.addEventListener('click',cancelFields);
  direction.addEventListener('change',()=>{const value=direction.value;if(!commit())return;applyRequest({action:'direction',direction:value});});
  add.addEventListener('click',()=>{if(pending.has(label)||pending.has(shape)){onStatus('Apply or cancel the selected block first');return;}if(applyRequest({action:'add-node',id:newId.value,label:newLabel.value,shape:'rect'},[newId,newLabel])){selected=newId.value;newId.value=newLabel.value='';paint();}});
  connect.addEventListener('click',()=>{if(pending.has(label)||pending.has(shape)){onStatus('Apply or cancel the selected block first');return;}if(applyRequest({action:'connect',from:selected,to:to.value,label:edgeLabel.value,arrow:'-->'},[to,edgeLabel]))edgeLabel.value='';});
  return Object.freeze({paint,commit,isEditing:()=>pending.size>0,select(id){if(!targets.includes(id)||!commit())return false;selected=id;target.value=id;paint();return true;},setTargets(items){targets=items.map(item=>item.id);if(!targets.includes(selected)&&!pending.size)selected=targets[0]||'';for(const input of [target,to]){const before=input.value;input.replaceChildren();for(const id of targets){const option=make('option',input,id);option.value=id;}input.value=targets.includes(before)?before:targets[0]||'';}target.value=selected;paint();},dispose(){disposed=true;targets=[];pending.clear();host.replaceChildren();}});
 }});
})();
