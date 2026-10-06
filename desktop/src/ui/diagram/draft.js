(() => {
 'use strict';
 const fail=code=>Object.freeze({ok:false,code}),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
 window.SirenNativeDiagramDraft=Object.freeze({create({context,bridge,onChange=()=>{},operationId=()=>crypto.randomUUID()}){
  if(context?.ok!==true||typeof context.readonly!=='boolean'||!context.diagram?.id||typeof context.diagram.source!=='string'||!Number.isSafeInteger(context.version)||context.version<1||!hash(context.sha256))throw TypeError('Exact native Diagram required');
  let diagram=structuredClone(context.diagram),source=diagram.source,stylePatch={},version=context.version,sha256=context.sha256,projectRevision=context.projectRevision??0;
  let dirty=false,paused=false,fenced=false,disposed=false,pending=null;
  let presentationEdits=[];
  const actualDiagram=()=>({...diagram,source,...stylePatch,...(presentationEdits.length?{presentation:window.SirenPresentationEdits.applyPresentationEdits(diagram.presentation,presentationEdits)}:{})});
  const status=()=>Object.freeze({diagramId:diagram.id,version,sha256,projectRevision,dirty,paused,fenced,disposed,pending:pending!==null,readonly:context.readonly});
  const changed=()=>{try{onChange(status());}catch{/* Observers do not grant save authority. */}};
  const reconcile=()=>{dirty=source!==diagram.source||Object.keys(stylePatch).length>0||presentationEdits.length>0;};
  const fonts=['Inter','Arial','Tahoma','Verdana','Georgia','Trebuchet MS','Courier New','Times New Roman'],weights=[400,500,600,700,800];
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
       else throw Error('Invalid style');node[field]=v;
      }Object.defineProperty(result[key],id,{value:node,enumerable:true,writable:true,configurable:true});
     }
    }else{if(!['fontFamily','fontSize','fontWeight','diagramTitle','diagramTitleTouched'].includes(key))throw Error('Invalid style');result[key]=value;}
   }return result;
  }
  async function accepted(receipt,request,applying,expected){
   return receipt?.ok===true&&receipt.domain==='diagram'&&receipt.entityId===diagram.id&&receipt.version===request.expectedVersion+(applying?1:0)&&hash(receipt.sha256)&&Number.isSafeInteger(receipt.projectRevision)&&receipt.projectRevision>=projectRevision&&['committed','recovery-degraded'].includes(receipt.durability)&&(!applying||receipt.operationId===request.operationId)&&receipt.sha256===await fingerprint(expected);
  }
  async function save(preparing=false){
   if(disposed||context.readonly||fenced||paused&&!preparing)return fail(fenced?'DIAGRAM_FENCED':'ACCESS_REFUSED');
   if(pending)return pending;if(!dirty)return Object.freeze({ok:true,unchanged:true});
   const request={diagramId:diagram.id,expectedVersion:version,operationId:operationId(),action:presentationEdits.length?'replace-deck-content':Object.keys(stylePatch).length?'replace-content':'replace-source',payload:{source,...stylePatch,...(presentationEdits.length?{presentationEdits:structuredClone(presentationEdits)}:{})}},expected={...actualDiagram(),sirenNativeVersion:version+1};
   const own=(async()=>{
    let receipt;try{receipt=await bridge.applyDiagram(request);}catch{fenced=true;return fail('DIAGRAM_SAVE_FAILED');}
    if(disposed)return fail('VIEW_DISPOSED');
    if(receipt?.ok===false&&receipt.code==='DOMAIN_VALIDATION_FAILED')return fail(receipt.code);
    let verified=false;try{verified=await accepted(receipt,request,true,expected);}catch{/* Uncertain commit cannot grant retry authority. */}
    if(!verified){fenced=true;return fail(receipt?.ok===false&&typeof receipt.code==='string'?receipt.code:'DIAGRAM_RESULT_REFUSED');}
    if(disposed)return fail('VIEW_DISPOSED');diagram=expected;stylePatch={};presentationEdits=[];version=receipt.version;sha256=receipt.sha256;projectRevision=receipt.projectRevision;dirty=false;return receipt;
   })();pending=own;changed();try{return await own;}finally{if(pending===own)pending=null;changed();}
  }
  return Object.freeze({
   getStatus:status,getDiagram:()=>structuredClone(actualDiagram()),
   editPresentation(input){if(disposed||paused||pending||fenced||context.readonly)return fail('DIAGRAM_NOT_EDITABLE');let next;try{const op=window.SirenPresentationEdits.normalizePresentationEdits([input])[0];next=structuredClone(presentationEdits);const last=next.at(-1);if(last?.action==='update'&&op.action==='update'&&last.id===op.id)last.changes={...last.changes,...op.changes};else next.push(op);const result=window.SirenPresentationEdits.applyPresentationEdits(diagram.presentation,next);if(JSON.stringify(result)===JSON.stringify(diagram.presentation))next=[];}catch{return fail('PRESENTATION_EDIT_REFUSED');}presentationEdits=next;reconcile();changed();return Object.freeze({ok:true});},
   setSource(value){if(disposed||paused||pending||fenced||context.readonly)return fail('DIAGRAM_NOT_EDITABLE');if(typeof value!=='string'||!value.isWellFormed())return fail('INVALID_SOURCE');source=value;reconcile();changed();return Object.freeze({ok:true});},
   setStyle(input){if(disposed||paused||pending||fenced||context.readonly)return fail('DIAGRAM_NOT_EDITABLE');let patch;try{patch=styleCopy(input);}catch{return fail('INVALID_STYLE');}for(const [key,value]of Object.entries(patch)){if(JSON.stringify(value)===JSON.stringify(diagram[key]))delete stylePatch[key];else stylePatch[key]=value;}reconcile();changed();return Object.freeze({ok:true});},
   save:()=>save(),
   async flushView(){
    if(disposed||context.readonly)return fail('ACCESS_REFUSED');paused=true;changed();if(pending)await pending;
    if(fenced)return fail('DIAGRAM_FENCED');if(dirty){const result=await save(true);if(!result.ok)return result;}
    for(let attempt=0;attempt<2;attempt++){
    if(typeof bridge.getDiagram==='function'){
     // All local edits are already durably accepted. A genuine preparing read
     // can adopt a later saved entity, but can never retry an unsaved conflict.
     let latest;try{latest=await bridge.getDiagram();if(latest?.ok===false&&typeof latest.code==='string')return fail(latest.code);if(disposed||latest?.ok!==true||latest.readonly!==false||latest.diagram?.id!==diagram.id||!Number.isSafeInteger(latest.version)||latest.version<version||!Number.isSafeInteger(latest.projectRevision)||latest.projectRevision<projectRevision||!hash(latest.sha256)||typeof latest.diagram.source!=='string'||latest.sha256!==await fingerprint(latest.diagram))throw Error('Invalid native Diagram');}catch{return fail('DIAGRAM_REFRESH_REFUSED');}
     if(disposed)return fail('VIEW_DISPOSED');diagram=structuredClone(latest.diagram);source=diagram.source;version=latest.version;sha256=latest.sha256;projectRevision=latest.projectRevision;changed();
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
   dispose(){disposed=true;paused=true;changed();},
  });
 }});
})();
