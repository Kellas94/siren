// Pure pinned source derivation only. Never import generated guarded runners.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const source={runner:await read('./native/terminal-normal-powershell.mjs'),worker:await read('./native/terminal-normal-worker.mjs')};
const api=await import('./native/terminal-peer-probe-derive.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
function derive(value=source){assert.equal(typeof api.deriveTerminalPeerProbe,'function');return api.deriveTerminalPeerProbe(value);}
const hash=value=>createHash('sha256').update(value).digest('hex');

test('peer finite probe derives deterministically from exactly pinned unchanged normal sources',()=>{
 const first=derive(),second=derive();assert.deepEqual(first,second);assert.equal(first.nativeExecuted,false);assert.equal(first.admitted,false);
 assert.equal(hash(source.runner),'c38cb94d2675fc7685367266e3db5bc911e009ea9ee52d88196ff7b7dab71c57');
 assert.equal(hash(source.worker),'4832c3c65b3073af4a92f5e0b8d22abf2fdf4307ee4c4798fc866bfc9875b91b');
 for(const value of [{...source,runner:source.runner+'\n'},{...source,worker:source.worker+'\n'}])assert.throws(()=>derive(value),/PEER_PROBE_INPUT_DRIFT/);
});
test('generated peer sources are exact separate artifacts and retain the hosted guard',async()=>{
 const result=derive();assert.equal(result.runner,await read('./native/terminal-peer-endpoints.mjs'));assert.equal(result.worker,await read('./native/terminal-peer-worker.mjs'));
 assert.match(result.runner,/from '\.\/terminal-peer-endpoints-contract\.mjs'/);
 assert.ok(result.runner.indexOf('requireCandidateCi({')<result.runner.indexOf('const desktop='));
 assert.equal(result.runner.includes('process.env.GH_ACTIONS='),false);assert.equal(result.runner.includes('process.env.GITHUB_ACTIONS='),false);
});
test('Safety observer and finite fixed shell retain exact baseline mechanisms and old normal oracle fields',()=>{
 const {runner,worker}=derive();
 const observer=source.runner.slice(source.runner.indexOf(" const original=await readFile(join(desktop,'tests/fixtures/terminal-main-owner-observer.cs')"),source.runner.indexOf(' const modules=Object.fromEntries'));
 assert.ok(observer.includes("'tests/fixtures/terminal-normal-observer.cs'"));assert.ok(observer.includes('promisify(execFile)(compiler'));assert.ok(runner.includes(observer));
 for(const text of ["result.status='NORMAL_POWERSHELL_OBSERVED_NOT_ADMITTED'","result.asyncRetirement={elapsedMs:performance.now()-start,ticks,maxGapMs:Math.max(maxGapMs,performance.now()-last)}", "result.completion=await wait(()=>json('worker-completion'),4000)","result.historyReplay=await consume(fresh,NORMAL_DONE)","result.lockAck=await fence.closeInput('lock')", "native.watchRoot(owner,result.ready.rootPid,config.shell,creatorMark)","result.stopped=await native.stopAndCloseSessionAsync(owner,77,3000)"])assert.ok(runner.includes(text),text);
 const fixedWorker=source.worker.slice(source.worker.indexOf(' const history=new TerminalCreatorHistory'),source.worker.indexOf(" await persist('worker-ready'"));assert.ok(worker.includes(fixedWorker));
 assert.ok(worker.includes("assert.deepEqual(Object.keys(config).sort(),['packagePath','shell'])"));assert.ok(worker.includes("setTimeout(()=>process.exit(91),20000);setInterval(()=>{},1000)"));
});
test('main acquires verified native endpoints before byte streams and existing HMAC channels',()=>{
 const {runner}=derive();assert.doesNotMatch(runner,/node:net|net\.createServer|net\.createConnection|createBootstrappedSession/);
 const pair=runner.indexOf('pair=native.createPeerListeners(hostOwner,packet.controlPipe,packet.dataPipe)'),session=runner.indexOf('native.createPeerSession(hostOwner,config.electron,config.creator,directory,packet.payload,pair)'),accept=runner.indexOf("native.acceptPeerLane(pair,'control',2500)"),stream=runner.indexOf("controlSocket=createNativePeerStream({native,endpoint:controlEndpoint,lane:'control',deadlineMs:2500})"),hmac=runner.indexOf("new TerminalControlChannel({stream:controlSocket,role:'main'");
 assert.ok(pair>=0&&pair<session&&session<accept&&accept<stream&&stream<hmac);
 assert.ok(runner.includes("native.acceptPeerLane(pair,'history',2500)"));assert.ok(runner.includes('control:native.peerSnapshot(controlEndpoint),history:native.peerSnapshot(historyEndpoint)'));
});
test('both lane outcome handlers attach before invoking potentially throwing native accepts',()=>{
 const {runner}=derive();
 assert.ok(runner.includes("Promise.allSettled([Promise.resolve().then(()=>native.acceptPeerLane(pair,'control',2500)),Promise.resolve().then(()=>native.acceptPeerLane(pair,'history',2500))])"));
 assert.ok(runner.includes("if(accepted[0].status==='fulfilled')controlEndpoint=accepted[0].value"));assert.ok(runner.includes("if(accepted[1].status==='fulfilled')historyEndpoint=accepted[1].value"));
});
test('creator wrapper loads literal addon separately from argv bootstrap and always disposes the opaque witness',()=>{
 const {runner,worker}=derive();
 assert.ok(runner.includes('async function creator(worker,reader,addon)'));assert.ok(runner.includes("const {createRequire}=await import('node:module'),native=createRequire(import.meta.url)(addon)"));
 assert.ok(runner.includes('readPeerTerminalBootstrap(process.stdin,{native:bootstrapNative,timeoutMs:1000})'));
 assert.ok(runner.includes('runPeerWorker(packet.bootstrap,process.argv[2],{native,witness:packet.witness,diagnostic:mark})'));assert.ok(runner.includes('finally{packet?.dispose();}'));
 assert.ok(runner.includes("JSON.stringify(pathToFileURL(join(desktop,'src/terminal/peer-bootstrap-reader.mjs')).href)},${JSON.stringify(addon)}"));
 assert.ok(worker.includes('export async function runPeerWorker(bootstrap,directory,peer)'));
 assert.doesNotMatch(runner+worker,/readBigUInt64|writeBigUInt64|\.handle\b|process\.argv\[[3-9]\]/);
});
test('creator connects with opaque witness and both native checks precede HMAC construction',()=>{
 const {worker}=derive();assert.doesNotMatch(worker,/node:net|net\.createConnection|once\(socket,'connect'\)/);
 const connect=worker.indexOf("native.connectPeerLane(peer.witness,bootstrap.controlPipe,'control',2500)"),history=worker.indexOf("native.connectPeerLane(peer.witness,bootstrap.dataPipe,'history',2500)"),stream=worker.indexOf("createNativePeerStream({native,endpoint:controlEndpoint,lane:'control',deadlineMs:2500})"),hmac=worker.indexOf('const control=new TerminalControlChannel');
 assert.ok(connect>=0&&connect<history&&history<stream&&stream<hmac);
 assert.ok(worker.includes('nativePeer:{control:native.peerSnapshot(controlEndpoint),history:native.peerSnapshot(historyEndpoint)'));
 assert.ok(worker.includes('streams:{control:controlSocket.stats(),history:historySocket.stats()},nativeExecutionAdmitted:false'));
});
test('successful native close receipts settle both streams and listeners before explicit async Stop',()=>{
 const {runner}=derive(),stop=runner.indexOf('result.stopped=await native.stopAndCloseSessionAsync(owner,77,3000)');
 const close=runner.indexOf('result.nativePeer.close.control=await controlSocket.closed'),history=runner.indexOf('result.nativePeer.close.history=await historySocket.closed'),listeners=runner.indexOf('result.nativePeer.close.listeners=await native.closePeerListeners(pair,3000)');
 assert.ok(close>=0&&close<history&&history<listeners&&listeners<stop);
 assert.ok(runner.includes('assert.deepEqual(result.nativePeer.close,{control:true,history:true,listeners:true})'));
 assert.ok(runner.includes('result.nativePeerCleanup=close'));assert.ok(runner.includes('result.nativePeerCleanupError='));
 const lock=runner.indexOf("result.lockAck=await fence.closeInput('lock')");assert.ok(lock<close);
});
test('diagnostic error classification emits only fixed whitelisted code and name',()=>{
 assert.equal(typeof api.classifyPeerDiagnosticError,'function');
 const classify=value=>api.classifyPeerDiagnosticError(value,types.isProxy);
 assert.deepEqual(classify(Object.assign(Error('PRIVATE_SECRET'),{code:'PEER_IDENTITY_REFUSED'})),{code:'PEER_IDENTITY_REFUSED',name:'Error'});
 assert.deepEqual(classify(Error('TERMINAL_PEER_BOOTSTRAP_REFUSED')),{code:'TERMINAL_PEER_BOOTSTRAP_REFUSED',name:'Error'});
 assert.deepEqual(classify(Object.assign(TypeError('PRIVATE_SECRET'),{code:'ERR_DLOPEN_FAILED'})),{code:'ERR_DLOPEN_FAILED',name:'TypeError'});
 assert.deepEqual(classify({code:'PRIVATE_SECRET',name:'PRIVATE_SECRET',message:'PRIVATE_SECRET',stack:'PRIVATE_SECRET'}),{code:'UNKNOWN',name:'Error'});
 assert.deepEqual(classify(null),{code:'UNKNOWN',name:'Error'});
});
test('diagnostic classification never executes error getters or Proxy traps',()=>{
 assert.equal(typeof api.classifyPeerDiagnosticError,'function');let touched=0;
 const getter={};for(const key of ['code','name','message'])Object.defineProperty(getter,key,{get(){touched++;throw Error('PRIVATE_SECRET');}});
 const proxy=new Proxy({}, {get(){touched++;throw Error('PRIVATE_SECRET');},getPrototypeOf(){touched++;throw Error('PRIVATE_SECRET');},getOwnPropertyDescriptor(){touched++;throw Error('PRIVATE_SECRET');}});
 const inherited=Object.create(proxy);
 for(const value of [getter,proxy,inherited])assert.deepEqual(api.classifyPeerDiagnosticError(value,types.isProxy),{code:'UNKNOWN',name:'Error'});
 assert.equal(touched,0);
});
test('creator diagnostics cover addon and bootstrap failures with fixed bounded JSON and optional packet disposal',()=>{
 const {runner}=derive(),creator=runner.slice(runner.indexOf('async function creator('),runner.indexOf('async function main('));
 assert.ok(creator.includes("const stages=['addon-loaded','bootstrap-read','worker-imported','worker-entered','control-connected','history-connected']"));
 assert.ok(creator.includes("join(process.argv[2],'peer-creator-diagnostic.json')"));
 assert.ok(creator.includes('diagnostic={schema:1,diagnosticOnly:true,admitted:false,stages:[],failure:null,consumeFailure:null}'));
 assert.ok(creator.includes("if(Buffer.byteLength(body,'utf8')>=4096)throw Error('PEER_DIAGNOSTIC_BOUND')"));
 assert.ok(creator.includes('stage!==stages[diagnostic.stages.length]'));assert.ok(creator.includes('diagnostic.stages.push(stage);await persist()'));
 assert.ok(creator.includes('diagnostic.failure=classifyError(error,types.isProxy)'));assert.ok(creator.includes('try{await persist();}catch{}throw error;'));
 assert.ok(creator.indexOf(' try{')<creator.indexOf('native=createRequire(import.meta.url)(addon)'));
 assert.ok(creator.includes("await mark('addon-loaded')"));assert.ok(creator.includes("await mark('bootstrap-read')"));assert.ok(creator.includes("await mark('worker-imported')"));
 assert.doesNotMatch(creator,/error\.message|error\.stack|JSON\.stringify\(error\)|String\(error\)/);
 const worst={schema:1,diagnosticOnly:true,admitted:false,stages:['addon-loaded','bootstrap-read','worker-imported','worker-entered','control-connected','history-connected'],failure:{code:'TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED',name:'AssertionError'}};
 assert.ok(Buffer.byteLength(JSON.stringify(worst),'utf8')<4096);
});
test('diagnostic bootstrap wrapper preserves captured native receiver, return and thrown identity',()=>{
 assert.equal(typeof api.wrapPeerBootstrapDiagnostics,'function');const record={consumeFailure:null},bytes=Buffer.from('inert'),witness=Object.freeze({}),result=Object.freeze({}),failure=Object.assign(Error('PRIVATE_SECRET'),{code:'PEER_WITNESS_REFUSED'});let fail=false,closes=0;
 const native={consumePeerBootstrap(value){assert.equal(this,native);assert.equal(value,bytes);if(fail)throw failure;return result;},closePeerWitness(value){assert.equal(this,native);assert.equal(value,witness);closes++;return true;}};
 const wrapper=api.wrapPeerBootstrapDiagnostics(native,record,api.classifyPeerDiagnosticError,types.isProxy);
 assert.equal(wrapper.consumePeerBootstrap(bytes),result);assert.equal(record.consumeFailure,null);
 native.consumePeerBootstrap=()=>{throw Error('WRONG_REPLACEMENT');};native.closePeerWitness=()=>{throw Error('WRONG_REPLACEMENT');};fail=true;
 assert.throws(()=>wrapper.consumePeerBootstrap(bytes),error=>error===failure);assert.deepEqual(record.consumeFailure,{code:'PEER_WITNESS_REFUSED',name:'Error'});
 assert.equal(wrapper.closePeerWitness(witness),true);assert.equal(closes,1);assert.equal(JSON.stringify(record).includes('PRIVATE_SECRET'),false);assert.deepEqual(Reflect.ownKeys(wrapper).sort(),['closePeerWitness','consumePeerBootstrap']);
});
test('diagnostic bootstrap wrapper refuses callback getters and Proxies without invoking them',()=>{
 assert.equal(typeof api.wrapPeerBootstrapDiagnostics,'function');let touched=0;const noop=()=>true;
 const getter={closePeerWitness:noop};Object.defineProperty(getter,'consumePeerBootstrap',{get(){touched++;return noop;}});
 const proxy=new Proxy({},{getOwnPropertyDescriptor(){touched++;throw Error('PRIVATE_SECRET');},getPrototypeOf(){touched++;throw Error('PRIVATE_SECRET');}});
 const callable=new Proxy(noop,{apply(){touched++;throw Error('PRIVATE_SECRET');}});
 for(const native of [getter,proxy,{consumePeerBootstrap:callable,closePeerWitness:noop},{consumePeerBootstrap:noop}])assert.throws(()=>api.wrapPeerBootstrapDiagnostics(native,{consumeFailure:null},api.classifyPeerDiagnosticError,types.isProxy),/PEER_DIAGNOSTIC_CALLBACK_REFUSED/);
 assert.equal(touched,0);
});
test('worker reports fixed entry and connection milestones without modifying native or HMAC order',()=>{
 const {worker}=derive();
 const entered=worker.indexOf("await peer.diagnostic('worker-entered')"),runtime=worker.indexOf("assert.equal(process.versions.electron,'44.5.1')"),control=worker.indexOf("native.connectPeerLane(peer.witness,bootstrap.controlPipe,'control',2500)"),controlMark=worker.indexOf("await peer.diagnostic('control-connected')"),history=worker.indexOf("native.connectPeerLane(peer.witness,bootstrap.dataPipe,'history',2500)"),historyMark=worker.indexOf("await peer.diagnostic('history-connected')"),stream=worker.indexOf('const controlSocket=createNativePeerStream');
 assert.ok(entered>=0&&entered<runtime&&runtime<control&&control<controlMark&&controlMark<history&&history<historyMark&&historyMark<stream);
});
test('main records only fixed allSettled accept diagnostics before the unchanged refusal assertion',()=>{
 const {runner}=derive(),outcomes=runner.indexOf('result.nativePeerAccept=accepted.map('),gate=runner.indexOf("assert.ok(accepted.every(value=>value.status==='fulfilled'),'NORMAL_CHANNEL_CONNECTION')");
 assert.ok(outcomes>=0&&outcomes<gate);assert.ok(runner.includes("error:outcome.status==='rejected'?classifyError(outcome.reason,types.isProxy):null"));
 assert.ok(runner.includes("lane:['control','history'][index],status:outcome.status"));
 const record=runner.slice(outcomes,gate);assert.doesNotMatch(record,/outcome\.value|reason\.message|reason\.stack|JSON\.stringify\(outcome\)/);
});
