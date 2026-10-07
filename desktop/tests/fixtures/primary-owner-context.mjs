import vm from 'node:vm';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {PrimaryPersistence} from '../../src/windows/primary.mjs';

// Synthetic VM boundary adapter. Structured clone matches Electron IPC data
// transfer; authority is never taken from the cloned renderer request.
// Isolated legacy storage tests retain their existing renderer close seam.
// This does not exercise or approve native all-view preparation; actual native
// control tests and Electron Code/Docs/close probes cover that distinct boundary.
export function installLegacyPreparation(context){
 context.prepareNativeWorkspace=()=>context.window.webContents.executeJavaScript('window.sirenDesktopBeginAccountTransition()');
 context.rollbackNativePreparation=()=>Promise.resolve();
}
export function installPrimaryOwner(context,{projects=()=>vm.runInContext('projects',context),recovery=()=>context.recovery}={}) {
 installLegacyPreparation(context);
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
