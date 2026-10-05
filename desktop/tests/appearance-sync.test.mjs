import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const load=async()=>{const window={};runInNewContext(await readFile(new URL('../src/ui/shared/appearance-sync.js',import.meta.url),'utf8'),{window});return window.SirenAppearanceSync;};
test('a delayed appearance read cannot overwrite a newer user choice',async()=>{
 const factory=await load();let release,reads=0,theme='dark';const seen=[];
 const sync=factory.create({get:()=>++reads===1?new Promise(r=>release=r):Promise.resolve({ok:true,theme}),set:async value=>{theme=value.theme;return {ok:true,theme};},apply:r=>seen.push(r.theme)});
 const old=sync.refresh();await sync.choose('light');release({ok:true,theme:'dark'});await old;
 assert.equal(seen.at(-1),'light');assert.equal(seen.includes('dark'),false);sync.dispose();
});
test('overlapping theme writes defer polling and obsolete errors until the latest choice settles',async()=>{
 const factory=await load();let release,reads=0,theme='light',errors=0;const seen=[];
 const sync=factory.create({get:async()=>{reads++;return {ok:true,theme};},set:value=>value.theme==='dark'?new Promise(r=>release=r):Promise.resolve({ok:true,theme}),apply:r=>seen.push(r.theme),rejected:()=>errors++});
 const old=sync.choose('dark');await sync.choose('light');await sync.refresh();assert.equal(reads,0);release({ok:false});await old;
 assert.equal(errors,0);assert.equal(seen.at(-1),'light');assert.equal(reads,1);sync.dispose();
});
