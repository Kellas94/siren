import assert from 'node:assert/strict';
// Passive DOM reads and the caller's trusted native keyboard only. Never open
// the OS select popup by clicking an already focused control.
export async function chooseNativeSelect(page,selector,value,{refusedValue,keys}={}){
 const target=JSON.stringify(selector),options=await page.evaluate(`Array.from(document.querySelector(${target}).options).filter(o=>!o.disabled).map(o=>o.value)`),index=options.indexOf(value);
 assert.ok(index>=0&&options.length<=64,'Bounded real select option must exist');
 const focused=()=>page.evaluate(`document.activeElement===document.querySelector(${target})`);
 for(let tabs=0;tabs<64&&!await focused();tabs++)await keys(page,'Tab','Tab',9);
 const requireFocus=async()=>assert.equal(await focused(),true,'NATIVE_SELECT_FOCUS_REQUIRED');
 await requireFocus();await keys(page,'Escape','Escape',27);await requireFocus();
 const end=index>options.length/2;await keys(page,end?'End':'Home',end?'End':'Home',end?35:36);await requireFocus();
 for(let i=0;i<(end?options.length-1-index:index);i++){await requireFocus();await keys(page,end?'ArrowUp':'ArrowDown',end?'ArrowUp':'ArrowDown',end?38:40);await requireFocus();}
 await keys(page,'Tab','Tab',9);await page.waitFor(`document.querySelector(${target}).value===${JSON.stringify(refusedValue??value)}`);
}
