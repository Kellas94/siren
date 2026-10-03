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
