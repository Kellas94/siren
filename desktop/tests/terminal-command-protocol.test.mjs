import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/terminal/command-protocol.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const identity={channelId:'commands1',sessionId:'session1'};
const token=()=>({...identity,projectId:'project1',windowId:'window1',epoch:1,leaseId:'lease1',generation:2,gateGeneration:3});
const request=(op,extra={})=>({type:'command',op,...identity,requestId:1,token:token(),...extra});
const encode=value=>{assert.equal(typeof api.encodeTerminalCommandRequest,'function');return api.encodeTerminalCommandRequest(value,identity);};
const decode=value=>{assert.equal(typeof api.decodeTerminalCommandRequest,'function');return api.decodeTerminalCommandRequest(value,identity);};
const reply=(extra={})=>({type:'command-result',op:'input',...identity,requestId:1,token:token(),status:'accepted',code:'COMMAND_ACCEPTED',...extra});
const validate=value=>{assert.equal(typeof api.validateTerminalCommandReply,'function');return api.validateTerminalCommandReply(value,identity);};

test('four typed command requests round-trip without generic operations',()=>{
 for(const [op,extra]of[['install',{}],['revoke',{}],['input',{inputSequence:0,data:'AΩ😀\r\n'}],['resize',{cols:80,rows:24}]]){
  const original=request(op,extra),wire=encode(original),restored=decode(wire);
  assert.ok(wire);assert.deepEqual({...restored,token:{...restored.token}},original);assert.ok(Object.isFrozen(wire)&&Object.isFrozen(wire.token)&&Object.isFrozen(restored));
  if(op==='input'){assert.equal(wire.dataBase64,'Qc6p8J+YgA0K');assert.equal(Object.hasOwn(wire,'data'),false);assert.equal(Object.hasOwn(restored,'dataBase64'),false);}
 }
 assert.equal(encode(request('execute',{command:'anything'})),null);
});
test('exact 32768-byte Unicode and control input stay inside the frame budget',()=>{
 for(const data of ['😀'.repeat(8192),'\0'.repeat(32768)]){
  const wire=encode(request('input',{inputSequence:0,data}));assert.ok(wire);assert.equal(decode(wire).data,data);assert.ok(Buffer.byteLength(JSON.stringify(wire))<=45056);
 }
 assert.equal(encode(request('input',{inputSequence:0,data:'😀'.repeat(8192)+'a'})),null);
 assert.equal(encode(request('input',{inputSequence:0,data:'\ud800'})),null);
});
test('all maximum-length identifiers still admit maximum Unicode input',()=>{
 const name='a'.repeat(128),scope={channelId:name,sessionId:name},t={...scope,projectId:name,windowId:name,epoch:Number.MAX_SAFE_INTEGER,leaseId:name,generation:Number.MAX_SAFE_INTEGER,gateGeneration:Number.MAX_SAFE_INTEGER};
 assert.equal(typeof api.encodeTerminalCommandRequest,'function');const wire=api.encodeTerminalCommandRequest({type:'command',op:'input',...scope,requestId:Number.MAX_SAFE_INTEGER,token:t,inputSequence:Number.MAX_SAFE_INTEGER,data:'😀'.repeat(8192)},scope);
 assert.ok(wire);assert.ok(Buffer.byteLength(JSON.stringify(wire))<=45056);
});
test('noncanonical base64 and invalid UTF8 cannot decode to terminal input',()=>{
 const wire={type:'command',op:'input',...identity,requestId:1,token:token(),inputSequence:0,dataBase64:'YQ=='};
 for(const dataBase64 of ['!!!!','YQ','YR==','/w==','7aCA','YQ==\n','A'.repeat(43696)])assert.equal(decode({...wire,dataBase64}),null);
 assert.equal(decode({...wire,dataBase64:''}).data,'');
});
test('full token and envelope identity are mandatory and bind session and channel',()=>{
 for(const field of Object.keys(token())){const t=token();delete t[field];assert.equal(encode(request('install',{token:t})),null);}
 for(const patch of [{sessionId:'other'},{channelId:'other'},{requestId:0},{requestId:Number.MAX_SAFE_INTEGER+1},{token:{...token(),sessionId:'other'}},{token:{...token(),channelId:'other'}},{token:{...token(),extra:true}}])assert.equal(encode(request('install',patch)),null);
 for(const field of ['epoch','generation','gateGeneration'])for(const value of [0,-1,1.5,Infinity])assert.equal(encode(request('install',{token:{...token(),[field]:value}})),null);
});
test('operation-specific fields, dimensions and sequences are exact',()=>{
 for(const value of [request('install',{data:''}),request('revoke',{open:false}),request('input',{inputSequence:-1,data:''}),request('input',{inputSequence:0,data:Buffer.from('x')}),request('resize',{cols:1,rows:24}),request('resize',{cols:501,rows:24}),request('resize',{cols:80,rows:0}),request('resize',{cols:80,rows:201}),request('resize',{cols:80.5,rows:24})])assert.equal(encode(value),null);
 for(const dims of [{cols:2,rows:1},{cols:500,rows:200}])assert.ok(encode(request('resize',dims)));
});
test('request/token/identity Proxies and accessors refuse without invoking traps',()=>{
 let touched=0;const hostile=value=>new Proxy(value,{get(){touched++;throw Error('secret');},getPrototypeOf(){touched++;throw Error('secret');},ownKeys(){touched++;throw Error('secret');}});
 assert.equal(encode(hostile(request('install'))),null);assert.equal(encode(request('install',{token:hostile(token())})),null);
 assert.equal(api.encodeTerminalCommandRequest(request('install'),hostile(identity)),null);
 const value=request('input',{inputSequence:0,data:'x'});Object.defineProperty(value,'data',{enumerable:true,get(){touched++;throw Error('secret');}});assert.equal(encode(value),null);
 const t=token();Object.defineProperty(t,'epoch',{enumerable:true,get(){touched++;return 1;}});assert.equal(encode(request('install',{token:t})),null);assert.equal(touched,0);
});
test('symbols, prototypes, hidden extras and nested mutation never bypass exact fields',()=>{
 const value=request('install');Object.defineProperty(value,'hidden',{value:1});assert.equal(encode(value),null);
 assert.equal(encode({...request('install'),[Symbol('extra')]:true}),null);assert.equal(encode(Object.assign(Object.create({}),request('install'))),null);
 const original=request('install'),wire=encode(original);original.token.epoch=99;assert.equal(wire.token.epoch,1);
});
test('reply has full correlation and accepts only fixed status/code pairs',()=>{
 const r=validate(reply());assert.ok(r);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.token));
 for(const code of ['REQUEST_REFUSED','SESSION_REFUSED','LEASE_STALE','GATE_CLOSED','ENDPOINT_UNAVAILABLE','INPUT_RECEIPT_EXPIRED','INPUT_SEQUENCE_REFUSED','RESIZE_RECEIPT_EXPIRED','COMMAND_BUSY','COMMAND_AMBIGUOUS','COMMAND_RETIRED'])assert.ok(validate(reply({status:'failed',code})));
 for(const patch of [{status:'failed',code:'COMMAND_ACCEPTED'},{status:'accepted',code:'LEASE_STALE'},{code:'arbitrary secret'},{error:'secret'},{data:'secret'},{requestId:0},{op:'shell'},{sessionId:'other'},{token:{...token(),channelId:'other'}}])assert.equal(validate(reply(patch)),null);
});
test('reply Proxy/accessor and encoded request accessor refuse without side effects',()=>{
 let touched=0;const value=reply();Object.defineProperty(value,'code',{enumerable:true,get(){touched++;return 'COMMAND_ACCEPTED';}});assert.equal(validate(value),null);
 const proxy=new Proxy(reply(),{ownKeys(){touched++;return [];}});assert.equal(validate(proxy),null);
 const wire={type:'command',op:'input',...identity,requestId:1,token:token(),inputSequence:0};Object.defineProperty(wire,'dataBase64',{enumerable:true,get(){touched++;return 'YQ==';}});assert.equal(decode(wire),null);assert.equal(touched,0);
});
