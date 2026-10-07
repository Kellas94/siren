import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const code=await readFile(new URL('../src/ui/workspace/home.js',import.meta.url),'utf8');
const guide=await readFile(new URL('../src/ui/workspace/guide.js',import.meta.url),'utf8');
function fixture(){
 const window={sirenDesktopBootstrap:{mode:'locked'}},document={readyState:'complete'};
 runInNewContext(guide+'\n'+code,{window,document});let callback,removed=0;const called=[];
 const desktop={onCommand:fn=>{callback=fn;return()=>{removed++;};}};
 return {window,desktop,called,send:id=>callback(id),removed:()=>removed};
}
test('Home native menu shortcuts route once to finite commands and disposal removes the listener',async()=>{
 const f=fixture();const dispose=f.window.installSirenHomeCommands({desktop:f.desktop,commands:{desktopCheckUpdates:()=>f.called.push('updates'),desktopLockPin:()=>f.called.push('lock')},enabled:()=>true});
 f.send('desktopCheckUpdates');f.send('desktopLockPin');f.send('unknown');f.send('__proto__');
 assert.deepEqual(f.called,['updates','lock']);dispose();assert.equal(f.removed(),1);
});
test('Home commands cannot run behind PIN or a retired workspace; busy UI still permits native Lock',()=>{
 const f=fixture();let unlocked=false,busy=true;
 f.window.installSirenHomeCommands({desktop:f.desktop,commands:{desktopLockPin:()=>f.called.push('lock'),desktopOpenProject:()=>f.called.push('open')},enabled:id=>unlocked&&(!busy||id==='desktopLockPin')});
 f.send('desktopLockPin');assert.deepEqual(f.called,[]);unlocked=true;f.send('desktopOpenProject');f.send('desktopLockPin');assert.deepEqual(f.called,['lock']);busy=false;f.send('desktopOpenProject');assert.deepEqual(f.called,['lock','open']);
});

test('actual Home export command invokes saved-backup bridge once, retains completion and never navigates',async()=>{
 const f=fixture(),note={textContent:''},container={querySelector:()=>note,querySelectorAll:()=>[],setAttribute(){},replaceChildren(){}};
 let calls=0,release;const pending=new Promise(r=>{release=r;});
 const view=f.window.renderSirenHome({container,desktop:f.desktop,bootstrap:{mode:'normal'},bridge:{exportSavedBackup:async()=>{calls++;return pending;},getHomeState:()=>assert.fail('export must not navigate or clear receipt')}});
 f.send('desktopExportProject');f.send('desktopExportProject');assert.equal(calls,1);assert.match(note.textContent,/unsaved/i);
 release({ok:true,revision:17,schema:2,bytes:100,sha256:'a'.repeat(64)});await new Promise(r=>setImmediate(r));assert.match(note.textContent,/17/);assert.match(note.textContent,/saved/i);
 view.cover();f.send('desktopExportProject');assert.equal(calls,1);
});

test('Home cancellation stays cancellation and covered pending completion cannot repaint private status',async()=>{
 const f=fixture(),note={textContent:''},container={querySelector:()=>note,querySelectorAll:()=>[],setAttribute(){},replaceChildren(){}};let release;
 const view=f.window.renderSirenHome({container,desktop:f.desktop,bootstrap:{mode:'normal'},bridge:{exportSavedBackup:()=>new Promise(r=>{release=r;})}});
 f.send('desktopExportProject');assert.equal(typeof release,'function');release({ok:false,code:'CANCELLED'});await new Promise(r=>setImmediate(r));assert.match(note.textContent,/cancel/i);
 f.send('desktopExportProject');view.cover();note.textContent='covered';release({ok:true,revision:18});await new Promise(r=>setImmediate(r));assert.equal(note.textContent,'covered');
});

test('visible Home Lock remains enabled while backup waits for its native destination',async()=>{
 const f=fixture(),note={textContent:''},lock={id:'homeLock',dataset:{},disabled:false},other={id:'homeModule-code',dataset:{},disabled:false};let release;
 const container={querySelector:()=>note,querySelectorAll:()=>[lock,other],setAttribute(){},replaceChildren(){}};
 f.window.renderSirenHome({container,desktop:f.desktop,bootstrap:{mode:'normal'},bridge:{exportSavedBackup:()=>new Promise(r=>{release=r;})}});
 f.send('desktopExportProject');assert.equal(lock.disabled,false);assert.equal(other.disabled,true);release({ok:false,code:'CANCELLED'});await new Promise(r=>setImmediate(r));assert.equal(other.disabled,false);
});
