import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const source=readFileSync(new URL('./native/terminal-host-roster-local-worker.mjs',import.meta.url),'utf8');
const lines=source.split(/\r?\n/).filter(line=>line.trim().startsWith("if(config.mode!=='listeners')for"));
assert.equal(lines.length,1,'Execute exactly the actual worker pending-accept dispatch statement');
const dispatch=new Function('native','config','pair','pending',lines[0]);
test('actual fixture dispatch uses the three native string lane identifiers',async()=>{
 const pair={},calls=[],pending=[],expected=['control','history','command'];
 const native={acceptPeerLane(actual,lane,timeout){assert.equal(actual,pair);assert.equal(lane,expected[calls.length]);assert.equal(timeout,10000);calls.push(lane);return Promise.reject(Error('CONTROLLED_PENDING_CANCELED'));}};
 dispatch(native,{mode:'accepts'},pair,pending);
 assert.deepEqual(calls,expected);assert.equal(pending.length,3);
 assert.deepEqual(await Promise.all(pending),expected.map(()=>({accepted:false,error:'CONTROLLED_PENDING_CANCELED'})));
});
test('actual listener-only fixture does not start accepts',()=>{
 const pending=[];dispatch({acceptPeerLane(){assert.fail('listener-only must not accept');}},{mode:'listeners'},{},pending);assert.deepEqual(pending,[]);
});
test('actual immediate rejection handler keeps the GC await gap from losing the original failure',()=>{
 const handlers=source.split(/\r?\n/).filter(line=>line.trim()==='original.catch(()=>{});');assert.equal(handlers.length,1);
 const child=handler=>spawnSync(process.execPath,['--unhandled-rejections=strict','--input-type=module','-e',`const original=Promise.reject(Error('CONTROLLED_NATIVE_REFUSAL'));${handler}\nawait new Promise(resolve=>setTimeout(resolve,20));try{await original;process.exitCode=2;}catch(e){if(e.message!=='CONTROLLED_NATIVE_REFUSAL')throw e;console.log('ORIGINAL_REFUSAL_RETAINED');}`],{encoding:'utf8',windowsHide:true,timeout:5000});
 const old=child('');assert.equal(old.status,1);assert.match(old.stderr,/CONTROLLED_NATIVE_REFUSAL/);assert.doesNotMatch(old.stdout,/ORIGINAL_REFUSAL_RETAINED/);
 const fixed=child(handlers[0]);assert.equal(fixed.status,0,fixed.stderr);assert.match(fixed.stdout,/ORIGINAL_REFUSAL_RETAINED/);
});
