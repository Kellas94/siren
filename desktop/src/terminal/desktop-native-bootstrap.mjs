// Private configured-tree DATA bootstrap. It cannot admit native execution.
import * as fs from 'node:fs/promises';
import {join,resolve,dirname,parse,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {types,isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {DESKTOP_NATIVE_RESOURCE_PATHS,captureDesktopNativeRuntimeResources} from './desktop-native-runtime-resources.mjs';
import {createDesktopNativeOwnedTreeVerifier} from './desktop-native-owned-tree.mjs';
const SOURCE_NAMES=["src/account/access.mjs","src/account/credentials.mjs","src/account/local-pin.mjs","src/account/oidc.mjs","src/account/permit.mjs","src/account/pin-lifecycle.mjs","src/account/pin-protection.mjs","src/account/pin-protocol.mjs","src/account/pin-worker.mjs","src/account/service.mjs","src/appearance/contracts.mjs","src/appearance/ipc.mjs","src/appearance/render.mjs","src/appearance/store.mjs","src/data-root.mjs","src/desktop-launch.mjs","src/documents/context.mjs","src/documents/diagram-catalogue.mjs","src/documents/diagram-embed-assets.mjs","src/documents/diagram-embed-bundle.mjs","src/documents/diagram-embed-export.mjs","src/documents/diagram-embed-publication.mjs","src/documents/diagram-embed-svg.mjs","src/documents/diagram-embeds.mjs","src/documents/diagram-layout.mjs","src/documents/diagram-metadata.mjs","src/documents/diagram-selection.mjs","src/documents/export.mjs","src/documents/presentation-edits.mjs","src/documents/presentation-notes.mjs","src/help/native.mjs","src/ipc.mjs","src/main.mjs","src/navigation/authority.mjs","src/navigation/backup-export.mjs","src/navigation/catalog.mjs","src/navigation/continue.mjs","src/navigation/contracts.mjs","src/navigation/document-create.mjs","src/navigation/entries.mjs","src/navigation/ipc.mjs","src/navigation/project-copies.mjs","src/navigation/resolver.mjs","src/navigation/service.mjs","src/navigation/source-bundle-copy.mjs","src/navigation/source-import.mjs","src/navigation/store.mjs","src/navigation/transition-receipts.mjs","src/navigation/window-labels.mjs","src/preload.cjs","src/projects/atomic.mjs","src/projects/budgets.mjs","src/projects/domain-validation.mjs","src/projects/import-admission.mjs","src/projects/import-status.mjs","src/projects/import-validation.mjs","src/projects/import-validator-window.mjs","src/projects/io.mjs","src/projects/migration.mjs","src/projects/paths.mjs","src/projects/selection.mjs","src/projects/store.mjs","src/protocol.mjs","src/publisher-config.mjs","src/recovery/access.mjs","src/recovery/checkpoints.mjs","src/recovery/diagnostics.mjs","src/recovery/native-process.mjs","src/recovery/processes.mjs","src/recovery/sessions.mjs","src/sources/analysis.mjs","src/sources/bundle-import.mjs","src/sources/diff-worker.mjs","src/sources/ipc.mjs","src/sources/manifest.mjs","src/sources/metrics.mjs","src/sources/migration.mjs","src/sources/read-ipc.mjs","src/sources/readers.mjs","src/sources/recovery.mjs","src/sources/repository.mjs","src/sources/text-model.mjs","src/start.mjs","src/terminal/candidate-initializer.mjs","src/terminal/command-protocol.mjs","src/terminal/contracts.mjs","src/terminal/creator-commands.mjs","src/terminal/creator-session.mjs","src/terminal/creator-startup.mjs","src/terminal/credits.mjs","src/terminal/cwd.mjs","src/terminal/desktop-bridge.mjs","src/terminal/desktop-native-filesystem.mjs","src/terminal/desktop-native-host-loader.mjs","src/terminal/desktop-native-host-reservation.mjs","src/terminal/desktop-native-initializer.mjs","src/terminal/desktop-native-providers.mjs","src/terminal/desktop-native-runtime-creator.mjs","src/terminal/desktop-native-runtime-host.mjs","src/terminal/desktop-native-runtime-resources.mjs","src/terminal/desktop-native-runtime.mjs","src/terminal/desktop-native-utility-launcher.mjs","src/terminal/desktop-theme.mjs","src/terminal/events.mjs","src/terminal/host-async-captured-operation.mjs","src/terminal/host-async-receipt-contract.mjs","src/terminal/host-candidate-ownership.mjs","src/terminal/input-gate.mjs","src/terminal/native-three-lane-stream.mjs","src/terminal/output.mjs","src/terminal/pin-lifecycle-owner.mjs","src/terminal/policy.mjs","src/terminal/production-access-transitions.mjs","src/terminal/production-aggregate-gate.mjs","src/terminal/production-attachment-output.mjs","src/terminal/production-backend.mjs","src/terminal/production-control-channel.mjs","src/terminal/production-creator-entry.mjs","src/terminal/production-creator.mjs","src/terminal/production-gate-link.mjs","src/terminal/production-history-channel.mjs","src/terminal/production-manager.mjs","src/terminal/production-provider-loader.mjs","src/terminal/production-remote-output.mjs","src/terminal/production-session-state.mjs","src/terminal/profile-catalogue-owner.mjs","src/terminal/profiles.mjs","src/terminal/provider-lifetime.mjs","src/terminal/remote-output.mjs","src/terminal/request-router.mjs","src/terminal/session-cleanup.mjs","src/terminal/session-command-channel.mjs","src/terminal/session-link.mjs","src/terminal/shutdown-graph.mjs","src/terminal/startup-protocol.mjs","src/terminal/three-lane-bootstrap-codec.mjs","src/terminal/three-lane-bootstrap-reader.mjs","src/ui/terminal/preload.cjs","src/updates/download.mjs","src/updates/github.mjs","src/updates/manifest.mjs","src/updates/service.mjs","src/windows/catalog.mjs","src/windows/code-docs.mjs","src/windows/control.mjs","src/windows/coordinator.mjs","src/windows/deck-navigation.mjs","src/windows/diagram-catalogue.mjs","src/windows/diagram-create.mjs","src/windows/diagram-edits.mjs","src/windows/diagram-export.mjs","src/windows/diagram-reads.mjs","src/windows/diagram-vector-render.mjs","src/windows/dock-ipc.mjs","src/windows/docs-diagram-refresh.mjs","src/windows/docs-diagrams.mjs","src/windows/docs-edits.mjs","src/windows/docs-export.mjs","src/windows/docs-reads.mjs","src/windows/docs-references.mjs","src/windows/docs-sources.mjs","src/windows/docs.mjs","src/windows/domain.mjs","src/windows/entities.mjs","src/windows/factory.mjs","src/windows/focus.mjs","src/windows/geometry.mjs","src/windows/home-admission.mjs","src/windows/ipc.mjs","src/windows/layout-memory.mjs","src/windows/layout.mjs","src/windows/preload.cjs","src/windows/presentation-deck.mjs","src/windows/presentation-ipc.mjs","src/windows/presentation-preload.cjs","src/windows/presentation-render.mjs","src/windows/presentation.mjs","src/windows/presenter-export.mjs","src/windows/primary.mjs","src/windows/readiness.mjs","src/windows/readonly-seals.mjs","src/windows/registry.mjs","src/windows/source-analysis.mjs","src/windows/source-barrier.mjs","src/windows/source-bridge.mjs","src/windows/source-context.mjs","src/windows/source-reads.mjs","src/windows/surface.mjs","src/windows/working-sources.mjs"];
const GENERATED_NAMES=["desktop/generated/app.html","desktop/generated/home.html","desktop/generated/build.json","desktop/generated/import-validation.html","desktop/generated/presentation-render.html","desktop/generated/diagram-vector.html","desktop/generated/code-analysis-worker.cjs","desktop/generated/windows/code.html","desktop/generated/windows/docs.html","desktop/generated/windows/diagram.html","desktop/generated/windows/presenter.html","desktop/generated/windows/audience.html","desktop/generated/assets/shell.js","desktop/generated/assets/shell.css","desktop/generated/assets/home-workspace.js","desktop/generated/assets/diagram-catalogue.css","desktop/generated/terminal-launch-preload.cjs","desktop/generated/windows/terminal.html","desktop/generated/windows/terminal-licenses.txt"];
const PACKAGE_NAMES=["@codemirror/autocomplete","@codemirror/commands","@codemirror/lang-python","@codemirror/language","@codemirror/search","@codemirror/state","@codemirror/view","@lezer/common","@lezer/highlight","@lezer/lr","@lezer/python","@marijn/find-cluster-break","crelt","entities","jose","jsonc-parser","oauth4webapi","openid-client","parse5","style-mod","w3c-keyname"];
const ELECTRON_NAMES=["electron/chrome_100_percent.pak","electron/chrome_200_percent.pak","electron/d3dcompiler_47.dll","electron/dxcompiler.dll","electron/dxil.dll","electron/electron.exe","electron/ffmpeg.dll","electron/icudtl.dat","electron/LICENSE","electron/LICENSES.chromium.html","electron/resources.pak","electron/snapshot_blob.bin","electron/v8_context_snapshot.bin","electron/version","electron/vk_swiftshader_icd.json","electron/vk_swiftshader.dll","electron/vulkan-1.dll"];
export const REQUIRED_APPLICATION_PATHS=Object.freeze([...SOURCE_NAMES.map(p=>'desktop/'+p),'desktop/src/terminal/desktop-native-bootstrap.mjs','desktop/src/terminal/desktop-native-owned-tree.mjs',...GENERATED_NAMES,'desktop/package.json','desktop/package-lock.json','desktop/native/generated/process-identity.exe','desktop/native/generated/process-identity.json',...PACKAGE_NAMES.map(p=>'desktop/node_modules/'+p+'/package.json')].sort());
const FILESYSTEM='desktop/native/terminal-filesystem-candidate/build/Release/siren_terminal_filesystem_candidate.node';
const HASH=/^[a-f0-9]{64}$/,MAX=8192,FILE=268435456,TOTAL=4294967296;
const fail=()=>{throw Error('BOOTSTRAP_ARGUMENT_REFUSED');};
const digest=b=>createHash('sha256').update(b).digest('hex');
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'length').get,backingOf=Object.getOwnPropertyDescriptor(typed,'buffer').get;
function data(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(k=>!keys.includes(k)))fail();
 const out=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();out[key]=d.value;}return out;
}
function list(value){
 if(!value||types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)fail();
 const n=Object.getOwnPropertyDescriptor(value,'length')?.value;if(!Number.isInteger(n)||n>MAX||Reflect.ownKeys(value).length!==n+1)fail();
 const out=[];for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();out.push(d.value);}return out;
}
function bytes(value,max){
 if(types.isProxy(value)||!Buffer.isBuffer(value)||Object.getPrototypeOf(value)!==Buffer.prototype)fail();
 let n,backing;try{n=lengthOf.call(value);backing=backingOf.call(value);}catch{fail();}
 if(!Number.isInteger(n)||n<1||n>max||types.isSharedArrayBuffer(backing))fail();
 const out=Buffer.alloc(n);Uint8Array.prototype.set.call(out,value);return out;
}
function relative(value,root=false){
 if(root&&value==='')return value;
 if(typeof value!=='string'||value.length>1024||!value.isWellFormed())fail();
 const parts=value.split('/');if(parts.length>64||parts.some(p=>!p||p==='.'||p==='..'||p.length>255||/[\\<>:"|?*\x00-\x1f\x7f-\x9f]/.test(p)||/[ .]$/.test(p)||p.normalize('NFC')!==p||/~\d/.test(p)||/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i.test(p)))fail();return value;
}
function rows(value,sorted=false){
 let total=0,previous=null;const seen=new Set(),out=[];
 for(const item of list(value)){
  const r=data(item,['path','bytes','sha256']);relative(r.path);const folded=r.path.toUpperCase();
  if(seen.has(folded)||sorted&&previous!==null&&previous>=r.path||!Number.isSafeInteger(r.bytes)||r.bytes<0||r.bytes>FILE||typeof r.sha256!=='string'||!HASH.test(r.sha256))fail();
  seen.add(folded);previous=r.path;total+=r.bytes;if(total>TOTAL)fail();out.push(Object.freeze({path:r.path,bytes:r.bytes,sha256:r.sha256}));
 }return Object.freeze(out);
}
function root(value){if(typeof value!=='string'||value.length>1024||! /^[A-Za-z]:\\/.test(value)||/[\x00-\x1f]/.test(value)||!isAbsolute(value)||resolve(value)!==value||value===parse(value).root)fail();return value;}
function manifest(value,directory){
 const m=data(value,['directory','files','directories']);if(root(m.directory)!==directory)fail();
 const files=rows(m.files),directories=list(m.directories).map(p=>relative(p,true)),seen=new Set(files.map(r=>r.path.toUpperCase())),parents=new Set();
 for(const p of directories){if(seen.has(p.toUpperCase()))fail();seen.add(p.toUpperCase());parents.add(p);}
 if(!parents.has('')||!files.length)fail();
 for(const p of [...directories.filter(p=>p!==''),...files.map(r=>r.path)]){const index=p.lastIndexOf('/');if(!parents.has(index<0?'':p.slice(0,index)))fail();}
 const table=new Map(files.map(r=>[r.path,r]));
 for(const name of [...REQUIRED_APPLICATION_PATHS,...DESKTOP_NATIVE_RESOURCE_PATHS,FILESYSTEM,...ELECTRON_NAMES])if(!table.has(name))fail();
 return Object.freeze({directory,files,directories:Object.freeze(directories)});
}
function parseJson(value){try{return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(value));}catch{fail();}}
export function captureNativeBootstrapInputs(value,directory){
 const v=data(value,['schema','runtimeManifestBytes','applicationRosterBytes','approvedSourceBuildReceiptBytes','expectedPins']);if(v.schema!==1)fail();
 const pins=data(v.expectedPins,['runtimeTreeSha256','applicationRosterSha256','approvedSourceBuildReceiptSha256']);if(Object.values(pins).some(p=>typeof p!=='string'||!HASH.test(p)))fail();
 const runtimeManifestBytes=bytes(v.runtimeManifestBytes,16777216),applicationRosterBytes=bytes(v.applicationRosterBytes,16777216),approvedSourceBuildReceiptBytes=bytes(v.approvedSourceBuildReceiptBytes,1048576);
 if(digest(runtimeManifestBytes)!==pins.runtimeTreeSha256||digest(applicationRosterBytes)!==pins.applicationRosterSha256||digest(approvedSourceBuildReceiptBytes)!==pins.approvedSourceBuildReceiptSha256)fail();
 const m=manifest(parseJson(runtimeManifestBytes),root(directory)),r=data(parseJson(applicationRosterBytes),['schema','files']);if(r.schema!==1)fail();const application=rows(r.files,true),table=new Map(m.files.map(x=>[x.path,x])),actual=new Map(application.map(x=>[x.path,x]));
 for(const name of REQUIRED_APPLICATION_PATHS)if(!actual.has(name))fail();
 for(const row of application)if(!isDeepStrictEqual(row,table.get(row.path)))fail();
 return Object.freeze({manifest:m,application,inputs:Object.freeze({runtimeManifestBytes,applicationRosterBytes,approvedSourceBuildReceiptBytes}),pins:Object.freeze({...pins})});
}
export async function captureConfiguredRuntime(value,directory){
 const m=manifest(value,root(directory)),table=new Map(m.files.map(row=>[row.path,row]));
 const resources=await captureDesktopNativeRuntimeResources({directory,pins:Object.fromEntries(DESKTOP_NATIVE_RESOURCE_PATHS.map(p=>[p,table.get(p).sha256]))});
 const verifier=createDesktopNativeOwnedTreeVerifier({manifest:m}),tree=await verifier.capture(resources);
 if(!await verifier.recheck(tree))throw Error('BOOTSTRAP_RUNTIME_REFUSED');
 return Object.freeze({manifest:m,resources,tree,verifier});
}
export async function startDesktopNativeBootstrap(value){
 const v=data(value,['manifest']),directory=resolve(fileURLToPath(new URL('../../../',import.meta.url))),control=dirname(directory);
 const captured=await captureConfiguredRuntime(v.manifest,directory);if(!await captured.verifier.recheck(captured.tree))throw Error('BOOTSTRAP_RUNTIME_REFUSED');
 const {configureDesktopLaunch}=await import('../desktop-launch.mjs');const {createDesktopNativeInitializer}=await import('./desktop-native-initializer.mjs');
 configureDesktopLaunch(createDesktopNativeInitializer(captured),{preferredDataRoot:join(control,'data'),protectedRuntimeRoot:directory});
 await import('../start.mjs');
}
