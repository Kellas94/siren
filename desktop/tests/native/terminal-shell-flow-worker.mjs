// Fixed CI probe only. This is not a production terminal or renderer transport.
import assert from 'node:assert/strict';
assert.equal(process.env.GITHUB_ACTIONS,'true','ISOLATED_WINDOWS_CI_ONLY');
assert.equal(process.env.RUNNER_OS,'Windows','ISOLATED_WINDOWS_CI_ONLY');
async function runShellFlowWorker(directory){
 const assert=(await import('node:assert/strict')).default;
 const {readFile,writeFile,rename,lstat}=await import('node:fs/promises'),{join,isAbsolute,resolve,dirname,parse}=await import('node:path'),{createRequire}=await import('node:module'),{setTimeout:delay}=await import('node:timers/promises'),{release}=await import('node:os');
 const {createShellFlowCore}=await import('./terminal-shell-flow-core.mjs'),{requireQualifiedConptyPlatform,requireSelectedOsConpty}=await import('./terminal-conpty-platform.mjs');
 assert.equal(isAbsolute(directory),true);directory=resolve(directory);
 for(let p=directory;p!==parse(p).root;p=dirname(p))assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_TEST_DIRECTORY');
 assert.equal((await lstat(directory)).isDirectory(),true);
 const configFile=join(directory,'shell-flow-config.json'),configStat=await lstat(configFile);assert.equal(configStat.isSymbolicLink(),false);assert.ok(configStat.isFile()&&configStat.size<=65536);
 const configBytes=await readFile(configFile);assert.ok(configBytes.length<=65536);const config=JSON.parse(configBytes);
 assert.deepEqual(Object.keys(config).sort(),['packagePath','shell']);assert.equal(isAbsolute(config.packagePath),true);
 const shell=join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');assert.equal(resolve(config.shell).toLowerCase(),resolve(shell).toLowerCase());
 assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');assert.equal(process.env.ELECTRON_RUN_AS_NODE,'1');
 const windowsRelease=release();requireQualifiedConptyPlatform({platform:process.platform,arch:process.arch,windowsVersion:windowsRelease});
 const require=createRequire(config.packagePath),manifest=require('node-pty/package.json');assert.equal(manifest.version,'1.1.0');
 const pty=require('node-pty'),env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^(NODE_|ELECTRON_)/i.test(k)));
 const term=pty.spawn(shell,['-NoLogo','-NoProfile'],{cwd:directory,env,cols:120,rows:30,useConpty:true,useConptyDll:false,handleFlowControl:false});
 requireSelectedOsConpty({useConpty:term._agent?._useConpty,useConptyDll:term._agent?._useConptyDll});
 const core=createShellFlowCore({write:data=>term.write(data),resize:(cols,rows)=>term.resize(cols,rows)});globalThis.__shellFlow={term,core};
 let outputError=null,exit=null;
 term.onData(data=>{try{core.append(data);}catch(error){outputError=error;}});term.onExit(event=>{exit={exitCode:event.exitCode,signal:event.signal};});
 const now=()=>Number(process.hrtime.bigint()/1000000n),startedAt=now();
 const persist=async(name,record)=>{const text=JSON.stringify(record);assert.ok(Buffer.byteLength(text)<=262144,'TEST_REPLY_BUDGET');const file=join(directory,name);await writeFile(file+'.pending',text,{flag:'wx'});await rename(file+'.pending',file);};
 await persist('shell-flow-ready.json',{admitted:false,scope:'CI test worker ready only; ownership/input/Lock/flood qualification pending',workerPid:process.pid,rootPid:term.pid,runtime:{...process.versions,arch:process.arch,platform:process.platform},nodePty:manifest.version,windowsRelease,osConpty:true,useConptyDll:false,stats:core.stats()});
 // Strictly finite test mailbox, not the proposed production control transport.
 // Native external Safety/Session owners must own this worker before execution.
 for(let sequence=0;sequence<128;sequence++){
  const name=String(sequence).padStart(6,'0'),file=join(directory,'control-'+name+'.json');let packet;
  for(;;){
   assert.ok(now()-startedAt<100000,'SHELL_FLOW_CONTROL_DEADLINE');if(outputError)throw outputError;assert.equal(exit,null,'SHELL_FLOW_ROOT_EXITED');
   try{const st=await lstat(file);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.size<=65536,'TEST_CONTROL_FILE_REFUSED');const bytes=await readFile(file);assert.ok(bytes.length<=65536);packet=JSON.parse(bytes);break;}catch(error){if(error.code!=='ENOENT')throw error;}await delay(5);
  }
  assert.equal(packet.sequence,sequence);let result;
  const keys=Object.keys(packet).sort().join(',');
  if(packet.kind==='gate'){assert.equal(keys,'generation,kind,open,sequence');result=core.applyGate({generation:packet.generation,open:packet.open});}
  else if(packet.kind==='input'){assert.equal(keys,'data,generation,kind,sequence');result=core.submit(packet.generation,packet.data);}
  else if(packet.kind==='resize'){assert.equal(keys,'cols,generation,kind,rows,sequence');result=core.fit(packet.generation,packet.cols,packet.rows);}
  else if(packet.kind==='snapshot'){assert.equal(keys,'fromSequence,kind,sequence');result=core.read({fromSequence:packet.fromSequence});}
  else if(packet.kind==='complete'){assert.equal(keys,'kind,sequence');result={stats:core.stats()};}
  else throw Error('TEST_CONTROL_KIND_REFUSED');
  await persist('reply-'+name+'.json',{admitted:false,sequence,kind:packet.kind,result,stats:core.stats(),ageMs:now()-startedAt});
  if(packet.kind==='complete')return;
 }
 throw Error('SHELL_FLOW_CONTROL_CAPACITY');
}
await runShellFlowWorker(process.argv[2]);
