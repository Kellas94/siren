import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/terminal-host-candidate-ownership.mjs';
const unavailable=f=>f.events.filter(e=>e[0]==='unavailable');
async function connected(){const f=fixture(),id=f.prepare().sessionOwnerId;assert.equal(f.allocate(id).ok,true);const c=await f.connect(id);assert.equal(c.ok,true);return {f,id,streams:c.transport};}
const stop=(f,id)=>f.adapter.stopSession({sessionOwnerId:id,deadlineMs:500,code:77});

test('peer EOF during explicitly owned Stop does not announce unexpected ownership loss',async()=>{
 const {f,id,streams}=await connected(),stopped=stop(f,id);streams.control.stream.destroy();f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await stopped).ok,true);assert.equal(unavailable(f).length,0);assert.equal(f.events.filter(e=>e[0]==='verified').length,1);
});
test('peer EOF before Stop still fences and announces unexpected loss',async()=>{
 const {f,id,streams}=await connected();streams.control.stream.destroy();assert.equal(unavailable(f).length,1);const stopped=stop(f,id);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await stopped).ok,true);assert.equal(unavailable(f).length,1);
});
test('failed native Stop still announces cleanup failure after an expected peer close',async()=>{
 const {f,id,streams}=await connected(),stopped=stop(f,id);streams.control.stream.destroy();f.nativeStop.reject(Error('inert native failure'));f.closeAll();assert.equal((await stopped).ok,false);assert.equal(unavailable(f).length,1);
});
