// Standalone SOURCE_ONLY controls. No installed entry or native admission.
import {createTerminalClient} from './client.js';
import {createTerminalView} from './view.js';
import {validateTerminalEvent} from '../../terminal/events.mjs';
import {TERMINAL_LIMITS as limits,TERMINAL_METHODS,validateTerminalRequest} from '../../terminal/contracts.mjs';
const fail=code=>Object.freeze({ok:false,code}),pass=value=>Object.freeze({ok:true,value:Object.freeze(value)});
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
const reasons=Object.freeze({NO_FOLDER:'Choose a project folder explicitly.',CWD_REQUIRED:'Choose a project folder before starting a session.',CANCELLED:'Folder selection was cancelled; your earlier choice is retained.',CWD_REFUSED:'The selected folder is no longer available. Choose it again.',PROFILE_UNAVAILABLE:'No supported shell profile is available.',PIN_REQUIRED:'SIREN is locked. Unlock before continuing.',CAPACITY_EXCEEDED:'Terminal capacity is occupied or another operation is still pending.',DETACH_UNVERIFIED:'The prior attachment is unconfirmed; another view will not be attached.',CREATE_UNVERIFIED:'Session creation is unconfirmed; it will not be retried.',CLEANUP_FAILED:'Process cleanup is unconfirmed. Do not assume the session stopped.',CLEANUP_UNVERIFIED:'Stop was submitted but cleanup remains unconfirmed.',RESPONSE_REFUSED:'The response was invalid. No further action was inferred.',VIEW_DETACHED:'Display detached; background work may continue.',SESSION_REFUSED:'Choose a current session.',HOST_UNAVAILABLE:'Terminal is unavailable for this operation.',SENDER_REFUSED:'This window no longer has access. Reopen the current Terminal view.'});

