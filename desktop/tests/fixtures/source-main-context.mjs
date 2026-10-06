import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {sourceReadFixture} from './source-read-context.mjs';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {PrimaryPersistence} from '../../src/windows/primary.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {RecoveryStore} from '../../src/recovery/checkpoints.mjs';
import {invokeSourceRead,invokeSourceMutation} from '../../src/windows/source-bridge.mjs';
import {NativeWorkingSources} from '../../src/windows/working-sources.mjs';
import {NativeDocsEdits} from '../../src/windows/docs-edits.mjs';
import {NativeCodeDocs} from '../../src/windows/code-docs.mjs';
import {DocsLinkService} from '../../src/windows/docs.mjs';
import {NativeSourceReads,selectedSourceReference} from '../../src/windows/source-reads.mjs';
import {NativeSourceAnalysis} from '../../src/windows/source-analysis.mjs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {NativeDocsReads} from '../../src/windows/docs-reads.mjs';
import {NativeDocsSources} from '../../src/windows/docs-sources.mjs';
import {NativeDocsReferences} from '../../src/windows/docs-references.mjs';
import {NativeDeckNavigation} from '../../src/windows/deck-navigation.mjs';
import {NativeDiagramReads} from '../../src/windows/diagram-reads.mjs';
import {NativeDiagramEdits} from '../../src/windows/diagram-edits.mjs';
import {NativeDiagramExports} from '../../src/windows/diagram-export.mjs';
import {renderDiagramVector} from '../../src/windows/diagram-vector-render.mjs';
import {NativePresentationDecks} from '../../src/windows/presentation-deck.mjs';
import {PresentationSession} from '../../src/windows/presentation.mjs';
import {NativeWindowCatalog} from '../../src/windows/catalog.mjs';
import {DomainRepository} from '../../src/windows/domain.mjs';
import {NativeReadonlyViewSeals} from '../../src/windows/readonly-seals.mjs';
import {NativeAllViewControl} from '../../src/windows/control.mjs';
import {NativeAllWorkspaceBarrier} from '../../src/windows/source-barrier.mjs';
import {navigationFields} from '../../src/navigation/contracts.mjs';
import {failure} from '../../src/ipc.mjs';
import {workspaceEntities,workspaceMetadata} from '../../src/windows/entities.mjs';
const main=await readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');
export function mainSlice(from,to){const start=main.indexOf(from),stop=main.indexOf(to,start);assert.ok(start>=0&&stop>start,'Actual native main integration block missing');return main.slice(start,stop);}
export async function nativeSourceContext(){
 const f=await sourceReadFixture(),handlers=new Map();
 class IPCRealmCoordinator extends WorkspaceCoordinator{invoke(grant,intent,...rest){return super.invoke(grant,structuredClone(intent),...rest);}}
 const context=vm.createContext({WorkspaceCoordinator:IPCRealmCoordinator,PrimaryPersistence,ProjectStore,SourceRepository,RecoveryStore,invokeSourceRead,invokeSourceMutation,NativeWorkingSources,NativeDocsEdits,NativeCodeDocs,DocsLinkService,NativeSourceReads,selectedSourceReference,NativeDocsReads,NativeDiagramReads,NativeDiagramEdits,NativeDiagramExports,renderDiagramVector,NativePresentationDecks,PresentationSession,NativeWindowCatalog,DomainRepository,NativeReadonlyViewSeals,NativeAllViewControl,NativeAllWorkspaceBarrier,navigationFields,workspaceEntities,workspaceMetadata,
  NativeDocsSources,NativeDocsReferences,NativeDeckNavigation,windowRegistry:f.registry,localPin:{state:()=>({unlocked:f.isUnlocked()})},dataRoot:f.root,writerOptions:{},projects:f.projects,recovery:new RecoveryStore(f.root),
  snapshot:f.selected,selectedId:f.selected.project.id,mode:'readonly',nativeReadonly:true,pinTransition:false,accountQuiesced:false,nativeShellFailure:false,writes:new Set(),bootstrap:{snapshot:f.selected},
  failure,console,NativeSourceAnalysis,join,nativeShells:new Map(f.registry.listViews().map((record,i)=>[record.windowId,f.windows[i]])),rendererRoot:fileURLToPath(new URL('../../generated',import.meta.url)),readOwnedBytes:(path)=>readFile(path),ipcMain:{handle:(channel,handler)=>handlers.set(channel,handler)},
 });
 vm.runInContext(mainSlice('let workingSources=null','const retireNativeViews')+';globalThis.owner=workspaceOwner;',context);
 return {...f,context,handlers};
}
