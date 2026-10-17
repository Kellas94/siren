// Actual controlled-delay boundary with inert process seams. No native PASS.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./process-identity-deadline.test.mjs',import.meta.url),'utf8');
const start=source.indexOf('execute:async(file,args,settings)=>{'),end=source.indexOf('\n      }});',start);assert.ok(start>=0&&end>start);const fn='('+source.slice(start+8,end)+'})';
async function exercise({delayMs=6000,elapsed=6100,rejectDelay=false}={}){
 const calls=[],settings={timeout:10000,maxBuffer:16384},args=['123'];let clock=0;
 const execute=vm.runInNewContext(fn,{assert,Math,String,delayMs,pid:123,process:{execPath:'owned-node.exe'},performance:{now:()=>clock},runNative:async(file,args,options)=>{calls.push({file,args:[...args],options:{...options}});if(calls.length===1){assert.equal(file,'owned-node.exe');assert.match(args[1],/^setTimeout/);assert.equal(args[2],String(delayMs));clock=elapsed;if(rejectDelay)throw Object.assign(Error('actual delay cancelled'),{killed:true,signal:'SIGTERM'});return {stdout:'',stderr:''};}return {stdout:'actual-native-bytes',stderr:''};}});
 return {calls,run:()=>execute('admitted-native.exe',args,settings)};
}
test('delay child settles before direct parent-owned native query within remaining original budget',async()=>{const r=await exercise();assert.deepEqual(await r.run(),{stdout:'actual-native-bytes',stderr:''});assert.equal(r.calls.length,2);assert.equal(r.calls[0].options.timeout,10000);assert.equal(r.calls[1].file,'admitted-native.exe');assert.deepEqual(r.calls[1].args,['123']);assert.equal(r.calls[1].options.timeout,3900);assert.equal(r.calls[1].options.maxBuffer,16384);});
test('actual prequery delay cancellation never starts a native child',async()=>{const r=await exercise({delayMs:12000,rejectDelay:true});await assert.rejects(r.run(),e=>e.killed===true&&e.signal==='SIGTERM');assert.equal(r.calls.length,1);});
test('exhausted total budget cannot start the native query',async()=>{const r=await exercise({elapsed:10000});await assert.rejects(r.run(),/CONTROLLED_NATIVE_DEADLINE_EXHAUSTED/);assert.equal(r.calls.length,1);});