export function createTerminalControls({container,bridge,epoch,projectId,available=false,terminalFactory,operationId,reviewPaste,search}={}){
 if(!container?.ownerDocument||typeof container.replaceChildren!=='function'||typeof container.ownerDocument.createElement!=='function'||typeof available!=='boolean'||available&&(!id(projectId)||!Number.isSafeInteger(epoch)||epoch<1||typeof terminalFactory!=='function'))throw TypeError('Scoped Terminal control adapters required');
 const document=container.ownerDocument,events=[],pending=new Set();let disposed=false,generation=0,busy=null,client=null,view=null,folder=null,profiles=[],sessions=[],profileId=null,selectedSessionId=null,displaySessionId=null,creationUncertain=false,detachUncertain=false,detachWork=null,code=available?'NO_FOLDER':'TERMINAL_UNAVAILABLE';const uncertainStops=new Map();
 const make=(tag,parent,label)=>{const node=document.createElement(tag);if(label!==undefined)node.textContent=label;parent.append(node);return node;};
 const listen=(node,name,fn)=>{node.addEventListener(name,fn);events.push(()=>node.removeEventListener(name,fn));};
 const root=make('section',container);root.className='terminal-controls';root.style.cssText='display:flex;flex-direction:column;gap:10px;color:var(--text,inherit);background:var(--panel-bg,transparent);font:inherit;min-height:0;';
 const toolbar=make('div',root);toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Terminal controls');toolbar.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px;border:1px solid var(--border,currentColor);border-radius:12px;';
 const buttons={};const button=(key,label,action)=>{const node=make('button',toolbar,label);node.type='button';node.dataset.action=key;node.style.cssText='font:inherit;color:inherit;background:var(--panel-bg,transparent);border:1px solid var(--border,currentColor);border-radius:8px;padding:6px 10px;';listen(node,'click',()=>{void action();});buttons[key]=node;return node;};
 button('folder','Choose folder',()=>pickFolder());button('refresh','Refresh',()=>refresh());
 const profileSelect=make('select',toolbar);profileSelect.setAttribute('aria-label','Shell profile');profileSelect.style.cssText='font:inherit;color:inherit;background:var(--panel-bg,transparent);border:1px solid var(--border,currentColor);border-radius:8px;padding:6px;';
 button('create','New terminal',()=>createSession());
 const sessionSelect=make('select',toolbar);sessionSelect.setAttribute('aria-label','Terminal session');sessionSelect.style.cssText=profileSelect.style.cssText;
 button('stop','Stop session',()=>stopSession());button('clear','Clear view',()=>clearView());
 const searchInput=make('input',toolbar);searchInput.type='search';searchInput.maxLength=4096;searchInput.placeholder='Find in output';searchInput.setAttribute('aria-label','Find in Terminal output');searchInput.style.cssText=profileSelect.style.cssText;
 button('find','Find',()=>find(searchInput.value));
 const folderLabel=make('p',root,'No folder selected.');folderLabel.style.cssText='margin:0;font-size:12px;overflow-wrap:anywhere;';
 const status=make('p',root);status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.cssText='margin:0;font-size:12px;overflow-wrap:anywhere;';
 const explanation=make('p',root,'Lock prevents new input; existing work continues in the background. Stop ends the selected session.');explanation.style.cssText='margin:0;font-size:12px;opacity:.75;';
 const display=make('div',root);display.setAttribute('aria-label','Terminal output');display.style.cssText='flex:1;min-height:160px;';
 const live=token=>!disposed&&available&&token.generation===generation;
 const track=promise=>{pending.add(promise);promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;};
 const activeCount=()=>sessions.filter(row=>row.state!=='exited'||uncertainStops.has(row.sessionId)).length;
 function paint(){
  if(disposed)return;const blocked=!available||!!busy;
  buttons.folder.disabled=buttons.refresh.disabled=blocked;buttons.create.disabled=blocked||!folder||!profiles.some(r=>r.profileId===profileId&&r.available)||creationUncertain||detachUncertain||activeCount()>=limits.sessions;
  buttons.stop.disabled=blocked||!selectedSessionId||uncertainStops.has(selectedSessionId)||!sessions.some(r=>r.sessionId===selectedSessionId&&!['exited','cleanup-failed'].includes(r.state));
  buttons.clear.disabled=buttons.find.disabled=blocked||!displaySessionId;searchInput.disabled=blocked||!displaySessionId;
  profileSelect.disabled=blocked;sessionSelect.disabled=blocked||detachUncertain;
  profileSelect.replaceChildren();if(!profiles.length){const option=make('option',profileSelect,'No shell profile');option.value='';}for(const row of profiles){const option=make('option',profileSelect,text(row.label)+(row.available?'':' · Unavailable'));option.value=row.profileId;option.disabled=!row.available;}profileSelect.value=profileId??'';
  sessionSelect.replaceChildren();if(!sessions.length){const option=make('option',sessionSelect,'No sessions');option.value='';}for(const row of sessions){const option=make('option',sessionSelect,text(row.cwdDisplay,80)+' · '+(uncertainStops.has(row.sessionId)?'Cleanup uncertain':row.state));option.value=row.sessionId;}sessionSelect.value=selectedSessionId??'';
  folderLabel.textContent=folder?text(folder.displayPath):'No folder selected.';
  const state=sessions.find(r=>r.sessionId===selectedSessionId)?.state;
  status.textContent=!available?'Terminal is unavailable in this build. See Help → Terminal availability.':busy?({folder:'Choosing folder…',refresh:'Refreshing…',create:'Starting session…',select:'Attaching session…',stop:'Stopping session…'}[busy.kind]??'Working…'):code?(reasons[code]??'Terminal could not confirm this operation.')+' ('+text(code,96)+')':displaySessionId?(view.snapshot().replaying?'Replaying retained output…':text(state??'Attached')):folder?'Ready to choose or start a session.':'Choose a project folder explicitly before starting a session.';
  root.setAttribute('aria-busy',String(!!busy));
 }
 function run(kind,action){
  if(disposed)return Promise.resolve(fail('VIEW_DISPOSED'));if(!available)return Promise.resolve(fail('TERMINAL_UNAVAILABLE'));if(busy)return Promise.resolve(fail('CAPACITY_EXCEEDED'));
  const token={kind,generation};busy=token;paint();
  return track((async()=>{try{const reply=await action(token);if(!live(token))return fail('VIEW_INACTIVE');code=reply.ok?null:reply.code;return reply;}catch{if(live(token))code='BRIDGE_UNAVAILABLE';return fail('BRIDGE_UNAVAILABLE');}finally{if(busy===token)busy=null;paint();}})());
 }
 function detachView(){
  displaySessionId=null;if(detachWork)return detachWork;
  // Own the actual detach before emulator/bridge callbacks can reenter. A
  // second local detach must not replace a still-unresolved real lease receipt.
  let resolve;const work=new Promise(r=>resolve=r);detachWork=work;track(work);
  const finish=result=>{if(!detached(result)){detachUncertain=true;code='DETACH_UNVERIFIED';}if(detachWork===work)detachWork=null;resolve(result);paint();};
  try{Promise.resolve(view.detach()).then(finish,()=>finish(fail('DETACH_UNVERIFIED')));}catch{finish(fail('DETACH_UNVERIFIED'));}return work;
 }
 async function attachKnown(token,sessionId){
  if(detachUncertain)return fail('DETACH_UNVERIFIED');
  if(displaySessionId||detachWork){const reply=await detachView();if(!detached(reply))return fail('DETACH_UNVERIFIED');if(!live(token))return fail('VIEW_INACTIVE');}
  if(!live(token))return fail('VIEW_INACTIVE');selectedSessionId=sessionId;
  const reply=await view.attach(sessionId);if(!live(token))return fail('VIEW_INACTIVE');
  if(reply.ok!==true){detachUncertain=true;return reply;}displaySessionId=sessionId;return reply;
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
  return attachKnown(token,value.sessionId);
 });}
 function selectSession(sessionId){return run('select',token=>{if(!id(sessionId)||!sessions.some(r=>r.sessionId===sessionId))return fail('SESSION_REFUSED');if(displaySessionId===sessionId)return pass({selected:true});return attachKnown(token,sessionId);});}
 function stopSession(){return run('stop',async token=>{
  const selected=sessions.find(r=>r.sessionId===selectedSessionId);if(!selected)return fail('SESSION_REFUSED');if(uncertainStops.has(selected.sessionId))return fail('CLEANUP_UNVERIFIED');if(selected.state==='exited')return fail('SESSION_NOT_RUNNING');
  // Reserve uncertainty before submission. A generation change cannot erase
  // the fact that Stop may already have affected this session.
  uncertainStops.set(selected.sessionId,'STOP_PENDING');
  const reply=await client.stop({sessionId:selected.sessionId});if(!live(token))return fail('VIEW_INACTIVE');const value=reply.ok?sessionValue(reply.value,epoch,projectId):null;
  if(!value||value.sessionId!==selected.sessionId||value.state!=='exited'){uncertainStops.set(selected.sessionId,reply.code??'RESPONSE_REFUSED');return fail(reply.code??'RESPONSE_REFUSED');}
  sessions=sessions.map(r=>r.sessionId===value.sessionId?value:r);uncertainStops.delete(value.sessionId);return pass({stopped:true});
 });}
 function clearView(){return disposed?fail('VIEW_DISPOSED'):!available?fail('TERMINAL_UNAVAILABLE'):view.clearView();}
 function find(query){return !disposed&&available&&view.find(query);}
 function detachDisplay(){
  if(disposed)return Promise.resolve(fail('VIEW_DISPOSED'));if(!available)return Promise.resolve(fail('TERMINAL_UNAVAILABLE'));generation++;displaySessionId=null;code='VIEW_DETACHED';
  // view.detach synchronously fences/clears before the first await.
  const reply=detachView();paint();return reply;
 }
 function dispose(){if(disposed)return;disposed=true;generation++;for(const off of events.splice(0))off();try{view?.dispose();}finally{client?.dispose();container.replaceChildren();}}
 async function drain(){while(pending.size)await Promise.all([...pending]);await view?.drain();await client?.drain();}
 const snapshot=()=>Object.freeze({available,disposed,busy:busy?.kind??null,code,folder,profileId,selectedSessionId,displaySessionId,creationUncertain,detachUncertain,sessions:Object.freeze(sessions.map(row=>Object.freeze({...row,uncertain:uncertainStops.has(row.sessionId)})))});
 listen(profileSelect,'change',()=>{if(!disposed&&available&&!busy&&profiles.some(r=>r.profileId===profileSelect.value&&r.available)){profileId=profileSelect.value;paint();}});
 listen(sessionSelect,'change',()=>{void selectSession(sessionSelect.value);});
 if(available){try{
  const mintControlId=operationId??(()=>crypto.randomUUID());if(typeof mintControlId!=='function')throw TypeError('Terminal operation-ID adapter required');
  // Capture before the injected minting callback; it can retire this display.
  client=createTerminalClient({bridge,epoch,operationId:()=>{const token=busy,value=mintControlId();if(!token||busy!==token||!live(token))throw Error('VIEW_INACTIVE');return value;}});
  view=createTerminalView({container:display,bridge:displayBridge(bridge,epoch,projectId,verified=>{if(!verified){detachUncertain=true;code='DETACH_UNVERIFIED';paint();}}),epoch,terminalFactory,operationId,reviewPaste,search});
  client.onState(event=>{if(disposed)return;const value=sessionValue(event.session,epoch,projectId);if(!value)return;sessions=sessions.map(row=>row.sessionId===value.sessionId?value:row);paint();});
 }catch(error){dispose();throw error;}}
 paint();return Object.freeze({refresh,pickFolder,createSession,selectSession,stopSession,clearView,find,detachDisplay,dispose,drain,snapshot});
}
