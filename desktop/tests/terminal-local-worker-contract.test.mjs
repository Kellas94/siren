import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
