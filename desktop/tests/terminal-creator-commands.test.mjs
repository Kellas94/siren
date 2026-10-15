import test from 'node:test';
import assert from 'node:assert/strict';
import {HostInputGate} from '../src/terminal/input-gate.mjs';

let TerminalCreatorCommands;
try { ({TerminalCreatorCommands}=await import('../src/terminal/creator-commands.mjs')); }
catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
const token=Object.freeze({sessionId:'session',channelId:'channel',projectId:'project',windowId:'window',epoch:1,leaseId:'lease',generation:1,gateGeneration:1});
const input=(changes={})=>({...token,inputSequence:0,data:'hello Ω\r\n\x03',...changes});
const dimensions=(changes={})=>({...token,requestId:7,cols:100,rows:30,...changes});
function fixture(overrides={},install=true){
 assert.equal(typeof TerminalCreatorCommands,'function','creator command authority export required');
 const calls={writes:[],resizes:[],checks:0},gate=new HostInputGate();
 const options={sessionId:'session',channelId:'channel',projectId:'project',gate,
  assertEndpointCurrent(){calls.checks++;return true;},writeInput(data){calls.writes.push(data);},resize(cols,rows){calls.resizes.push([cols,rows]);},...overrides};
 const authority=new TerminalCreatorCommands(options);
 assert.deepEqual(authority.applyGate({generation:1,open:true}),{ok:true,generation:1,open:true});
 if(install)assert.deepEqual(authority.installLease(token),{ok:true});
 return {authority,gate,options,calls};
}
const refused=(result,code)=>{assert.equal(result.ok,false);if(code)assert.equal(result.code,code);};

