(() => {
 'use strict';
 const fail=code=>Object.freeze({ok:false,code}),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
 window.SirenNativeDocsDraft=Object.freeze({create({context,bridge,onChange=()=>{},operationId=()=>crypto.randomUUID()}){
  if(context?.ok!==true||typeof context.readonly!=='boolean'||!context.document?.id||!hash(context.version)||!hash(context.sha256))throw TypeError('Exact native document required');
  let document=structuredClone(context.document),version=context.version,sha256=context.sha256,projectRevision=context.projectRevision??0;
  let content={title:document.title??'',blocks:structuredClone(document.blocks??[])},dirty=false,paused=false,fenced=false,disposed=false,pending=null;
  let undo=[],redo=[],group=null,groupAt=0,historyLimited=false;
  const editable=()=>!disposed&&!paused&&!pending&&!fenced&&!context.readonly;
  const resetHistory=()=>{undo=[];redo=[];group=null;groupAt=0;historyLimited=false;};
  const trimHistory=()=>{while(undo.length+redo.length>60||[...undo,...redo].reduce((n,s)=>n+s.length*2,0)>4*1024*1024){if(undo.length)undo.shift();else redo.shift();}};
  const updateDirty=()=>{dirty=JSON.stringify(content)!==JSON.stringify({title:document.title??'',blocks:document.blocks??[]});};
  const status=()=>Object.freeze({documentId:document.id,version,sha256,projectRevision,dirty,paused,fenced,disposed,pending:pending!==null,readonly:context.readonly,canUndo:editable()&&undo.length>0,canRedo:editable()&&redo.length>0,historyLimited});
  const changed=()=>{try{onChange(status());}catch{/* View observers cannot change save acceptance. */}};
  const moveHistory=(from,to)=>{if(!editable()||!from.length)return fail('DOCUMENT_HISTORY_UNAVAILABLE');const previous=JSON.stringify(content),next=from.pop();to.push(previous);trimHistory();content=JSON.parse(next);group=null;updateDirty();changed();return Object.freeze({ok:true});};
  async function accepted(value,request,applying,expected){
   return value?.ok===true&&value.domain==='docs'&&value.entityId===document.id&&hash(value.version)&&hash(value.sha256)&&Number.isSafeInteger(value.projectRevision)&&value.projectRevision>=projectRevision&&['committed','recovery-degraded'].includes(value.durability)&&
    (applying?value.operationId===request.operationId&&value.version!==request.expectedVersion:value.version===request.expectedVersion)&&value.sha256===await fingerprint(expected);
  }
  async function save(prepare=false){
   if(disposed||context.readonly||fenced||paused&&!prepare)return fail(fenced?'DOCUMENT_FENCED':'ACCESS_REFUSED');
   if(pending)return pending;if(!dirty)return Object.freeze({ok:true,unchanged:true});
   group=null;
   const payload=structuredClone(content),request={operationId:operationId(),documentId:document.id,expectedVersion:version,action:'replace-content',payload},expected={...document,...payload};
   const own=(async()=>{
    let receipt;try{receipt=await bridge.applyDocument(request);}catch{fenced=true;return fail('DOCUMENT_SAVE_FAILED');}
    if(disposed)return fail('VIEW_DISPOSED');
    if(receipt?.ok===false&&receipt.code==='DOMAIN_VALIDATION_FAILED')return fail(receipt.code);
    let verified=false;try{verified=await accepted(receipt,request,true,expected);}catch{/* Unknown commit cannot grant retry authority. */}
    if(!verified){fenced=true;return fail(receipt?.ok===false&&typeof receipt.code==='string'?receipt.code:'DOCUMENT_RESULT_REFUSED');}
    if(disposed)return fail('VIEW_DISPOSED');document=expected;version=receipt.version;sha256=receipt.sha256;projectRevision=receipt.projectRevision;dirty=false;return receipt;
   })();pending=own;changed();try{return await own;}finally{if(pending===own)pending=null;changed();}
  }
  return Object.freeze({
   getStatus:status,getContent:()=>structuredClone(content),getDocument:()=>structuredClone({...document,...content}),
   setContent(value,{historyGroup=null}={}){
    if(!editable())return fail('DOCUMENT_NOT_EDITABLE');let next,nextJSON;try{next=structuredClone(value);nextJSON=JSON.stringify(next);}catch{return fail('INVALID_CONTENT');}
    const previous=JSON.stringify(content);if(previous===nextJSON)return Object.freeze({ok:true});
    const key=typeof historyGroup==='string'&&historyGroup.length<=160?historyGroup:null,now=Date.now();
    if(Math.max(previous.length,nextJSON.length)*2>4*1024*1024){resetHistory();historyLimited=true;}else{historyLimited=false;redo=[];if(!key||group!==key||now-groupAt>1000)undo.push(previous);trimHistory();group=key;groupAt=now;}
    content=next;updateDirty();changed();return Object.freeze({ok:true});
   },
   undo:()=>moveHistory(undo,redo),redo:()=>moveHistory(redo,undo),
   save:()=>save(),
   async flushView(){
    if(disposed||context.readonly)return fail('ACCESS_REFUSED');paused=true;changed();if(pending)await pending;
    if(fenced)return fail('DOCUMENT_FENCED');if(dirty){const saved=await save(true);if(!saved.ok)return saved;}
    for(let attempt=0;attempt<2;attempt++){
    if(typeof bridge.getDocument==='function'){
     // Local changes have already been genuinely saved. Reading a later clean
     // entity under the private ticket never retries a stale content mutation.
     let latest;try{latest=await bridge.getDocument();if(latest?.ok===false&&typeof latest.code==='string')return fail(latest.code);if(disposed||latest?.ok!==true||latest.readonly!==false||latest.document?.id!==document.id||!hash(latest.version)||!hash(latest.sha256)||!Number.isSafeInteger(latest.projectRevision)||latest.projectRevision<projectRevision||latest.sha256!==await fingerprint(latest.document))throw Error('Invalid native document');}catch{return fail('DOCUMENT_REFRESH_REFUSED');}
     if(disposed)return fail('VIEW_DISPOSED');const next={title:latest.document.title??'',blocks:structuredClone(latest.document.blocks??[])};if(JSON.stringify(next)!==JSON.stringify(content))resetHistory();document=structuredClone(latest.document);content=next;version=latest.version;sha256=latest.sha256;projectRevision=latest.projectRevision;changed();
    }
    const request={entityId:document.id,expectedVersion:version};let receipt;
    try{receipt=await bridge.flushDocument(request);}catch{return fail('DOCUMENT_FLUSH_FAILED');}
    if(receipt?.ok===false&&receipt.code==='DOCUMENT_CONFLICT'&&typeof bridge.getDocument==='function'){if(attempt===0)continue;return fail(receipt.code);}
    let verified=false;try{verified=await accepted(receipt,request,false,document);}catch{/* Refuse unverified durability. */}
    if(disposed||!verified)return fail(receipt?.ok===false?receipt.code:'DOCUMENT_RESULT_REFUSED');return receipt;
    }
   },
   resumeView(){if(disposed)return fail('VIEW_DISPOSED');paused=false;changed();return Object.freeze({ok:true});},
   dispose(){disposed=true;paused=true;resetHistory();changed();},
  });
 }});
})();
