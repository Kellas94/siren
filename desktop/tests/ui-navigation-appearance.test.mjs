// Literal owner controls adapted by /root to maintained live-source regression tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {homeFixture,hold,tick,load,vm} from './fixtures/ui-navigation-appearance.mjs';
const readyState=project=>({ok:true,state:{mode:'normal',selectedProjectId:project,projectFormat:'desktop',projects:[{projectId:project,label:project,availability:'cached'}],continuation:null,views:[],capabilities:{diagrams:true,docs:true,code:true,present:true}}});

test('Home initial busy request waits for its first admitted state',async()=>{
 const read=hold(),f=await homeFixture(read);f.navigate('present');assert.equal(f.clock.pending().length,1);assert.deepEqual(f.catalogue,[]);read.resolve(readyState('project-a'));await f.ready;f.clock.fire(f.clock.pending()[0]);await tick();assert.equal(f.catalogue.length,1);assert.equal(f.catalogue[0].request.role,'presenter');
});
test('Home latest intent replaces one timer; even an already-delivered cancelled callback cannot consume it',async()=>{
 const f=await homeFixture(),read=hold();f.setRead(read);const refresh=f.home.refresh();f.navigate('docs');const old=f.clock.pending()[0];f.navigate('code');const latest=f.clock.pending()[0];assert.notEqual(old,latest);assert.equal(old.cancelled,true);assert.equal(f.clock.pending().length,1);old.fn();assert.equal(f.clock.pending().length,1);assert.deepEqual(f.catalogue,[]);
 f.setRead(null);read.resolve(readyState('project-a'));await refresh;f.clock.fire(latest);await tick();assert.equal(f.catalogue.length,1);assert.equal(f.catalogue[0].request.role,'code');assert.equal(f.clock.pending().length,0);
});
test('Home cover cancels queued intent and a fresh resumed action opens normally',async()=>{
 const f=await homeFixture(),read=hold();f.setRead(read);const refresh=f.home.refresh();f.navigate('docs');const old=f.clock.pending()[0];f.home.cover();assert.equal(old.cancelled,true);assert.equal(f.clock.pending().length,0);f.setProject('project-b');f.setRead(null);await f.home.resume();read.resolve(readyState('project-a'));await refresh;old.fn();await tick();assert.deepEqual(f.catalogue,[]);f.navigate('docs');await tick();assert.equal(f.catalogue.length,1);assert.equal(f.catalogue[0].project,'project-b');
});
test('Home dispose cancels pending navigation, including stale bridge and timer callbacks',async()=>{
 const f=await homeFixture(),read=hold();f.setRead(read);const refresh=f.home.refresh();f.navigate('docs');const old=f.clock.pending()[0];f.home.dispose();assert.equal(old.cancelled,true);old.fn();f.navigate('code');read.resolve(readyState('project-a'));await refresh;await tick();assert.deepEqual(f.catalogue,[]);assert.equal(f.clock.pending().length,0);
});
test('Home a newer refresh serial retires prior retry while fresh request uses the new serial',async()=>{
 const f=await homeFixture(),read=hold();f.setRead(read);const refresh=f.home.refresh();f.navigate('docs');const old=f.clock.pending()[0];f.setRead(null);await f.home.refresh();f.clock.fire(old);await tick();assert.deepEqual(f.catalogue,[]);read.resolve(readyState('project-a'));await refresh;f.navigate('present');await tick();assert.equal(f.catalogue.length,1);assert.equal(f.catalogue[0].request.role,'presenter');
});
test('Home latest Find supersedes old module without duplicate library dispatch',async()=>{
 const f=await homeFixture(),read=hold(),found=[];f.window.SirenProjectSearch={open:()=>found.push('find')};f.setRead(read);const refresh=f.home.refresh();f.navigate('docs');const old=f.clock.pending()[0];f.navigate('find');f.setRead(null);read.resolve(readyState('project-a'));await refresh;old.fn();f.clock.fire(f.clock.pending()[0]);await tick();assert.deepEqual(found,['find']);assert.deepEqual(f.catalogue,[]);
});

