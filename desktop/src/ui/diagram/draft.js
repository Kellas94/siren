(() => {
 'use strict';
 const fail=code=>Object.freeze({ok:false,code}),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
 window.SirenNativeDiagramDraft=Object.freeze({create({context,bridge,onChange=()=>{},operationId=()=>crypto.randomUUID(),now=()=>Date.now()}){
  if(context?.ok!==true||typeof context.readonly!=='boolean'||!context.diagram?.id||typeof context.diagram.source!=='string'||!Number.isSafeInteger(context.version)||context.version<1||!hash(context.sha256))throw TypeError('Exact native Diagram required');
  let diagram=structuredClone(context.diagram),source=diagram.source,stylePatch={},version=context.version,sha256=context.sha256,projectRevision=context.projectRevision??0;
  let dirty=false,paused=false,fenced=false,disposed=false,pending=null;
  let presentationEdits=[],styleRemovals=[];
  const actualDiagram=()=>{const value={...diagram,source,...stylePatch,...(presentationEdits.length?{presentation:window.SirenPresentationEdits.applyPresentationEdits(diagram.presentation,presentationEdits)}:{})};for(const key of styleRemovals)delete value[key];return value;};
  const status=()=>Object.freeze({diagramId:diagram.id,version,sha256,projectRevision,dirty,paused,fenced,disposed,pending:pending!==null,readonly:context.readonly});
  const changed=()=>{try{onChange(status());}catch{/* Observers do not grant save authority. */}};
  const reconcile=()=>{dirty=source!==diagram.source||Object.keys(stylePatch).length>0||styleRemovals.length>0||presentationEdits.length>0;};
  const historyFields=['fontFamily','fontSize','fontWeight','diagramTitle','diagramTitleTouched','nodeStyles','nodeMetadata'],limitStates=60,limitBytes=8*1024*1024;
  let history=[],historyIndex=-1,historyBytes=0,historySequence=0,coalescing=null;
  const editable=()=>!disposed&&!paused&&!pending&&!fenced&&!context.readonly;
  const snapshot=()=>{const value=actualDiagram(),style={};for(const key of historyFields)if(Object.hasOwn(value,key))style[key]=structuredClone(value[key]);return{source,style};};
  function recordHistory(label,coalesce=false){
   const value=snapshot(),key=JSON.stringify(value),bytes=new TextEncoder().encode(key).length,time=now();
   if(history[historyIndex]?.key===key)return;
   if(bytes>limitBytes){history=[{id:'edit-'+(++historySequence),label:'Current edit · history limit',value:null,key:null,bytes:0}];historyIndex=0;historyBytes=0;coalescing=null;return;}
   if(history[historyIndex]?.value===null){history=[];historyIndex=-1;historyBytes=0;}
   history=history.slice(0,historyIndex+1);historyBytes=history.reduce((sum,e)=>sum+e.bytes,0);
   const merge=coalesce&&coalescing!==null&&time>=coalescing&&time-coalescing<=750&&historyIndex>0;
   if(merge){historyBytes-=history[historyIndex].bytes;history.pop();historyIndex--;}
   history.push({id:'edit-'+(++historySequence),label:typeof label==='string'?label.slice(0,80):'Edit diagram',value,key,bytes});historyBytes+=bytes;historyIndex=history.length-1;coalescing=coalesce?time:null;
   while(history.length>1&&(history.length>limitStates||historyBytes>limitBytes)){historyBytes-=history.shift().bytes;historyIndex--;}
  }
  const resetHistory=()=>{history=[];historyIndex=-1;historyBytes=0;coalescing=null;recordHistory('Opened diagram');};
  function restoreHistory(id){
   if(!editable())return fail('DIAGRAM_NOT_EDITABLE');const index=history.findIndex(e=>e.id===id);
   if(index<0||index===historyIndex||!history[index].value)return fail('DIAGRAM_HISTORY_REFUSED');
   const value=history[index].value;source=value.source;stylePatch={};styleRemovals=[];
   for(const key of historyFields){if(!Object.hasOwn(value.style,key)){if(Object.hasOwn(diagram,key))styleRemovals.push(key);}else if(!Object.hasOwn(diagram,key)||JSON.stringify(value.style[key])!==JSON.stringify(diagram[key]))stylePatch[key]=structuredClone(value.style[key]);}
   historyIndex=index;coalescing=null;reconcile();changed();return Object.freeze({ok:true});
  }
  resetHistory();
  const fonts=['Inter','Arial','Tahoma','Verdana','Georgia','Trebuchet MS','Courier New','Times New Roman'],weights=[400,500,600,700,800];
  function ownData(value,budget={nodes:0,chars:0},depth=0){
   if(++budget.nodes>50000||depth>32)throw Error('Invalid style');if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;if(typeof value==='string'){if(!value.isWellFormed()||(budget.chars+=value.length)>2*1024*1024)throw Error('Invalid style');return value;}if(!value||typeof value!=='object')throw Error('Invalid style');
   const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);if(Array.isArray(value)){const length=descriptors.length.value;if(length>50000||keys.length!==length+1)throw Error('Invalid style');return Array.from({length},(_,i)=>{const d=descriptors[i];if(!d||!('value'in d))throw Error('Invalid style');return ownData(d.value,budget,depth+1);});}
   return Object.fromEntries(keys.map(key=>{const d=descriptors[key];if(typeof key!=='string'||!d.enumerable||!('value'in d))throw Error('Invalid style');return[key,ownData(d.value,budget,depth+1)];}));
  }
  function styleCopy(input){
   if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid style');
   const descriptors=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(descriptors),result={};
   if(!keys.length||keys.length>6)throw Error('Invalid style');
   for(const key of keys){const descriptor=descriptors[key];if(typeof key!=='string'||!descriptor.enumerable||!('value'in descriptor))throw Error('Invalid style');const value=descriptor.value;
    if(key==='fontFamily'&&!fonts.includes(value)||key==='fontSize'&&(!Number.isInteger(value)||value<10||value>28)||key==='fontWeight'&&!weights.includes(value)||key==='diagramTitle'&&(typeof value!=='string'||!value.isWellFormed()||value.length>160)||key==='diagramTitleTouched'&&typeof value!=='boolean')throw Error('Invalid style');
    if(key==='nodeStyles'){
     if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid style');const nodes=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(nodes).length>250)throw Error('Invalid style');result[key]={};
     for(const id of Reflect.ownKeys(nodes)){const entry=nodes[id];if(typeof id!=='string'||!/^[A-Za-z_][\w.-]*$/.test(id)||!entry.enumerable||!('value'in entry)||!entry.value||typeof entry.value!=='object'||Array.isArray(entry.value))throw Error('Invalid style');const fields=Object.getOwnPropertyDescriptors(entry.value),node={};
      for(const field of Reflect.ownKeys(fields)){const item=fields[field];if(typeof field!=='string'||!item.enumerable||!('value'in item))throw Error('Invalid style');const v=item.value;
       if(['fill','border','text'].includes(field)){if(typeof v!=='string'||!/^#[a-f0-9]{6}$/i.test(v))throw Error('Invalid style');}
       else if(field==='fontFamily'){if(v!=='inherit'&&!fonts.includes(v))throw Error('Invalid style');}
       else if(field==='fontSize'){if(!Number.isInteger(v)||v<9||v>28)throw Error('Invalid style');}
       else if(field==='fontWeight'){if(v!=='inherit'&&!weights.includes(v))throw Error('Invalid style');}
       else{const existing=actualDiagram().nodeStyles?.[id];if(!existing||!Object.hasOwn(existing,field))throw Error('Invalid style');const copied=ownData(v);if(JSON.stringify(copied)!==JSON.stringify(existing[field]))throw Error('Invalid style');node[field]=copied;continue;}node[field]=v;
      }Object.defineProperty(result[key],id,{value:node,enumerable:true,writable:true,configurable:true});
     }
     for(const [id,prior]of Object.entries(actualDiagram().nodeStyles||{}))for(const field of Object.keys(prior||{}))if(!['fill','border','text','fontFamily','fontSize','fontWeight'].includes(field)&&!Object.hasOwn(result[key][id]||{},field))throw Error('Invalid style');
    }else{if(!['fontFamily','fontSize','fontWeight','diagramTitle','diagramTitleTouched'].includes(key))throw Error('Invalid style');result[key]=value;}
   }return result;
  }
  async function accepted(receipt,request,applying,expected){
   return receipt?.ok===true&&receipt.domain==='diagram'&&receipt.entityId===diagram.id&&receipt.version===request.expectedVersion+(applying?1:0)&&hash(receipt.sha256)&&Number.isSafeInteger(receipt.projectRevision)&&receipt.projectRevision>=projectRevision&&['committed','recovery-degraded'].includes(receipt.durability)&&(!applying||receipt.operationId===request.operationId)&&receipt.sha256===await fingerprint(expected);
  }
  async function save(preparing=false){
   if(disposed||context.readonly||fenced||paused&&!preparing)return fail(fenced?'DIAGRAM_FENCED':'ACCESS_REFUSED');
   if(pending)return pending;if(!dirty)return Object.freeze({ok:true,unchanged:true});
   coalescing=null;
   const request={diagramId:diagram.id,expectedVersion:version,operationId:operationId(),action:presentationEdits.length?'replace-deck-content':Object.keys(stylePatch).length||styleRemovals.length?'replace-content':'replace-source',payload:{source,...stylePatch,...(styleRemovals.length?{resetStyleFields:[...styleRemovals]}:{}),...(presentationEdits.length?{presentationEdits:structuredClone(presentationEdits)}:{})}},expected={...actualDiagram(),sirenNativeVersion:version+1};
   const own=(async()=>{
    let receipt;try{receipt=await bridge.applyDiagram(request);}catch{fenced=true;return fail('DIAGRAM_SAVE_FAILED');}
    if(disposed)return fail('VIEW_DISPOSED');
    if(receipt?.ok===false&&receipt.code==='DOMAIN_VALIDATION_FAILED')return fail(receipt.code);
    let verified=false;try{verified=await accepted(receipt,request,true,expected);}catch{/* Uncertain commit cannot grant retry authority. */}
    if(!verified){fenced=true;return fail(receipt?.ok===false&&typeof receipt.code==='string'?receipt.code:'DIAGRAM_RESULT_REFUSED');}
    if(disposed)return fail('VIEW_DISPOSED');diagram=expected;stylePatch={};styleRemovals=[];presentationEdits=[];version=receipt.version;sha256=receipt.sha256;projectRevision=receipt.projectRevision;dirty=false;return receipt;
   })();pending=own;changed();try{return await own;}finally{if(pending===own)pending=null;changed();}
  }
  return Object.freeze({
   getStatus:status,getDiagram:()=>structuredClone(actualDiagram()),
   getHistory:()=>Object.freeze({index:historyIndex,entries:Object.freeze(history.map(e=>Object.freeze({id:e.id,label:e.label}))),bytes:historyBytes,limitBytes,limitStates}),restoreHistory,
   undo:()=>restoreHistory(history[historyIndex-1]?.id),redo:()=>restoreHistory(history[historyIndex+1]?.id),
   editPresentation(input){if(disposed||paused||pending||fenced||context.readonly)return fail('DIAGRAM_NOT_EDITABLE');let next;try{const op=window.SirenPresentationEdits.normalizePresentationEdits([input])[0];next=structuredClone(presentationEdits);const last=next.at(-1);if(last?.action==='update'&&op.action==='update'&&last.id===op.id)last.changes={...last.changes,...op.changes};else next.push(op);const result=window.SirenPresentationEdits.applyPresentationEdits(diagram.presentation,next);if(JSON.stringify(result)===JSON.stringify(diagram.presentation))next=[];}catch{return fail('PRESENTATION_EDIT_REFUSED');}presentationEdits=next;reconcile();changed();return Object.freeze({ok:true});},
   setSource(value,{label='Edit Mermaid',coalesce=false}={}){if(!editable())return fail('DIAGRAM_NOT_EDITABLE');if(typeof value!=='string'||!value.isWellFormed())return fail('INVALID_SOURCE');source=value;recordHistory(label,coalesce);reconcile();changed();return Object.freeze({ok:true});},
   setStyle(input,{label='Change style'}={}){if(!editable())return fail('DIAGRAM_NOT_EDITABLE');let patch;try{patch=styleCopy(input);}catch{return fail('INVALID_STYLE');}for(const [key,value]of Object.entries(patch)){styleRemovals=styleRemovals.filter(k=>k!==key);if(JSON.stringify(value)===JSON.stringify(diagram[key]))delete stylePatch[key];else stylePatch[key]=value;}recordHistory(label);reconcile();changed();return Object.freeze({ok:true});},
   editMetadata(input){
    if(!editable())return fail('DIAGRAM_NOT_EDITABLE');let next;
    try{next=window.SirenDiagramMetadata.update(actualDiagram().nodeMetadata,input);if(next!==undefined&&!Object.keys(next).length&&!Object.hasOwn(diagram,'nodeMetadata'))next=undefined;}catch{return fail('DIAGRAM_METADATA_REFUSED');}
    styleRemovals=styleRemovals.filter(k=>k!=='nodeMetadata');
    if(next===undefined){delete stylePatch.nodeMetadata;if(Object.hasOwn(diagram,'nodeMetadata'))styleRemovals.push('nodeMetadata');}
    else if(JSON.stringify(next)===JSON.stringify(diagram.nodeMetadata))delete stylePatch.nodeMetadata;else stylePatch.nodeMetadata=structuredClone(next);
    recordHistory('Annotate block');reconcile();changed();return Object.freeze({ok:true});
   },
   save:()=>save(),
   async flushView(){
    if(disposed||context.readonly)return fail('ACCESS_REFUSED');paused=true;changed();if(pending)await pending;
    if(fenced)return fail('DIAGRAM_FENCED');if(dirty){const result=await save(true);if(!result.ok)return result;}
    for(let attempt=0;attempt<2;attempt++){
    if(typeof bridge.getDiagram==='function'){
     // All local edits are already durably accepted. A genuine preparing read
     // can adopt a later saved entity, but can never retry an unsaved conflict.
     let latest;try{latest=await bridge.getDiagram();if(latest?.ok===false&&typeof latest.code==='string')return fail(latest.code);if(disposed||latest?.ok!==true||latest.readonly!==false||latest.diagram?.id!==diagram.id||!Number.isSafeInteger(latest.version)||latest.version<version||!Number.isSafeInteger(latest.projectRevision)||latest.projectRevision<projectRevision||!hash(latest.sha256)||typeof latest.diagram.source!=='string'||latest.sha256!==await fingerprint(latest.diagram))throw Error('Invalid native Diagram');}catch{return fail('DIAGRAM_REFRESH_REFUSED');}
     if(disposed)return fail('VIEW_DISPOSED');const adopted=latest.version!==version||latest.sha256!==sha256;diagram=structuredClone(latest.diagram);source=diagram.source;version=latest.version;sha256=latest.sha256;projectRevision=latest.projectRevision;if(adopted)resetHistory();changed();
    }
    const request={entityId:diagram.id,expectedVersion:version};let receipt;try{receipt=await bridge.flushDiagram(request);}catch{return fail('DIAGRAM_FLUSH_FAILED');}
    // A different captured window may have saved after the read was queued.
    // Recapture once only; this path invokes no source mutation at a fresh base.
    if(receipt?.ok===false&&receipt.code==='REVISION_CONFLICT'&&typeof bridge.getDiagram==='function'){if(attempt===0)continue;return fail(receipt.code);}
    let verified=false;try{verified=await accepted(receipt,request,false,diagram);}catch{/* Keep local source and refuse unverified durability. */}
    if(!verified||disposed){fenced=true;return fail(receipt?.ok===false?receipt.code:'DIAGRAM_RESULT_REFUSED');}return receipt;
    }
   },
   resumeView(){if(disposed)return fail('VIEW_DISPOSED');paused=false;changed();return Object.freeze({ok:true});},
   dispose(){disposed=true;paused=true;history=[];historyIndex=-1;historyBytes=0;coalescing=null;changed();},
  });
 }});
})();
