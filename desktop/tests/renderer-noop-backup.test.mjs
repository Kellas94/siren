import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {PrimaryPersistence} from '../src/windows/primary.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
const source=await readFile(new URL('../src/ui/storage.js',import.meta.url),'utf8');
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'siren-noop-native-backup-')),projects=new ProjectStore(root),recovery=new RecoveryStore(root);
 const state='{"source":"flowchart TD\\n A-->B"}',previous='{"source":"flowchart TD\\n BEFORE-->B"}';
 const initial=await projects.createProject({label:'No-op backup preservation',json:JSON.stringify({kind:'siren-desktop',schema:1,storage:{state,'state-last-good':previous}})});
 const primary=new PrimaryPersistence({projects:()=>projects,recovery});
 const window={sirenDesktopBootstrap:{snapshot:initial,readonly:false},sirenDesktop:{saveProject:request=>primary.save(structuredClone(request),{projectId:initial.project.id,isCurrent:()=>true})}};
 vm.runInNewContext(source,{window,crypto:globalThis.crypto,TextEncoder});const store=window.createSirenDesktopStore({workspaceKey:'state'});
 return {projects,recovery,store,initial,state,previous,current:()=>projects.readProject(initial.project.id)};
}
test('repeated unchanged renderer saves preserve the actual last-good backup and native project revision',async()=>{
 const f=await fixture();for(let attempt=0;attempt<2;attempt++)assert.equal((await f.store.setWithBackup('state',f.state,'state-last-good',f.state)).ok,true);
 const actual=await f.current();assert.deepEqual(actual,f.initial);assert.equal(f.store.get('state-last-good'),f.previous);
 assert.equal((await f.recovery.scan()).valid.length,1,'The second unchanged acknowledged write reuses the exact verified checkpoint');
});
test('a real new state rotates last-good once and further unchanged saves preserve that prior state',async()=>{
 const f=await fixture(),changed='{"source":"flowchart TD\\n NEW-->B"}';
 assert.equal((await f.store.setWithBackup('state',changed,'state-last-good',f.state)).ok,true);
 const once=await f.current();assert.equal(once.revision,f.initial.revision+1);
 assert.equal((await f.store.setWithBackup('state',changed,'state-last-good',changed)).ok,true);
 assert.deepEqual(await f.current(),once);assert.equal(JSON.parse(once.json).storage['state-last-good'],f.state);
});
