import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFile, cp, mkdir, writeFile, readFile, readdir, lstat, realpath, rm} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {extractFile} from '@electron/asar';
import {mkdtemp} from './fixtures/temporary.mjs';
import {buildDevelopmentPackage} from '../scripts/package.mjs';

// Actual builder/ASAR/renderer, with an explicitly non-executable test runtime.
// This tests build resource lifetime; it does not qualify a portable application.
const desktop=fileURLToPath(new URL('../',import.meta.url));
const historical='.build-input-00000000-0000-4000-8000-000000000000';
const sentinel='export const packagingFixture = "staging lifetime";\n';
async function fixture(t,{failRuntime=false}={}){
 const root=await mkdtemp(join(tmpdir(),'siren-package-staging-test-'));
 const ownedRoot=resolve(root);
 t.after(async()=>{
  assert.equal((await realpath(root)).toLowerCase(),ownedRoot.toLowerCase());
  assert.ok((await lstat(root)).isDirectory()&&!(await lstat(root)).isSymbolicLink());
  assert.ok(ownedRoot.startsWith(resolve(await realpath(tmpdir()))),'Fixture removal stays in the named temporary directory');
  await rm(ownedRoot,{recursive:true});
 });
 await cp(join(desktop,'src'),join(root,'src'),{recursive:true,errorOnExist:true,force:false});
 await writeFile(join(root,'src/main.mjs'),sentinel);
 await mkdir(join(root,'baseline'));await copyFile(join(desktop,'baseline/R78.html'),join(root,'baseline/R78.html'));
 await mkdir(join(root,'native/generated'),{recursive:true});
 for(const name of ['process-identity.exe','process-identity.json'])await copyFile(join(desktop,'native/generated',name),join(root,'native/generated',name));
 await copyFile(join(desktop,'native/process-identity.cs'),join(root,'native/process-identity.cs'));
 await writeFile(join(root,'package.json'),JSON.stringify({name:'siren-staging-test-fixture',version:'0.0.0-test',main:'src/start.mjs',type:'module'}));
 await writeFile(join(root,'package-lock.json'),JSON.stringify({packages:{'':{}}}));
 const runtime=join(root,'node_modules/electron/dist');await mkdir(runtime,{recursive:true});
 await writeFile(join(runtime,'electron.exe'),'NON-EXECUTABLE OWNED PACKAGING TEST FIXTURE');
 await writeFile(join(runtime,'LICENSE'),'Owned synthetic fixture: no runtime is distributed or executed.');
 await writeFile(join(runtime,'version'),'44.5.1');
 await writeFile(join(runtime,'LICENSES.chromium.html'),'<div class="product"><div class="title">Owned fixture</div><div class="license">Owned synthetic fixture notice for packaging resource-lifetime tests only.</div></div>');
 if(failRuntime)await writeFile(join(runtime,'unidentified-runtime.txt'),'Force the real runtime allowlist to fail after inputs are staged.');
 await mkdir(join(root,'dist',historical),{recursive:true});
 await writeFile(join(root,'dist',historical,'keep.txt'),'Historical staging belongs to another invocation.');
 return root;
}
async function assertHistoricalOnly(root){
 assert.deepEqual((await readdir(join(root,'dist'))).filter(name=>name.startsWith('.build-input-')),[historical],'This invocation must remove its own staging and preserve other staging');
 assert.equal(await readFile(join(root,'dist',historical,'keep.txt'),'utf8'),'Historical staging belongs to another invocation.');
}
test('successful real package build removes its own staging and preserves its archive and historical sibling',{skip:process.platform!=='win32',timeout:120000},async t=>{
 const root=await fixture(t);
 const result=await buildDevelopmentPackage({desktopRoot:root,sourceCommit:'a'.repeat(40)});
 await assertHistoricalOnly(root);
 assert.equal(extractFile(join(result.previewRoot,'App/versions/0.1.0/resources/app.asar'),'src/main.mjs').toString(),sentinel);
 assert.equal(JSON.parse(await readFile(join(result.previewRoot,'BUILD-IDENTITY.json'),'utf8')).releaseAdmitted,false);
});
test('failed real package build removes its own populated staging and preserves original error and partial preview',{skip:process.platform!=='win32',timeout:120000},async t=>{
 const root=await fixture(t,{failRuntime:true});
 await assert.rejects(buildDevelopmentPackage({desktopRoot:root,sourceCommit:'b'.repeat(40)}),/Unidentified runtime file/);
 await assertHistoricalOnly(root);
 const previews=(await readdir(join(root,'dist'))).filter(name=>name.startsWith('development-'));
 assert.equal(previews.length,1,'Partial preview remains outside temporary staging for diagnostics');
 assert.ok((await lstat(join(root,'dist',previews[0],'App/versions/0.1.0'))).isDirectory());
});
