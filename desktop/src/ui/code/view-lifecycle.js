const failure=code=>Object.freeze({ok:false,code});
const same=(a,b)=>a && b && a.sourceId===b.sourceId && a.version===b.version && a.sha256===b.sha256;

/** Renderer-local preparation only. Main must independently seal native flush
 * receipts before changing authority or recording clean close. No Docs save,
 * grant retirement or Lock acknowledgement is established by this result. */
export function createCodeViewLifecycle({editor,client}={}) {
  const api={};
  for(const [name,object,keys] of [['editor',editor,['getStatus','pauseView','resumeView','flush']],['client',client,['getState','pauseView','resumeView','drain']]]) {
    api[name]={};for(const key of keys) {
      const descriptor=object && Object.getOwnPropertyDescriptor(object,key);
      if(typeof descriptor?.value!=='function')throw TypeError('INVALID_CODE_VIEW');
      api[name][key]=descriptor.value.bind(object);
    }
  }
  let preparing=null,busy=false,prepared=false;
  const ready=(receipt,readonly)=> {
    const status=api.editor.getStatus(),source=api.client.getState();
    return status.ready && status.paused && !status.disposed && !status.opening && !status.pending && !status.saving && !status.fenced && !status.dirty &&
      source.paused && !source.disposed && !source.fenced && !source.pending && same(status.sourceRef,source) &&
      status.readonly===readonly && (readonly || same(status.sourceRef,receipt));
  };
  function flushView() {
    if(preparing)return preparing;
    busy=true;
    const paused=api.editor.pauseView(); // Synchronous before the first await.
    preparing=(async()=>{
      if(paused?.ok!==true)return failure(paused?.code||'VIEW_PAUSE_FAILED');
      const initial=api.editor.getStatus();if(!initial.paused || initial.disposed || !initial.ready)return failure('VIEW_CHANGED');
      let receipt;
      if(!initial.readonly) {
        receipt=await api.editor.flush();
        if(receipt?.ok!==true)return failure(receipt?.code||'VIEW_FLUSH_FAILED');
        if(!['committed','recovery-degraded'].includes(receipt.durability))return failure('INVALID_RECEIPT');
      }
      const saved=api.editor.getStatus();
      if(!saved.paused || saved.disposed || saved.pending || saved.saving || saved.dirty || saved.fenced || saved.readonly!==initial.readonly ||
        !same(saved.sourceRef,api.client.getState()) || (!initial.readonly && !same(saved.sourceRef,receipt)))return failure('VIEW_CHANGED');
      const clientPaused=api.client.pauseView();if(clientPaused?.ok!==true)return failure(clientPaused?.code||'VIEW_PAUSE_FAILED');
      const drained=await api.client.drain();if(drained?.ok!==true)return failure(drained?.code||'VIEW_DRAIN_FAILED');
      if(!ready(receipt,initial.readonly))return failure('VIEW_CHANGED');
      prepared=true;
      return Object.freeze(initial.readonly?{ok:true,readonly:true}:{ok:true,readonly:false,sourceReceipt:receipt});
    })().catch(()=>failure('VIEW_FLUSH_FAILED')).then(value=>{
      busy=false;
      if(value.ok!==true) {prepared=false;api.editor.pauseView();}
      return value;
    });
    return preparing;
  }
  function resumeView() {
    if(busy)return failure('VIEW_BUSY');
    if(!prepared)return failure('VIEW_NOT_PREPARED');
    const clientResumed=api.client.resumeView();if(clientResumed?.ok!==true)return failure(clientResumed?.code||'VIEW_RESUME_FAILED');
    const editorResumed=api.editor.resumeView();
    if(editorResumed?.ok!==true) {api.client.pauseView();return failure(editorResumed?.code||'VIEW_RESUME_FAILED');}
    preparing=null;prepared=false;return Object.freeze({ok:true});
  }
  return Object.freeze({flushView,resumeView});
}
