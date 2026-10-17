// Test-only observations and genuine bounded keyboard navigation. No setters,
// synthetic events, selection retry, popup wait or timeout extension.
const statusSnapshot=`(()=>{
 const controls=document.querySelectorAll('#homeDocsFilter-status'), select=controls[0], active=document.activeElement,
  registers=document.querySelectorAll('.home-docs-filters');
 let popupOpen=null;
 try { if(select)popupOpen=select.matches(':open'); } catch {}
 return {at:performance.now(),count:controls.length,tagName:select?.tagName??null,
  connected:select?.isConnected===true,disabled:select?.disabled??null,value:select?.value??null,
  selectedIndex:select?.selectedIndex??null,selectedValue:select?.options?.[select.selectedIndex]?.value??null,
  active:active?.id||active?.tagName||null,popupOpen,
  type:select?.type??null,label:select?.getAttribute?.('aria-label')??null,filterKey:select?.dataset?.registerFilter??null,
  size:select?.size??null,optionValues:Array.from(select?.options??[],o=>o.value),optionDisabled:Array.from(select?.options??[],o=>o.disabled===true),
  activeIsStatus:controls.length===1&&active===select,activeType:active?.type??null,activeTagName:active?.tagName??null,
  registerCount:registers.length,expanded:registers[0]?.open===true};
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

const keyboardError=code=>Object.assign(new Error(code),{code});
function requireKeyboardStatus(snapshot) {
 if(snapshot.count!==1||snapshot.tagName!=='SELECT'||!snapshot.connected||snapshot.disabled!==false||
    snapshot.type!=='select-one'||snapshot.size>1||snapshot.label!=='Status'||snapshot.filterKey!=='status'||
    snapshot.registerCount!==1||snapshot.expanded!==true||
    snapshot.optionValues.join('\0')!==['','draft','in-review','approved'].join('\0')||snapshot.optionDisabled.some(Boolean))
  throw keyboardError('DOCS_STATUS_KEYBOARD_UNAVAILABLE');
 if(snapshot.popupOpen!==false)throw keyboardError('DOCS_STATUS_NOT_CLOSED');
}

/** Focus through normal Tab order. Never click the select or open its popup.
 * The fixture has at most eleven tab stops; twelve observed Tabs is a finite
 * reachability bound, not a selection retry or an increased condition timeout. */
export async function chooseStatusWithTrustedTabs(driver,result,expected) {
 if(expected!=='approved'&&expected!=='')throw keyboardError('DOCS_STATUS_EXPECTATION_UNSUPPORTED');
 const observe=async stage=>{
  const snapshot=await driver.evaluate(statusSnapshot),row={...snapshot,stage,expected};
  const retained=result.registerKeyboardObservations??=[];
  if(retained.length<32)retained.push(row);
  else result.registerKeyboardObservationsDropped=(result.registerKeyboardObservationsDropped??0)+1;
  requireKeyboardStatus(snapshot);return snapshot;
 };
 let snapshot=await observe('navigation-start');
 for(let tabs=0;!snapshot.activeIsStatus&&tabs<12;tabs++) {
  await sendObservedRegisterKey(driver,result,'Tab','Tab',9);
  snapshot=await observe('after-navigation-tab');
 }
 if(!snapshot.activeIsStatus)throw keyboardError('DOCS_STATUS_FOCUS_UNREACHED');
 snapshot=await observe('before-selection-key');
 if(!snapshot.activeIsStatus||snapshot.activeTagName!=='SELECT'||snapshot.activeType!=='select-one')
  throw keyboardError('DOCS_STATUS_FOCUS_UNREACHED');
 await sendObservedRegisterKey(driver,result,expected==='approved'?'End':'Home',expected==='approved'?'End':'Home',expected==='approved'?35:36);
 snapshot=await observe('after-selection-key');
 if(!snapshot.activeIsStatus||snapshot.activeType!=='select-one')throw keyboardError('DOCS_STATUS_FOCUS_UNREACHED');
 await sendObservedRegisterKey(driver,result,'Tab','Tab',9);
 snapshot=await observe('after-commit-tab');
 if(snapshot.activeIsStatus||snapshot.active!=='homeDocsFilter-links'||snapshot.activeTagName!=='SELECT'||snapshot.activeType!=='select-one')
  throw keyboardError('DOCS_STATUS_TAB_NOT_COMMITTED');
 // The existing independent exact-value guard and actual Search action follow
 // in docs-context. Acknowledged End/Home/Tab packets alone never qualify them.
}
