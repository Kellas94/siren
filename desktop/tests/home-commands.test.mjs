import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const code=await readFile(new URL('../src/ui/workspace/home.js',import.meta.url),'utf8');
function fixture(){
 const window={sirenDesktopBootstrap:{mode:'locked'}},document={readyState:'complete'};
 runInNewContext(code,{window,document});let callback,removed=0;const called=[];
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