function syncFixture(){const window={},gets=[],sets=[],seen=[],errors=[],unavailable=[];vm.runInNewContext(load('src/ui/shared/appearance-sync.js'),{window});const api=window.SirenAppearanceSync.create({get(){const d=hold();gets.push(d);return d.promise;},set(value){const d=hold();sets.push({...d,value});return d.promise;},apply:value=>seen.push(value.theme),rejected:(value,context)=>errors.push({value,context}),unavailable:()=>unavailable.push('unavailable')});return{api,gets,sets,seen,errors,unavailable};}
for(const outcome of['refused','reject'])test('appearance older read '+outcome+' cannot hide a newer successful read',async()=>{
 const f=syncFixture(),old=f.api.refresh(),latest=f.api.refresh();f.gets[1].resolve({ok:true,theme:'dark'});await latest;if(outcome==='reject')f.gets[0].reject(Error('OLD_READ_FAILED'));else f.gets[0].resolve({ok:false,code:'ACCESS_REFUSED'});await old;assert.deepEqual(f.seen,['dark']);assert.deepEqual(f.unavailable,[]);
});
test('appearance newest read failure fences an older success instead of painting obsolete state',async()=>{
 const f=syncFixture(),old=f.api.refresh(),latest=f.api.refresh();f.gets[1].resolve({ok:false,code:'ACCESS_REFUSED'});await latest;f.gets[0].resolve({ok:true,theme:'light'});await old;assert.deepEqual(f.seen,[]);assert.deepEqual(f.unavailable,['unavailable']);
});
test('appearance pending write skips reads; old read cannot overwrite choice or final refresh',async()=>{
 const f=syncFixture(),old=f.api.refresh(),choice=f.api.choose('dark','CURRENT_CONTEXT');await f.api.refresh();assert.equal(f.gets.length,1);f.gets[0].resolve({ok:true,theme:'light'});await old;assert.deepEqual(f.seen,[]);f.sets[0].resolve({ok:true,theme:'dark'});await tick();assert.deepEqual(f.seen,['dark']);assert.equal(f.gets.length,2);f.gets[1].resolve({ok:true,theme:'dark'});await choice;assert.deepEqual(f.seen,['dark','dark']);assert.deepEqual(f.errors,[]);
});
test('appearance overlapping writes keep newest choice authoritative and final refresh waits all writes',async()=>{
 const f=syncFixture(),old=f.api.choose('light','OLD_CONTEXT'),latest=f.api.choose('dark','NEW_CONTEXT');f.sets[1].resolve({ok:true,theme:'dark'});await latest;assert.deepEqual(f.seen,['dark']);assert.equal(f.gets.length,0);await f.api.refresh();assert.equal(f.gets.length,0);f.sets[0].resolve({ok:false,code:'APPEARANCE_WRITE_FAILED'});await tick();assert.deepEqual(f.errors,[]);assert.equal(f.gets.length,1);f.gets[0].resolve({ok:true,theme:'dark'});await old;assert.deepEqual(f.seen,['dark','dark']);
});
for(const outcome of['success','reject'])test('appearance dispose fences held read '+outcome+' and later requests',async()=>{
 const f=syncFixture(),read=f.api.refresh();f.api.dispose();if(outcome==='reject')f.gets[0].reject(Error('RETIRED_READ'));else f.gets[0].resolve({ok:true,theme:'dark'});await read;await f.api.refresh();assert.equal(f.gets.length,1);assert.deepEqual(f.seen,[]);assert.deepEqual(f.unavailable,[]);assert.equal((await f.api.choose('dark')).ok,false);assert.equal(f.sets.length,0);
});
test('appearance dispose during write suppresses callbacks and final refresh',async()=>{
 const f=syncFixture(),choice=f.api.choose('dark','RETIRED_CONTEXT');f.api.dispose();f.sets[0].resolve({ok:false,code:'ACCESS_REFUSED'});await choice;assert.deepEqual(f.seen,[]);assert.deepEqual(f.errors,[]);assert.equal(f.gets.length,0);
});
test('appearance current rejection retains its captured context then performs final native read',async()=>{
 const f=syncFixture(),choice=f.api.choose('dark','CAPTURED_CONTEXT');f.sets[0].resolve({ok:false,code:'APPEARANCE_WRITE_FAILED'});await tick();assert.equal(f.errors.length,1);assert.equal(f.errors[0].context,'CAPTURED_CONTEXT');f.gets[0].resolve({ok:true,theme:'light'});await choice;assert.deepEqual(f.seen,['light']);
});
