import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const start=main.indexOf("window.webContents.on('before-input-event'"),end=main.indexOf("await window.loadURL",start);assert.ok(start>=0&&end>start);
function fixture(){let handler;const calls=[];vm.runInNewContext(main.slice(start,end),{window:{webContents:{on:(_id,fn)=>{handler=fn;}},close:()=>calls.push('quit')},desktopCommand:id=>calls.push(id)});return {calls,press:input=>{let prevented=0;handler({preventDefault:()=>{prevented++;}},input);return prevented;}};}
test('actual native primary routes each reserved chord once and prevents duplicate page/menu delivery',()=>{
 const f=fixture();for(const [key,alt,command] of [[',',false,'desktopPinSettings'],['l',true,'desktopLockPin'],['o',true,'desktopOpenProject'],['u',true,'desktopCheckUpdates'],['r',true,'desktopRecovery'],['e',true,'desktopExportProject'],['q',false,'quit']]){assert.equal(f.press({type:'keyDown',control:true,alt,shift:false,key}),1);assert.equal(f.calls.at(-1),command);}
 assert.equal(f.calls.length,7);
});
test('keyup repeat composing and unrelated modifiers do not dispatch reserved native commands',()=>{
 const f=fixture();for(const patch of [{type:'keyUp'},{isComposing:true},{shift:true},{meta:true},{control:false},{key:'x'},{key:'constructor'}])assert.equal(f.press({type:'keyDown',control:true,alt:true,shift:false,key:'l',...patch}),0);
 assert.equal(f.press({type:'keyDown',control:true,alt:true,shift:false,key:'l',isAutoRepeat:true}),1,'Prevent a held reserved chord reaching the menu without dispatching it again');assert.deepEqual(f.calls,[]);
});
