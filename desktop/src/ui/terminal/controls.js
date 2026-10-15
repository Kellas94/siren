// Standalone SOURCE_ONLY controls. No installed entry or native admission.
import {createTerminalClient} from './client.js';
import {createTerminalView} from './view.js';
import {validateTerminalEvent} from '../../terminal/events.mjs';
import {TERMINAL_LIMITS as limits,TERMINAL_METHODS,validateTerminalRequest} from '../../terminal/contracts.mjs';
const fail=code=>Object.freeze({ok:false,code}),pass=value=>Object.freeze({ok:true,value:Object.freeze(value)});
let panelSequence=0;
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
function data(value,keys){
 try{if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(k=>!keys.includes(k)))return null;
  const out=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;
 }catch{return null;}
}
function array(value,max){try{if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return null;const length=Object.getOwnPropertyDescriptor(value,'length')?.value;if(!Number.isSafeInteger(length)||length<0||length>max||Reflect.ownKeys(value).length!==length+1)return null;const rows=[];for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;rows.push(d.value);}return rows;}catch{return null;}}
const text=(value,max=160)=>String(value).toWellFormed().replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,max);
function folderValue(value,projectId){const r=data(value,['cwdId','projectId','displayPath']);return r&&id(r.cwdId)&&r.projectId===projectId&&typeof r.displayPath==='string'&&r.displayPath.length>0&&r.displayPath.length<=32768&&r.displayPath.isWellFormed()?Object.freeze(r):null;}
function profileValues(value){const rows=array(value,1);if(!rows)return null;const result=[];for(const row of rows){const r=data(row,['profileId','label','available']);if(!r||r.profileId!=='powershell'||typeof r.label!=='string'||!r.label.length||r.label.length>128||!r.label.isWellFormed()||typeof r.available!=='boolean')return null;result.push(Object.freeze(r));}return Object.freeze(result);}
function sessionValue(value,epoch,projectId){const checked=validateTerminalEvent('terminalState',{epoch,session:value});return checked.ok&&checked.event.session.projectId===projectId&&checked.event.session.profileId==='powershell'?checked.event.session:null;}
function sessionValues(value,epoch,projectId){const rows=array(value,limits.sessions),seen=new Set(),result=[];if(!rows)return null;for(const row of rows){const r=sessionValue(row,epoch,projectId);if(!r||seen.has(r.sessionId))return null;seen.add(r.sessionId);result.push(r);}return result;}
const detached=reply=>reply?.ok===true&&data(reply.value,['detached'])?.detached===true;
function displayRetired(reply,sessionId,epoch){if(detached(reply))return true;const value=reply?.ok===true?data(reply.value,['retired','basis','sessionId','epoch']):null;return value?.retired===true&&value.basis==='STOPPED_SESSION'&&value.sessionId===sessionId&&value.epoch===epoch;}
function dimensionsValue(value){try{if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;const keys=Reflect.ownKeys(value);if(keys.length>2||keys.some(k=>!['cols','rows'].includes(k)))return null;const result={cols:120,rows:40};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}return result;}catch{return null;}}
function displayBridge(bridge,epoch,projectId,observeDetach){
 // Validate successful attach scope before the existing view can construct its
 // emulator. This DATA filter conveys no grant or native execution authority.
 const result=Object.create(null);for(const name of [...Object.keys(TERMINAL_METHODS),'onTerminalData','onTerminalGap','onTerminalState']){const d=Object.getOwnPropertyDescriptor(bridge,name);if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')throw TypeError('Finite Terminal bridge required');const fn=d.value;result[name]=(...args)=>Reflect.apply(fn,bridge,args);}
 // Both owned clients must apply the same metadata scope before a state can
 // reach the display, including the supported shell profile.
 const subscribeState=result.onTerminalState;result.onTerminalState=callback=>subscribeState(payload=>{const checked=validateTerminalEvent('terminalState',payload);if(checked.ok&&checked.event.epoch===epoch&&sessionValue(checked.event.session,epoch,projectId))callback(checked.event);});
 // Observe real lease cleanup even when the attachment arrived after local
 // retirement. A previous no-lease detach cannot verify this later receipt.
 const detach=result.terminalDetach;result.terminalDetach=payload=>{
  try{return Promise.resolve(detach(payload)).then(reply=>{const r=data(reply,['ok','value','operationId']);observeDetach(!!r&&r.operationId===payload.operationId&&r.ok===true&&data(r.value,['detached'])?.detached===true);return reply;},error=>{observeDetach(false);throw error;});}
  catch(error){observeDetach(false);throw error;}
 };
 const attach=result.terminalAttach;result.terminalAttach=payload=>Promise.resolve(attach(payload)).then(reply=>{
  try{const ok=reply&&Object.getOwnPropertyDescriptor(reply,'ok');if(ok&&Object.hasOwn(ok,'value')&&ok.value===true){const r=data(reply,['ok','value','operationId']),a=r&&data(r.value,['session','leaseId','generation','firstSequence','nextSequence']),s=a&&sessionValue(a.session,epoch,projectId);if(!s||s.sessionId!==payload.sessionId)return Object.freeze({ok:false,code:'RESPONSE_REFUSED',operationId:payload.operationId});}}
  catch{return Object.freeze({ok:false,code:'RESPONSE_REFUSED',operationId:payload.operationId});}return reply;
 });return Object.freeze(result);
}
const reasons=Object.freeze({PASTE_CANCELLED:'Paste cancelled. No pasted text was sent.',PASTE_REFUSED:'Paste was refused. Use valid plain text of at most 32 KiB.',PASTE_CONTROL_REFUSED:'Paste contains invisible terminal controls. No pasted text was sent.',NO_FOLDER:'Choose a project folder explicitly.',CWD_REQUIRED:'Choose a project folder before starting a session.',CANCELLED:'Folder selection was cancelled; your earlier choice is retained.',CWD_REFUSED:'The selected folder is no longer available. Choose it again.',PROFILE_UNAVAILABLE:'No supported shell profile is available.',PIN_REQUIRED:'SIREN is locked. Unlock before continuing.',CAPACITY_EXCEEDED:'Terminal capacity is occupied or another operation is still pending.',DETACH_UNVERIFIED:'The prior attachment is unconfirmed; another view will not be attached.',CREATE_UNVERIFIED:'Session creation is unconfirmed; it will not be retried.',CLEANUP_FAILED:'Process cleanup is unconfirmed. Do not assume the session stopped.',CLEANUP_UNVERIFIED:'Stop was submitted but cleanup remains unconfirmed.',RESPONSE_REFUSED:'The response was invalid. No further action was inferred.',VIEW_DETACHED:'Display detached; background work may continue.',SESSION_REFUSED:'Choose a current session.',HOST_UNAVAILABLE:'Terminal is unavailable for this operation.',SENDER_REFUSED:'This window no longer has access. Reopen the current Terminal view.'});

export function createTerminalControls({container,bridge,epoch,projectId,available=false,terminalFactory,operationId,reviewPaste,search,onExplain=null}={}){
 if(!container?.ownerDocument||typeof container.replaceChildren!=='function'||typeof container.ownerDocument.createElement!=='function'||typeof available!=='boolean'||available&&(!id(projectId)||!Number.isSafeInteger(epoch)||epoch<1||typeof terminalFactory!=='function'))throw TypeError('Scoped Terminal control adapters required');
 const document=container.ownerDocument,events=[],pending=new Set();let disposed=false,generation=0,displayNotifying=false,busy=null,client=null,view=null,folder=null,profiles=[],sessions=[],profileId=null,selectedSessionId=null,displaySessionId=null,creationUncertain=false,detachUncertain=false,detachWork=null,code=available?'NO_FOLDER':'TERMINAL_UNAVAILABLE';const uncertainStops=new Map();
 const make=(tag,parent,label)=>{const node=document.createElement(tag);if(label!==undefined)node.textContent=label;parent.append(node);return node;};
 const listen=(node,name,fn,capture=false)=>{node.addEventListener(name,fn,capture);events.push(()=>node.removeEventListener(name,fn,capture));};
 const root=make('section',container);root.className='terminal-controls';root.style.cssText='display:flex;flex-direction:column;gap:10px;color:var(--text,inherit);background:var(--panel-bg,transparent);font:inherit;min-height:0;';
 const toolbar=make('div',root);toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Terminal controls');toolbar.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px;border:1px solid var(--border,currentColor);border-radius:12px;';
 const buttons={};const button=(key,label,action)=>{const node=make('button',toolbar,label);node.type='button';node.dataset.action=key;node.style.cssText='font:inherit;color:inherit;background:var(--panel-bg,transparent);border:1px solid var(--border,currentColor);border-radius:8px;padding:6px 10px;';listen(node,'click',()=>{void action();});buttons[key]=node;return node;};
 button('folder','Choose folder',()=>pickFolder());button('refresh','Refresh',()=>refresh());
 const profileSelect=make('select',toolbar);profileSelect.setAttribute('aria-label','Shell profile');profileSelect.style.cssText='font:inherit;color:inherit;background:var(--panel-bg,transparent);border:1px solid var(--border,currentColor);border-radius:8px;padding:6px;';
 button('create','New terminal',()=>createSession());
 button('stop','Stop session',()=>stopSession());button('clear','Clear view',()=>clearView());
 const searchInput=make('input',toolbar);searchInput.type='search';searchInput.maxLength=4096;searchInput.placeholder='Find in output';searchInput.setAttribute('aria-label','Find in Terminal output');searchInput.style.cssText=profileSelect.style.cssText;
 button('find','Find',()=>find(searchInput.value));
 const sessionTabs=make('div',root);sessionTabs.setAttribute('role','tablist');sessionTabs.setAttribute('aria-label','Terminal sessions');sessionTabs.setAttribute('aria-orientation','horizontal');sessionTabs.style.cssText='display:flex;gap:6px;overflow-x:auto;padding:2px;';
 const tabNodes=new Map(),panelId='siren-terminal-output-'+(++panelSequence);let tabFocusId=null;
 const folderLabel=make('p',root,'No folder selected.');folderLabel.style.cssText='margin:0;font-size:12px;overflow-wrap:anywhere;';
 const status=make('p',root);status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.cssText='margin:0;font-size:12px;overflow-wrap:anywhere;';
 const explanationHost=make('div',root);
 let explainSerial=0,explanationOffer=null;
 function clearExplanation(){explainSerial++;const old=explanationOffer;explanationOffer=null;old?.button.remove();}
 const explanationCurrent=record=>!disposed&&available&&record.serial===explainSerial&&record.generation===generation&&record.sessionId===selectedSessionId&&record.displaySessionId===displaySessionId;
 function offerExplanation(token,reply){
  if(typeof onExplain!=='function'||!token.operation||!live(token)||token.sessionId!==selectedSessionId||token.displaySessionId!==displaySessionId)return;
  let code;try{const ok=Object.getOwnPropertyDescriptor(reply,'ok'),field=Object.getOwnPropertyDescriptor(reply,'code');if(!ok||!Object.hasOwn(ok,'value')||ok.value!==false||!field||!Object.hasOwn(field,'value')||typeof field.value!=='string'||!/^[A-Z][A-Z0-9_]{0,95}$/.test(field.value))return;code=field.value;}catch{return;}
  if(token.operation==='pick-cwd'&&code==='CANCELLED'||token.operation==='input'&&code==='PASTE_CANCELLED')return;
  const identity=Object.freeze({namespace:'terminal',operation:token.operation,code}),button=document.createElement('button'),record={serial:explainSerial,generation,sessionId:selectedSessionId,displaySessionId,button};
  button.type='button';button.textContent='Explain error';button.dataset.action='explain-error';
  button.addEventListener('click',()=>{if(explanationOffer!==record||!explanationCurrent(record)||button.isConnected!==true)return;clearExplanation();try{Promise.resolve(onExplain(identity)).catch(()=>{});}catch{/* Optional manual cannot alter a Terminal receipt. */}});
  explanationOffer=record;explanationHost.append(button);
  if(explanationOffer===record&&!explanationCurrent(record))clearExplanation();
 }
 const explanation=make('p',root,'Lock prevents new input; existing work continues in the background. Stop ends the selected session.');explanation.style.cssText='margin:0;font-size:12px;opacity:.75;';
 const display=make('div',root);display.id=panelId;display.setAttribute('role','tabpanel');display.setAttribute('aria-label','Terminal output');display.style.cssText='flex:1;min-height:160px;';
 const review=make('section',root);review.setAttribute('role','group');review.setAttribute('aria-label','Review multiline paste');review.hidden=true;review.style.cssText='padding:12px;border:1px solid var(--border,currentColor);border-radius:12px;background:var(--panel-bg,transparent);';
 make('p',review,'Review this text before sending it to PowerShell.');
 const preview=make('textarea',review);preview.setAttribute('aria-label','Text to send to Terminal');preview.readOnly=true;preview.spellcheck=false;preview.rows=6;preview.style.cssText='box-sizing:border-box;width:100%;font:inherit;font-family:monospace;color:inherit;background:var(--panel-bg,transparent);border:1px solid var(--border,currentColor);border-radius:8px;padding:8px;';
 const submitPaste=make('button',review,'Send to Terminal'),cancelPaste=make('button',review,'Cancel');submitPaste.type=cancelPaste.type='button';submitPaste.dataset.action='paste-submit';cancelPaste.dataset.action='paste-cancel';submitPaste.disabled=cancelPaste.disabled=true;
 let pasteReview=null;
 function finishPasteReview(approved=false){const held=pasteReview;if(!held)return;pasteReview=null;preview.value='';review.hidden=true;submitPaste.disabled=cancelPaste.disabled=true;held.resolve(approved===true);}
 function localPasteReview(value){
  if(disposed||!available||!displaySessionId||pasteReview)return Promise.resolve(false);
  const held={generation,sessionId:displaySessionId};const answer=new Promise(resolve=>held.resolve=resolve);pasteReview=held;
  preview.value=value;review.hidden=false;submitPaste.disabled=cancelPaste.disabled=false;cancelPaste.focus();return answer;
 }
 listen(submitPaste,'click',()=>{const held=pasteReview,s=view?.snapshot();finishPasteReview(!!held&&!disposed&&held.generation===generation&&held.sessionId===displaySessionId&&s?.active===true&&s.sessionId===held.sessionId&&!s.replaying);});
 listen(cancelPaste,'click',()=>finishPasteReview(false));
 listen(review,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();finishPasteReview(false);}});
 const live=token=>!disposed&&available&&token.generation===generation;
 const track=promise=>{pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;};
 const activeCount=()=>sessions.filter(row=>row.state!=='exited'||uncertainStops.has(row.sessionId)).length;
 function currentTab(target){for(let node=target;node&&node!==sessionTabs;node=node.parentNode)if(node.parentNode===sessionTabs&&tabNodes.get(node.dataset.sessionId)===node)return node;return null;}
 function paintSessionTabs(blocked){
  const prior=currentTab(document.activeElement),stamp=generation;
  if(prior)tabFocusId=prior.dataset.sessionId;
  const ids=new Set(sessions.map(row=>row.sessionId));
  if(!ids.has(tabFocusId))tabFocusId=ids.has(selectedSessionId)?selectedSessionId:sessions[0]?.sessionId??null;
  const nodes=sessions.map(row=>{
   let tab=tabNodes.get(row.sessionId);
   if(!tab){tab=document.createElement('button');tab.type='button';tab.dataset.sessionId=row.sessionId;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panelId);tab.style.cssText='flex:0 0 auto;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:inherit;color:inherit;background:var(--panel-bg,transparent);border:1px solid var(--border,currentColor);border-radius:8px;padding:6px 10px;';tabNodes.set(row.sessionId,tab);}
   const label=text(row.cwdDisplay,80)+' · PowerShell · '+(uncertainStops.has(row.sessionId)?'Cleanup uncertain':row.state),selected=row.sessionId===selectedSessionId;
   if(tab.textContent!==label)tab.textContent=label;
   tab.setAttribute('aria-label',label);tab.setAttribute('aria-selected',String(selected));tab.setAttribute('aria-disabled',String(blocked||detachUncertain));tab.tabIndex=row.sessionId===tabFocusId?0:-1;tab.style.fontWeight=selected?'600':'400';return tab;
  });
  for(const key of tabNodes.keys())if(!ids.has(key))tabNodes.delete(key);
  const children=Array.from(sessionTabs.children),changed=children.length!==nodes.length||children.some((node,i)=>node!==nodes[i]);
  if(changed)sessionTabs.replaceChildren(...nodes);sessionTabs.hidden=nodes.length===0;
  // Only restore focus that belonged to this strip. Stable rows never detach;
  // metadata/output repaints must not pull focus away from emulator input.
  if(changed&&prior&&!disposed&&stamp===generation&&(!document.activeElement||document.activeElement===document.body||document.activeElement===prior)){
   (tabNodes.get(prior.dataset.sessionId)??tabNodes.get(tabFocusId))?.focus();
  }
 }
 let painting=false,paintAgain=false;
 function paint(){
  if(disposed)return;if(painting){paintAgain=true;return;}painting=true;
  try{do{paintAgain=false;paintCurrent();}while(paintAgain&&!disposed);}finally{painting=false;}
 }
 function paintCurrent(){
  if(disposed)return;const blocked=!available||!!busy,displayState=view?.snapshot(),displayActive=!!displaySessionId&&displayState?.active===true&&displayState.sessionId===displaySessionId,displayUnavailable=!!displaySessionId&&displayState?.sessionId===displaySessionId&&!displayState.active;
  buttons.folder.disabled=buttons.refresh.disabled=blocked;buttons.create.disabled=blocked||!folder||!profiles.some(r=>r.profileId===profileId&&r.available)||creationUncertain||detachUncertain||activeCount()>=limits.sessions;
  buttons.stop.disabled=blocked||!selectedSessionId||uncertainStops.has(selectedSessionId)||!sessions.some(r=>r.sessionId===selectedSessionId&&!['exited','cleanup-failed'].includes(r.state));
  buttons.clear.disabled=buttons.find.disabled=blocked||!displayActive;searchInput.disabled=blocked||!displayActive;
  profileSelect.disabled=blocked;
  profileSelect.replaceChildren();if(!profiles.length){const option=make('option',profileSelect,'No shell profile');option.value='';}for(const row of profiles){const option=make('option',profileSelect,text(row.label)+(row.available?'':' · Unavailable'));option.value=row.profileId;option.disabled=!row.available;}profileSelect.value=profileId??'';
  paintSessionTabs(blocked);
  folderLabel.textContent=folder?text(folder.displayPath):'No folder selected.';
  const state=sessions.find(r=>r.sessionId===selectedSessionId)?.state;
  status.textContent=!available?'Terminal is unavailable in this build. See Help → Terminal availability.':displayUnavailable?'Terminal display is unavailable. ('+text(displayState.code??'VIEW_INACTIVE',96)+')':busy?({folder:'Choosing folder…',refresh:'Refreshing…',create:'Starting session…',select:'Attaching session…',stop:'Stopping session…',paste:'Reviewing or sending pasted text…'}[busy.kind]??'Working…'):code?(reasons[code]??'Terminal could not confirm this operation.')+' ('+text(code,96)+')':displaySessionId?(view.snapshot().replaying?'Replaying retained output…':text(state??'Attached')):folder?'Ready to choose or start a session.':'Choose a project folder explicitly before starting a session.';
  root.setAttribute('aria-busy',String(!!busy));
 }
 function run(kind,action){
  if(disposed)return Promise.resolve(fail('VIEW_DISPOSED'));if(!available)return Promise.resolve(fail('TERMINAL_UNAVAILABLE'));if(displayNotifying||painting)return Promise.resolve(fail('VIEW_INACTIVE'));if(busy)return Promise.resolve(fail('CAPACITY_EXCEEDED'));
  clearExplanation();const token={kind,generation,sessionId:selectedSessionId,displaySessionId,operation:kind==='folder'?'pick-cwd':kind==='create'?'create':kind==='paste'?'input':kind==='stop'?'stop':null};busy=token;paint();
  return track((async()=>{try{const reply=await action(token);if(!live(token))return fail('VIEW_INACTIVE');code=reply.ok?null:reply.code;offerExplanation(token,reply);return reply;}catch{if(live(token)){code='BRIDGE_UNAVAILABLE';offerExplanation(token,fail(code));}return fail('BRIDGE_UNAVAILABLE');}finally{if(busy===token)busy=null;paint();}})());
 }
 function detachView(){
  const retiringSessionId=view.snapshot().sessionId;finishPasteReview(false);displaySessionId=null;if(detachWork)return detachWork;
  // Own the actual detach before emulator/bridge callbacks can reenter. A
  // second local detach must not replace a still-unresolved real lease receipt.
  let resolve;const work=new Promise(r=>resolve=r);detachWork=work;track(work);
  const finish=result=>{if(!displayRetired(result,retiringSessionId,epoch)){detachUncertain=true;code='DETACH_UNVERIFIED';}if(detachWork===work)detachWork=null;resolve(result);paint();};
  try{Promise.resolve(view.detach()).then(finish,()=>finish(fail('DETACH_UNVERIFIED')));}catch{finish(fail('DETACH_UNVERIFIED'));}return work;
 }
 async function attachKnown(token,sessionId){
  const bindExplanation=()=>{if(live(token)){token.operation='attach';token.sessionId=selectedSessionId;token.displaySessionId=displaySessionId;}};bindExplanation();
  if(detachUncertain)return fail('DETACH_UNVERIFIED');
  if(displaySessionId||detachWork){const retiringSessionId=view.snapshot().sessionId,reply=await detachView();bindExplanation();if(!displayRetired(reply,retiringSessionId,epoch))return fail('DETACH_UNVERIFIED');if(!live(token))return fail('VIEW_INACTIVE');}
  if(!live(token))return fail('VIEW_INACTIVE');selectedSessionId=sessionId;tabFocusId=sessionId;bindExplanation();
  const reply=await view.attach(sessionId,uncertainStops.has(sessionId));if(!live(token))return fail('VIEW_INACTIVE');
  if(reply.ok!==true){if(reply.code!=='SESSION_REFUSED')detachUncertain=true;return reply;}displaySessionId=sessionId;return reply;
 }
 function pickFolder(){return run('folder',async token=>{const reply=await client.pickCwd();if(!live(token))return fail('VIEW_INACTIVE');if(!reply.ok)return reply;const value=folderValue(reply.value,projectId);if(!value)return fail('RESPONSE_REFUSED');folder=value;return pass({selected:true});});}
 function refresh(){return run('refresh',async token=>{
  const profileReply=await client.listProfiles();if(!live(token))return fail('VIEW_INACTIVE');if(!profileReply.ok)return profileReply;const nextProfiles=profileValues(profileReply.value);if(!nextProfiles)return fail('RESPONSE_REFUSED');
  const listReply=await client.list();if(!live(token))return fail('VIEW_INACTIVE');if(!listReply.ok)return listReply;const nextSessions=sessionValues(listReply.value,epoch,projectId);if(!nextSessions)return fail('RESPONSE_REFUSED');
  // An absent row is not a cleanup receipt. Preserve every uncertain session.
  for(const row of sessions)if(uncertainStops.has(row.sessionId)&&!nextSessions.some(r=>r.sessionId===row.sessionId))nextSessions.push(row);
  if(nextSessions.length>limits.sessions)return fail('CAPACITY_EXCEEDED');profiles=nextProfiles;sessions=nextSessions;
  if(!profiles.some(r=>r.profileId===profileId&&r.available))profileId=profiles.find(r=>r.available)?.profileId??null;
  if(selectedSessionId&&!sessions.some(r=>r.sessionId===selectedSessionId)&&!displaySessionId)selectedSessionId=null;
  return pass({refreshed:true});
 });}
 function createSession(dimensions={}){return run('create',async token=>{
  const size=dimensionsValue(dimensions);if(!size||!validateTerminalRequest('terminalCreate',{operationId:'controls_shape',epoch,cwdId:'controls_shape',profileId:'powershell',...size}).ok)return fail('REQUEST_REFUSED');
  if(creationUncertain)return fail('CREATE_UNVERIFIED');if(detachUncertain)return fail('DETACH_UNVERIFIED');if(!folder)return fail('CWD_REQUIRED');if(!profiles.some(r=>r.profileId===profileId&&r.available))return fail('PROFILE_UNAVAILABLE');if(activeCount()>=limits.sessions)return fail('CAPACITY_EXCEEDED');
  creationUncertain=true;const expectedFolder=folder,expectedProfile=profileId,reply=await client.create({cwdId:expectedFolder.cwdId,profileId:expectedProfile,...size});if(!live(token))return fail('VIEW_INACTIVE');
  if(!reply.ok){creationUncertain=true;return reply;}
  const value=sessionValue(reply.value,epoch,projectId);if(!value||value.profileId!==expectedProfile||value.cwdDisplay!==expectedFolder.displayPath||!['starting','running'].includes(value.state)||sessions.some(r=>r.sessionId===value.sessionId)){creationUncertain=true;return fail('RESPONSE_REFUSED');}
  if(sessions.length>=limits.sessions){const removable=sessions.findIndex(r=>r.state==='exited'&&!uncertainStops.has(r.sessionId));if(removable<0){creationUncertain=true;return fail('CAPACITY_EXCEEDED');}sessions.splice(removable,1);}sessions.push(value);creationUncertain=false;
  token.operation=null;return attachKnown(token,value.sessionId);
 });}
 function selectSession(sessionId){return run('select',token=>{if(!id(sessionId)||!sessions.some(r=>r.sessionId===sessionId))return fail('SESSION_REFUSED');const displayState=view.snapshot();if(displaySessionId===sessionId&&displayState.active===true&&displayState.sessionId===sessionId)return pass({selected:true});return attachKnown(token,sessionId);});}
 function stopSession(){return run('stop',async token=>{
  const selected=sessions.find(r=>r.sessionId===selectedSessionId);if(!selected)return fail('SESSION_REFUSED');if(uncertainStops.has(selected.sessionId))return fail('CLEANUP_UNVERIFIED');if(selected.state==='exited')return fail('SESSION_NOT_RUNNING');
  // Reserve uncertainty before submission. A generation change cannot erase
  // the fact that Stop may already have affected this session.
  uncertainStops.set(selected.sessionId,'STOP_PENDING');
  view.beginStop(selected.sessionId);
  const reply=await client.stop({sessionId:selected.sessionId});if(!live(token))return fail('VIEW_INACTIVE');const value=reply.ok?sessionValue(reply.value,epoch,projectId):null;if(!live(token))return fail('VIEW_INACTIVE');
  if(!value||value.sessionId!==selected.sessionId||value.profileId!==selected.profileId||value.cwdDisplay!==selected.cwdDisplay||value.state!=='exited'){uncertainStops.set(selected.sessionId,reply.code??'RESPONSE_REFUSED');return fail(reply.code??'RESPONSE_REFUSED');}
  sessions=sessions.map(r=>r.sessionId===value.sessionId?value:r);uncertainStops.delete(value.sessionId);if(displaySessionId===value.sessionId)view.observeStoppedSession({epoch,session:value});return pass({stopped:true});
 });}
 function clearView(){return disposed?fail('VIEW_DISPOSED'):!available?fail('TERMINAL_UNAVAILABLE'):view.clearView();}
 function find(query){return !disposed&&available&&view.find(query);}
 function setTheme(value){return disposed?fail('VIEW_DISPOSED'):!available?fail('TERMINAL_UNAVAILABLE'):view.setTheme(value);}
 function detachDisplay(){
  if(disposed)return Promise.resolve(fail('VIEW_DISPOSED'));if(!available)return Promise.resolve(fail('TERMINAL_UNAVAILABLE'));clearExplanation();generation++;displaySessionId=null;code='VIEW_DETACHED';
  // Repeated local retirement must fence a queued switch but retain the same
  // actual cleanup work, without repaint reentry or another bridge request.
  if(detachWork)return detachWork;
  // view.detach synchronously fences/clears before the first await.
  const reply=detachView();paint();return reply;
 }
 function dispose(){if(disposed)return;disposed=true;clearExplanation();generation++;tabNodes.clear();tabFocusId=null;finishPasteReview(false);for(const off of events.splice(0))off();try{view?.dispose();}finally{client?.dispose();container.replaceChildren();}}
 async function drain(){while(pending.size)await Promise.all([...pending]);await view?.drain();await client?.drain();}
 const snapshot=()=>Object.freeze({available,disposed,busy:busy?.kind??null,code,folder,profileId,selectedSessionId,displaySessionId,creationUncertain,detachUncertain,sessions:Object.freeze(sessions.map(row=>Object.freeze({...row,uncertain:uncertainStops.has(row.sessionId)})))});
 listen(profileSelect,'change',()=>{if(!disposed&&available&&!busy&&!painting&&profiles.some(r=>r.profileId===profileSelect.value&&r.available)){clearExplanation();profileId=profileSelect.value;paint();}});
 function activateTab(tab){if(!tab||disposed||!available||busy||painting||displayNotifying||detachUncertain)return;tabFocusId=tab.dataset.sessionId;void selectSession(tabFocusId);}
 listen(sessionTabs,'click',event=>activateTab(currentTab(event.target)));
 listen(sessionTabs,'focusin',event=>{const tab=currentTab(event.target);if(tab&&!disposed){tabFocusId=tab.dataset.sessionId;paint();}});
 listen(sessionTabs,'keydown',event=>{
  const tab=currentTab(event.target);if(!tab||disposed||!available||event.altKey||event.ctrlKey||event.metaKey)return;
  const index=sessions.findIndex(row=>row.sessionId===tab.dataset.sessionId);if(index<0)return;
  if(event.key==='Enter'||event.key===' '){event.preventDefault();activateTab(tab);return;}
  const next=event.key==='Home'?0:event.key==='End'?sessions.length-1:event.key==='ArrowRight'?(index+1)%sessions.length:event.key==='ArrowLeft'?(index+sessions.length-1)%sessions.length:null;
  if(next===null)return;event.preventDefault();tabFocusId=sessions[next].sessionId;tabNodes.get(tabFocusId)?.focus();if(!disposed)paint();
 });
 if(available){try{
  const mintControlId=operationId??(()=>crypto.randomUUID());if(typeof mintControlId!=='function')throw TypeError('Terminal operation-ID adapter required');
  // Capture before the injected minting callback; it can retire this display.
  client=createTerminalClient({bridge,epoch,operationId:()=>{const token=busy,value=mintControlId();if(!token||busy!==token||!live(token))throw Error('VIEW_INACTIVE');return value;}});
  const displayChanged=state=>{
   if(disposed||!view||state.sessionId!==view.snapshot().sessionId)return;
   const previous=displayNotifying;displayNotifying=true;
   try{paint();}finally{displayNotifying=previous;}
  };
  const captureRawInput=sessionId=>{
   if(disposed||busy||!available||sessionId!==selectedSessionId||sessionId!==displaySessionId)return null;
   clearExplanation();const serial=explainSerial,token={generation,sessionId:selectedSessionId,displaySessionId,operation:'input'};
   return reply=>{if(serial!==explainSerial||busy||!live(token)||token.sessionId!==selectedSessionId||token.displaySessionId!==displaySessionId)return;offerExplanation(token,reply);paint();};
  };
  view=createTerminalView({container:display,bridge:displayBridge(bridge,epoch,projectId,verified=>{if(!verified){detachUncertain=true;code='DETACH_UNVERIFIED';paint();}}),epoch,terminalFactory,operationId,reviewPaste:reviewPaste===undefined?localPasteReview:reviewPaste,search,onDisplayState:displayChanged,captureRawInput});
  client.onState(event=>{if(disposed)return;const value=sessionValue(event.session,epoch,projectId);if(!value)return;sessions=sessions.map(row=>row.sessionId===value.sessionId?value:row);if(value.sessionId===displaySessionId&&value.state!=='running')finishPasteReview(false);paint();});
  listen(display,'paste',event=>{
   // Consume the explicit DOM paste before clipboard/emulator callbacks can
   // reenter. Raw onData remains the stricter non-paste path.
   if(event.defaultPrevented||event.cancelable!==true)return;
   event.preventDefault();event.stopImmediatePropagation();
   const capturedGeneration=generation,capturedSession=displaySessionId;
   if(disposed||!available||busy||!capturedSession)return;
   let value;try{value=event.clipboardData?.getData('text/plain');}catch{code='REQUEST_REFUSED';paint();return;}
   if(disposed||capturedGeneration!==generation||capturedSession!==displaySessionId)return;
   if(typeof value!=='string'||!value.length||!validateTerminalRequest('terminalInput',{operationId:'paste_shape',epoch,sessionId:capturedSession,leaseId:'paste_shape',generation:1,inputSequence:0,data:value}).ok){code='PASTE_REFUSED';paint();return;}
   void run('paste',()=>view.paste(value));
  },true);
 }catch(error){dispose();throw error;}}
 paint();return Object.freeze({refresh,pickFolder,createSession,selectSession,stopSession,clearView,find,setTheme,detachDisplay,dispose,drain,snapshot});
}