test('creator authority export exists and incomplete construction refuses dependencies',()=>{
 assert.equal(typeof TerminalCreatorCommands,'function','creator command authority export required');
 assert.throws(()=>new TerminalCreatorCommands(),TypeError);
});
test('closed startup refuses commands and a valid lease permits synchronous input and resize',()=>{
 const f=fixture({},false);refused(f.authority.input(input()),'LEASE_STALE');
 assert.deepEqual(f.authority.installLease(token),{ok:true});
 assert.deepEqual(f.authority.input(input()),{ok:true,accepted:true,inputSequence:0});
 assert.deepEqual(f.authority.resize(dimensions()),{ok:true,accepted:true,requestId:7,cols:100,rows:30});
 assert.deepEqual(f.calls.writes,[input().data]);assert.deepEqual(f.calls.resizes,[[100,30]]);
 assert.equal(f.authority.nativeExecutionAdmitted,false);
});
test('every bound identity field must match at the last input and resize boundary',()=>{
 const f=fixture();
 for(const [key,value] of Object.entries({sessionId:'other',channelId:'other',projectId:'other',windowId:'other',epoch:2,leaseId:'other',generation:2,gateGeneration:2})){
  refused(f.authority.input(input({[key]:value})));refused(f.authority.resize(dimensions({[key]:value})));
 }
 assert.equal(f.calls.writes.length,0);assert.equal(f.calls.resizes.length,0);
});
test('gate close revokes old leases and reopening requires a strictly newer lease',()=>{
 const f=fixture();assert.equal(f.authority.input(input()).ok,true);
 assert.deepEqual(f.authority.applyGate({generation:2,open:false}),{ok:true,generation:2,open:false});
 refused(f.authority.input(input({inputSequence:1})));
 assert.deepEqual(f.authority.applyGate({generation:3,open:true}),{ok:true,generation:3,open:true});
 refused(f.authority.installLease({...token,gateGeneration:3}),'LEASE_STALE');
 const fresh={...token,leaseId:'fresh',generation:2,gateGeneration:3};assert.equal(f.authority.installLease(fresh).ok,true);
 assert.equal(f.authority.input({...fresh,inputSequence:0,data:'new'}).ok,true);assert.deepEqual(f.calls.writes,[input().data,'new']);
});
test('external original gate changes cannot revive an installed lease',()=>{
 const f=fixture();f.gate.apply({generation:2,open:false});refused(f.authority.input(input()),'GATE_CLOSED');
 f.gate.apply({generation:3,open:true});refused(f.authority.input(input()));
 refused(f.authority.installLease({...token,gateGeneration:3}),'LEASE_STALE');
 assert.equal(f.calls.writes.length,0);
});
test('idempotent open gate ACK preserves a lease while stale conflicting gates cannot change it',()=>{
 const f=fixture();assert.equal(f.authority.applyGate({generation:1,open:true}).ok,true);
 refused(f.authority.applyGate({generation:1,open:false}));
 assert.equal(f.authority.input(input()).ok,true);
});
test('replacement revokes the old lease before invoking an endpoint callback',()=>{
 let f,replacing=false,observed;
 f=fixture({assertEndpointCurrent(){if(replacing){replacing=false;observed=f.authority.input(input());}return true;}});
 replacing=true;const fresh={...token,leaseId:'fresh',generation:2};assert.equal(f.authority.installLease(fresh).ok,true);
 refused(observed);refused(f.authority.input(input()));assert.equal(f.authority.input({...fresh,inputSequence:0,data:'new'}).ok,true);
 assert.deepEqual(f.calls.writes,['new']);
});
test('matching revoke is idempotent and a stale revoke cannot revoke a replacement',()=>{
 const f=fixture();assert.equal(f.authority.revokeLease(token).ok,true);assert.equal(f.authority.revokeLease(token).ok,true);
 refused(f.authority.input(input()));const fresh={...token,leaseId:'fresh',generation:2};assert.equal(f.authority.installLease(fresh).ok,true);
 refused(f.authority.revokeLease(token),'LEASE_STALE');assert.equal(f.authority.input({...fresh,inputSequence:0,data:'new'}).ok,true);
});
test('input duplicates return known acceptance without writing twice and conflicts or skips refuse',()=>{
 const f=fixture(),first=f.authority.input(input());assert.equal(first.ok,true);assert.equal(Object.isFrozen(first),true);
 assert.deepEqual(f.authority.input(input()),first);refused(f.authority.input(input({data:'changed'})),'REQUEST_REFUSED');
 refused(f.authority.input(input({inputSequence:2})),'INPUT_SEQUENCE_REFUSED');
 assert.equal(f.authority.input(input({inputSequence:1,data:'next'})).ok,true);assert.deepEqual(f.calls.writes,[input().data,'next']);
});
test('only the latest256 input receipts remain and old sequence never executes again',()=>{
 const f=fixture();for(let n=0;n<257;n++)assert.equal(f.authority.input(input({inputSequence:n,data:'x'+n})).ok,true);
 refused(f.authority.input(input({data:'x0'})),'INPUT_RECEIPT_EXPIRED');
 assert.equal(f.authority.input(input({inputSequence:1,data:'x1'})).ok,true);assert.equal(f.calls.writes.length,257);
 assert.equal(f.authority.stats().inputReceipts,256);assert.equal(JSON.stringify(f.authority.stats()).includes('x1'),false);
});
test('resize correlation accepts positive increasing gaps and deduplicates exact dimensions',()=>{
 const f=fixture();assert.equal(f.authority.resize(dimensions()).ok,true);assert.equal(f.authority.resize(dimensions()).ok,true);
 refused(f.authority.resize(dimensions({cols:101})),'REQUEST_REFUSED');
 assert.equal(f.authority.resize(dimensions({requestId:100})).ok,true);
 refused(f.authority.resize(dimensions({requestId:99})),'RESIZE_RECEIPT_EXPIRED');assert.equal(f.calls.resizes.length,2);
});
test('resize receipts are capped at256 independently of input receipts',()=>{
 const f=fixture();for(let n=1;n<=257;n++)assert.equal(f.authority.resize(dimensions({requestId:n})).ok,true);
 refused(f.authority.resize(dimensions({requestId:1})),'RESIZE_RECEIPT_EXPIRED');
 assert.equal(f.authority.resize(dimensions({requestId:2})).ok,true);assert.equal(f.calls.resizes.length,257);assert.equal(f.authority.stats().resizeReceipts,256);
});
test('UTF8 input limit and dimensions refuse whole submissions without partial writes',()=>{
 const f=fixture();for(const data of ['Ω'.repeat(16385),'x'.repeat(32769),'\ud800','\udc00',42])refused(f.authority.input(input({data})),'REQUEST_REFUSED');
 for(const changes of [{cols:1},{cols:501},{rows:0},{rows:201},{cols:2.5},{requestId:0}])refused(f.authority.resize(dimensions(changes)),'REQUEST_REFUSED');
 assert.equal(f.calls.writes.length,0);assert.equal(f.calls.resizes.length,0);
 assert.equal(f.authority.input(input({data:'Ω'.repeat(16384)})).ok,true);assert.equal(f.authority.resize(dimensions({cols:2,rows:200})).ok,true);
});
test('option accessors and Proxies including callback and gate Proxies execute no traps',()=>{
 const f=fixture();let touched=0;const trap={get(){touched++;throw Error('trap');},ownKeys(){touched++;throw Error('trap');},getPrototypeOf(){touched++;throw Error('trap');},getOwnPropertyDescriptor(){touched++;throw Error('trap');},apply(){touched++;throw Error('trap');}};
 const getter={...f.options};Object.defineProperty(getter,'writeInput',{enumerable:true,get(){touched++;return ()=>{};}});
 for(const options of [getter,new Proxy(f.options,trap),{...f.options,writeInput:new Proxy(()=>{},trap)},{...f.options,assertEndpointCurrent:new Proxy(()=>true,trap)},{...f.options,gate:new Proxy(f.gate,trap)},{...f.options,extra:true}])assert.throws(()=>new TerminalCreatorCommands(options),TypeError);
 assert.equal(touched,0);
});
test('request accessors and Proxy prototypes are refused without evaluating traps',()=>{
 const f=fixture();let touched=0;const trap={get(){touched++;throw Error('trap');},ownKeys(){touched++;throw Error('trap');},getPrototypeOf(){touched++;throw Error('trap');},getOwnPropertyDescriptor(){touched++;throw Error('trap');}};
 const getter=input();Object.defineProperty(getter,'data',{enumerable:true,get(){touched++;return 'bad';}});
 for(const request of [getter,new Proxy(input(),trap),Object.assign(Object.create(new Proxy({},trap)),input()),{...input(),extra:true}])refused(f.authority.input(request),'REQUEST_REFUSED');
 assert.equal(touched,0);assert.equal(f.calls.writes.length,0);
});
test('endpoint failure is permanent even when the callback later reports current',()=>{
 for(const outcome of [false,undefined,{},()=>{throw Error('private');}]){
  let current=true;const f=fixture({assertEndpointCurrent(){return current?true:typeof outcome==='function'?outcome():outcome;}});current=false;
  refused(f.authority.input(input()),'ENDPOINT_UNAVAILABLE');current=true;refused(f.authority.installLease({...token,generation:2}),'ENDPOINT_UNAVAILABLE');assert.equal(f.calls.writes.length,0);
 }
});
test('provider throw or nonvoid result is ambiguous and can never be retried',()=>{
 for(const method of ['input','resize'])for(const value of [true,{accepted:true},Promise.resolve(),()=>{throw Error('private');}]){
  let calls=0;const fn=()=>{calls++;if(typeof value==='function')return value();return value;};const f=fixture(method==='input'?{writeInput:fn}:{resize:fn});
  refused(f.authority[method](method==='input'?input():dimensions()),'COMMAND_AMBIGUOUS');
  refused(f.authority[method](method==='input'?input():dimensions()),'COMMAND_AMBIGUOUS');assert.equal(calls,1);
 }
});
test('thenable or Proxy provider results are not inspected',()=>{
 for(const method of ['input','resize']){
  let touched=0;const result=new Proxy({},{get(){touched++;throw Error('private');},getPrototypeOf(){touched++;throw Error('private');}});
  const f=fixture(method==='input'?{writeInput:()=>result}:{resize:()=>result});refused(f.authority[method](method==='input'?input():dimensions()),'COMMAND_AMBIGUOUS');assert.equal(touched,0);
 }
});
test('endpoint callback reentrant revoke or gate close prevents the final provider call',()=>{
 for(const kind of ['revoke','gate','retire'])for(const method of ['input','resize']){
  let f,armed=false;f=fixture({assertEndpointCurrent(){if(armed){armed=false;if(kind==='revoke')f.authority.revokeLease(token);else if(kind==='gate')f.authority.applyGate({generation:2,open:false});else f.authority.retire();}return true;}});armed=true;
  refused(f.authority[method](method==='input'?input():dimensions()));assert.equal(f.calls.writes.length,0);assert.equal(f.calls.resizes.length,0);
 }
});
test('nested command callbacks cannot execute a second provider while a command is in flight',()=>{
 let f,armed=false,nested;f=fixture({assertEndpointCurrent(){if(armed){armed=false;nested=f.authority.input(input());}return true;}});armed=true;
 assert.equal(f.authority.input(input()).ok,true);refused(nested,'COMMAND_BUSY');assert.equal(f.calls.writes.length,1);
 let g,nestedResize;g=fixture({writeInput(){nestedResize=g.authority.resize(dimensions());}});assert.equal(g.authority.input(input()).ok,true);refused(nestedResize,'COMMAND_BUSY');assert.equal(g.calls.resizes.length,0);
});
test('known void write acceptance remains known if its callback synchronously revokes the lease',()=>{
 let f,writes=0;f=fixture({writeInput(){writes++;f.authority.revokeLease(token);}});
 assert.deepEqual(f.authority.input(input()),{ok:true,accepted:true,inputSequence:0});refused(f.authority.input(input()));assert.equal(writes,1);
});
test('callbacks and original HostInputGate methods are captured before later mutation',()=>{
 const f=fixture();let touched=0;f.options.writeInput=()=>{touched++;};f.options.resize=()=>{touched++;};f.options.assertEndpointCurrent=()=>false;
 const originalAllows=HostInputGate.prototype.allows,originalApply=HostInputGate.prototype.apply;
 try{HostInputGate.prototype.allows=()=>{touched++;return true;};HostInputGate.prototype.apply=()=>{touched++;return {ok:true};};
  assert.equal(f.authority.input(input()).ok,true);assert.equal(f.authority.resize(dimensions()).ok,true);assert.equal(f.authority.applyGate({generation:2,open:false}).ok,true);refused(f.authority.input(input({inputSequence:1})));
 }finally{HostInputGate.prototype.allows=originalAllows;HostInputGate.prototype.apply=originalApply;}
 assert.equal(touched,0);assert.equal(f.calls.writes.length,1);assert.equal(f.calls.resizes.length,1);
});
test('retirement is idempotent metadata-only and keeps all future commands unavailable',()=>{
 const f=fixture();assert.equal(f.authority.retire(),true);assert.equal(f.authority.retire(),true);
 for(const call of [()=>f.authority.installLease({...token,generation:2}),()=>f.authority.input(input()),()=>f.authority.resize(dimensions()),()=>f.authority.applyGate({generation:2,open:true})])refused(call(),'COMMAND_RETIRED');
 assert.equal(f.calls.writes.length,0);assert.equal(f.calls.resizes.length,0);assert.equal(Object.isFrozen(f.authority.stats()),true);assert.equal(f.authority.stats().retired,true);
});
