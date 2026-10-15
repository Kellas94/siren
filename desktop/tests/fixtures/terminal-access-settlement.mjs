import assert from 'node:assert/strict';
import {win32 as path} from 'node:path';
import {TerminalProductionManager} from '../../src/terminal/production-manager.mjs';
import {TerminalRequestRouter} from '../../src/terminal/request-router.mjs';
import {CwdAuthority} from '../../src/terminal/cwd.mjs';
import {createShellProfileCatalogue} from '../../src/terminal/profiles.mjs';
import {privateManager,deferred,until,inertTick} from './terminal-manager-global.mjs';
const {TerminalProductionAccessTransitions}=await import('../../src/terminal/production-access-transitions.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
function directory(value){const p=path.normalize(value),root=path.parse(p).root,parts=p.slice(root.length).split('\\').filter(Boolean),ancestors=[{path:root,identity:root,directory:true,reparse:false}];let parent=root;for(const part of parts){parent=path.join(parent,part);ancestors.push({path:parent,identity:parent,directory:true,reparse:false});}return {canonicalPath:p,identity:p,directory:true,reparse:false,ancestors};}
function executable(value){const p=path.normalize(value);return {canonicalPath:p,identity:p,file:true,reparse:false,ancestors:directory(path.dirname(p)).ancestors};}
export function setup(options={}){
 assert.equal(typeof TerminalProductionAccessTransitions,'function','Missing additive access-transition coordinator');
 const h=privateManager(options.manager),event={sender:h.window.webContents,senderFrame:h.window.webContents.mainFrame},trace=[];
 const cwd=new CwdAuthority({pickDirectory:options.pickDirectory??(()=>Promise.resolve({canceled:false,filePaths:['C:\\Project']})),protectedRoots:['C:\\Protected'],inspectDirectory:p=>Promise.resolve(directory(p)),authorize:g=>h.registry.isCurrent(g),captureAdmission:g=>h.registry.captureAdmissionGuard(g),maxPending:1});
 const catalogue=createShellProfileCatalogue({getSystemDirectory:options.getSystemDirectory??(()=>Promise.resolve('C:\\Windows\\System32')),inspectExecutable:p=>Promise.resolve(executable(p)),readEnvironment:()=>Promise.resolve({SYSTEMROOT:'C:\\Windows',PATH:'C:\\Windows\\System32'}),authorize:()=>h.registry.isCurrent(h.grant),captureAdmission:()=>h.registry.captureAdmissionGuard(h.grant),maxPending:1});
 const router=new TerminalRequestRouter({registry:h.registry,manager:h.manager});let controller;
 const observeManager=()=>Reflect.apply(TerminalProductionManager.prototype.stats,h.manager,[]),observeRouter=()=>Reflect.apply(TerminalRequestRouter.prototype.stats,router,[]);
 const wrapped=(name,hook)=>()=>{const m=observeManager();trace.push({name,closed:m.inputClosed,epoch:m.accessGeneration,revoked:observeRouter().revoked});return hook?hook({h,cwd,catalogue,router,controller}):Promise.resolve();};
 const config={manager:h.manager,router,registry:h.registry,cwdAuthority:cwd,profileCatalogues:[catalogue],projectId:'project1',prepareWorkspace:wrapped('prepare',options.prepare),retireViews:wrapped('retire',options.retire),rollbackWorkspace:wrapped('rollback',options.rollback),isReady:()=>options.isReady?options.isReady({h,controller}):true,deadlineMs:options.deadlineMs??200};
 controller=new TerminalProductionAccessTransitions(config);
 return {h,event,trace,cwd,catalogue,router,controller,config,async end(){await h.end();}};
}
