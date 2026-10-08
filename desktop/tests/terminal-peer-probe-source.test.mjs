// Pure pinned source derivation only. Never import generated guarded runners.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
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
 assert.ok(runner.includes('readPeerTerminalBootstrap(process.stdin,{native,timeoutMs:1000})'));
 assert.ok(runner.includes('runPeerWorker(packet.bootstrap,process.argv[2],{native,witness:packet.witness})'));assert.ok(runner.includes('finally{packet.dispose();}'));
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
