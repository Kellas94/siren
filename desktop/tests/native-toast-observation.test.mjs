import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
const module=await import('./native/toast-observation.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
function fixture({visible=false,absent=false}={}){
 let open=false,changed=false,calls=0;const toast={textContent:'Original notification',style:{opacity:'.4'},classList:{contains:()=>changed,add:()=>{changed=true;},remove:()=>{changed=false;}},matches:()=>open,showPopover(){open=true;},hidePopover(){open=false;},checkVisibility:()=>visible};
 // Model only the DOM attribute boundary; actual CSS declarations, transitions
 // and priorities are qualified by the Electron toast-transition probe.
 toast.getAttribute=name=>{assert.equal(name,'style');return JSON.stringify(toast.style);};
 toast.setAttribute=(name,value)=>{assert.equal(name,'style');toast.style=JSON.parse(value);};
 toast.removeAttribute=name=>{assert.equal(name,'style');toast.style={};};
 const document={getElementById:id=>id==='toast'?toast:id==='desktopAccessScreen'&&!absent?{isConnected:true}:null};
 const driver={evaluate:async expression=>{calls++;return runInNewContext(expression,{document,getComputedStyle:()=>({opacity:toast.style.opacity,visibility:visible?'visible':'hidden'})});}};
 return {driver,toast,get calls(){return calls;},get open(){return open;},get changed(){return changed;}};
}
test('toast admission and CSS isolation are observed in one native evaluation and owned fixture changes restored',async()=>{
 assert.equal(typeof module.observeAccessToast,'function');const f=fixture(),r=await module.observeAccessToast(f.driver);assert.equal(r.topLayer,true);assert.equal(r.visible,false);assert.equal(r.opacity,1);assert.equal(f.calls,1);assert.equal(f.open,false);assert.equal(f.changed,false);assert.equal(f.toast.style.opacity,'.4');assert.equal(f.toast.textContent,'Original notification');
});
test('atomic observation preserves genuine leakage/precondition failures rather than reporting success',async()=>{
 assert.equal(typeof module.observeAccessToast,'function');const f=fixture({visible:true}),r=await module.observeAccessToast(f.driver);assert.equal(r.visible,true);assert.equal(r.topLayer,true);const absent=fixture({absent:true});await assert.rejects(module.observeAccessToast(absent.driver),/Actual PIN overlay/);assert.equal(absent.calls,1);assert.equal(absent.open,false);
});
