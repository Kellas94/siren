import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const module=await import('../src/terminal/ownership-source.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const inputs=Object.fromEntries(await Promise.all([['host','terminal-host-guard/host.cc'],['extension','terminal-session-composition.inc']].map(async([k,p])=>[k,await readFile(new URL('fixtures/'+p,import.meta.url),'utf8')])));
const digest=s=>createHash('sha256').update(s).digest('hex');
test('reusable owner source refuses changed historical inputs rather than silently deriving from unknown code',()=>{
 assert.equal(typeof module.deriveTerminalOwnershipSource,'function');
 for(const key of ['host','extension'])assert.throws(()=>module.deriveTerminalOwnershipSource({...inputs,[key]:inputs[key]+'\n'}),/SOURCE_DRIFT/);
});
test('reusable native owner has one target, unconditional monitors and no fault-injection switches',()=>{
 assert.equal(typeof module.deriveTerminalOwnershipSource,'function');const r=module.deriveTerminalOwnershipSource(inputs);
 assert.equal(r.admitted,false);assert.equal(r.compiled,false);assert.equal(r.binding.targets.length,1);
 assert.equal(r.binding.targets[0].target_name,'siren_terminal_ownership');assert.deepEqual(r.binding.targets[0].sources,['ownership.cc']);
 assert.doesNotMatch(r.source,/SIREN_TEST|injectedStopFailures|stop77Count/);
 for(const symbol of ['RegisterWaitForSingleObject(&owner->wait','RegisterWaitForSingleObject(&p->wait','RegisterWaitForSingleObject(&p->shellWait'])assert.ok(r.source.includes(symbol),symbol);
 assert.equal(r.source.includes('if(!p->stopping.load())p->monitorTerminateSucceeded.store(TerminateJobObject(p->job.h,79)!=FALSE);'),true);
});
test('normal Session capture requires creator and shell; Host128/Session32/eight admission caps remain finite',()=>{
 assert.equal(typeof module.deriveTerminalOwnershipSource,'function');const {source}=module.deriveTerminalOwnershipSource(inputs);
 assert.match(source,/NumberOfProcessIdsInList<2\|\|list->NumberOfProcessIdsInList>32/);
 assert.doesNotMatch(source,/NumberOfProcessIdsInList<5/);
 assert.match(source,/if\(!creator\|\|!shell\)/);assert.match(source,/sessionCount\.load\(\)>=8/);
 assert.match(source,/\+128\*sizeof\(ULONG_PTR\)/);assert.match(source,/NumberOfProcessIdsInList>128/);
 assert.match(source,/CREATE_SUSPENDED\|CREATE_NO_WINDOW\|CREATE_UNICODE_ENVIRONMENT\|EXTENDED_STARTUPINFO_PRESENT/);
 assert.ok(source.indexOf('p->atomicBeforeResume=true;')<source.indexOf('ResumeThread(thread.h)'));
 assert.match(source,/PROC_THREAD_ATTRIBUTE_JOB_LIST,jobs,2\*sizeof\(HANDLE\)/);
});
test('source lineage is deterministic and historical source bytes are unchanged',async()=>{
 assert.equal(typeof module.deriveTerminalOwnershipSource,'function');const a=module.deriveTerminalOwnershipSource(inputs),b=module.deriveTerminalOwnershipSource(inputs);
 assert.equal(a.source,b.source);assert.equal(a.sha256,digest(a.source));
 assert.deepEqual(a.inputs,{host:digest(inputs.host),extension:digest(inputs.extension)});
 assert.equal(digest(await readFile(new URL('fixtures/terminal-host-guard/host.cc',import.meta.url),'utf8')),a.inputs.host);
 assert.equal(digest(await readFile(new URL('fixtures/terminal-session-composition.inc',import.meta.url),'utf8')),a.inputs.extension);
});

test('checked-in native candidate equals the pinned derivation, including its single build target',async()=>{
 const r=module.deriveTerminalOwnershipSource(inputs);
 assert.equal(await readFile(new URL('../native/terminal-ownership/ownership.cc',import.meta.url),'utf8'),r.source);
 assert.deepEqual(JSON.parse(await readFile(new URL('../native/terminal-ownership/binding.gyp',import.meta.url),'utf8')),r.binding);
});
