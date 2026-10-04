(() => {
 'use strict';
 const fail=code=>Object.freeze({ok:false,code}),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
 window.SirenNativeDiagramDraft=Object.freeze({create({context,bridge,onChange=()=>{},operationId=()=>crypto.randomUUID()}){
  if(context?.ok!==true||typeof context.readonly!=='boolean'||!context.diagram?.id||typeof context.diagram.source!=='string'||!Number.isSafeInteger(context.version)||context.version<1||!hash(context.sha256))throw TypeError('Exact native Diagram required');
  let diagram=structuredClone(context.diagram),source=diagram.source,version=context.version,sha256=context.sha256,projectRevision=context.projectRevision??0;
  let dirty=false,paused=false,fenced=false,disposed=false,pending=null;
  const status=()=>Object.freeze({diagramId:diagram.id,version,sha256,projectRevision,dirty,paused,fenced,disposed,pending:pending!==null,readonly:context.readonly});
  const changed=()=>{try{onChange(status());}catch{/* Observers do not grant save authority. */}};
  async function accepted(receipt,request,applying,expected){
   return receipt?.ok===true&&receipt.domain==='diagram'&&receipt.entityId===diagram.id&&receipt.version===request.expectedVersion+(applying?1:0)&&hash(receipt.sha256)&&Number.isSafeInteger(receipt.projectRevision)&&receipt.projectRevision>=projectRevision&&['committed','recovery-degraded'].includes(receipt.durability)&&(!applying||receipt.operationId===request.operationId)&&receipt.sha256===await fingerprint(expected);
  }
  async function save(preparing=false){
   if(disposed||context.readonly||fenced||paused&&!preparing)return fail(fenced?'DIAGRAM_FENCED':'ACCESS_REFUSED');
   if(pending)return pending;if(!dirty)return Object.freeze({ok:true,unchanged:true});
   const request={diagramId:diagram.id,expectedVersion:version,operationId:operationId(),action:'replace-source',payload:{source}},expected={...diagram,source,sirenNativeVersion:version+1};
   const own=(async()=>{
    let receipt;try{receipt=await bridge.applyDiagram(request);}catch{fenced=true;return fail('DIAGRAM_SAVE_FAILED');}
    if(disposed)return fail('VIEW_DISPOSED');
    if(receipt?.ok===false&&receipt.code==='DOMAIN_VALIDATION_FAILED')return fail(receipt.code);
    let verified=false;try{verified=await accepted(receipt,request,true,expected);}catch{/* Uncertain commit cannot grant retry authority. */}
    if(!verified){fenced=true;return fail(receipt?.ok===false&&typeof receipt.code==='string'?receipt.code:'DIAGRAM_RESULT_REFUSED');}
    if(disposed)return fail('VIEW_DISPOSED');diagram=expected;version=receipt.version;sha256=receipt.sha256;projectRevision=receipt.projectRevision;dirty=false;return receipt;
   })();pending=own;changed();try{return await own;}finally{if(pending===own)pending=null;changed();}
  }
  return Object.freeze({
   getStatus:status,getDiagram:()=>structuredClone({...diagram,source}),
   setSource(value){if(disposed||paused||pending||fenced||context.readonly)return fail('DIAGRAM_NOT_EDITABLE');if(typeof value!=='string'||!value.isWellFormed())return fail('INVALID_SOURCE');source=value;dirty=source!==diagram.source;changed();return Object.freeze({ok:true});},
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
