import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compareFreshConnectJson} from './terminal-connect-comparison.mjs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import * as util from 'node:util';
import * as paths from 'node:path';
import {prepareCurrentRuntimeLockBuild,materializeCurrentRuntimeLockBuild} from './terminal-current-runtime-lock-build.mjs';
import {currentLockFixture} from './terminal-current-runtime-lock-test-fixture.mjs';
import {discoverCurrentRuntimeLock,runCurrentRuntimeLockScenario} from './terminal-current-runtime-lock.mjs';
const api=await import('./terminal-current-runtime-lock-derivation.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('current native preparation derives bounded new scripts rather than mutating old diagnostics',async()=>{
 assert.equal(typeof api.deriveCurrentRuntimeLockScripts,'function');
 const [provision,driver,worker]=await Promise.all(['provision','driver','worker'].map(name=>readFile(new URL('./terminal-system-seeded-'+name+'.mjs',import.meta.url),'utf8')));
 const result=api.deriveCurrentRuntimeLockScripts({provision,driver,worker});
 assert.equal(result.nativeExecutionAdmitted,false);assert.equal(result.files.length,3);
 const p=result.files.find(f=>f.name.endsWith('-provision.mjs')).text;
 assert(!p.includes('stage_historical_sources'));assert(!p.includes('hosted-v1.zip'));assert(!p.includes('generateSystemSeededProfileMaterialization'));assert(p.includes('materializeCurrentRuntimeLockSources'));
 const w=result.files.find(f=>f.name.endsWith('-worker.mjs')).text;
 assert(w.includes('runCurrentRuntimeLockScenario'));assert(w.includes("importExecution('desktop/tests/native/terminal-current-runtime-lock.mjs')"));assert(w.includes('freshParentPermit(challenge,TerminalControlChannel,permitBootstrap)'));
 const d=result.files.find(f=>f.name.endsWith('-driver.mjs')).text;
 assert(d.includes('RUNNING_LOCK_COMPLETE'));assert(d.includes("['pathext-omitted',common.omitted],['pathext-trusted',common.trusted]"));assert(d.includes('createFreshParentPermitServer'));assert(d.includes('requireFreshCleanup(cleanup)'));
});
test('ADVERSE original comparison cannot consume current seeded module path expectation',()=>{
 const expected={schema:1,creatorPid:42,shellPid:84,commandLine:'powershell.exe -NoProfile',cwd:'C:\\Project',env:['SystemRoot=C:\\Windows','PATH=C:\\Windows','PSModulePath=C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'],useConptyDll:false};
 assert.equal(compareFreshConnectJson('{}',JSON.stringify(expected)).code,'EXPECTATION_REFUSED','original adverse is retained: seeded expectation cannot reach raw checking');
});
const root=new URL('../../../',import.meta.url),read=p=>readFile(new URL(p,root));
let prepared;const build=()=>prepared??=prepareCurrentRuntimeLockBuild(read);
test('all seven generated bodies restore exactly and no old runtime staging survives',async()=>{
 const b=await build();assert.equal(b.derivatives.length,7);assert.equal(b.plan.files.length,53);assert.equal(b.plan.resources.length,8);assert.equal(b.manifest.diagnostics.length,20);
 for(const d of b.derivatives){const original=api.restoreCurrentRuntimeLockScript(d),p='desktop/tests/native/'+(d.map.kind.match(/^(worker|driver|provision)$/)?'terminal-system-seeded-'+d.map.kind+'.mjs':d.name);assert.equal(original,(await read(p)).toString());assert.equal(crypto.createHash('sha256').update(original).digest('hex'),d.map.originalSha256);}
 const provision=b.outputs.get('desktop/tests/native/terminal-current-runtime-lock-provision.mjs').toString();assert.equal(/\bPREP\b/.test(provision),false);for(const old of ['hosted-v1.zip','stage_historical_sources','generateSystemSeededProfileMaterialization','historical-source-mapping'])assert.equal(provision.includes(old),false,old);
 assert.equal(b.plan.historicalOverlays,false);assert.equal(b.actualPinUiProof,false);
});
test('changed source and freeze refuse before any writer; source plan is one current closure',async()=>{
 const b=await build();let writes=0;
 await assert.rejects(materializeCurrentRuntimeLockBuild(b,async p=>{const bytes=await read(p);return p.endsWith('/profiles.mjs')?Buffer.concat([bytes,Buffer.from('\n')]):bytes;},async()=>{writes++;}),/CURRENT_LOCK_STARTUP_SOURCE_REFUSED/);assert.equal(writes,0);
 await assert.rejects(prepareCurrentRuntimeLockBuild(async p=>{const bytes=await read(p);return p.endsWith('/owner-freeze.json')?Buffer.concat([bytes,Buffer.from('\n')]):bytes;}),/CURRENT_LOCK_STARTUP_FREEZE_REFUSED/);
 const copied=new Map();const r=await materializeCurrentRuntimeLockBuild(b,read,async(p,bytes)=>{assert.equal(copied.has(p),false);copied.set(p,bytes);});assert.equal(r.files,copied.size);for(const row of b.manifest.inputs){const raw=copied.get(row.path);assert.equal(raw.length,row.bytes);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),row.sha256);}assert.equal(r.nativeExecutionAdmitted,false);
});
test('generated modules parse without evaluating their imports or activating providers',async()=>{
 const b=await build();for(const f of b.derivatives){const module=new vm.SourceTextModule(f.text);assert.equal(module.status,'unlinked');}
});
async function rawApi(){
 const b=await build(),context=vm.createContext({Buffer,URL}),cache=new Map(),builtins={'node:crypto':crypto,'node:util':util,'node:path':paths};
 const load=p=>{if(cache.has(p))return cache.get(p);const m=new vm.SourceTextModule(b.outputs.get(p).toString(),{context,identifier:p});cache.set(p,m);return m;};
 const compare=load('desktop/tests/native/terminal-connect-comparison.mjs');
 await compare.link((s,ref)=>{if(s.startsWith('.'))return load(paths.posix.normalize(paths.posix.join(paths.posix.dirname(ref.identifier),s)));if(!cache.has(s)){const exports=builtins[s];assert(exports,'unexpected builtin '+s);cache.set(s,new vm.SyntheticModule(Object.keys(exports),function(){for(const k of Object.keys(exports))this.setExport(k,exports[k]);},{context}));}return cache.get(s);});await compare.evaluate();
 const deriver=load('desktop/tests/native/terminal-connect-derivative.mjs');await deriver.link(s=>cache.get(s));await deriver.evaluate();
 const original=(await readFile(new URL('terminal-connect-derivative-20261011/original-data/windowsPtyAgent.js.source.txt',root),'utf8'));
 const generated=deriver.namespace.generateTerminalConnectDerivative(original);assert.equal(generated.ok,true);
 const creator=load('desktop/tests/native/terminal-creator-transport-derivative.mjs');await creator.link(s=>cache.get(s));await creator.evaluate();
 const transport=creator.namespace.generateTerminalCreatorTransportDerivative((await read('desktop/src/terminal/production-creator-entry.mjs')).toString());assert.equal(transport.ok,true);
 return {compare:compare.namespace.compareFreshConnectJson,generated,transport,b};
}
function observe(source,env){
 let clock=0;const c=vm.createContext({Buffer,exports:{},require:n=>n==='node:crypto'?crypto:n==='node:util'?util:n==='node:perf_hooks'?{performance:{now:()=>++clock}}:n==='node:process'?{pid:42}:assert.fail(n)});
 vm.runInContext(source,c,{timeout:500});vm.runInContext('var env='+JSON.stringify(env)+';var receiver={_useConptyDll:false,_innerPid:84};var ticket=__sirenConnectObserver.begin(env,"powershell.exe -NoProfile","C:\\\\Project",receiver);__sirenConnectObserver.finish(ticket,env,"powershell.exe -NoProfile","C:\\\\Project",receiver,true,true);',c,{timeout:500});return c.exports.readConnectObservation();
}
test('actual isolated observer + parser + comparison accept only exact canonical seeded env bytes',async()=>{
 const {compare,generated}=await rawApi(),env=['SystemRoot=C:\\Windows','PATH=C:\\Windows','PSModulePath=C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'],expected={schema:1,creatorPid:42,shellPid:84,commandLine:'powershell.exe -NoProfile',cwd:'C:\\Project',env,useConptyDll:false},raw=observe(generated.observerSource,env);
 assert.equal(raw.phase,'RETURNED');assert.equal(compare(JSON.stringify(raw),JSON.stringify(expected)).ok,true);
 for(const changed of [env.slice(0,2),[...env.slice(0,2),env[2]+'x'],[...env,'PRIVATE=x'],[...env,'psmodulepath=x'],env.map(s=>s.replace('PSModulePath','PSMODULEPATH'))]){const actual=observe(generated.observerSource,changed);assert.equal(compare(JSON.stringify(actual),JSON.stringify(expected)).ok,false);}
 assert.equal(compare(JSON.stringify(raw),JSON.stringify({...expected,env:[...env,'PRIVATE=x']})).ok,false);
 for(const name of ['terminal-creator-transport-derivative.mjs','terminal-connect-raw-json.mjs','terminal-connect-comparison.mjs'])assert(generated.allowlist.includes('PSModulePath')&& (await build()).outputs.get('desktop/tests/native/'+name).toString().includes("'PSModulePath'"));
});
test('all 21 authorized keys fit exact seeded raw roster and a 22nd duplicate stays adverse',async()=>{
 const {compare,generated}=await rawApi(),env=Array.from(generated.allowlist,k=>k+'='+(k==='PATHEXT'?'.EXE':'x'));
 assert.equal(env.length,21);const raw=observe(generated.observerSource,env),e={schema:1,creatorPid:42,shellPid:84,commandLine:'powershell.exe -NoProfile',cwd:'C:\\Project',env,useConptyDll:false};assert.equal(compare(JSON.stringify(raw),JSON.stringify(e)).ok,true);const extra=observe(generated.observerSource,[...env,'PSModulePath=x']);assert.equal(extra.phase,'BEFORE_CAPTURE_INVALID');assert.equal(compare(JSON.stringify(extra),JSON.stringify(e)).ok,false);
});
test('actual isolated creator transport preserves canonical seeded raw bytes and refuses aliases/duplicate vectors',async()=>{
 const {transport,generated}=await rawApi(),env=Array.from(generated.allowlist,k=>k+'='+(k==='PATHEXT'?'.EXE':'x')),raw=observe(generated.observerSource,env),entry='file:///C:/job/fresh-runtime/execution/desktop/src/terminal/diagnostic-creator-entry.mjs';
 function capture(value){const writes=[],c=vm.createContext({Buffer,URL});c.receipt=vm.runInContext('('+JSON.stringify(value)+')',c);const agent='C:\\job\\fresh-runtime\\execution\\desktop\\runtime\\terminal-provider\\node_modules\\node-pty\\lib\\windowsPtyAgent.js',require=n=>n==='node:util'?util:n==='node:path'?paths.win32:n==='node:process'?{pid:42,platform:'win32'}:n==='node:fs'?{writeFileSync:(...args)=>writes.push(args)}:n===agent?{readConnectObservation:()=>c.receipt}:assert.fail(n);require.resolve=n=>n;Object.assign(c,{require,moduleUrl:entry,fileURLToPath:url=>paths.win32.normalize(decodeURIComponent(url.pathname).replace(/^\//,'').replaceAll('/','\\'))});vm.runInContext('var transport=('+transport.initializerSource+')(require,moduleUrl,fileURLToPath);transport.acquire();transport.write();',c,{timeout:500});return writes;}
 const writes=capture(raw);assert.equal(writes.length,1);assert.deepEqual(JSON.parse(writes[0][1]),JSON.parse(JSON.stringify(raw)));assert.equal(writes[0][2].flag,'wx');
 for(const mutate of [r=>r.before.env.push(r.before.env[0]),r=>r.after.env.at(-1).key='PSMODULEPATH',r=>r.before.env.at(-1).key='PRIVATE']){const r=structuredClone(raw);mutate(r);assert.equal(capture(r).length,0);}
});
test('derived preinput, private permit, observer and cleanup bodies remain exact unchanged gates',async()=>{
 const b=await build(),oldWorker=(await read('desktop/tests/native/terminal-system-seeded-worker.mjs')).toString(),worker=b.outputs.get('desktop/tests/native/terminal-current-runtime-lock-worker.mjs').toString(),oldDriver=(await read('desktop/tests/native/terminal-system-seeded-driver.mjs')).toString(),driver=b.outputs.get('desktop/tests/native/terminal-current-runtime-lock-driver.mjs').toString();
 for(const [before,after,start,end] of [[oldWorker,worker,"  // Genuine held capabilities", "  // The observer owns"],[oldWorker,worker,' async function collectCleanup(', "  observationPhase='module-import'"],[oldDriver,driver,"   child.stdout.on('data'", "   stage='ARM_WORKER_RESULT'"]]){const a=before.indexOf(start),z=before.indexOf(end,a);assert(a>=0&&z>a,start);const fragment=before.slice(a,z);assert.equal(after.includes(fragment),true,start);}
 assert(worker.includes("graph.shutdown({code:77,deadlineMs:5000,shutdownId})"));assert(worker.includes("graph.shutdown({code:98,deadlineMs:5000,shutdownId})"));assert(driver.includes('},120000)'));assert(driver.includes("requireFreshCleanup(cleanup)"));
});
test('actual original Lock fixture results qualify isolated current parent classifier; falsified observations fail',async()=>{
 const b=await build(),driver=b.outputs.get('desktop/tests/native/terminal-current-runtime-lock-driver.mjs').toString(),a=driver.indexOf('function classifyCurrentRunningLock('),z=driver.indexOf('// DRIVER_INERT_HELPERS_END',a),freshIdentity=v=>JSON.stringify([v.pid,v.image,v.createdFileTime]);assert(a>=0&&z>a);
 const classify=vm.runInNewContext('('+driver.slice(a,z).trim()+')',{assert,freshIdentity},{timeout:500});
 const h=await currentLockFixture();try{const result=await runCurrentRuntimeLockScenario(await h.prepare(discoverCurrentRuntimeLock)),before=result.records.find(r=>r.name==='running-before-lock').value,expected={sessionId:result.sessionId,creatorPid:before.session.root.pid,shellPid:before.session.shell.pid,token:h.token},observed={status:'CURRENT_RUNNING_LOCK_DIAGNOSTIC_COMPLETE',lockResult:result};assert.equal(classify(observed,expected),'RUNNING_LOCK_COMPLETE');
 for(const mutate of [o=>o.lockResult.lockRefusedNewInput=false,o=>o.lockResult.records.find(r=>r.name==='lock-and-input-refusal').value.refused.ok=true,o=>o.lockResult.records.find(r=>r.name==='completed-while-locked').value.completed='b'.repeat(32),o=>o.lockResult.records.find(r=>r.name==='same-session-after-lock').value.session.shell.createdFileTime='9999',o=>o.lockResult.records.find(r=>r.name==='fresh-lease-history').value.output='',o=>o.lockResult.records.find(r=>r.name==='fresh-lease-history').value.second.generation=0]){const changed=structuredClone(observed);mutate(changed);assert.throws(()=>classify(changed,expected));}
 }finally{await h.dispose();}
});

test('current generated build and worker target corrected Electron while inverse restores historical donors',async()=>{
 const source={};for(const key of ['provision','driver','worker'])source[key]=await readFile(new URL('./terminal-system-seeded-'+key+'.mjs',import.meta.url),'utf8');
 const result=api.deriveCurrentRuntimeLockScripts(source);
 for(const file of result.files){assert.doesNotMatch(file.text,/44\.5\.1/);assert.equal(api.restoreCurrentRuntimeLockScript(file),source[file.map.kind]);}
 assert.match(result.files[0].text,/version==='44\.9\.3'/);assert.match(result.files[0].text,/--target=44\.9\.3/);
 assert.match(result.files[2].text,/process\.versions\.electron,'44\.9\.3'/);assert.match(result.files[2].text,/ready:true,electron:'44\.9\.3'/);
});
