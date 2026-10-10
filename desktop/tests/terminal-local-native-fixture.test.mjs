import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLocalSessionCapture} from './native/terminal-local-fixture-contract.mjs';
const node='C:\\Program Files\\nodejs\\node.exe',conhost='C:\\Windows\\System32\\conhost.exe';
const member=(pid,image)=>({pid,image,alive:true,createdFileTime:'134361028565007571',exitCode:259});
const ready={creatorPid:10,shellPid:11};
const fixture=(extra=[])=>({active:2+extra.length,held:[member(10,node),member(11,node),...extra]});
const check=captured=>validateLocalSessionCapture({captured,ready,node,conhost});
test('fixed creator and shell-role Node processes admitted as DATA only',()=>assert.equal(check(fixture()).ok,true));
test('zero, one or two exact system console helpers permitted',()=>{
 assert.equal(check(fixture([member(12,conhost)])).ok,true);
 assert.equal(check(fixture([member(12,conhost),member(13,conhost.toUpperCase())])).ok,true);
});
test('unexpected third Node cannot be treated as console helper',()=>assert.equal(check(fixture([member(12,node)])).ok,false));
test('lookalike console path and duplicate identity refused',()=>{
 assert.equal(check(fixture([member(12,'C:\\Temp\\conhost.exe')])).ok,false);
 assert.equal(check(fixture([member(10,conhost)])).ok,false);
});
test('missing fixed member and dead member refused',()=>{
 const c=fixture();c.held[1].pid=12;assert.equal(check(c).ok,false);
 const d=fixture();d.held[0].alive=false;assert.equal(check(d).ok,false);
});
test('accounting mismatch and more than two helpers refused',()=>{
 const c=fixture();c.active=3;assert.equal(check(c).ok,false);
 assert.equal(check(fixture([member(12,conhost),member(13,conhost),member(14,conhost)])).ok,false);
});
test('fixture validation never grants native admission or settlement',()=>{
 const r=check(fixture());assert.equal(r.nativeExecutionAdmitted,false);assert.equal(r.actualSettlementEstablished,false);
});
