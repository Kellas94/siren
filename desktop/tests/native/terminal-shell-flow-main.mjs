// Function is inert when imported. Only the fenced isolated-CI runner writes it
// as an Electron main entry, after external Safety bootstrap is constructed.
export async function runShellFlowMain(config){
 const {app,utilityProcess}=await import('electron'),assert=(await import('node:assert/strict')).default;
 const fs=await import('node:fs/promises'),{join}=await import('node:path'),{createRequire}=await import('node:module'),{createHash}=await import('node:crypto'),{setTimeout:delay}=await import('node:timers/promises');
 const {createShellFlowController}=await import(config.controllerUrl),{createShellFlowMailbox}=await import(config.mailboxUrl),{ShellFlowMarkerScanner}=await import(config.probeUrl);
 const now=()=>Number(process.hrtime.bigint()/1000000n),age=now(),hash=s=>createHash('sha256').update(s).digest('hex');
 app.setPath('userData',join(config.output,'profile'));await app.whenReady();
 const result={admitted:false,status:'FAILED',runtime:{...process.versions,arch:process.arch,platform:process.platform},samples:[],phase:'bootstrap'};
 const native=createRequire(import.meta.url)(config.addon),strong=globalThis.__shellFlowMain={};let host,hostOwner,session,sessionClosed=false,hostClosed=false,controller,workerAlive=true;
 const exited=s=>s.active===0&&!s.root.alive&&(!s.shell||!s.shell.alive)&&s.held.every(p=>!p.alive);
 const persist=async(path,value)=>{await fs.writeFile(path+'.pending',JSON.stringify(value),{flag:'wx'});await fs.rename(path+'.pending',path);};
 const wait=async(fn,ms=3000)=>{const deadline=now()+ms;for(;;){assert.ok(now()<deadline,'SHELL_FLOW_WAIT_DEADLINE');const value=await fn();assert.ok(now()<deadline,'SHELL_FLOW_WAIT_DEADLINE');if(value)return value;await delay(5);}};
 const json=async path=>{try{const st=await fs.lstat(path);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.size<=262144,'FLOW_RECORD_BUDGET');return JSON.parse(await fs.readFile(path));}catch(e){if(e.code!=='ENOENT')throw e;return null;}};
 const stage=async(label,value)=>{await persist(join(config.output,'flow-'+label+'-ready.json'),{mainPid:process.pid,...value});await wait(async()=>{try{return await fs.readFile(join(config.output,'flow-'+label+'-go.request'),'utf8')==='go';}catch(e){if(e.code!=='ENOENT')throw e;}},5000);};
 const watchdog=setTimeout(()=>app.exit(94),100000);
 try{
  assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');assert.equal(process.arch,'x64');
  const hello={},mark=native.mark();host=utilityProcess.fork(config.hostEntry,[],{serviceName:'SIREN fixed shell control',stdio:'pipe'});strong.host=host;
  host.stdout?.on('data',()=>{});host.stderr?.on('data',()=>{});host.on('message',m=>{hello[m.kind]=m;});
  await wait(()=>hello.hello);assert.equal(hello.hello.pid,host.pid);hostOwner=native.start(host.pid,config.electron,mark);strong.hostOwner=hostOwner;
  const directory=join(config.output,'Șiren flow α');await fs.mkdir(directory);await fs.copyFile(config.fixture,join(directory,'fixed-shell-flow-child.exe'));
  await fs.writeFile(join(directory,'fixed-shell-flow.ps1'),config.probe.script,{flag:'wx'});
  await fs.writeFile(join(directory,'shell-flow-config.json'),JSON.stringify({packagePath:config.packagePath,shell:config.shell}),{flag:'wx'});
  result.phase='create';const rootMark=native.mark();session=native.createSession(hostOwner,config.electron,config.creator,directory);strong.session=session;
  result.initialSession=native.snapshotSession(session);const ready=await wait(()=>json(join(directory,'shell-flow-ready.json')),15000);
  assert.equal(ready.workerPid,result.initialSession.root.pid);assert.equal(ready.stats.inputWrites,0);native.watchRoot(session,ready.rootPid,config.shell,rootMark);result.worker=ready;
  const mailbox=createShellFlowMailbox({directory,fs,now,delay,isAlive:()=>workerAlive&&native.snapshotSession(session).root.alive});
  controller=createShellFlowController({exchange:packet=>mailbox.exchange(packet),isAlive:()=>workerAlive&&native.snapshotSession(session).root.alive,now});strong.controller=controller;
  assert.equal((await controller.unlock()).ok,true);const generation=controller.snapshot().generation;
  const command="& '"+join(directory,'fixed-shell-flow.ps1').replaceAll("'","''")+"'\r";
  for(const marker of Object.values(config.probe.markers))assert.equal(command.includes(marker),false);
  assert.equal((await controller.submit(command)).ok,true);assert.equal((await controller.resize(120,30)).result.ok,true);
  const fixturePids={};await wait(async()=>{try{for(const key of ['root','branch','grandchild','detached']){const text=await fs.readFile(join(directory,key+'.ready'),'utf8');assert.match(text,/^[1-9][0-9]{0,9}$/);fixturePids[key]=Number(text);}return true;}catch(e){if(e.code!=='ENOENT')throw e;}},5000);
  const before=native.captureSession(session),hostBefore=native.capture(hostOwner);result.before=before;result.hostBefore=hostBefore;result.fixturePids=fixturePids;
  await stage('first',{session:before,host:hostBefore,fixturePids,worker:ready});result.phase='flood';
  await fs.writeFile(join(directory,'fixed-flood-go.request'),'go',{flag:'wx'});
  const scanner=new ShellFlowMarkerScanner(config.probe.markers);let cursor=0,last,maxRetained=0,maxAllocated=0,gaps=0;
  async function observe(){
   const reply=await controller.read(cursor);assert.ok(reply.result,'FLOW_OUTPUT_REPLY');const r=reply.result,s=reply.stats;
   assert.ok(s.retainedUtf8Bytes<=4194304&&s.allocatedBytes<=4194304,'FLOW_RING_CAPACITY');maxRetained=Math.max(maxRetained,s.retainedUtf8Bytes);maxAllocated=Math.max(maxAllocated,s.allocatedBytes);
   if(r.gap)gaps++;for(const c of r.chunks){assert.ok(c.utf8Bytes<=32768);assert.equal(Buffer.byteLength(c.data),c.utf8Bytes);scanner.append(c.sequence,c.data);}
   const nextCursor=Math.max(r.nextSequence,s.nextSequence-32768),tailGap=nextCursor>r.nextSequence?{fromSequence:r.nextSequence,toSequence:nextCursor,droppedUtf8Bytes:nextCursor-r.nextSequence,resetParser:true,reason:'fixed-probe-tail-selection'}:null;
   if(tailGap)gaps++;
   cursor=nextCursor;last=s;result.samples.push({ageMs:now()-age,stats:s,gap:r.gap??null,tailGap,chunks:r.chunks.map(c=>({sequence:c.sequence,utf8Bytes:c.utf8Bytes,sha256:hash(c.data)}))});assert.ok(result.samples.length<=90,'FLOW_SAMPLE_CAPACITY');return scanner;
  }
  await wait(async()=>{await observe();return scanner.seen('start');},5000);
  const lock=controller.lock();assert.equal(controller.snapshot().closed,true);assert.equal((await controller.submit('# fixed locally refused\r')).ok,false);assert.equal((await lock).ok,true);
  const refused=await controller.probeStaleInput(generation,'# fixed stale refused\r');assert.equal(refused.result.ok,false);assert.equal(refused.stats.inputWrites,1);result.locked=refused;
  const deadline=now()+75000;while(!scanner.seen('done')){assert.ok(now()<deadline,'FLOW_FLOOD_DEADLINE');await delay(1000);await observe();assert.equal(last.inputWrites,1);assert.equal(last.open,false);}
  const flood=await json(join(directory,'fixed-flood-result.json'));assert.ok(flood&&flood.admitted===false&&flood.elapsedMs>=60000&&flood.elapsedMs<75000&&flood.generatedAsciiBytes>4194304&&flood.generatedAsciiBytes<=134217728);assert.equal(flood.blocks*8192,flood.generatedAsciiBytes);
  assert.equal(last.inputWriteAttempts,1);assert.equal(last.inputUtf8Bytes,Buffer.byteLength(command));assert.equal(last.inputWriteSha256,hash(command));assert.equal(last.inputAttemptSha256,hash(command));assert.ok(last.droppedUtf8Bytes>0&&gaps>0);
  result.flood=flood;result.completedWhileLocked=last;result.history={maxRetained,maxAllocated,gaps,scanner:scanner.stats()};
  // Exercise actual ring eviction deliberately, separately from tail sampling.
  // Reading omitted history must never write/replay any input to PowerShell.
  const replay=await controller.read(0);assert.ok(replay.result.gap?.resetParser===true&&replay.result.gap.droppedUtf8Bytes>0);assert.equal(replay.stats.inputWrites,1);assert.equal(replay.stats.inputAttemptSha256,hash(command));
  result.historyReplay={gap:replay.result.gap,stats:replay.stats,chunks:replay.result.chunks.map(c=>({sequence:c.sequence,utf8Bytes:c.utf8Bytes,sha256:hash(c.data)}))};
  result.phase='fresh-unlock';assert.equal((await controller.unlock()).ok,true);await observe();assert.equal(last.inputWrites,1);
  assert.equal((await controller.submit(config.probe.freshCommand)).ok,true);await wait(async()=>{await observe();return scanner.seen('fresh');},3000);
  assert.equal(last.inputWrites,2);assert.equal(last.inputWriteAttempts,2);assert.equal(last.inputWriteSha256,hash(command+config.probe.freshCommand));assert.equal(last.inputUtf8Bytes,Buffer.byteLength(command+config.probe.freshCommand));
  result.finalStats=last;result.finalScanner=scanner.stats();result.controller=controller.metrics();result.mailbox=mailbox.stats();result.commands={first:{bytes:Buffer.byteLength(command),sha256:hash(command)},fresh:{bytes:Buffer.byteLength(config.probe.freshCommand),sha256:hash(config.probe.freshCommand)}};
  assert.ok([...result.controller.gateAckMs,...result.controller.inputAckMs].every(ms=>ms>=0&&ms<=500),'FLOW_CONTROL_LATENCY');
  await stage('finish',{flood,finalStats:last,controller:result.controller});controller.dispose();workerAlive=false;result.phase='stop';
  const stopping=now();native.stopSession(session,77);result.stopped=await wait(()=>{const s=native.snapshotSession(session);return exited(s)?s:null;});result.stopMs=now()-stopping;sessionClosed=native.closeSession(session)===true;assert.equal(sessionClosed,true);
  host.postMessage({kind:'exit'});await wait(()=>exited(native.snapshot(hostOwner)));hostClosed=native.close(hostOwner)===true;assert.equal(hostClosed,true);
  result.sessionClosed=sessionClosed;result.hostClosed=hostClosed;result.ageMs=now()-age;assert.ok(result.ageMs<100000);result.status='SHELL_FLOW_OBSERVED_NOT_ADMITTED';
 }catch(e){result.error={code:e.code,message:e.message,stack:e.stack};try{if(session&&!sessionClosed)result.failureSession=native.snapshotSession(session);}catch(error){result.snapshotError=String(error);}}
 finally{
  controller?.dispose();workerAlive=false;
  try{if(session&&!sessionClosed){native.stopSession(session,98);await wait(()=>exited(native.snapshotSession(session)));native.closeSession(session);}}catch(e){result.cleanupError=String(e.stack??e);result.status='FAILED';}
  try{if(hostOwner&&!hostClosed){native.stop(hostOwner,98);await wait(()=>exited(native.snapshot(hostOwner)));native.close(hostOwner);}}catch(e){result.hostCleanupError=String(e.stack??e);result.status='FAILED';}
  clearTimeout(watchdog);await fs.writeFile(join(config.output,'native-result.json'),JSON.stringify(result,null,2),{flag:'wx'});app.exit(result.status==='SHELL_FLOW_OBSERVED_NOT_ADMITTED'?0:1);
 }
}
