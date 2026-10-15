import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/ui/terminal/preload.cjs',import.meta.url),'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return '';});
const methods=['terminalPickCwd','terminalListProfiles','terminalCreate','terminalList','terminalAttach','terminalInput','terminalResize','terminalAck','terminalDetach','terminalStop'];
function setup(options={}){
 const exposed={},listeners=new Map(),calls=[],removed=[];let unload;
 const ipcRenderer={invoke(...args){calls.push(args);return options.invoke?.(...args)??Promise.resolve({ok:true,value:{},operationId:'operation_a'});},on(channel,fn){if(options.on)options.on(channel,fn);listeners.set(channel,[...(listeners.get(channel)??[]),fn]);options.afterOn?.();},removeListener(channel,fn){removed.push({channel,fn});listeners.set(channel,(listeners.get(channel)??[]).filter(v=>v!==fn));}};
 const context={require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(name,api)=>exposed[name]=api},ipcRenderer};},window:{addEventListener(name,fn,options){assert.equal(name,'unload');assert.equal(options.once,true);unload=fn;}}};
 vm.runInNewContext(source,context,{timeout:1000});return {api:exposed.sirenTerminal,exposed,listeners,calls,removed,unload:()=>unload(),emit(channel,...args){for(const fn of [...listeners.get(channel)??[]])fn(...args);}};
}
test('standalone candidate exposes ten finite operations, context/theme/placement/Help reads and six payload-only subscriptions',async()=>{
 assert.ok(source.length>0);const s=setup();assert.equal(Object.isFrozen(s.api),true);assert.deepEqual(Object.keys(s.api).sort(),[...methods,'getTerminalHelpContext','getTerminalContext','getTerminalTheme','toggleTerminalPlacement','onTerminalTheme','onTerminalHelp','onTerminalContext','onTerminalData','onTerminalGap','onTerminalState'].sort());assert.deepEqual(Object.keys(s.exposed),['sirenTerminal']);
 for(const name of methods){const payload={test:name};await s.api[name](payload);assert.equal(s.calls.at(-1)[0],'siren:terminal');assert.equal(s.calls.at(-1)[1],name);assert.equal(s.calls.at(-1)[2],payload);}
 assert.equal(s.api.invoke,undefined);assert.equal(s.api.require,undefined);s.unload();
});

test('context read ignores supplied arguments and shares actual pending request capacity',async()=>{
 const held=[];const s=setup({invoke:()=>new Promise(resolve=>held.push(resolve))});const pending=Array.from({length:32},()=>s.api.getTerminalContext({forged:'scope'}));assert.equal(s.calls.length,32);assert.ok(s.calls.every(args=>args.length===1&&args[0]==='siren:terminal-context'));assert.equal((await s.api.terminalList({})).code,'CAPACITY_EXCEEDED');s.unload();held.forEach(resolve=>resolve({available:true}));assert.ok((await Promise.all(pending)).every(r=>r.code==='CLIENT_DISPOSED'));
});

