// Test-only observations. No selection setter, retry, popup wait or timeout extension.
const statusSnapshot=`(()=>{
 const controls=document.querySelectorAll('#homeDocsFilter-status'), select=controls[0];
 let popupOpen=null;
 try { if(select)popupOpen=select.matches(':open'); } catch {}
 return {at:performance.now(),count:controls.length,tagName:select?.tagName??null,
  connected:select?.isConnected===true,disabled:select?.disabled??null,value:select?.value??null,
  selectedIndex:select?.selectedIndex??null,selectedValue:select?.options?.[select.selectedIndex]?.value??null,
  active:document.activeElement?.id||document.activeElement?.tagName||null,popupOpen};
})()`;

export async function clickSearchAfterStatusCommit(driver,result,expected) {
 const snapshot=await driver.evaluate(statusSnapshot);
 (result.registerSelections??=[]).push({...snapshot,expected});
 if(snapshot.count!==1||snapshot.tagName!=='SELECT'||!snapshot.connected||snapshot.disabled!==false||snapshot.value!==expected||snapshot.selectedValue!==expected) {
  const error=new Error('Docs Status selection was not committed before Search');
  error.code='DOCS_STATUS_NOT_COMMITTED';
  throw error;
 }
 await driver.click('#homeLibrarySearch');
}

export async function sendObservedRegisterKey(driver,result,key,code,windowsVirtualKeyCode,modifiers=0) {
 for(const type of ['keyDown','keyUp']) {
  const packet={type,key,code,windowsVirtualKeyCode,modifiers};
  const observation={...packet,sentAt:performance.now(),acknowledged:false};
  const retained=result.registerKeyPackets??=[];
  if(retained.length<32)retained.push(observation);
  else result.registerKeyPacketsDropped=(result.registerKeyPacketsDropped??0)+1;
  try {
   await driver.send('Input.dispatchKeyEvent',packet);
   observation.acknowledged=true;
  } catch(error) {
   observation.error=String(error?.message??error).slice(0,500);
   throw error;
  } finally {
   observation.ackAt=performance.now();
   if(!observation.acknowledged)result.registerLastKeyFailure={...observation};
  }
 }
}
