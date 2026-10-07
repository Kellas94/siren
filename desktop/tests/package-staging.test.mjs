import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,readdir,rename,symlink,lstat,realpath,rm} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {withPackageStaging} from '../scripts/package-staging.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'siren-owned-staging-')),dist=join(root,'dist');await mkdir(dist);
 t.after(async()=>{
  assert.equal((await realpath(root)).toLowerCase(),resolve(root).toLowerCase());
  assert.ok(!(await lstat(root)).isSymbolicLink());
  const within=relative(await realpath(tmpdir()),root);assert.ok(within&&!within.startsWith('..')&&!isAbsolute(within));
  await rm(resolve(root),{recursive:true});
 });
 const historical=join(dist,'.build-input-00000000-0000-4000-8000-000000000000');await mkdir(historical);await writeFile(join(historical,'keep'),'another build');
 return{root,dist,historical};
}
test('staging lifetime removes only its own populated tree and returns the build result',async t=>{
 const{root,dist,historical}=await fixture(t);const preview=join(dist,'development-kept'),data=join(root,'Data');await mkdir(preview);await mkdir(data);
 await writeFile(join(preview,'archive'),'completed artifact');await writeFile(join(data,'project'),'user project');
 let used;const result={preview};
 assert.equal(await withPackageStaging(dist,async path=>{used=path;await mkdir(join(path,'nested'));await writeFile(join(path,'nested','input'),'temporary');return result;}),result);
 await assert.rejects(lstat(used),{code:'ENOENT'});
 assert.equal(await readFile(join(historical,'keep'),'utf8'),'another build');assert.equal(await readFile(join(preview,'archive'),'utf8'),'completed artifact');assert.equal(await readFile(join(data,'project'),'utf8'),'user project');
});
test('build failure is rethrown by identity after its staging is removed',async t=>{
 const{dist}=await fixture(t);const original=new Error('copy failed');let used;
 await assert.rejects(withPackageStaging(dist,async path=>{used=path;await writeFile(join(path,'partial'),'partial input');throw original;}),error=>error===original);
 await assert.rejects(lstat(used),{code:'ENOENT'});
});
test('cooperative cancellation removes staging and preserves the exact cancellation',async t=>{
 const{dist}=await fixture(t);const original=new DOMException('Build cancelled','AbortError');let used;
 await assert.rejects(withPackageStaging(dist,async path=>{used=path;await writeFile(join(path,'partial'),'partial input');AbortSignal.abort(original).throwIfAborted();}),error=>error===original);
 await assert.rejects(lstat(used),{code:'ENOENT'});
});
test('falsy build rejection is not mistaken for success',async t=>{
 const{dist}=await fixture(t);let used;
 await withPackageStaging(dist,async path=>{used=path;throw undefined;}).then(()=>assert.fail('Original rejection swallowed'),error=>assert.equal(error,undefined));
 await assert.rejects(lstat(used),{code:'ENOENT'});
});
test('staging refuses a junction parent before invoking the build',async t=>{
 const{root,dist}=await fixture(t);const alias=join(root,'alias');await symlink(dist,alias,'junction');
 await assert.rejects(withPackageStaging(alias,async path=>{await writeFile(join(path,'unexpected'),'must not execute');}),/path refused/i);
 assert.deepEqual(await readdir(dist),['.build-input-00000000-0000-4000-8000-000000000000']);
});
test('nested junction refuses cleanup and preserves the target and staged diagnostics',async t=>{
 const{root,dist}=await fixture(t);const target=join(root,'outside-staging');await mkdir(target);await writeFile(join(target,'keep'),'outside data');let used;
 await assert.rejects(withPackageStaging(dist,async path=>{used=path;await writeFile(join(path,'diagnostic'),'build completed');await symlink(target,join(path,'nested-link'),'junction');}),/PACKAGE_STAGING_CLEANUP_FAILED/);
 assert.equal(await readFile(join(target,'keep'),'utf8'),'outside data');assert.equal(await readFile(join(used,'diagnostic'),'utf8'),'build completed');
});
test('cleanup refusal preserves both errors and discloses the exact retained staging path',async t=>{
 const{root,dist}=await fixture(t);const original=new Error('Original ASAR failure'),target=join(root,'elsewhere');await mkdir(target);let used;
 await assert.rejects(withPackageStaging(dist,async path=>{used=path;await symlink(target,join(path,'link'),'junction');throw original;}),error=>{
  assert.ok(error instanceof AggregateError);assert.equal(error.cause,original);assert.equal(error.errors[0],original);assert.equal(error.errors.length,2);assert.equal(error.stagingPath,used);return true;
 });
 assert.ok((await lstat(used)).isDirectory());
});
test('replaced staging root is not deleted even when the replacement is a normal directory',async t=>{
 const{root,dist}=await fixture(t);const moved=join(root,'original-staging');let used;
 await assert.rejects(withPackageStaging(dist,async path=>{used=path;await writeFile(join(path,'original'),'original');await rename(path,moved);await mkdir(path);await writeFile(join(path,'replacement'),'replacement');}),/PACKAGE_STAGING_CLEANUP_FAILED/);
 assert.equal(await readFile(join(used,'replacement'),'utf8'),'replacement');assert.equal(await readFile(join(moved,'original'),'utf8'),'original');
});
test('replaced staging root junction is refused without deleting its target',async t=>{
 const{root,dist}=await fixture(t);const moved=join(root,'original-staging'),target=join(root,'target');await mkdir(target);await writeFile(join(target,'keep'),'target data');
 await assert.rejects(withPackageStaging(dist,async path=>{await rename(path,moved);await symlink(target,path,'junction');}),/PACKAGE_STAGING_CLEANUP_FAILED/);
 assert.equal(await readFile(join(target,'keep'),'utf8'),'target data');assert.ok((await lstat(moved)).isDirectory());
});
test('replaced parent refuses cleanup without deleting replacement or moved trees',async t=>{
 const{root,dist}=await fixture(t);const moved=join(root,'moved-dist');let used;
 await assert.rejects(withPackageStaging(dist,async path=>{used=path;await writeFile(join(path,'original'),'original');await rename(dist,moved);await mkdir(dist);await mkdir(path);await writeFile(join(path,'replacement'),'replacement');}),/PACKAGE_STAGING_CLEANUP_FAILED/);
 assert.equal(await readFile(join(used,'replacement'),'utf8'),'replacement');assert.equal(await readFile(join(moved,relative(dist,used),'original'),'utf8'),'original');
});
test('concurrent builds clean their own staging without touching another invocation',async t=>{
 const{dist,historical}=await fixture(t);const paths=[];let release;const ready=new Promise(resolve=>{release=resolve;});const original=new Error('second build failed');
 const run=fail=>withPackageStaging(dist,async path=>{paths.push(path);await writeFile(join(path,'input'),fail?'two':'one');if(paths.length===2)release();await ready;assert.equal((await readdir(path)).length,1);if(fail)throw original;return 'first';});
 const results=await Promise.allSettled([run(false),run(true)]);assert.equal(new Set(paths).size,2);assert.deepEqual(results,[{status:'fulfilled',value:'first'},{status:'rejected',reason:original}]);
 for(const path of paths)await assert.rejects(lstat(path),{code:'ENOENT'});assert.equal(await readFile(join(historical,'keep'),'utf8'),'another build');
});
