// Pure current-source preparation. Private reader/writer only; no native/process I/O.
import {createHash} from 'node:crypto';
import {posix as path} from 'node:path';
import {planCurrentRuntimeLockSources,verifyCurrentRuntimeLockSources} from './terminal-current-runtime-lock-sources.mjs';
import {CURRENT_LOCK_DIAGNOSTICS,deriveCurrentRuntimeLockScripts,deriveCurrentRuntimeLockRawSupport,restoreCurrentRuntimeLockScript} from './terminal-current-runtime-lock-derivation.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base='desktop/tests/native/';
const valid=p=>typeof p==='string'&&/^desktop\/[A-Za-z0-9_.\/-]+$/.test(p)&&p.split('/').every(p=>p&&p!=='.'&&p!=='..');
export const CURRENT_LOCK_STARTUP_FREEZE=Object.freeze({path:'terminal-startup-module-policy-implementation-20261012/owner-freeze.json',bytes:21712,sha256:'321193167425700c5f758de7a7892b25ac75cce6a70d7b3238ee2b66fa7c8d3e'});
const startup=['profiles','startup-protocol','production-manager','production-backend','session-link','creator-startup'].map(n=>'desktop/src/terminal/'+n+'.mjs');
const pin=(p,b)=>({path:p,bytes:b.length,sha256:sha(b)});
const utf8=b=>{if(!Buffer.isBuffer(b))throw Error('CURRENT_LOCK_BUILD_BUFFER');const s=new TextDecoder('utf-8',{fatal:true}).decode(b);if(!Buffer.from(s).equals(b))throw Error('CURRENT_LOCK_BUILD_UTF8');return s;};
export async function prepareCurrentRuntimeLockBuild(read){
 if(typeof read!=='function')throw TypeError('Private current source reader required');
 const originals=new Map(),outputs=new Map();
 async function source(p){if(originals.has(p))return originals.get(p);const raw=await read(p);if(!Buffer.isBuffer(raw)||raw.length>2*1024*1024)throw Error('CURRENT_LOCK_BUILD_BUFFER');const bytes=Buffer.from(raw);originals.set(p,bytes);return bytes;}
 const frozen=await source(CURRENT_LOCK_STARTUP_FREEZE.path);
 if(frozen.length!==CURRENT_LOCK_STARTUP_FREEZE.bytes||sha(frozen)!==CURRENT_LOCK_STARTUP_FREEZE.sha256)throw Error('CURRENT_LOCK_STARTUP_FREEZE_REFUSED');
 const held=JSON.parse(utf8(frozen));
 const plan=await planCurrentRuntimeLockSources(source);
 for(const name of startup){const expected=held.sources.find(row=>row.path===name),actual=plan.files.find(row=>row.path===name);if(!expected||!actual||expected.bytes!==actual.bytes||expected.sha256!==actual.sha256)throw Error('CURRENT_LOCK_STARTUP_SOURCE_REFUSED');}
 const original={};for(const kind of ['provision','driver','worker'])original[kind]=utf8(await source(base+'terminal-system-seeded-'+kind+'.mjs'));
 const scripts=deriveCurrentRuntimeLockScripts(original),support={};for(const kind of ['connect-derivative','creator-transport-derivative','connect-raw-json','connect-comparison'])support[kind]=utf8(await source(base+'terminal-'+kind+'.mjs'));
 const derivatives=[...scripts.files,...deriveCurrentRuntimeLockRawSupport(support)];
 for(const file of derivatives){const originalPath=base+(file.map.kind.match(/^(provision|driver|worker)$/)?'terminal-system-seeded-'+file.map.kind+'.mjs':file.name);if(restoreCurrentRuntimeLockScript(file)!==utf8(await source(originalPath)))throw Error('CURRENT_LOCK_BUILD_INVERSE');outputs.set(base+file.name,Buffer.from(file.text));}
 const additional=['desktop/package.json','desktop/package-lock.json','desktop/tests/fixtures/terminal-filesystem-evidence.cs','desktop/tests/fixtures/terminal-session-process-observer.cs'];
 for(const p of new Set([...plan.files.map(r=>r.path),...plan.resources.map(r=>r.path),...CURRENT_LOCK_DIAGNOSTICS,...additional]))if(!outputs.has(p))outputs.set(p,await source(p));
 const sourcePlan=base+'terminal-current-runtime-lock-current-sources.json';outputs.set(sourcePlan,Buffer.from(JSON.stringify(plan)+'\n'));
 // All literal runtime imports must resolve in one staged closure. Dynamic
 // importExecution targets are separately checked against exact current inputs.
 for(const [p,raw]of outputs){if(!p.endsWith('.mjs'))continue;const text=utf8(raw);for(const m of text.matchAll(/(?:^|\n)import\s+(?:[^;\n]*?\s+from\s+)?['"]([^'"]+)['"]|\bawait\s+import\(\s*['"]([^'"]+)['"]\s*\)/g)){const spec=m[1]??m[2];if(spec.startsWith('.')&&!outputs.has(path.normalize(path.join(path.dirname(p),spec))))throw Error('CURRENT_LOCK_BUILD_IMPORT_MISSING:'+p+':'+spec);}for(const m of text.matchAll(/importExecution\('([^']+)'\)/g))if(!outputs.has(m[1]))throw Error('CURRENT_LOCK_BUILD_EXECUTION_IMPORT_MISSING:'+m[1]);}
 for(const [p,raw]of outputs)if(!valid(p)||raw.length>2*1024*1024)throw Error('CURRENT_LOCK_BUILD_OUTPUT_REFUSED');
 const manifest={schema:1,scope:'CURRENT_RUNTIME_LOCK_BUILD_SOURCE_PINS',nativeAdmission:false,inputs:[...outputs].map(([p,b])=>pin(p,b)).sort((a,b)=>a.path.localeCompare(b.path)),diagnostics:[...CURRENT_LOCK_DIAGNOSTICS]};
 outputs.set(base+'terminal-current-runtime-lock-inputs.json',Buffer.from(JSON.stringify(manifest)+'\n'));
 // Re-read every actual original before returning any writable preparation.
 for(const [p,raw]of originals){const now=await read(p);if(!Buffer.isBuffer(now)||!now.equals(raw))throw Error('CURRENT_LOCK_BUILD_SOURCE_DRIFT:'+p);}
 return {scope:'CURRENT_SOURCE_ORIGINAL_RUNNING_LOCK_PREPARATION',nativeExecutionAdmitted:false,productActivation:false,actualPinUiProof:false,plan,manifest,derivatives,originals,outputs,inputPins:[...originals].map(([p,b])=>pin(p,b)).sort((a,b)=>a.path.localeCompare(b.path)),limits:'Source bytes and literal import closure only. Native compile/provider/raw/permit/four held external joins remain mandatory; generated utility keepalive is not a product host.'};
}
export async function materializeCurrentRuntimeLockBuild(prepared,read,write){
 if(typeof read!=='function'||typeof write!=='function')throw TypeError('Private source reader and exclusive fresh-root writer required');
 // Rebuild from current source bytes. Caller-mutated plans/output buffers never
 // choose files to write; the returned object is only a consistency declaration.
 const actual=await prepareCurrentRuntimeLockBuild(read);
 if(JSON.stringify(prepared.inputPins)!==JSON.stringify(actual.inputPins)||JSON.stringify(prepared.manifest)!==JSON.stringify(actual.manifest))throw Error('CURRENT_LOCK_BUILD_SOURCE_DRIFT');
 await verifyCurrentRuntimeLockSources(actual.plan,read);
 for(const [p,b]of actual.outputs)await write(p,Buffer.from(b));
 return {files:actual.outputs.size,sourceModules:actual.plan.files.length,resources:actual.plan.resources.length,diagnostics:actual.manifest.diagnostics.length,nativeExecutionAdmitted:false,productActivation:false};
}
