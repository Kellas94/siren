import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,access,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {retainSessionProvisionFailure} from './terminal-session-provision-retention.mjs';
const base=fileURLToPath(new URL('../../../terminal-session-provision-20261010/',import.meta.url));
async function fixture(t){const root=await mkdtemp(join(base,'retention-test-')),work=join(root,'work'),artifact=join(root,'artifact');await mkdir(work);await mkdir(artifact);t.after(async()=>{assert.ok(resolve(root).startsWith(resolve(base)+'\\'));await rm(root,{recursive:true});});return{work,artifact};}
test('failed build retains partial execution and both native artifacts as DATA',async t=>{
 const {work,artifact}=await fixture(t),files=['execution/desktop/runtime/terminal-provider/package.json','terminal-host-roster-candidate/build/partial.vcxproj','terminal-creator-three-lane/build/Release/siren.node'];
 for(const path of files){await mkdir(resolve(work,path,'..'),{recursive:true});await writeFile(join(work,path),'inert:'+path);}
 await mkdir(join(work,'electron-deps'));await writeFile(join(work,'electron-deps','not-selected.txt'),'not selected');
 const result=await retainSessionProvisionFailure({workDirectory:work,artifactDirectory:artifact});
 for(const path of files)assert.equal(await readFile(join(artifact,'partial',path),'utf8'),'inert:'+path);
 assert.equal(result.copied.length,3);assert.deepEqual(result.missing,[]);await assert.rejects(access(join(artifact,'partial/electron-deps')));
});
test('failed preparation records each not-yet-created selected subtree',async t=>{
 const {work,artifact}=await fixture(t);const result=await retainSessionProvisionFailure({workDirectory:work,artifactDirectory:artifact});assert.deepEqual(result.missing,['execution','terminal-host-roster-candidate','terminal-creator-three-lane']);assert.deepEqual(result.copied,[]);
});
test('retention refuses an artifact target inside its own source tree',async t=>{const {work}=await fixture(t);await assert.rejects(retainSessionProvisionFailure({workDirectory:work,artifactDirectory:join(work,'artifact')}));});
