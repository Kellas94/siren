import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {createTerminalClient}=await import('../src/ui/terminal/client.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const methods=['terminalPickCwd','terminalListProfiles','terminalCreate','terminalList','terminalAttach','terminalInput','terminalResize','terminalAck','terminalDetach','terminalStop'];
const lease={sessionId:'session_a',leaseId:'lease_a',generation:1};
function setup(options={}){
 const calls=[],listeners={},unsubscribed=[];let next=0;
 const bridge=Object.fromEntries(methods.map(method=>[method,payload=>{calls.push({method,payload});return options.dispatch?options.dispatch(method,payload):Promise.resolve({ok:true,value:{},operationId:payload.operationId});}]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=callback=>{if(options.subscribeFailure===name)throw Error('inert subscribe failure');listeners[name]=callback;return()=>{unsubscribed.push(name);delete listeners[name];if(options.unsubscribeFailure===name)throw Error('inert unsubscribe failure');};};
 const client=createTerminalClient({bridge,epoch:4,operationId:()=>`operation_${++next}`});return {bridge,client,calls,listeners,unsubscribed};
}
const output=(extra={})=>({epoch:4,...lease,sequence:0,data:'Ș😀',utf8Bytes:6,...extra});

test('client forwards exactly ten finite commands with fresh operation IDs and captured epoch',async()=>{
 const s=setup();const requests=[['pickCwd',{}],['listProfiles',{}],['create',{cwdId:'cwd_a',profileId:'powershell',cols:120,rows:40}],['list',{}],['attach',{sessionId:'session_a'}],['input',{...lease,inputSequence:0,data:'hello\r'}],['resize',{...lease,cols:80,rows:24}],['ack',{...lease,throughSequence:6}],['detach',lease],['stop',{sessionId:'session_a'}]];
 for(const [name,payload]of requests)assert.equal((await s.client[name](payload)).ok,true);
 assert.deepEqual(s.calls.map(x=>x.method),methods);assert.equal(new Set(s.calls.map(x=>x.payload.operationId)).size,10);assert.ok(s.calls.every(x=>x.payload.epoch===4&&Object.isFrozen(x.payload)));assert.equal(s.client.execute,undefined);assert.equal(s.client.spawn,undefined);s.client.dispose();
});
test('caller cannot replace epoch, operation identity, cwd path or inject getters into a request',async()=>{
 const s=setup();let reads=0;const bad={...lease,inputSequence:0};Object.defineProperty(bad,'data',{enumerable:true,get(){reads++;return 'x';}});
 for(const p of [{epoch:0},{operationId:'forged'},{path:'C:\\secret'},Object.create({}),{[Symbol()]:true}])assert.equal((await s.client.list(p)).ok,false);
 assert.equal((await s.client.input(bad)).ok,false);assert.equal(reads,0);assert.equal(s.calls.length,0);s.client.dispose();
});
test('oversize or malformed Unicode input is refused whole before bridge dispatch',async()=>{
 const s=setup();for(const data of ['😀'.repeat(8193),'x'.repeat(32769),'\ud800'])assert.equal((await s.client.input({...lease,inputSequence:0,data})).ok,false);
 assert.equal(s.calls.length,0);assert.equal((await s.client.input({...lease,inputSequence:0,data:'😀'.repeat(8192)})).ok,true);s.client.dispose();
});
test('typed immutable output subscriptions filter wrong epoch and invalid byte count with zero automatic input or ACK',()=>{
 const s=setup(),received=[];const off=s.client.onData(e=>received.push(e));s.listeners.Data(output({epoch:3}));s.listeners.Data(output({utf8Bytes:1}));s.listeners.Data(output());assert.equal(received.length,1);assert.equal(received[0].data,'Ș😀');assert.equal(Object.isFrozen(received[0]),true);assert.equal(s.calls.length,0);off();s.listeners.Data(output());assert.equal(received.length,1);s.client.dispose();
});
test('gap and passive state metadata are validated without granting input or issuing commands',()=>{
 const s=setup(),received=[];s.client.onGap(e=>received.push(e));s.client.onState(e=>received.push(e));s.listeners.Gap({epoch:4,...lease,droppedUtf8Bytes:20,resumeSequence:30});s.listeners.State({epoch:4,session:{sessionId:'session_a',projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Project',state:'exited',exitCode:77,droppedUtf8Bytes:20,attachedWindowId:null}});assert.equal(received.length,2);assert.equal(s.calls.length,0);s.client.dispose();
});
test('disposal is synchronous, idempotent, unsubscribes all streams and suppresses stale callbacks and replies',async()=>{
 let resolve;const s=setup({dispatch:()=>new Promise(r=>resolve=r),unsubscribeFailure:'Data'}),received=[];s.client.onData(e=>{received.push(e);s.client.dispose();});s.client.onData(()=>assert.fail('fanout continued after disposal'));const old=s.listeners.Data,work=s.client.list();old(output());old(output());s.client.dispose();assert.equal(received.length,1);assert.deepEqual(s.unsubscribed,['Data','Gap','State']);assert.equal((await s.client.stop({sessionId:'session_a'})).code,'CLIENT_DISPOSED');resolve({ok:true,value:{},operationId:s.calls[0].payload.operationId});assert.equal((await work).code,'CLIENT_DISPOSED');assert.equal(s.calls.length,1);await s.client.drain();
});
test('request capacity remains bounded while actual bridge Promises are pending, including after dispose',async()=>{
 const held=[];const s=setup({dispatch:(_m,p)=>new Promise(resolve=>held.push(()=>resolve({ok:true,value:{},operationId:p.operationId})))});const work=Array.from({length:32},()=>s.client.list());assert.equal((await s.client.list()).code,'CAPACITY_EXCEEDED');assert.equal(s.calls.length,32);let drained=false;s.client.dispose();const drain=s.client.drain().then(()=>drained=true);await Promise.resolve();assert.equal(drained,false);held.forEach(r=>r());assert.ok((await Promise.all(work)).every(r=>r.code==='CLIENT_DISPOSED'));await drain;assert.equal(drained,true);
});
test('captured bridge methods are used and mismatched or malformed receipts are refused',async()=>{
 const s=setup({dispatch:()=>Promise.resolve({ok:true,value:{},operationId:'wrong'})});s.bridge.terminalList=()=>assert.fail('dynamic bridge lookup');assert.equal((await s.client.list()).code,'BRIDGE_UNAVAILABLE');s.client.dispose();
 for(const value of [null,{ok:'true'},{ok:true},{ok:false,operationId:'wrong'}]){const f=setup({dispatch:()=>Promise.resolve(value)});assert.equal((await f.client.list()).ok,false);f.client.dispose();}
 const failed=setup({dispatch:()=>Promise.reject(Error('inert IPC failure'))});assert.equal((await failed.client.list()).code,'BRIDGE_UNAVAILABLE');await failed.client.drain();failed.client.dispose();
});
test('partial subscription setup cleans up earlier streams before throwing',()=>{
 let released=0;const bridge=Object.fromEntries(methods.map(m=>[m,()=>Promise.resolve({ok:false})]));bridge.onTerminalData=()=>()=>released++;bridge.onTerminalGap=()=>{throw Error('inert setup failure');};bridge.onTerminalState=()=>assert.fail('must stop setup');assert.throws(()=>createTerminalClient({bridge,epoch:4}));assert.equal(released,1);
});
test('bounded listeners tolerate callback failure and removed callbacks during fanout',()=>{
 const s=setup();let count=0,off;s.client.onData(()=>{off();throw Error('inert listener failure');});off=s.client.onData(()=>assert.fail('removed callback ran'));s.client.onData(()=>count++);s.listeners.Data(output());assert.equal(count,1);for(let i=0;i<30;i++)s.client.onGap(()=>{});assert.throws(()=>s.client.onState(()=>{}));s.client.dispose();
});
test('source has no Node, shell, PTY, DOM or product-preload activation dependency',async()=>{
 const source=await readFile(new URL('../src/ui/terminal/client.js',import.meta.url),'utf8');assert.doesNotMatch(source,/from ['"](?:node:|electron)|require\(|child_process|ipcRenderer|exposeInMainWorld|document\./);
});

test('request reservation fences operation-ID and payload reflection reentry before bridge dispatch',async()=>{
 const s=setup();s.client.dispose();
 for(const source of ['operationId','payload']){
  let client,calls=0;const bridge=Object.fromEntries(methods.map(m=>[m,p=>{calls++;return Promise.resolve({ok:true,value:{},operationId:p.operationId});}]));
  for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=()=>()=>{};
  client=createTerminalClient({bridge,epoch:4,operationId:()=>{if(source==='operationId')client.dispose();return 'operation_a';}});
  const payload=source==='payload'?new Proxy({},{ownKeys(){client.dispose();return [];}}):{};
  assert.equal((await client.list(payload)).code,'CLIENT_DISPOSED');assert.equal(calls,0);await client.drain();
 }
 let client,nested=false,next=0;const calls=[],held=[],nestedWork=[];
 const bridge=Object.fromEntries(methods.map(m=>[m,p=>{calls.push(p);return new Promise(resolve=>held.push(()=>resolve({ok:true,value:{},operationId:p.operationId})));}]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=()=>()=>{};
 client=createTerminalClient({bridge,epoch:4,operationId:()=>{const id=`operation_${++next}`;if(!nested){nested=true;for(let i=0;i<32;i++)nestedWork.push(client.list());}return id;}});
 const outer=client.list();assert.equal(calls.length,32);held.forEach(r=>r());assert.equal((await outer).ok,true);const results=await Promise.all(nestedWork);assert.equal(results.filter(r=>r.code==='CAPACITY_EXCEEDED').length,1);client.dispose();await client.drain();
});

test('invalid operation identity cannot escape through a disposed refusal receipt',async()=>{
 let client,calls=0;const invalid={secret:'unvalidated'};
 const bridge=Object.fromEntries(methods.map(m=>[m,()=>{calls++;return Promise.resolve({ok:false});}]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=()=>()=>{};
 client=createTerminalClient({bridge,epoch:4,operationId:()=>{client.dispose();return invalid;}});
 const result=await client.list();assert.equal(result.code,'CLIENT_DISPOSED');assert.equal(result.operationId,undefined);assert.equal(calls,0);await client.drain();
});
