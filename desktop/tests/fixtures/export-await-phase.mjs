import {readFile,open,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {PresentationSession} from '../../src/windows/presentation.mjs';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {NativeDocsReads} from '../../src/windows/docs-reads.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {navigationFields} from '../../src/navigation/contracts.mjs';
import {childDirectory,ownedDirectory,ownedFile} from '../../src/projects/paths.mjs';
import {readOwnedBytes} from '../../src/projects/io.mjs';
import {digest} from '../../src/projects/atomic.mjs';
import {formatPresentationNotes} from '../../src/documents/presentation-notes.mjs';
import {formatSavedDocument} from '../../src/documents/export.mjs';
/** Exact production class body and runtime dependencies, with only an ownedFile
 * await-phase adapter. Deterministic last-cleanup revocation; no product hook or
 * fake success, registry, session, filesystem, byte formatter or write operation. */
export async function exportClassAtOwnedFile(kind,phase){
 const names={presenter:'NativePresenterExports',docs:'NativeDocsExports'};if(!Object.hasOwn(names,kind)||typeof phase!=='function')throw TypeError('Finite test publisher required');
 const name=names[kind],source=await readFile(new URL('../../src/windows/'+(kind==='presenter'?'presenter':'docs')+'-export.mjs',import.meta.url),'utf8');
 const dependencies={randomUUID,open,rename,unlink,join,WindowRegistry,PresentationSession,WorkspaceCoordinator,NativeDocsReads,ProjectStore,navigationFields,childDirectory,ownedDirectory,ownedFile:async path=>{await phase(path);return ownedFile(path);},readOwnedBytes,digest,formatPresentationNotes,formatSavedDocument};
 return new Function(...Object.keys(dependencies),source.replace(/^import .*;\r?\n/gm,'').replace('export class '+name,'class '+name)+'\nreturn '+name+';')(...Object.values(dependencies));
}
