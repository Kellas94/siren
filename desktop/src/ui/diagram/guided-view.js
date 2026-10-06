(() => {
 'use strict';
 window.SirenNativeGuidedView=Object.freeze({create({host,sourceFor,editable,onSource,onStatus}){
  let page=0,disposed=false,editing=null;
  const make=(tag,parent,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;parent.append(element);return element;};
  function edit(button,row,field,value,choices){
   if(disposed||!editable()||editing)return;
   const input=document.createElement(choices?'select':'input');input.setAttribute('aria-label','Line '+(row.index+1)+' '+field);input.dataset.guidedInput=field;
   if(choices)for(const choice of choices){const option=make('option',input,choice);option.value=choice;}
   else{input.type='text';input.maxLength=512;}
   input.value=value;button.replaceWith(input);
   let closed=false;const finish=(apply,restoreFocus=true)=>{
    if(closed)return true;
    if(apply&&input.value!==value){const result=editable()?window.SirenNativeGuided.edit(sourceFor(),{index:row.index,expectedLine:row.text,field,value:input.value}):{ok:false};
     if(result.ok&&onSource(result.source)===true)onStatus('Guided edit · Save explicitly with Ctrl+S');else{input.setAttribute('aria-invalid','true');input.title='Correct this field or press Esc to cancel. Your source is retained.';onStatus('The line changed or cannot be edited. Your current Mermaid source and field are retained.');return false;}
    }
    closed=true;editing=null;
    paint();if(restoreFocus)host.querySelector('[data-line="'+row.index+'"][data-field="'+field+'"]')?.focus();
    return true;
   };
   editing={input,finish};onStatus('Editing Guided field · Enter to apply · Esc to cancel · Ctrl+S to save');
   input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();finish(true);}else if(event.key==='Escape'){event.preventDefault();finish(false);}});
   input.addEventListener('blur',()=>finish(true,false));if(choices)input.addEventListener('change',()=>finish(true));input.focus();input.select?.();
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
  return Object.freeze({paint,isEditing:()=>editing!==null,commit:()=>editing?editing.finish(true):true,reset:()=>{page=0;paint();},pause:()=>{if(!editing)host.replaceChildren();},dispose:()=>{disposed=true;editing=null;host.replaceChildren();}});
 }});
})();
