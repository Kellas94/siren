import vm from 'node:vm';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {PrimaryPersistence} from '../../src/windows/primary.mjs';

// Synthetic VM boundary adapter. Structured clone matches Electron IPC data
// transfer; authority is never taken from the cloned renderer request.
export function installPrimaryOwner(context,{projects=()=>vm.runInContext('projects',context),recovery=()=>context.recovery}={}) {
 const captures=new WeakMap(),window=context.window;
 const state=()=>({projectId:context.selectedId,generation:context.bootstrap.selectionGeneration,mode:context.mode,readonly:context.nativeReadonly});
 const registry={capture:()=>{const policy=state();const grant=Object.freeze({role:'workspace',projectId:policy.projectId,entityIds:[],windowId:'fixture-primary'});captures.set(grant,policy);return grant;},
  isCurrent:grant=>{const prior=captures.get(grant),live=state();return Boolean(prior&&Object.keys(live).every(key=>live[key]===prior[key]));},
  eventFor:grant=>captures.has(grant)?{sender:window.webContents,senderFrame:window.webContents.mainFrame}:null,caller:()=>null};
 const owner=new WorkspaceCoordinator({registry,sources:()=>({}),access:(_g,scope)=>!context.accountQuiesced&&!context.writes.selectionQuiesced&&
  (scope.action==='recovery'||context.mode==='normal'&&!context.nativeReadonly),
  primary:new PrimaryPersistence({projects:()=>projects(),recovery:recovery(),onSelected:current=>{context.snapshot=current;context.bootstrap={...context.bootstrap,snapshot:current};}})});
 registry.capturePrimary=registry.capture;
 context.windowRegistry=registry;context.workspaceOwner={saveWorkspace:(grant,request)=>owner.saveWorkspace(grant,structuredClone(request))};
 return owner;
}
