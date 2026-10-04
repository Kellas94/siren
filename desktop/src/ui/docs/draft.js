(() => {
 'use strict';
 const fail=code=>Object.freeze({ok:false,code}),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 window.SirenNativeDocsDraft=Object.freeze({create({context,bridge,onChange=()=>{},operationId=()=>crypto.randomUUID()}){
  if(context?.ok!==true||typeof context.readonly!=='boolean'||!context.document?.id||!hash(context.version)||!hash(context.sha256))throw TypeError('Exact native document required');
  let document=structuredClone(context.document),version=context.version,sha256=context.sha256,projectRevision=context.projectRevision??0;
  let content={title:document.title??'',blocks:structuredClone(document.blocks??[])},dirty=false,paused=false,fenced=false,disposed=false,pending=null;
  const status=()=>Object.freeze({documentId:document.id,version,sha256,projectRevision,dirty,paused,fenced,disposed,pending:pending!==null,readonly:context.readonly});
  const changed=()=>{try{onChange(status());}catch{/* View observers cannot change save acceptance. */}};
  function accepted(value,request,applying){
   return value?.ok===true&&value.domain==='docs'&&value.entityId===document.id&&hash(value.version)&&hash(value.sha256)&&Number.isSafeInteger(value.projectRevision)&&value.projectRevision>=projectRevision&&['committed','recovery-degraded'].includes(value.durability)&&
    (applying?value.operationId===request.operationId:value.version===request.expectedVersion);
  }
  async function save(prepare=false){
   if(disposed||context.readonly||fenced||paused&&!prepare)return fail(fenced?'DOCUMENT_FENCED':'ACCESS_REFUSED');
   if(pending)return pending;if(!dirty)return Object.freeze({ok:true,unchanged:true});
   const payload=structuredClone(content),request={operationId:operationId(),documentId:document.id,expectedVersion:version,action:'replace-content',payload};
   const own=(async()=>{
    let receipt;try{receipt=await bridge.applyDocument(request);}catch{return fail('DOCUMENT_SAVE_FAILED');}
    if(disposed)return fail('VIEW_DISPOSED');
    if(!accepted(receipt,request,true)){fenced=true;return fail(receipt?.ok===false&&typeof receipt.code==='string'?receipt.code:'DOCUMENT_RESULT_REFUSED');}
    document={...document,...payload};version=receipt.version;sha256=receipt.sha256;projectRevision=receipt.projectRevision;dirty=false;return receipt;
   })();pending=own;changed();try{return await own;}finally{if(pending===own)pending=null;changed();}
  }
  return Object.freeze({
   getStatus:status,getContent:()=>structuredClone(content),getDocument:()=>structuredClone({...document,...content}),
   setContent(value){if(disposed||paused||pending||fenced||context.readonly)return fail('DOCUMENT_NOT_EDITABLE');try{content=structuredClone(value);}catch{return fail('INVALID_CONTENT');}dirty=JSON.stringify(content)!==JSON.stringify({title:document.title??'',blocks:document.blocks??[]});changed();return Object.freeze({ok:true});},
   save:()=>save(),
   async flushView(){
    if(disposed||context.readonly)return fail('ACCESS_REFUSED');paused=true;changed();if(pending)await pending;
    if(fenced)return fail('DOCUMENT_FENCED');if(dirty){const saved=await save(true);if(!saved.ok)return saved;}
    const request={entityId:document.id,expectedVersion:version};let receipt;
    try{receipt=await bridge.flushDocument(request);}catch{return fail('DOCUMENT_FLUSH_FAILED');}
    if(disposed||!accepted(receipt,request,false))return fail(receipt?.ok===false?receipt.code:'DOCUMENT_RESULT_REFUSED');return receipt;
   },
   resumeView(){if(disposed)return fail('VIEW_DISPOSED');paused=false;changed();return Object.freeze({ok:true});},
   dispose(){disposed=true;paused=true;changed();},
  });
 }});
})();
