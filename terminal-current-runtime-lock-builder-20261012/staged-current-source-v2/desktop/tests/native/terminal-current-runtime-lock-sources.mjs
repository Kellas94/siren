// Isolated preparation: reads exact current bytes through a private reader.
// No filesystem mutation, historical overlay, provider load or native execution.
import {posix as path} from 'node:path';
import {createHash} from 'node:crypto';
export const CURRENT_LOCK_SOURCE_ENTRIES=Object.freeze([
 'desktop/src/terminal/shutdown-graph.mjs',
 'desktop/src/terminal/pin-lifecycle-owner.mjs',
 'desktop/src/terminal/production-creator-entry.mjs',
 'desktop/tests/native/terminal-current-runtime-lock.mjs',
 'desktop/tests/native/terminal-current-runtime-lock-cleanup.mjs',
 'desktop/tests/native/terminal-session-command.mjs'
]);
const digest=b=>createHash('sha256').update(b).digest('hex');
const resources=Object.freeze([
 ...['terminal-creator-three-lane','terminal-host-roster-candidate'].flatMap(name=>['binding.gyp','ownership.cc','peer-endpoints.inc'].map(file=>'desktop/native/'+name+'/'+file)),
 'desktop/runtime/terminal-provider/package.json','desktop/runtime/terminal-provider/package-lock.json'
]);
const valid=p=>typeof p==='string'&&/^desktop\/(?:src|tests\/native)\/[A-Za-z0-9_./-]+\.mjs$/.test(p)&&!p.split('/').some(s=>s==='..'||s==='.'||!s);
export async function planCurrentRuntimeLockSources(read){
 if(typeof read!=='function')throw TypeError('Private exact source reader required');
 const pending=[...CURRENT_LOCK_SOURCE_ENTRIES],files=new Map();let total=0;
 while(pending.length){
  const p=pending.shift();if(files.has(p))continue;if(!valid(p)||files.size>=160)throw Error('CURRENT_LOCK_SOURCE_CLOSURE_REFUSED');
  const raw=await read(p);if(!Buffer.isBuffer(raw)||raw.length>2*1024*1024||total+raw.length>8*1024*1024)throw Error('CURRENT_LOCK_SOURCE_BYTES_REFUSED');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);if(!Buffer.from(text).equals(raw))throw Error('CURRENT_LOCK_SOURCE_UTF8_REFUSED');
  total+=raw.length;const imports=[];
  for(const match of text.matchAll(/(?:^|\n)import\s+(?:[^;\n]*?\s+from\s+)?['"]([^'"]+)['"]|\bawait\s+import\(\s*['"]([^'"]+)['"]\s*\)/g)){
   const spec=match[1]??match[2];if(!spec.startsWith('.'))continue;
   const target=path.normalize(path.join(path.dirname(p),spec));if(!valid(target))throw Error('CURRENT_LOCK_SOURCE_IMPORT_REFUSED');imports.push(target);pending.push(target);
  }
  files.set(p,Object.freeze({path:p,bytes:raw.length,sha256:digest(raw),imports:Object.freeze([...new Set(imports)].sort())}));
 }
 const resourceRows=[];for(const p of resources){const raw=await read(p);if(!Buffer.isBuffer(raw)||raw.length>2*1024*1024||total+raw.length>8*1024*1024)throw Error('CURRENT_LOCK_RESOURCE_BYTES_REFUSED');total+=raw.length;resourceRows.push(Object.freeze({path:p,bytes:raw.length,sha256:digest(raw)}));}
 const host="setInterval(()=>{},1000);\nprocess.parentPort.postMessage({ready:true,electron:process.versions.electron,modules:process.versions.modules,napi:process.versions.napi});\n";
 const launcher="import {runProductionCreatorEntry} from './production-creator-entry.mjs';\nawait runProductionCreatorEntry();\n";
 return Object.freeze({schema:'siren-current-runtime-lock-source-plan/v1',historicalOverlays:false,nativeExecutionAdmitted:false,productActivation:false,totalBytes:total,entries:CURRENT_LOCK_SOURCE_ENTRIES,files:Object.freeze([...files.values()].sort((a,b)=>a.path.localeCompare(b.path))),resources:Object.freeze(resourceRows),generatedHost:Object.freeze({text:host,sha256:digest(Buffer.from(host)),packagedHostQualified:false,scope:'Existing fixed utility host keepalive/readiness; no production host entry exists.'}),generatedCreatorLauncher:Object.freeze({path:'desktop/src/terminal/production-creator-launcher.mjs',text:launcher,sha256:digest(Buffer.from(launcher))}),requireResources:Object.freeze({binariesQualified:false,paths:Object.freeze(['desktop/native/terminal-creator-three-lane/build/Release/siren_terminal_creator_three_lane.node','desktop/native/terminal-host-roster-candidate/build/Release/siren_terminal_host_roster_candidate.node','desktop/runtime/terminal-provider/node_modules/node-pty/package.json','desktop/runtime/terminal-provider/node_modules/node-pty/lib/index.js']),requirements:'Electron 44.5.1/ABI149 x64; separately pinned compiled addons, dedicated node-pty1.1.0 inventory and original raw/permit/external observer gates required.'}),limits:Object.freeze({files:160,fileBytes:2*1024*1024,totalBytes:8*1024*1024}),scope:'Literal static and await-import source closure only. Native addons, generated entry strings, Electron/provider resources and final startup freeze require separate binding.'});
}
export async function materializeCurrentRuntimeLockSources(plan,read,write){
 if(typeof write!=='function')throw TypeError('Private new-root source writer required');
 await verifyCurrentRuntimeLockSources(plan,read);
 const staged=[];
 for(const row of [...plan.files,...plan.resources]){const raw=await read(row.path);if(!Buffer.isBuffer(raw)||raw.length!==row.bytes||digest(raw)!==row.sha256)throw Error('CURRENT_LOCK_SOURCE_DRIFT');staged.push([row.path,Buffer.from(raw)]);}
 // Entire closure is validated and staged BEFORE the first caller-owned write.
 // Writer must enforce exclusive creation in the separately approved new root.
 for(const [p,raw]of staged)await write(p,raw);
 return Object.freeze({files:staged.length,nativeExecutionAdmitted:false,generatedFilesWritten:false});
}
export async function verifyCurrentRuntimeLockSources(plan,read){
 const now=await planCurrentRuntimeLockSources(read);
 if(JSON.stringify(now)!==JSON.stringify(plan))throw Error('CURRENT_LOCK_SOURCE_DRIFT');
 return Object.freeze({ok:true,files:now.files.length,nativeExecutionAdmitted:false});
}
