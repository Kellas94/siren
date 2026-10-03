import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {sourceReadFixture} from './source-read-context.mjs';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {PrimaryPersistence} from '../../src/windows/primary.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {RecoveryStore} from '../../src/recovery/checkpoints.mjs';
import {invokeSourceRead} from '../../src/windows/source-bridge.mjs';
import {NativeSourceReads,selectedSourceReference} from '../../src/windows/source-reads.mjs';
import {NativeDocsReads} from '../../src/windows/docs-reads.mjs';
import {NativeWindowCatalog} from '../../src/windows/catalog.mjs';
import {DomainRepository} from '../../src/windows/domain.mjs';
import {workspaceEntities,workspaceMetadata} from '../../src/windows/entities.mjs';
const main=await readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');
export function mainSlice(from,to){const start=main.indexOf(from),stop=main.indexOf(to,start);assert.ok(start>=0&&stop>start,'Actual native main integration block missing');return main.slice(start,stop);}
export async function nativeSourceContext(){
 const f=await sourceReadFixture(),handlers=new Map();
 class IPCRealmCoordinator extends WorkspaceCoordinator{invoke(grant,intent,...rest){return super.invoke(grant,structuredClone(intent),...rest);}}
 const context=vm.createContext({WorkspaceCoordinator:IPCRealmCoordinator,PrimaryPersistence,ProjectStore,SourceRepository,RecoveryStore,invokeSourceRead,NativeSourceReads,selectedSourceReference,NativeDocsReads,NativeWindowCatalog,DomainRepository,workspaceEntities,workspaceMetadata,
  windowRegistry:f.registry,localPin:{state:()=>({unlocked:f.isUnlocked()})},dataRoot:f.root,writerOptions:{},projects:f.projects,recovery:new RecoveryStore(f.root),
  snapshot:f.selected,selectedId:f.selected.project.id,mode:'readonly',nativeReadonly:true,pinTransition:false,accountQuiesced:false,nativeShellFailure:false,writes:new Set(),bootstrap:{snapshot:f.selected},
  ipcMain:{handle:(channel,handler)=>handlers.set(channel,handler)},
 });
 vm.runInContext(mainSlice('const workspaceOwner=new WorkspaceCoordinator','const retireNativeViews')+';globalThis.owner=workspaceOwner;',context);
 return {...f,context,handlers};
}
