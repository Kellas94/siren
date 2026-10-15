// Pure packet validation only; no native addon, process or identity admission.
import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/terminal/three-lane-bootstrap-codec.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const create=value=>{assert.equal(typeof api.createThreeLaneTerminalBootstrap,'function');return api.createThreeLaneTerminalBootstrap(value??{sessionId:'session1',channelId:'channel1'});};
const decode=value=>{assert.equal(typeof api.decodeThreeLaneTerminalBootstrap,'function');return api.decodeThreeLaneTerminalBootstrap(value);};
const zero=value=>Uint8Array.prototype.every.call(value,byte=>byte===0);
function raw(){const fields=['session1','channel1','\\\\.\\pipe\\siren-terminal-control-'+'a'.repeat(32),'\\\\.\\pipe\\siren-terminal-data-'+'b'.repeat(32),'\\\\.\\pipe\\siren-terminal-command-'+'c'.repeat(32)],parts=fields.map(s=>Buffer.from(s)),bytes=Buffer.alloc(18+parts.reduce((n,b)=>n+b.length,0)+96);Buffer.from('SIRENTB2').copy(bytes);let offset=18;for(let i=0;i<parts.length;i++){bytes.writeUInt16BE(parts[i].length,8+i*2);parts[i].copy(bytes,offset);offset+=parts[i].length;}for(let i=0;i<3;i++)bytes.fill(i+1,offset+i*32,offset+(i+1)*32);return bytes;}

test('three-lane packet encodes five lengths and three independent hidden secrets',()=>{
 const b=create();assert.equal(b.payload.subarray(0,8).toString(),'SIRENTB2');assert.ok(b.payload.length<=2048);
 const expected=[b.sessionId,b.channelId,b.controlPipe,b.historyPipe,b.commandPipe];let offset=18;for(let i=0;i<5;i++){const length=b.payload.readUInt16BE(8+i*2);assert.equal(b.payload.subarray(offset,offset+length).toString(),expected[i]);offset+=length;}
 assert.equal(b.payload.length-offset,96);for(const [key,prefix]of[['control','control'],['history','data'],['command','command']]){assert.match(b[key+'Pipe'],new RegExp('^\\\\\\\\\\.\\\\pipe\\\\siren-terminal-'+prefix+'-[a-f0-9]{32}$'));assert.equal(b[key+'Secret'].length,32);assert.equal(zero(b[key+'Secret']),false);}
 assert.notDeepEqual(b.controlSecret,b.historySecret);assert.notDeepEqual(b.controlSecret,b.commandSecret);assert.notDeepEqual(b.historySecret,b.commandSecret);assert.equal(JSON.stringify(b).includes('Secret'),false);assert.equal(JSON.stringify(b).includes('payload'),false);assert.equal(b.nativeExecutionAdmitted,false);b.dispose();b.dispose();assert.ok(zero(b.payload)&&zero(b.controlSecret)&&zero(b.historySecret)&&zero(b.commandSecret));
});
test('literal SIRENTB2 vector decodes all scopes and wipes its input',()=>{
 const bytes=raw(),b=decode(bytes);assert.equal(b.sessionId,'session1');assert.equal(b.channelId,'channel1');assert.equal(b.historyPipe,'\\\\.\\pipe\\siren-terminal-data-'+'b'.repeat(32));assert.deepEqual(b.controlSecret,Buffer.alloc(32,1));assert.deepEqual(b.historySecret,Buffer.alloc(32,2));assert.deepEqual(b.commandSecret,Buffer.alloc(32,3));assert.ok(Object.isFrozen(b));assert.ok(zero(bytes));b.dispose();assert.ok(zero(b.commandSecret));
});
test('bad lengths, wrong version, truncation, suffix and lane-prefix swaps refuse whole payload',()=>{
 const good=raw(),bad=[];for(const index of[0,8,10,12,14,16]){const bytes=Buffer.from(good);bytes[index]=255;bad.push(bytes);}bad.push(Buffer.from(good.subarray(0,-1)),Buffer.concat([good,Buffer.from([0])]),Buffer.from(good));bad.at(-1).write('SIRENTB1');
 const swapped=Buffer.from(good);swapped.write('siren-terminal-xxxx-',swapped.indexOf('siren-terminal-data-'));bad.push(swapped);
 for(const bytes of bad){assert.throws(()=>decode(bytes),/THREE_LANE_BOOTSTRAP_REFUSED/);assert.ok(zero(bytes));}
});
test('all three secrets must be nonzero and pairwise distinct',()=>{
 for(const [a,b]of[[0,0],[1,1],[2,2],[0,1],[0,2],[1,2]]){const bytes=raw(),start=bytes.length-96;if(a===b)bytes.fill(0,start+a*32,start+(a+1)*32);else bytes.copy(bytes,start+b*32,start+a*32,start+(a+1)*32);assert.throws(()=>decode(bytes),/THREE_LANE_BOOTSTRAP_REFUSED/);assert.ok(zero(bytes));}
});
test('strict UTF8 and scoped identifiers never normalize invalid bytes',()=>{
 for(const patch of[[18,255],[18,65]]){const bytes=raw();bytes[patch[0]]=patch[1];assert.throws(()=>decode(bytes),/THREE_LANE_BOOTSTRAP_REFUSED/);assert.ok(zero(bytes));}
 assert.throws(()=>create({sessionId:'bad id',channelId:'channel1'}));assert.throws(()=>create({sessionId:'session1',channelId:'channel1',commandPipe:'injected'}));
});
test('rejected oversized input wipes at most the bounded 2049-byte window',()=>{
 const bytes=Buffer.alloc(8192,7);assert.throws(()=>decode(bytes),/THREE_LANE_BOOTSTRAP_REFUSED/);assert.ok(zero(bytes.subarray(0,2049)));assert.equal(bytes[2049],7);
});
test('request, binary Proxy and Proxy prototypes invoke no traps',()=>{
 assert.equal(typeof api.createThreeLaneTerminalBootstrap,'function');assert.equal(typeof api.decodeThreeLaneTerminalBootstrap,'function');
 let touched=0;const trap={get(){touched++;throw Error('private');},getPrototypeOf(){touched++;throw Error('private');},ownKeys(){touched++;throw Error('private');}};
 const getter={channelId:'channel1'};Object.defineProperty(getter,'sessionId',{enumerable:true,get(){touched++;return 'session1';}});
 for(const value of[getter,new Proxy({sessionId:'session1',channelId:'channel1'},trap),Object.assign(Object.create(new Proxy({},trap)),{sessionId:'session1',channelId:'channel1'})])assert.throws(()=>create(value));
 for(const value of[new Proxy(raw(),trap),Object.create(new Proxy(Buffer.prototype,trap)),Object.setPrototypeOf(raw(),new Proxy(Buffer.prototype,trap))])assert.throws(()=>decode(value));assert.equal(touched,0);
});
test('decorated Buffer properties are ignored by native byte copying and wiping',()=>{
 const bytes=raw();let touched=0;for(const key of['length','copy','buffer','byteOffset','fill','subarray'])Object.defineProperty(bytes,key,{get(){touched++;throw Error('private');}});const b=decode(bytes);assert.equal(b.commandSecret[0],3);assert.ok(zero(bytes));assert.equal(touched,0);b.dispose();
});
