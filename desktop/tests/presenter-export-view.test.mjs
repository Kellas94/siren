import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../src/ui/presentation/notes-export.js',import.meta.url),'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return '';});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const window={};runInNewContext(source,{window});assert.equal(typeof window.SirenPresenterNotesExport?.create,'function');
 class Node{hidden=false;disabled=false;listeners={};addEventListener(k,f){this.listeners[k]=f;}removeEventListener(k){delete this.listeners[k];}emit(){return this.listeners.click?.();}}
 const button=new Node(),revealButton=new Node(),messages=[],calls=[];let ready=true,state={deck:{deckId:'deck-a',version:'a'.repeat(64)}},answer;
 const bridge={exportNotes:async p=>{calls.push(JSON.parse(JSON.stringify(p)));return typeof answer==='function'?answer():answer;},revealExport:async p=>{calls.push(JSON.parse(JSON.stringify(p)));return{ok:true};}};
 const view=window.SirenPresenterNotesExport.create({button,revealButton,bridge,getState:()=>state,isReady:()=>ready,onStatus:t=>messages.push(t)}),receipt={ok:true,exportId:'00000000-0000-4000-8000-000000000001',filename:'presentation-notes-00000000-0000-4000-8000-000000000001.txt',bytes:123,sha256:'c'.repeat(64),deckId:'deck-a',deckVersion:'a'.repeat(64)};
 return {view,button,revealButton,messages,calls,receipt,answer:a=>answer=a,state:a=>state=a,ready:a=>ready=a};
}
test('Presenter action submits only captured version and shows file only for exact finite acknowledged receipt',async()=>{
 const f=fixture();f.answer(f.receipt);f.button.emit();await tick();assert.deepEqual(f.calls,[{deckVersion:'a'.repeat(64)}]);assert.match(f.messages.at(-1),/captured/i);assert.equal(f.revealButton.hidden,false);f.revealButton.emit();await tick();assert.deepEqual(f.calls[1],{exportId:f.receipt.exportId});
});
test('unique pending action joins Lock and rejects late completion; resume cannot restore private delivery receipt',async()=>{
 const f=fixture();let release;f.answer(()=>new Promise(r=>release=r));f.button.emit();await tick();f.button.emit();assert.equal(f.calls.length,1);assert.equal(f.button.disabled,true);let joined=false;const pending=Promise.resolve(f.view.pause()).then(()=>joined=true);await tick();assert.equal(joined,false);const count=f.messages.length;release(f.receipt);await pending;assert.equal(f.messages.length,count);assert.equal(f.revealButton.hidden,true);f.view.resume();assert.equal(f.button.disabled,false);assert.equal(f.revealButton.hidden,true);
});
test('Refresh/current version changes and malformed responses cannot expose stale file or imply successful export',async()=>{
 const f=fixture();for(const answer of [{ok:false},{...f.receipt,deckVersion:'b'.repeat(64)},{...f.receipt,filename:'outside.txt'},{...f.receipt,path:'outside'}]){f.answer(answer);f.button.emit();await tick();assert.equal(f.revealButton.hidden,true);assert.match(f.messages.at(-1),/retained/i);}
 f.answer(f.receipt);f.button.emit();await tick();assert.equal(f.revealButton.hidden,false);f.state({deck:{deckId:'deck-a',version:'b'.repeat(64)}});f.view.update();assert.equal(f.revealButton.hidden,true);
});
test('unready/disposed actions refuse transport and release controls after thrown export/reveal',async()=>{
 const f=fixture();f.ready(false);f.view.update();f.button.emit();assert.equal(f.calls.length,0);f.ready(true);f.answer(()=>{throw Error('unavailable');});f.button.emit();await tick();assert.equal(f.button.disabled,false);assert.equal(f.revealButton.hidden,true);assert.match(f.messages.at(-1),/retained/i);f.view.dispose();f.button.emit();assert.equal(f.calls.length,1);assert.equal(f.button.disabled,true);
});
