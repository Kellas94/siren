// Literal completion-order controls; live-loader adaptation by /root.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const hold=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function fixture(){const window={},reads=[],seen=[],hidden=[];vm.runInNewContext(readFileSync(new URL('../src/ui/shared/appearance-sync.js',import.meta.url),'utf8'),{window});const api=window.SirenAppearanceSync.create({get(){const d=hold();reads.push(d);return d.promise;},set:async()=>({ok:true,theme:'dark'}),apply:r=>seen.push(r.theme),unavailable:()=>hidden.push('unavailable')});return{api,reads,seen,hidden};}
test('an older successful read can apply while a newer read is still pending',async()=>{
 const f=fixture(),old=f.api.refresh(),newer=f.api.refresh();f.reads[0].resolve({ok:true,theme:'light'});await old;assert.deepEqual(f.seen,['light']);assert.deepEqual(f.hidden,[]);f.reads[1].resolve({ok:true,theme:'dark'});await newer;assert.deepEqual(f.seen,['light','dark']);f.api.dispose();
});
for(const outcome of ['refused','rejected'])test('an older '+outcome+' read remains observable while a newer read is pending',async()=>{
 const f=fixture(),old=f.api.refresh(),newer=f.api.refresh();if(outcome==='rejected')f.reads[0].reject(Error('READ_FAILED'));else f.reads[0].resolve({ok:false,code:'ACCESS_REFUSED'});await old;assert.deepEqual(f.hidden,['unavailable']);f.reads[1].resolve({ok:true,theme:'dark'});await newer;assert.deepEqual(f.seen,['dark']);assert.deepEqual(f.hidden,['unavailable']);f.api.dispose();
});
test('middle completion makes progress and fences older reply while newest remains pending',async()=>{
 const f=fixture(),first=f.api.refresh(),middle=f.api.refresh(),latest=f.api.refresh();f.reads[1].resolve({ok:true,theme:'dark'});await middle;assert.deepEqual(f.seen,['dark']);f.reads[0].resolve({ok:true,theme:'light'});await first;assert.deepEqual(f.seen,['dark']);f.reads[2].resolve({ok:true,theme:'light'});await latest;assert.deepEqual(f.seen,['dark','light']);f.api.dispose();
});
test('newer rejected completion fences an older successful reply',async()=>{
 const f=fixture(),old=f.api.refresh(),newer=f.api.refresh();f.reads[1].reject(Error('NEW_READ_FAILED'));await newer;f.reads[0].resolve({ok:true,theme:'light'});await old;assert.deepEqual(f.seen,[]);assert.deepEqual(f.hidden,['unavailable']);f.api.dispose();
});
test('newer synchronous get failure completes its barrier before old read returns',async()=>{
 const window={},oldRead=hold(),seen=[],hidden=[];let calls=0;vm.runInNewContext(readFileSync(new URL('../src/ui/shared/appearance-sync.js',import.meta.url),'utf8'),{window});const api=window.SirenAppearanceSync.create({get(){if(++calls===1)return oldRead.promise;throw Error('SYNC_GET_FAILED');},set:async()=>({ok:true}),apply:r=>seen.push(r.theme),unavailable:()=>hidden.push('unavailable')});const old=api.refresh();await api.refresh();oldRead.resolve({ok:true,theme:'light'});await old;assert.deepEqual(seen,[]);assert.deepEqual(hidden,['unavailable']);api.dispose();
});
