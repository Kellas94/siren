// Actual worker function with inert imports, PTY, filesystem and clock only.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import path from 'node:path';import {readFile} from 'node:fs/promises';
import {createShellFlowCore} from './terminal-shell-flow-core.mjs';
let source='';try{source=await readFile(new URL('terminal-shell-flow-worker.mjs',import.meta.url),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
async function exercise(){
 const begin=source.indexOf('async function runShellFlowWorker(directory){'),end=source.indexOf('\nawait runShellFlowWorker(',begin);assert.ok(begin>=0&&end>begin,'MISSING_SHELL_FLOW_WORKER');let fn=source.slice(begin,end);
 for(const name of ['node:assert/strict','node:fs/promises','node:path','node:module','node:timers/promises','node:os'])fn=fn.replaceAll("await import('"+name+"')",'seams['+JSON.stringify(name)+']');
 fn=fn.replaceAll("await import('./terminal-shell-flow-core.mjs')",'seams.core').replaceAll("await import('./terminal-conpty-platform.mjs')",'seams.platform');assert.doesNotMatch(fn,/\bimport\s*\(/);
 const writes=[],resizes=[],spawned=[],saved=new Map(),term={pid:40,_agent:{_useConpty:true,_useConptyDll:false},write:d=>writes.push(d),resize:(c,r)=>resizes.push([c,r]),onData(f){this.data=f;},onExit(f){this.exited=f;}};
 const directory=path.resolve('C:/inert-shell'),shell=path.join('C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),config={packagePath:path.resolve('C:/fixed/package.json'),shell};
 const packets=[{sequence:0,kind:'gate',generation:1,open:true},{sequence:1,kind:'input',generation:1,data:"Write-Output 'fixed'\r"},{sequence:2,kind:'gate',generation:2,open:false},{sequence:3,kind:'input',generation:1,data:'late\r'},{sequence:4,kind:'snapshot',fromSequence:0},{sequence:5,kind:'complete'}];
 // Imports share one realm in the real worker. This vm seam explicitly moves
 // gate records into the imported core's realm without weakening its checks.
 const coreSeam={createShellFlowCore:options=>{const core=createShellFlowCore(options);return {...core,applyGate:packet=>core.applyGate(JSON.parse(JSON.stringify(packet)))};}};
 const seams={'node:assert/strict':{default:assert},'node:path':path,'node:module':{createRequire:()=>name=>name==='node-pty/package.json'?{version:'1.1.0'}:{spawn:(exe,args,options)=>{spawned.push({exe,args,options});return term;}}},'node:os':{release:()=> '10.0.26100'},core:coreSeam,platform:{requireQualifiedConptyPlatform:()=>{},requireSelectedOsConpty:()=>{}},'node:timers/promises':{setTimeout:async()=>{}},'node:fs/promises':{
  lstat:async()=>({isSymbolicLink:()=>false,isDirectory:()=>true,isFile:()=>true,size:100}),
  readFile:async p=>{if(p.endsWith('shell-flow-config.json'))return Buffer.from(JSON.stringify(config));const match=p.match(/control-(\d+)\.json$/);if(match)return Buffer.from(JSON.stringify(packets[Number(match[1])]));throw Error('Unexpected path '+p);},
  writeFile:async(p,data)=>{saved.set(p,JSON.parse(data));if(p.endsWith('shell-flow-ready.json.pending'))term.data('ready\r\n');if(p.endsWith('reply-000002.json.pending'))term.data('fixed command completed while locked\r\n');},
  rename:async(a,b)=>{saved.set(b,saved.get(a));},
 }};
 const process={pid:30,versions:{electron:'44.5.1',node:'24.21.0',modules:'149',napi:'10'},arch:'x64',platform:'win32',env:{SystemRoot:'C:/Windows',PATH:'fixed',NODE_OPTIONS:'bad',NODE_PATH:'bad',ELECTRON_RUN_AS_NODE:'1',ELECTRON_EXTRA_LAUNCH_ARGS:'bad'},hrtime:{bigint:()=>1000000n}};
 await vm.runInNewContext('('+fn+')',{seams,process,Buffer,setTimeout:()=>1})(directory);
 return {writes,resizes,spawned,saved,directory,shell};
}
test('actual worker spawns only explicit PowerShell profile in owned cwd with injection variables stripped',async()=>{const r=await exercise();assert.equal(r.spawned.length,1);const s=r.spawned[0];assert.equal(s.exe,r.shell);assert.deepEqual([...s.args],['-NoLogo','-NoProfile']);assert.equal(s.options.cwd,r.directory);assert.equal(s.options.useConptyDll,false);assert.equal(s.options.handleFlowControl,false);assert.equal(Object.keys(s.options.env).some(k=>/^(NODE_|ELECTRON_)/.test(k)),false);});
test('actual close ACK precedes late-input refusal; output and snapshot continue without automatic PTY writes',async()=>{const r=await exercise();assert.deepEqual(r.writes,["Write-Output 'fixed'\r"]);const reply=n=>r.saved.get(path.join(r.directory,'reply-'+String(n).padStart(6,'0')+'.json'));assert.equal(reply(2).result.ok,true);assert.equal(reply(3).result.ok,false);assert.match(reply(4).result.chunks.map(c=>c.data).join(''),/completed while locked/);assert.equal(reply(5).result.stats.inputWrites,1);assert.equal(reply(5).result.stats.open,false);});
