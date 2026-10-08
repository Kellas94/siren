// Fixed test worker only. Launched atomically contained, not through a renderer.
import assert from 'node:assert/strict';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {release} from 'node:os';
import {requireQualifiedConptyPlatform,requireSelectedOsConpty} from './terminal-conpty-platform.mjs';
assert.equal(process.argv.length,3);const directory=process.argv[2];assert.equal(isAbsolute(directory),true);
try {
const configBytes=await readFile(join(directory,'electron-config.json'));assert.ok(configBytes.length<65536);
const config=JSON.parse(configBytes);for(const p of [config.fixture,config.packagePath])assert.equal(isAbsolute(p),true);
assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');assert.equal(process.env.ELECTRON_RUN_AS_NODE,'1');
const windowsRelease=release();requireQualifiedConptyPlatform({platform:process.platform,arch:process.arch,windowsVersion:windowsRelease});
const require=createRequire(config.packagePath),manifest=require('node-pty/package.json');assert.equal(manifest.version,'1.1.0');
const pty=require('node-pty'),env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!['NODE_OPTIONS','NODE_PATH','ELECTRON_RUN_AS_NODE','ELECTRON_NO_ASAR','ELECTRON_EXTRA_LAUNCH_ARGS'].includes(k.toUpperCase())));
const term=pty.spawn(config.fixture,['root',directory],{cwd:directory,env,cols:80,rows:24,useConpty: true,useConptyDll: false,handleFlowControl:false});
requireSelectedOsConpty({useConpty:term._agent?._useConpty,useConptyDll:term._agent?._useConptyDll});
let receivedBytes=0,ring=Buffer.alloc(0),exited=false;
term.onExit(()=>{exited=true;});term.onData(data=>{const b=Buffer.from(data);receivedBytes+=b.length;ring=Buffer.concat([ring,b]);if(ring.length>4194304)ring=Buffer.from(ring.subarray(ring.length-4194304));});
const expires=Date.now()+6500;
while(!ring.toString('utf8').includes('SIREN_NATIVE_FIXED_READY')&&Date.now()<expires&&!exited)await delay(10);
assert.ok(!exited&&ring.includes(Buffer.from('SIREN_NATIVE_FIXED_READY')),'FIXED_DRAIN_DEADLINE');
// Exercise the upstream lazy fork helper as an observation, never Stop authority.
const cp=require('node:child_process'),originalFork=cp.fork;let helper,helperMessage,helperExit;
cp.fork=function(...args){assert.equal(helper,undefined,'UNEXPECTED_SECOND_HELPER');assert.match(args[0],/conpty_console_list_agent$/);helper=originalFork.apply(this,args);helper.on('message',m=>{helperMessage=m;});helperExit=new Promise((resolve,reject)=>{helper.once('error',reject);helper.once('exit',(code,signal)=>resolve({code,signal}));});return helper;};
let consolePids;
try{consolePids=await term._agent._getConsoleProcessList();}finally{cp.fork=originalFork;}
assert.ok(Array.isArray(consolePids)&&consolePids.includes(term.pid),'HELPER_LIST_MISSING_ROOT');assert.deepEqual(helperMessage?.consoleProcessList,consolePids,'UPSTREAM_TIMEOUT_FALLBACK_REFUSED');
const helperFinished=await Promise.race([helperExit,delay(1500).then(()=>{throw Error('HELPER_EXIT_DEADLINE');})]);assert.deepEqual(helperFinished,{code:0,signal:null});
const ready={workerPid:process.pid,rootPid:term.pid,runtime:{electron:process.versions.electron,node:process.versions.node,modules:process.versions.modules,napi:process.versions.napi,arch:process.arch,platform:process.platform},nodePty:manifest.version,windowsRelease,osConpty:term._agent._useConpty,useConptyDll:term._agent._useConptyDll,receivedBytes,retainedBytes:ring.length,inputWrites:0,rssBytes:process.memoryUsage().rss,helperListObserved:true,helperExitCode:helperFinished.code,helperPid:helper.pid,consolePids};
await writeFile(join(directory,'electron-ready.pending'),JSON.stringify(ready),{flag:'wx'});await rename(join(directory,'electron-ready.pending'),join(directory,'electron-ready.json'));
// Held native Jobs own lifetime. No pty.kill(), PID kill, input or local retries.
setTimeout(()=>process.exit(91),14000);setInterval(()=>{},1000);
} catch(error) {
 await writeFile(join(directory,'electron-worker-error.json'),JSON.stringify({status:'FAILED',pid:process.pid,message:error.message,stack:error.stack}),{flag:'wx'});
 throw error;
}
