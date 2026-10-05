import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {waitForWorkspaceAdmission} from './native/drive.mjs';
test('native qualification waits for registry admission after DOM/preload availability',async()=>{
 let calls=0,admitted=false;
 const context={window:{sirenDesktopAdmitted:async()=>{admitted=true;},sirenWindow:{getView:async()=>{calls++;return calls<3?{ok:false,code:'SENDER_REFUSED'}:{ok:true,view:{role:'workspace'}};}}}};
 const driver={evaluate:expression=>runInNewContext(expression,context),waitFor:async expression=>{for(let i=0;i<5;i++)if(await runInNewContext(expression,context))return;throw Error('Admission timeout');}};
 const receipt=await waitForWorkspaceAdmission(driver);assert.equal(admitted,true);assert.equal(receipt.ok,true);assert.equal(receipt.view.role,'workspace');assert.ok(calls>=3);
});