test('context invalidation subscriptions share capacity and late unload reconciliation',()=>{
 const s=setup();const offs=Array.from({length:32},()=>s.api.onTerminalContext(()=>{}));assert.throws(()=>s.api.onTerminalData(()=>{}));offs[0]();s.api.onTerminalGap(()=>{});s.unload();assert.equal(s.removed.length,33);
 for(const throwing of [false,true]){const f=setup({on:()=>f.unload(),afterOn:()=>{if(throwing)throw Error('late context registration');}});assert.throws(()=>f.api.onTerminalContext(()=>{}));assert.equal(f.listeners.get('siren:terminal-context')?.length??0,0);}
});
test('subscriptions do not expose the Electron event and their removal is idempotent',()=>{
 const s=setup(),received=[],event={sender:{secret:true}},payload={epoch:4};const off=s.api.onTerminalData((...args)=>received.push(args));s.emit('siren:terminal-data',event,payload);assert.equal(received.length,1);assert.equal(received[0].length,1);assert.equal(received[0][0],payload);off();off();s.emit('siren:terminal-data',event,payload);assert.equal(received.length,1);assert.equal(s.removed.length,1);s.unload();
});
test('subscriptions are bounded across all streams, validate callbacks and release capacity',()=>{
 const s=setup();assert.throws(()=>s.api.onTerminalGap(null));const offs=Array.from({length:32},()=>s.api.onTerminalData(()=>{}));assert.throws(()=>s.api.onTerminalState(()=>{}));offs[0]();const off=s.api.onTerminalGap(()=>{});assert.equal(typeof off,'function');s.unload();assert.equal(s.removed.length,33);
});
test('unload synchronously retires every subscription and suppresses captured late callbacks',async()=>{
 const s=setup(),received=[];s.api.onTerminalData(p=>{received.push(p);s.unload();});s.api.onTerminalGap(p=>received.push(p));const old=s.listeners.get('siren:terminal-gap')[0];s.emit('siren:terminal-data',{},'first');old({},'late');assert.deepEqual(received,['first']);assert.throws(()=>s.api.onTerminalState(()=>{}));assert.equal((await s.api.terminalList({})).code,'CLIENT_DISPOSED');assert.equal(s.calls.length,0);
});
test('bridge requests retain the actual pending capacity until resolution and never retry',async()=>{
 const held=[];const s=setup({invoke:()=>new Promise(resolve=>held.push(resolve))});const pending=Array.from({length:32},()=>s.api.terminalList({}));assert.equal((await s.api.terminalStop({})).code,'CAPACITY_EXCEEDED');assert.equal(s.calls.length,32);held.shift()({ok:false,code:'PIN_REQUIRED'});await pending[0];const last=s.api.terminalList({});assert.equal(s.calls.length,33);s.unload();held.forEach(resolve=>resolve({ok:true,value:{}}));assert.ok((await Promise.all([...pending.slice(1),last])).every(r=>r.code==='CLIENT_DISPOSED'));
});
test('synchronous invoke failure and rejected invocation release capacity without exposing exceptions',async()=>{
 let count=0;const s=setup({invoke:()=>{if(++count%2)throw Error('inert invoke failure');return Promise.reject(Error('inert IPC failure'));}});for(let i=0;i<80;i++)assert.equal((await s.api.terminalList({})).code,'BRIDGE_UNAVAILABLE');assert.equal(s.calls.length,80);s.unload();
});
test('callback exceptions cannot strand other unload subscriptions',()=>{
 const s=setup();s.api.onTerminalData(()=>{throw Error('inert callback');});s.api.onTerminalGap(()=>{});assert.doesNotThrow(()=>s.emit('siren:terminal-data',{},{}));s.unload();assert.equal(s.removed.length,2);
});
test('late IPC registration is reconciled after unload even when registration subsequently throws',()=>{
 for(const throwing of [false,true]){
  const s=setup({on:()=>s.unload(),afterOn:()=>{if(throwing)throw Error('inert registration failure after unload');}});
  // Simulate a registration that completes after its reentrant unload.
  const original=s.api.onTerminalData;
  assert.throws(()=>original(()=>{}));assert.equal(s.listeners.get('siren:terminal-data')?.length??0,0);
 }
});
test('synchronous invocation unloading before throw returns the terminal disposed refusal',async()=>{
 const s=setup({invoke:()=>{s.unload();throw Error('inert late invocation failure');}});assert.equal((await s.api.terminalList({})).code,'CLIENT_DISPOSED');assert.equal(s.calls.length,1);
});
test('preload source is unwired and contains no generic renderer filesystem or execution capability',async()=>{
 assert.doesNotMatch(source,/node:|child_process|\.sendSync\(|\.send\(|eval\(|new Function|nodeIntegration|readFile|writeFile|execFile|spawn\(/);const active=await readFile(new URL('../src/preload.cjs',import.meta.url),'utf8');assert.doesNotMatch(active,/ui\/terminal\/preload|sirenTerminal|siren:terminal/);
});
