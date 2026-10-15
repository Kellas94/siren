// Pure binary bootstrap tests; no stdin, listener, process or native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../src/terminal/bootstrap-codec.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('bootstrap binds session/channel and independent unpredictable control/data endpoints and keys',()=>{
 assert.equal(typeof module.createTerminalBootstrap,'function');assert.equal(typeof module.decodeTerminalBootstrap,'function');
 const a=module.createTerminalBootstrap({sessionId:'session-a',channelId:'channel-a'}),b=module.createTerminalBootstrap({sessionId:'session-a',channelId:'channel-a'});
 try{assert.ok(a.payload.length<=2048);assert.equal(a.controlSecret.length,32);assert.equal(a.dataSecret.length,32);assert.notDeepEqual(a.controlSecret,a.dataSecret);assert.notDeepEqual(a.controlSecret,b.controlSecret);assert.notEqual(a.controlPipe,b.controlPipe);assert.notEqual(a.controlPipe,a.dataPipe);
  const input=Buffer.from(a.payload),decoded=module.decodeTerminalBootstrap(input);assert.ok(input.every(x=>x===0));for(const key of ['sessionId','channelId','controlPipe','dataPipe'])assert.equal(decoded[key],a[key]);assert.deepEqual(decoded.controlSecret,a.controlSecret);assert.deepEqual(decoded.dataSecret,a.dataSecret);assert.equal(decoded.nativeExecutionAdmitted,false);
 }finally{a.dispose();b.dispose();}assert.ok(a.payload.every(x=>x===0));assert.ok(a.controlSecret.every(x=>x===0));assert.ok(a.dataSecret.every(x=>x===0));
});
test('unknown/accessor startup fields and unsafe identifiers are refused before secret allocation',()=>{
 assert.equal(typeof module.createTerminalBootstrap,'function');let accessed=0;
 for(const value of [{sessionId:'../x',channelId:'channel'},{sessionId:'session',channelId:'channel',secret:'untrusted'},Object.defineProperty({channelId:'channel'},'sessionId',{enumerable:true,get(){accessed++;return 'session';}}),[],null])assert.throws(()=>module.createTerminalBootstrap(value),/BOOTSTRAP_REFUSED/);
 assert.equal(accessed,0);
});
test('truncated, oversized, wrong magic, extra trailing bytes and corrupt length records are consumed and refused',()=>{
 assert.equal(typeof module.createTerminalBootstrap,'function');const a=module.createTerminalBootstrap({sessionId:'session',channelId:'channel'});
 try{for(const bytes of [Buffer.from(a.payload.subarray(0,10)),Buffer.alloc(2049),Buffer.concat([a.payload,Buffer.from([1])]),Buffer.from(a.payload)]){if(bytes.length===a.payload.length)bytes[0]^=255;assert.throws(()=>module.decodeTerminalBootstrap(bytes),/BOOTSTRAP_REFUSED/);assert.ok(bytes.every(x=>x===0));}
  const bad=Buffer.from(a.payload);bad.writeUInt16BE(65535,8);assert.throws(()=>module.decodeTerminalBootstrap(bad),/BOOTSTRAP_REFUSED/);assert.ok(bad.every(x=>x===0));
 }finally{a.dispose();}
});
test('keys cannot be zero, equal or leaked through packet metadata; disposed payload cannot be reused',()=>{
 assert.equal(typeof module.createTerminalBootstrap,'function');const a=module.createTerminalBootstrap({sessionId:'session',channelId:'channel'});
 for(const equal of [false,true]){const bytes=Buffer.from(a.payload);if(equal)bytes.copy(bytes,bytes.length-32,bytes.length-64,bytes.length-32);else bytes.fill(0,bytes.length-64,bytes.length-32);assert.throws(()=>module.decodeTerminalBootstrap(bytes),/BOOTSTRAP_REFUSED/);assert.ok(bytes.every(x=>x===0));}
 assert.equal(JSON.stringify(a).includes(a.controlSecret.toString('hex')),false);a.dispose();assert.throws(()=>module.decodeTerminalBootstrap(a.payload),/BOOTSTRAP_REFUSED/);
});

test('identifier matching rejects final line terminators rather than accepting regex end-before-newline',()=>{
 assert.equal(typeof module.createTerminalBootstrap,'function');
 for(const suffix of ['\n','\r','\r\n','\u2028','\u2029'])for(const key of ['sessionId','channelId'])assert.throws(()=>module.createTerminalBootstrap({sessionId:'session',channelId:'channel',[key]:'valid'+suffix}),/BOOTSTRAP_REFUSED/);
});

test('metadata serialization omits every buffer and decoded keys can be disposed independently',()=>{
 const a=module.createTerminalBootstrap({sessionId:'session',channelId:'channel'}),d=module.decodeTerminalBootstrap(Buffer.from(a.payload));
 try{for(const value of [a,d])assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(value))).sort(),['sessionId','channelId','controlPipe','dataPipe','nativeExecutionAdmitted'].sort());d.dispose();assert.ok(d.controlSecret.every(x=>x===0));assert.ok(d.dataSecret.every(x=>x===0));assert.ok(a.controlSecret.some(x=>x!==0));}finally{a.dispose();d.dispose();}
});

test('malformed UTF8, foreign pipe namespaces and overlarge input clear only a bounded read window',()=>{
 const a=module.createTerminalBootstrap({sessionId:'session',channelId:'channel'});
 try{const invalidUtf=Buffer.from(a.payload);invalidUtf[16]=0xc0;assert.throws(()=>module.decodeTerminalBootstrap(invalidUtf),/BOOTSTRAP_REFUSED/);assert.ok(invalidUtf.every(x=>x===0));
  const foreign=Buffer.from(a.payload),at=foreign.indexOf(Buffer.from('siren-terminal-control-'));assert.ok(at>0);foreign[at]='X'.charCodeAt(0);assert.throws(()=>module.decodeTerminalBootstrap(foreign),/BOOTSTRAP_REFUSED/);assert.ok(foreign.every(x=>x===0));
  const huge=Buffer.alloc(100000,1);assert.throws(()=>module.decodeTerminalBootstrap(huge),/BOOTSTRAP_REFUSED/);assert.ok(huge.subarray(0,2049).every(x=>x===0));assert.equal(huge[2049],1);
 }finally{a.dispose();}
});
