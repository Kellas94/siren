(() => {
 'use strict';
 window.SirenNativeGuidedView=Object.freeze({create({host,sourceFor,editable,onSource,onStatus,contextFor=()=>undefined}){
  let page=0,disposed=false,editing=null,external=null;
  const retireExternal=()=>{if(external){external.active=false;external=null;}};
  function beginExternalInteraction(){
   if(disposed||editing?.composing||(editing&&editing.context!==contextFor()))return null;
   const context=contextFor(),source=sourceFor();
   if(external?.active&&external.context===context&&external.source===source)return external.handle;
   retireExternal();const input=editing?.input,focus=host.contains?.(document.activeElement)?document.activeElement:null;
   const selection=focus&&typeof focus.selectionStart==='number'?{start:focus.selectionStart,end:focus.selectionEnd,direction:focus.selectionDirection}:null;
   const own={active:true,context,source,handle:null};
   own.handle=Object.freeze({restore(){
    if(!own.active)return false;
    let current=!disposed&&contextFor()===context&&sourceFor()===source&&(!input||editing?.input===input)&&(!focus||(host.contains?.(focus)&&!focus.disabled&&focus.isConnected!==false&&host.hidden!==true&&(!focus.getClientRects||focus.getClientRects().length>0)))&&!document.body?.inert&&document.documentElement?.style?.visibility!=='hidden';
    try{if(current&&focus){focus.focus();if(selection)focus.setSelectionRange?.(selection.start,selection.end,selection.direction);}}catch{current=false;}finally{own.active=false;if(external===own)external=null;}return current;
   },retire(){own.active=false;if(external===own)external=null;}});external=own;return own.handle;
  }
  const make=(tag,parent,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;parent.append(element);return element;};
  function edit(button,row,field,value,choices){
   if(disposed||!editable()||editing)return;
   const input=document.createElement(choices?'select':'input');input.setAttribute('aria-label','Line '+(row.index+1)+' '+field);input.dataset.guidedInput=field;
   if(choices)for(const choice of choices){const option=make('option',input,choice);option.value=choice;}
   else{input.type='text';input.maxLength=512;}
   input.value=value;button.replaceWith(input);
   let closed=false,composing=false;const finish=(apply,restoreFocus=true)=>{
    if(closed)return true;
    if(disposed||editing?.input!==input||editing.context!==contextFor())return false;
    if(apply&&composing)return false;
    retireExternal();
    if(apply&&input.value!==value){const result=editable()?window.SirenNativeGuided.edit(sourceFor(),{index:row.index,expectedLine:row.text,field,value:input.value}):{ok:false};
     if(result.ok&&onSource(result.source)===true)onStatus('Guided edit · Save explicitly with Ctrl+S');else{input.setAttribute('aria-invalid','true');input.title='Correct this field or press Esc to cancel. Your source is retained.';onStatus('The line changed or cannot be edited. Your current Mermaid source and field are retained.');return false;}
    }
    closed=true;editing=null;
    paint();if(restoreFocus)host.querySelector('[data-line="'+row.index+'"][data-field="'+field+'"]')?.focus();
    return true;
   };
   editing={input,finish,composing,context:contextFor()};onStatus('Editing Guided field · Enter to apply · Esc to cancel · Ctrl+S to save');
   input.addEventListener('compositionstart',()=>{composing=true;if(editing?.input===input)editing.composing=true;});input.addEventListener('compositionend',()=>{composing=false;if(editing?.input===input)editing.composing=false;});
   input.addEventListener('keydown',event=>{if(event.isComposing||composing)return;if(event.key==='Enter'){event.preventDefault();finish(true);}else if(event.key==='Escape'){event.preventDefault();finish(false);}});
   input.addEventListener('blur',()=>{if(!external?.active)finish(true,false);});if(choices)input.addEventListener('change',()=>{if(!external?.active)finish(true);});input.focus();input.select?.();
  }
  function chip(container,row,field,value,choices){
   const button=make('button',container,value||'…');button.type='button';button.className='guided-chip';button.dataset.line=String(row.index);button.dataset.field=field;button.disabled=!editable();button.setAttribute('aria-label','Line '+(row.index+1)+' '+field+': '+value);
   button.addEventListener('click',()=>edit(button,row,field,value,choices));
  }
  function paint(){
   if(disposed||editing)return;host.replaceChildren();const read=window.SirenNativeGuided.inspect(sourceFor());
   if(!read.ok){make('p',host,'Guided supports up to 50,000 characters and 5,000 lines. Your complete source remains available in Text.');return;}
   page=Math.min(page,Math.max(0,Math.ceil(read.rows.length/64)-1));
   const controls=make('div',host);controls.className='guided-pages';
   const previous=make('button',controls,'Previous lines');previous.type='button';previous.disabled=page===0;previous.addEventListener('click',()=>{page--;paint();});
   make('span',controls,(page*64+1)+'–'+Math.min((page+1)*64,read.rows.length)+' of '+read.rows.length+' lines');
   const next=make('button',controls,'Next lines');next.type='button';next.disabled=(page+1)*64>=read.rows.length;next.addEventListener('click',()=>{page++;paint();});
   const rows=make('div',host);rows.className='guided-rows';
   for(const row of read.rows.slice(page*64,(page+1)*64)){
    const line=make('div',rows);line.className='guided-row';line.dataset.guidedLine=String(row.index);make('span',line,String(row.index+1)).className='guided-line-number';
    if(row.kind==='header'){make('span',line,row.keyword);chip(line,row,'direction',row.direction,['TD','TB','BT','LR','RL']);}
    else if(row.kind==='block'){chip(line,row,'id',row.id);chip(line,row,'label',row.label);chip(line,row,'shape',row.shape,window.SirenNativeGuided.shapes);}
    else if(row.kind==='link'){chip(line,row,'fromId',row.fromId);if(row.fromToken)chip(line,row,'fromLabel',row.fromLabel);chip(line,row,'arrow',row.arrow,['<-->','-.->','-.-','==>','===','--o','--x','-->','---','~~~']);chip(line,row,'label',row.label);chip(line,row,'toId',row.toId);if(row.toToken)chip(line,row,'toLabel',row.toLabel);}
    else if(row.kind==='note')chip(line,row,'body',row.body);
    else chip(line,row,'text',row.text);
   }
  }
  return Object.freeze({paint,beginExternalInteraction,isEditing:()=>editing!==null,commit:()=>{if(editing?.composing)return false;retireExternal();return editing?editing.finish(true):true;},reset:()=>{page=0;paint();},pause:()=>{retireExternal();if(!editing)host.replaceChildren();},dispose:()=>{retireExternal();disposed=true;editing=null;host.replaceChildren();}});
 }});
})();
