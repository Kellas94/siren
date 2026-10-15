// Owner permanent adaptations of FIXRES-I1/I2 plus parser policy controls.
// All inspected sources remain inert bytes: no link/instantiate/evaluate.
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {captureProductionResources} from './terminal-production-resources.mjs';
const parent=fileURLToPath(new URL('../../evidence/workspace-surface/terminal-production-parser-disposable/',import.meta.url));
const roots=['desktop/src/terminal/production-backend.mjs','desktop/src/terminal/production-ownership.mjs','desktop/src/terminal/production-creator-entry.mjs'];
const aux=['desktop/native/terminal-creator-three-lane/ownership.cc','desktop/native/terminal-creator-three-lane/peer-endpoints.inc','desktop/native/terminal-creator-three-lane/binding.gyp','desktop/runtime/terminal-provider/package.json','desktop/runtime/terminal-provider/package-lock.json'];
async function fixture(t,code){
 await mkdir(parent,{recursive:true});const root=await mkdtemp(path.join(parent,'case-'));
 t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(parent));assert.ok(path.basename(root).startsWith('case-'));await rm(root,{recursive:true,force:true});});
 for(const rel of [...roots,...aux,'desktop/src/terminal/hidden.mjs','desktop/src/terminal/shared.mjs']){const p=path.join(root,...rel.split('/'));await mkdir(path.dirname(p),{recursive:true});await writeFile(p,rel===roots[0]?code:rel.endsWith('.mjs')?'export const inert=true;\n':rel.endsWith('.json')?'{}\n':'// inert native source bytes\n');}
 return ()=>captureProductionResources({sourceRoot:root});
}
for(const [name,eol]of [['CR','\r'],['LS','\u2028'],['PS','\u2029']])test('FIXRES-I1 actual static request after '+name+' line-comment termination is captured',async t=>{
 const capture=await fixture(t,'// harmless comment'+eol+"import './hidden.mjs';\nthrow Error('INSPECTED_CODE_MUST_NOT_RUN');");
 const c=await capture();assert.ok(c.entries.some(r=>r.relativePath==='desktop/src/terminal/hidden.mjs'));
});
for(const code of ["const of=2; of / 2; import('node:fs'); /dummy/;","const obj={return:2}; obj.return / 2; import('node:fs'); /dummy/;","const obj={return:2}; obj?.return / 2; import('node:fs'); /dummy/;"])test('FIXRES-I2 division cannot hide forbidden dynamic import: '+code.split(';')[0],async t=>{
 await assert.rejects(await fixture(t,code),/PRODUCTION_RESOURCES_REFUSED/);
});
test('ordinary division and control-statement regexp retain actual static dependency without evaluation',async t=>{
 const capture=await fixture(t,"const of=2; of / 2; if(true) /text/.test('');\nimport './hidden.mjs';\nthrow Error('INSPECTED_CODE_MUST_NOT_RUN');");
 const c=await capture();assert.ok(c.entries.some(r=>r.relativePath.endsWith('/hidden.mjs')));
});
test('V8-decoded escaped static specifier is inventoried at its exact canonical path',async t=>{
 const capture=await fixture(t,"import './\\u0073hared.mjs';");const c=await capture();assert.ok(c.entries.some(r=>r.relativePath.endsWith('/shared.mjs')));
});
test('invalid JavaScript cannot become a branded source capture',async t=>{
 await assert.rejects(await fixture(t,'export const = ;'),/PRODUCTION_RESOURCES_REFUSED/);
});
for(const [label,code]of [
 ['block comment',"import /* inert */ ('node:fs');"],
 ['LF',"import // inert\n('node:fs');"],
 ['CR',"import // inert\r('node:fs');"],
 ['LS',"import // inert\u2028('node:fs');"],
 ['PS',"import // inert\u2029('node:fs');"],
 ['BOM whitespace',"import /* inert */\ufeff('node:fs');"],
 ['escaped keyword',"im\\u0070ort('node:fs');"]
])test('raw dynamic-text refusal or actual syntax parser rejects '+label,async t=>{
 await assert.rejects(await fixture(t,code),/PRODUCTION_RESOURCES_REFUSED/);
});
for(const [label,code]of [
 ['comment',"// import('not-executed')\nexport const inert=true;"],
 ['string',"const text=\"import('not-executed')\";"],
 ['regexp',"const text=/import('not-executed')/;"],
 ['template',"const text=`import('not-executed')`;"],
 ['property',"const obj={import(){}}; obj.import('not-executed');"]
])test('strict diagnostic policy conservatively refuses dynamic lookalike in '+label,async t=>{
 await assert.rejects(await fixture(t,code),/PRODUCTION_RESOURCES_REFUSED/);
});

for(const [label,code]of [
 ['block',"const text=\"import /*\"; import('node:fs'); /* */"],
 ['line',"const text=\"import //\"; import('node:fs');\n"]
])test('raw '+label+' comment lookalike cannot skip a later real dynamic import',async t=>{
 await assert.rejects(await fixture(t,code),/PRODUCTION_RESOURCES_REFUSED/);
});

test('missing supported non-evaluating parser refuses capture before filesystem inspection',()=>{
 const url=new URL('./terminal-production-resources.mjs',import.meta.url).href;
 const code="import assert from 'node:assert/strict'; import {captureProductionResources} from "+JSON.stringify(url)+"; await assert.rejects(captureProductionResources({sourceRoot:'not-an-absolute-path'}),/moduleRequests parser unavailable/);";
 const result=spawnSync(process.execPath,['--no-experimental-vm-modules','--input-type=module','--eval',code],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536});
 assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);
});

for(const [label,code]of [
 ['plain source',"void import.source('node:fs');"],
 ['source with block trivia',"void import /* a */ . /* b */ source /* c */ ('node:fs');"],
 ['source with line trivia',"void import // a\r. // b\u2028source // c\u2029('node:fs');"],
 ['escaped source phase',"void import.sourc\\u0065('node:fs');"],
 ['future defer phase',"void import.defer('node:fs');"],
 ['unknown phase',"void import.other('node:fs');"]
])test('FIXRES-I3 dynamic '+label+' refuses capture',async t=>{
 await assert.rejects(await fixture(t,code),/PRODUCTION_RESOURCES_REFUSED/);
});

test('import.meta with trivia remains inert and preserves ordinary static requests',async t=>{
 const c=await (await fixture(t,"const here=import /* a */ . /* b */ meta.url; import './shared.mjs'; throw Error('NEVER_RUN');"))();
 assert.ok(c.entries.some(r=>r.relativePath.endsWith('/shared.mjs')));
});
