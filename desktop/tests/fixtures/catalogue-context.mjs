import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {NativeDiagramEdits} from '../../src/windows/diagram-edits.mjs';
import {diagramContext} from './diagram-context.mjs';
import {DomainRepository} from '../../src/windows/domain.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {workspaceMetadata} from '../../src/windows/entities.mjs';

// Real repository/FIFO/registry/admission contracts, simulated native handles.
// This fixture is not Electron execution or a GUI qualification.
export async function catalogueContext(){
 const base=await diagramContext();let selected=base.selected,allow=true,beforeFactory=async()=>{},beforeAdmit=async()=>{},showHook=()=>{},failCleanup=false;const windows=[],shown=[],failures=[],notifications=[];
 function native(url){const w=new EventEmitter();w.id=windows.length+1;let destroyed=false;w.isDestroyed=()=>destroyed;w.isMinimized=()=>false;w.focus=()=>{};w.restore=()=>{};w.destroy=()=>{if(failCleanup)throw Error('cleanup refused');destroyed=true;w.webContents.emit('destroyed');w.emit('closed');};w.close=w.destroy;const wc=w.webContents=new EventEmitter();Object.assign(wc,{id:w.id+100,mainFrame:{url},getURL:()=>wc.mainFrame.url,isDestroyed:()=>destroyed});windows.push(w);return w;}
 const registry=new WindowRegistry({authorize:()=>allow?{projectId:selected.project.id,mode:'normal',access:'write',entityIds:[...workspaceMetadata(selected).diagrams.map(d=>d.id),'doc-a',base.ref.sourceId]}:null,createWindow:async options=>{await beforeFactory();return native(options.mainFrameUrl);}});
 const primary=native('siren://app/home.html');registry.bindWorkspace(primary);registry.activateWorkspace({entryUrl:'siren://app/home.html'});
 for(const [role,entityId]of [['diagram','diagram-a'],['docs','doc-a'],['code',base.ref.sourceId]])await registry.openView({role,entityId});
 const event=i=>({sender:windows[i].webContents,senderFrame:windows[i].webContents.mainFrame}),grant=i=>i===0?registry.capturePrimary(event(i)):registry.capture(event(i));
 let edits;
 const domains=new DomainRepository({projects:({canWrite})=>new ProjectStore(base.root,{canSave:canWrite}),sources:({canWrite})=>new SourceRepository(base.root,{canWrite}),validatePatch:()=>true,allocateDiagramId:()=> 'created-b'});
 const access=(g,s)=>s.action==='create-catalogue-diagram'?allow&&(g.role==='workspace'||edits?.isWorking(g)):s.action==='read-domain'||['edit-domain','flush-domain'].includes(s.action)&&edits?.isWorking(g);
 const refresh=async(result,scope)=>{if(result.ok&&scope.isCurrent())selected=await base.projects.readProject(scope.projectId);return result;};
 const owner=new WorkspaceCoordinator({registry,sources:()=>base.sources,domains:{read:(...args)=>domains.read(...args),apply:async(k,p,s)=>refresh(await domains.apply(k,p,s),s),flush:(...args)=>domains.flush(...args),appendCatalogueDiagram:async(p,s)=>refresh(await domains.appendCatalogueDiagram(p,s),s)},access});
 edits=new NativeDiagramEdits({registry,owner,enabled:()=>allow,snapshotFor:()=>selected});
 const admitted=await edits.admit(grant(1));if(!admitted.ok)throw Error('fixture origin admission refused');
 const windowFor=id=>windows.find(w=>registry.capture({sender:w.webContents,senderFrame:w.webContents.mainFrame})?.windowId===id);
 return {...base,registry,owner,edits,windows,shown,failures,notifications,event,grant,windowFor,getSelected:()=>selected,
  setFactory:f=>beforeFactory=f,setAdmit:f=>beforeAdmit=f,setShow:f=>showHook=f,setCleanupFailure:v=>failCleanup=v,setAllow:v=>allow=v,
  adapters:{registry,owner,canBrowse:()=>allow,canCreate:g=>access(g,{action:'create-catalogue-diagram'}),snapshotFor:()=>selected,windowFor,
   admit:async(g)=>{await beforeAdmit();return edits.admit(g);},isWorking:g=>edits.isWorking(g),
   show:v=>{showHook(v);shown.push(v);},onCreated:r=>notifications.push(r),onNativeFailure:r=>failures.push(r)}};
}
