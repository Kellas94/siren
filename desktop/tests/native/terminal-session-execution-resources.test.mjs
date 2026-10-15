// Inert byte inventories only. Fixture JS/native bytes must never execute.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm,cp,link} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureShutdownGraphResources,captureProductionResources,recheckProductionResources} from './terminal-production-resources.mjs';
let api={};try{api=await import('./terminal-session-execution-resources.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const parent=fileURLToPath(new URL('../../evidence/workspace-surface/terminal-session-inventory-disposable/',import.meta.url));
const roots=['production-backend','production-ownership','production-creator-entry','shutdown-graph'].map(n=>'desktop/src/terminal/'+n+'.mjs');
const nativeRoots=['terminal-creator-three-lane','terminal-host-roster-candidate'];
const bins=nativeRoots.map(n=>'desktop/native/'+n+'/build/Release/siren_'+n.replaceAll('-','_')+'.node');
const provider='desktop/runtime/terminal-provider', launcher='desktop/src/terminal/production-creator-launcher.mjs';
const launcherText="import {runProductionCreatorEntry} from './production-creator-entry.mjs';\nawait runProductionCreatorEntry();\n";
const runtime=['prebuilds/win32-x64/conpty.node','prebuilds/win32-x64/conpty_console_list.node','lib/index.js','lib/windowsTerminal.js','lib/terminal.js','lib/eventEmitter2.js','lib/utils.js','lib/windowsPtyAgent.js','lib/windowsConoutConnection.js','lib/shared/conout.js','lib/worker/conoutSocketWorker.js','lib/conpty_console_list_agent.js'];
const methods=()=>{assert.equal(typeof api.captureTerminalSessionExecutionResources,'function','Missing fixed execution-tree inventory');assert.equal(typeof api.recheckTerminalSessionExecutionResources,'function');return api;};
async function fixture(t){
 await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'case-')),source=path.join(dir,'source'),application=path.join(dir,'execution');
 const put=async(root,rel,bytes)=>{const p=path.join(root,...rel.split('/'));await mkdir(path.dirname(p),{recursive:true});await writeFile(p,bytes);};
 t.after(async()=>{const checked=path.resolve(dir);assert.equal(path.dirname(checked),path.resolve(parent));assert(path.basename(checked).startsWith('case-'));await rm(checked,{recursive:true,force:true});});
 for(const rel of roots)await put(source,rel,"throw Error('INSPECTED_CODE_MUST_NOT_EXECUTE');\n");
 for(const n of nativeRoots)for(const file of ['ownership.cc','peer-endpoints.inc','binding.gyp'])await put(source,'desktop/native/'+n+'/'+file,'// INERT '+n+' '+file+'\n');
 for(const file of ['package.json','package-lock.json'])await put(source,provider+'/'+file,await readFile(new URL('../../runtime/terminal-provider/'+file,import.meta.url)));
 const capture=await captureShutdownGraphResources({sourceRoot:source});await cp(source,application,{recursive:true});await put(application,launcher,launcherText);
 for(const rel of bins)await put(application,rel,'OPAQUE_FIXTURE_BYTES_NOT_A_BINARY');
 for(const name of ['node-pty','node-addon-api']){
  const pkg={name,version:name==='node-pty'?'1.1.0':'7.1.1',license:'MIT'};if(name==='node-pty'){pkg.main='./lib/index.js';pkg.dependencies={'node-addon-api':'^7.1.0'};}
  await put(application,provider+'/node_modules/'+name+'/package.json',JSON.stringify(pkg));
 }
 for(const rel of ['node-pty/LICENSE','node-pty/deps/winpty/LICENSE','node-addon-api/LICENSE.md'])await put(application,provider+'/node_modules/'+rel,'Permission is hereby granted. Inert notice.\n');
 for(const rel of runtime)await put(application,provider+'/node_modules/node-pty/'+rel,rel.endsWith('.node')?'OPAQUE_PROVIDER_FIXTURE':"throw Error('PROVIDER_MUST_NOT_EXECUTE');\n");
 return {source,application,capture,put:(rel,bytes)=>put(application,rel,bytes),options:{sourceCapture:capture,applicationDirectory:application},remove:rel=>rm(path.join(application,...rel.split('/')),{recursive:true,force:true})};
}
test('fixed execution inventory records source/provider/native bytes without granting runtime authority',async t=>{
 const a=methods(),f=await fixture(t),c=await a.captureTerminalSessionExecutionResources(f.options);
 assert.equal(c.schema,'siren-terminal-session-execution-resources/v1');assert.equal(c.nativeExecutionAdmitted,false);assert.equal(c.binaryCompatibility,'UNVERIFIED');assert.equal(c.nativeBinaries.length,2);assert.equal(c.provider.selectedNative.length,2);
 assert.deepEqual(c.nativeBinaries.map(r=>r.relativePath).sort(),[...bins].sort());assert.equal(await a.recheckTerminalSessionExecutionResources(c),true);assert.equal(await recheckProductionResources(f.capture),true);assert.equal(globalThis.__sessionInventoryExecuted,undefined);
});
test('capture refuses missing and empty fixed native slots',async t=>{const a=methods(),f=await fixture(t);await f.remove(bins[0]);await assert.rejects(a.captureTerminalSessionExecutionResources(f.options),/SESSION_EXECUTION_RESOURCES_REFUSED/);await f.put(bins[0],'');await assert.rejects(a.captureTerminalSessionExecutionResources(f.options),/SESSION_EXECUTION_RESOURCES_REFUSED/);});
test('complete tree refuses lookup shadows, unknown files and empty directories',async t=>{
 const a=methods(),f=await fixture(t);
 for(const rel of [bins[0]+'.js',provider+'/unexpected.json','desktop/src/unexpected.mjs']){await f.put(rel,'inert');await assert.rejects(a.captureTerminalSessionExecutionResources(f.options),/SESSION_EXECUTION_RESOURCES_REFUSED/);await f.remove(rel);}
 await mkdir(path.join(f.application,'unused-empty'));await assert.rejects(a.captureTerminalSessionExecutionResources(f.options),/SESSION_EXECUTION_RESOURCES_REFUSED/);
});
test('copied source and fixed launcher must match exact bytes',async t=>{
 const a=methods(),f=await fixture(t);await f.put(roots[0],'// replacement');await assert.rejects(a.captureTerminalSessionExecutionResources(f.options),/SESSION_EXECUTION_RESOURCES_REFUSED/);await f.put(roots[0],await readFile(path.join(f.source,roots[0])));await f.put(launcher,launcherText+'// altered\n');await assert.rejects(a.captureTerminalSessionExecutionResources(f.options),/SESSION_EXECUTION_RESOURCES_REFUSED/);
});
test('recheck detects binary and provider changes without executing them',async t=>{
 const a=methods(),f=await fixture(t),c=await a.captureTerminalSessionExecutionResources(f.options);await f.put(bins[1],'changed');await assert.rejects(a.recheckTerminalSessionExecutionResources(c),/SESSION_EXECUTION_RESOURCES_REFUSED/);await f.put(bins[1],'OPAQUE_FIXTURE_BYTES_NOT_A_BINARY');await f.put(provider+'/node_modules/node-pty/lib/index.js',"throw Error('CHANGED_PROVIDER_NEVER_EXECUTE');");await assert.rejects(a.recheckTerminalSessionExecutionResources(c),/SESSION_EXECUTION_RESOURCES_REFUSED/);
});
test('only genuine fixed graph captures and private inventory handles are accepted',async t=>{
 const a=methods(),f=await fixture(t);await assert.rejects(a.captureTerminalSessionExecutionResources({...f.options,sourceCapture:{...f.capture}}),/RESOURCES_REFUSED/);const base=await captureProductionResources({sourceRoot:f.source});await assert.rejects(a.captureTerminalSessionExecutionResources({...f.options,sourceCapture:base}),/SESSION_EXECUTION_RESOURCES_REFUSED/);const c=await a.captureTerminalSessionExecutionResources(f.options);await assert.rejects(a.recheckTerminalSessionExecutionResources({...c}),/SESSION_EXECUTION_RESOURCES_REFUSED/);await assert.rejects(a.recheckTerminalSessionExecutionResources(c,undefined),/SESSION_EXECUTION_RESOURCES_REFUSED/);
});
test('option accessors, Proxies, extra keys and extra arguments cause no caller code execution',async()=>{
 const a=methods();let invoked=0;const getter={get sourceCapture(){invoked++;throw Error('GETTER');},applicationDirectory:'x'};
 for(const options of [getter,new Proxy({}, {get(){invoked++;throw Error('PROXY');}}),{sourceCapture:null,applicationDirectory:'x',binaryPath:'anything'}])await assert.rejects(a.captureTerminalSessionExecutionResources(options),/SESSION_EXECUTION_RESOURCES_REFUSED/);
 await assert.rejects(a.captureTerminalSessionExecutionResources({sourceCapture:null,applicationDirectory:'x'},undefined),/SESSION_EXECUTION_RESOURCES_REFUSED/);assert.equal(invoked,0);
});
test('hardlinked native artifacts and over-budget artifacts are refused',async t=>{
 const a=methods(),f=await fixture(t),first=path.join(f.application,bins[0]),second=path.join(f.application,bins[1]);await f.remove(bins[1]);await link(first,second);await assert.rejects(a.captureTerminalSessionExecutionResources(f.options),/SESSION_EXECUTION_RESOURCES_REFUSED/);await f.remove(bins[1]);await f.put(bins[1],Buffer.alloc(16*1024*1024+1));await assert.rejects(a.captureTerminalSessionExecutionResources(f.options),/SESSION_EXECUTION_RESOURCES_REFUSED/);
});
test('separation refuses the same source and execution root (SI-I1)',async t=>{
 const a=methods(),f=await fixture(t),capture=await captureShutdownGraphResources({sourceRoot:f.application});
 await assert.rejects(a.captureTerminalSessionExecutionResources({sourceCapture:capture,applicationDirectory:f.application}),/source and execution trees must be separate/);
});
test('separation refuses execution nested inside the source root (SI-I1)',async t=>{
 const a=methods(),f=await fixture(t),nested=path.join(f.source,'execution-child');await cp(f.application,nested,{recursive:true});
 const capture=await captureShutdownGraphResources({sourceRoot:f.source});
 await assert.rejects(a.captureTerminalSessionExecutionResources({sourceCapture:capture,applicationDirectory:nested}),/source and execution trees must be separate/);
});
test('separation refuses source nested inside execution provider build surface (SI-I1)',async t=>{
 const a=methods(),f=await fixture(t),nested=path.join(f.application,provider,'node_modules','node-addon-api','source-material');await cp(f.source,nested,{recursive:true});
 const capture=await captureShutdownGraphResources({sourceRoot:nested});
 await assert.rejects(a.captureTerminalSessionExecutionResources({sourceCapture:capture,applicationDirectory:f.application}),/source and execution trees must be separate/);
});
