// Explicit candidate composition only. Native graph construction is a separate
// private admission prerequisite; no renderer, environment or CLI can supply it.
import {randomUUID} from 'node:crypto';
import {captureTerminalGraphAuthorities,shutdownTerminalGraph} from './shutdown-graph.mjs';
import {createDesktopTerminalBridge} from './desktop-bridge.mjs';
import {createTerminalPinLifecycleServices} from './pin-lifecycle-owner.mjs';
import {terminalPalette} from './desktop-theme.mjs';
import {invokeDock} from '../windows/dock-ipc.mjs';
const fail=code=>({ok:false,code});
export function createDesktopTerminalCandidate({createGraph=null}={}){
 if(createGraph!==null&&typeof createGraph!=='function')throw TypeError('Private qualified graph factory required');
 return function initializeDesktopTerminal(hooks){
  const {registry,ipcMain,getProjectId,isReady,workspaceEvent,pinHooks,windowFor,getAppearance,systemDark,isRollbackReady}=hooks;
  let graph=null,bridge=null,project=null,pinLifecycle=null,pending=null,serial=0,disposed=false,initializing=false,workspaceTransition=false;const entities=new Map();let rollbackPermit=null;const usedRollbackScopes=new WeakSet();
  function privateRollbackReady(){const p=rollbackPermit;if(!p)return false;try{return !disposed&&!workspaceTransition&&graph===p.graph&&project===p.project&&getProjectId()===p.project&&workspaceEvent().sender===p.event.sender&&workspaceEvent().senderFrame===p.event.senderFrame&&registry.isCurrent(p.grant)&&p.guard.isCurrent()&&isRollbackReady(p.scope)===true&&rollbackPermit===p;}catch{return false;}}
  function entityId(id){if(!id)return null;if(!entities.has(id))entities.set(id,'terminal_'+randomUUID());return entities.get(id);}
  function ready(){return !disposed&&project===getProjectId()&&isReady()===true;}
  function send(event,channel,payload){if(!ready()||registry.capture(event)?.role!=='terminal')throw Error('SENDER_REFUSED');event.senderFrame.send(channel,payload);}
  async function retireDisplays(){bridge?.invalidate();for(const record of registry.listViews().filter(r=>r.role==='terminal'))if(!await registry.discardViewAsync(record.windowId))throw Error('WINDOW_DESTROY_FAILED');}
  async function shutdown(reason='Project changed'){
   bridge?.dispose();bridge=null;pinLifecycle=null;const old=graph;graph=null;project=null;
   if(old){const receipt=await shutdownTerminalGraph(old,{code:77,deadlineMs:5000,shutdownId:'desktop_shutdown_'+ ++serial});if(!receipt?.actualSettled||receipt.unknown)throw Error('HOST_SHUTDOWN_UNVERIFIED');}
  }
  async function ensure(event){
   if(disposed||!createGraph||isReady()!==true)return false;
   const grant=registry.capture(event),admission=registry.captureAdmissionGuard(grant),selected=getProjectId();if(grant?.role!=='workspace'||grant.projectId!==selected||!admission)return false;
   if(graph&&project===selected){const m=captureTerminalGraphAuthorities(graph,registry,project);if(!m)return false;if(!m.access.currentRouter()){if((await m.access.reopen(workspaceEvent())).ok!==true)return false;}return !!bridge;}
   if(pending)return false;
   const work=(async()=>{
    if(graph)await shutdown();
    let next;try{next=await createGraph({registry,projectId:selected,workspaceEvent:workspaceEvent(),access:{prepareWorkspace:async()=>{await retireDisplays();if(!initializing&&!workspaceTransition)await pinHooks.prepareWorkspace();},retireViews:async()=>{if(!initializing&&!workspaceTransition)await pinHooks.retireViews();},rollbackWorkspace:async()=>{if(!initializing)await pinHooks.rollbackWorkspace();},isReady:()=>getProjectId()===selected&&(isReady()===true||privateRollbackReady())}});}catch{return false;}
    const members=captureTerminalGraphAuthorities(next,registry,selected);if(!members)return false;
    if(disposed||getProjectId()!==selected||isReady()!==true||!admission.isCurrent()){await shutdownTerminalGraph(next,{code:77,deadlineMs:5000,shutdownId:'desktop_stale_'+ ++serial});return false;}
    graph=next;project=selected;
    bridge=createDesktopTerminalBridge({graph,registry,projectId:project,getProjectId,isReady,send});
    pinLifecycle=createTerminalPinLifecycleServices({...pinHooks,afterUnlock:async result=>{const prepared=await pinHooks.afterUnlock(result);if(result?.ok===true&&ready()){const event=workspaceEvent();registry.activateWorkspace({entryUrl:event.sender.getURL()});}return prepared;},terminalAccess:members.access});
    // A newly admitted graph must establish the initial CLOSE/fresh OPEN with
    // its real host before publishing a context or accepting renderer requests.
    initializing=true;try{if((await members.access.beginLock('Terminal initial access')).ok!==true||(await members.access.reopen(workspaceEvent())).ok!==true){await shutdown();return false;}}finally{initializing=false;}
    return ready();
   })();pending=work;try{return await work;}finally{pending=null;}
  }
  async function launch(event,...args){if(args.length)return fail('REQUEST_REFUSED');if(!await ensure(event))return fail('TERMINAL_UNAVAILABLE');return hooks.openWindow(event,{role:'terminal',entityId:entityId(project)});}
  const context=event=>bridge?.context(event)??fail('TERMINAL_UNAVAILABLE');
  const theme=async(event,...args)=>{if(args.length||context(event).available!==true)return fail('SENDER_REFUSED');const scope=registry.capture(event),appearance=await getAppearance();if(!registry.isCurrent(scope)||context(event).available!==true)return fail('SENDER_REFUSED');return {ok:true,palette:terminalPalette(appearance?.theme,systemDark())};};
  ipcMain.handle('siren:terminal-launch',launch);
  ipcMain.handle('siren:terminal-capability',event=>registry.capture(event)?.role==='workspace'&&isReady()===true?{ok:true,available:!!createGraph}:fail('TERMINAL_UNAVAILABLE'));
  ipcMain.handle('siren:terminal',(event,method,payload,...args)=>bridge?.invoke(event,method,payload,...args)??fail('TERMINAL_UNAVAILABLE'));
  ipcMain.handle('siren:terminal-context',(event,...args)=>args.length?fail('REQUEST_REFUSED'):context(event));
  ipcMain.handle('siren:terminal-theme',theme);
  ipcMain.handle('siren:terminal-placement',(event,...args)=>{if(args.length||context(event).available!==true)return fail('SENDER_REFUSED');const grant=registry.capture(event),row=registry.surfaceRecords().find(r=>r.windowId===grant?.windowId);if(!row)return fail('ACCESS_REFUSED');const placement=row.placement==='attached'?'detached':'attached';const r=invokeDock({registry,event,method:placement==='attached'?'attach':'detach',payload:{windowId:row.windowId}});return r.ok?{ok:true,placement}:r;});
  function appearanceChanged(){for(const record of registry.listViews().filter(r=>r.role==='terminal')){const view=windowFor(record.windowId);if(view&&!view.isDestroyed())try{send({sender:view.webContents,senderFrame:view.webContents.mainFrame},'siren:terminal-theme',{});}catch{}}}
  return Object.freeze({entityIds:id=>createGraph&&isReady()===true?[entityId(id)]:[],get pinLifecycle(){return pinLifecycle;},retireDisplays,shutdown,appearanceChanged,
   async prepareTransition(){const members=graph&&captureTerminalGraphAuthorities(graph,registry,project);if(members&&!members.access.stats().inputFenced){bridge?.invalidate();workspaceTransition=true;try{const r=members.access.beginLock('Workspace transition');if((await r).ok!==true)throw Error('TERMINAL_FENCE_UNVERIFIED');}finally{workspaceTransition=false;}}await retireDisplays();},
   async rollbackTransition(scope){
    if(scope!==undefined){
      if(!scope||typeof scope!=='object'||usedRollbackScopes.has(scope)||typeof isRollbackReady!=='function'||isRollbackReady(scope)!==true)throw Error('ROLLBACK_SCOPE_REFUSED');
      usedRollbackScopes.add(scope);
    }
    if(disposed||initializing||workspaceTransition||getProjectId()!==project){if(scope!==undefined)throw Error('ROLLBACK_SCOPE_REFUSED');return;}
    if(!graph)return;
    const members=captureTerminalGraphAuthorities(graph,registry,project),status=members?.access.stats();
    if(status?.transition==='open'){if(scope!==undefined)throw Error('ROLLBACK_SCOPE_REFUSED');return;}
    if(!status?.inputFenced)return;
    if(scope===undefined){
      if(isReady()!==true)return;
      const event=workspaceEvent();registry.activateWorkspace({entryUrl:event.sender.getURL()});const r=await members.access.reopen(event);if(!r.ok)throw Error('TERMINAL_REOPEN_UNVERIFIED');return;
    }
    if(rollbackPermit)throw Error('ROLLBACK_SCOPE_REFUSED');
    const event=Object.freeze({...workspaceEvent()});registry.activateWorkspace({entryUrl:event.sender.getURL()});
    const grant=registry.capture(event),guard=registry.captureAdmissionGuard(grant);
    if(grant?.role!=='workspace'||grant.projectId!==project||!guard)throw Error('ROLLBACK_SCOPE_REFUSED');
    const p={scope,graph,project,event,grant,guard};rollbackPermit=p;
    try{
      if(!privateRollbackReady())throw Error('ROLLBACK_SCOPE_REFUSED');
      const r=await members.access.reopen(event);if(!r.ok)throw Error('TERMINAL_REOPEN_UNVERIFIED');
      if(!privateRollbackReady()){
        // OPEN may have completed just before scope retirement. Fence through
        // the existing coordinator without forwarding another MAIN preparation.
        if(!members.access.stats().inputFenced){bridge?.invalidate();workspaceTransition=true;try{const closed=await members.access.beginLock('Workspace rollback retired');if(!closed.ok)throw Error('TERMINAL_ROLLBACK_FENCE_UNVERIFIED');}finally{workspaceTransition=false;}}
        throw Error('TERMINAL_REOPEN_UNVERIFIED');
      }
    }finally{if(rollbackPermit===p)rollbackPermit=null;}
   },
   async dispose(){disposed=true;await shutdown();},snapshot:()=>Object.freeze({configured:!!createGraph,project,available:!!bridge&&ready()})});
 };
}
