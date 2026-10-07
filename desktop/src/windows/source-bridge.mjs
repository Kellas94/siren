import {normalizeSourceRequest} from '../sources/ipc.mjs';
const fail=code=>Object.freeze({ok:false,code});
const methods=new Set(['getMetrics','readRange']);

/** Read-only production transport prerequisite. No writable source intent or
 * caller-supplied native identity is accepted; owner derives project/permissions.
 * Native editor and all-view transition admission remains a separate step. */
export async function invokeSourceRead({event,method,payload:input,registry,owner,referenceFor}) {
  if(typeof method!=='string'||!methods.has(method))return fail('REQUEST_REFUSED');
  let payload;
  try{payload=normalizeSourceRequest(method,input);}catch{return fail('REQUEST_REFUSED');}
  if(!payload||!Object.hasOwn(payload,'version'))return fail('REQUEST_REFUSED');
  let grant;
  try{
    grant=registry.capture(Object.freeze({sender:event?.sender,senderFrame:event?.senderFrame}));
    const entry=grant?.role==='workspace'?'siren://app/app.html':grant?.role==='code'?`siren://app/windows/code.html?windowId=${grant.windowId}`:null;
    if(!grant||!entry||grant.mainFrameUrl!==entry||!registry.isCurrent(grant))return fail('ACCESS_REFUSED');
    const ref=referenceFor?.(grant,payload);
    if(!ref||ref.sourceId!==payload.sourceId||ref.version!==payload.version||!/^([a-f0-9]{64})$/.test(ref.sha256))return fail('ACCESS_REFUSED');
    const result=await owner.invoke(grant,{kind:'source',method,payload});
    const current=referenceFor?.(grant,payload);
    if(!registry.isCurrent(grant)||!current||current.sourceId!==ref.sourceId||current.version!==ref.version||current.sha256!==ref.sha256)return fail('ACCESS_REFUSED');
    return result.ok&&method==='getMetrics'&&result.sha256!==ref.sha256?fail('SOURCE_RESULT_REFUSED'):result;
  }catch{return fail('SOURCE_READ_FAILED');}
}

/** Native write transport boundary. Admission is separate from readonly reads:
 * only an unpinned genuine Code view and main-owned edit policy may mutate.
 * The optional drain nonce is passed by the private native control adapter,
 * never decoded from renderer source payloads. Saving a source does not link it
 * to Docs or replace the selected project manifest. */
export async function invokeSourceMutation({event,method,payload:input,registry,owner,canEdit,flushNonce}) {
 if(!['applyEdit','commitSource'].includes(method))return fail('REQUEST_REFUSED');
 let payload;try{payload=normalizeSourceRequest(method,input);}catch{return fail('REQUEST_REFUSED');}
 if(!payload)return fail('REQUEST_REFUSED');
 let grant,sender,frame;
 try{
  sender=event?.sender;frame=event?.senderFrame;
  grant=registry.capture(Object.freeze({sender,senderFrame:frame}));
  const current=()=>{
   if(!grant||grant.role!=='code'||event.sender!==sender||event.senderFrame!==frame||!registry.isCurrent(grant)||
      grant.mainFrameUrl!==`siren://app/windows/code.html?windowId=${grant.windowId}`||!grant.entityIds.includes(payload.sourceId))return false;
   const source=registry.sourceScope(grant);
   return source?.sourceId===payload.sourceId&&!Object.hasOwn(source,'version')&&typeof canEdit==='function'&&canEdit(grant,payload)===true;
  };
  if(!current())return fail('ACCESS_REFUSED');
  const result=await owner.invoke(grant,{kind:'source',method,payload},flushNonce);
  return current()?result:fail('ACCESS_REFUSED');
 }catch{return fail('SOURCE_WRITE_FAILED');}
}
