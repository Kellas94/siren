// Text/lineage checks only. Never compile/load/execute the generated C++.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {deriveMinimalCreatorOwnership}=await import('../src/terminal/creator-environment-source.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const base=await readFile(new URL('../native/terminal-ownership/ownership.cc',import.meta.url),'utf8');
const binding=await readFile(new URL('../native/terminal-ownership/binding.gyp',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
test('minimal creator source derivation refuses unknown source and build inputs',()=>{
 assert.equal(typeof deriveMinimalCreatorOwnership,'function');
 for(const pair of [{source:base+'\n',binding},{source:base,binding:binding+'\n'}])assert.throws(()=>deriveMinimalCreatorOwnership(pair),/INPUT_DRIFT/);
});
test('minimal creator cannot inherit private main environment or user-injected PATH/TEMP',()=>{
 assert.equal(typeof deriveMinimalCreatorOwnership,'function');const r=deriveMinimalCreatorOwnership({source:base,binding});
 assert.doesNotMatch(r.source,/GetEnvironmentStringsW|GetEnvironmentVariableW|GetTempPath|SetEnvironmentVariable/);
 assert.match(r.source,/GetSystemWindowsDirectoryW/);assert.match(r.source,/GetSystemDirectoryW/);
 assert.match(r.source,/L"TEMP="\+privateDirectory/);assert.match(r.source,/L"TMP="\+privateDirectory/);
 assert.match(r.source,/CreatorEnvironment\(environment,directory\)/);
 assert.deepEqual(r.environmentKeys,['ComSpec','ELECTRON_RUN_AS_NODE','PATH','SystemRoot','TEMP','TMP','windir']);
 assert.doesNotMatch(r.source,/SIREN_TEST|NODE_OPTIONS=|OPENAI_API_KEY=|SIREN_.*=/);
 assert.equal(r.admitted,false);assert.equal(r.compiled,false);
});
test('new native variant preserves every containment and lifetime instruction outside its explicit env delta',()=>{
 assert.equal(typeof deriveMinimalCreatorOwnership,'function');const r=deriveMinimalCreatorOwnership({source:base,binding});
 const remove=s=>s.replace(/(?:bool SystemEnvironmentDirectory[\s\S]*?)?bool CreatorEnvironment\([\s\S]*?(?=struct Attributes)/,'ENVIRONMENT\n').replace('CreatorEnvironment(environment,directory)','CreatorEnvironment(environment)').replace('// Minimal-environment variant; separate source/artifact qualification required.\n','');
 assert.equal(remove(r.source),remove(base));
 assert.equal(r.binding.targets.length,1);assert.equal(r.binding.targets[0].target_name,'siren_terminal_ownership_minimal_env');
 const original=JSON.parse(binding),copy=structuredClone(r.binding);copy.targets[0].target_name=original.targets[0].target_name;assert.deepEqual(copy,original);
});
test('generated checked-in variant exactly matches deterministic derivation; historical pins stay unchanged',async()=>{
 assert.equal(typeof deriveMinimalCreatorOwnership,'function');const r=deriveMinimalCreatorOwnership({source:base,binding}),again=deriveMinimalCreatorOwnership({source:base,binding});
 assert.equal(r.source,again.source);assert.equal(r.sha256,hash(r.source));assert.equal(r.baseSha256,hash(base));assert.notEqual(r.sha256,r.baseSha256);
 assert.equal(await readFile(new URL('../native/terminal-ownership-minimal-env/ownership.cc',import.meta.url),'utf8'),r.source);
 assert.deepEqual(JSON.parse(await readFile(new URL('../native/terminal-ownership-minimal-env/binding.gyp',import.meta.url),'utf8')),r.binding);
 assert.equal(hash(await readFile(new URL('../native/terminal-ownership/ownership.cc',import.meta.url))),'f0557cefb26dc337f4acfbc2f8e3302822f2f3f2371a9842e6c9c8b5cf536d3c');
});
