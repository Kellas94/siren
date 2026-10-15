// Inert import. Only the isolated hosted runner serializes this function as main.
export async function runAggregateFlowMain(config){
 const {app,utilityProcess}=await import('electron'),assert=(await import('node:assert/strict')).default;
 const fs=await import('node:fs/promises'),{join}=await import('node:path'),{createRequire}=await import('node:module'),{createHash}=await import('node:crypto'),{setTimeout:delay}=await import('node:timers/promises');
 const {createShellFlowController}=await import(config.controllerUrl),{createShellFlowMailbox}=await import(config.mailboxUrl),{ShellFlowMarkerScanner}=await import(config.probeUrl),{createAggregateFlowDelivery}=await import(config.deliveryUrl);
 const now=()=>Number(process.hrtime.bigint()/1000000n),age=now(),hash=s=>createHash('sha256').update(s).digest('hex');
 app.setPath('userData',join(config.output,'profile'));await app.whenReady();
 const result={admitted:false,status:'FAILED',runtime:{...process.versions,arch:process.arch,platform:process.platform},slots:[],creditSamples:[],phase:'bootstrap'};
 const native=createRequire(import.meta.url)(config.addon),strong=globalThis.__aggregateFlow={slots:[]};let host,hostOwner,hostClosed=false,delivery,transportCalls=0;
 const exited=s=>s.active===0&&!s.root.alive&&(!s.shell||!s.shell.alive)&&s.held.every(p=>!p.alive);
 const persist=async(path,value)=>{await fs.writeFile(path+'.pending',JSON.stringify(value),{flag:'wx'});await fs.rename(path+'.pending',path);};
 const wait=async(fn,ms=3000)=>{const deadline=now()+ms;for(;;){assert.ok(now()<deadline,'AGGREGATE_WAIT_DEADLINE');const value=await fn();assert.ok(now()<deadline,'AGGREGATE_WAIT_DEADLINE');if(value)return value;await delay(5);}};
 const json=async path=>{try{const st=await fs.lstat(path);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.size<=262144,'AGGREGATE_RECORD_BUDGET');return JSON.parse(await fs.readFile(path));}catch(e){if(e.code!=='ENOENT')throw e;return null;}};
 const stage=async(label,value)=>{await persist(join(config.output,'flow-'+label+'-ready.json'),{mainPid:process.pid,...value});await wait(async()=>{try{return await fs.readFile(join(config.output,'flow-'+label+'-go.request'),'utf8')==='go';}catch(e){if(e.code!=='ENOENT')throw e;}},5000);};
 const watchdog=setTimeout(()=>app.exit(94),100000);
 try{
  assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');assert.equal(process.arch,'x64');
  const hello={},mark=native.mark();host=utilityProcess.fork(config.hostEntry,[],{serviceName:'SIREN aggregate fixed control',stdio:'pipe'});strong.host=host;
  host.stdout?.on('data',()=>{});host.stderr?.on('data',()=>{});host.on('message',m=>{hello[m.kind]=m;});await wait(()=>hello.hello);assert.equal(hello.hello.pid,host.pid);
  hostOwner=native.start(host.pid,config.electron,mark);strong.hostOwner=hostOwner;
  for(let slot=0;slot<8;slot++){
   const directory=join(config.output,'Șiren aggregate α '+slot);await fs.mkdir(directory);
   await fs.writeFile(join(directory,'fixed-shell-flow.ps1'),config.probe.script,{flag:'wx'});await fs.writeFile(join(directory,'shell-flow-config.json'),JSON.stringify({packagePath:config.packagePath,shell:config.shell}),{flag:'wx'});
   const rootMark=native.mark(),session=native.createSession(hostOwner,config.electron,config.creator,directory),s={slot,directory,session,closed:false,alive:true,cursor:0,token:null,last:null,scanner:new ShellFlowMarkerScanner(config.probe.markers)};strong.slots.push(s);
   const r={slot,samples:[]};result.slots.push(r);s.record=r;r.initialSession=native.snapshotSession(session);
   const ready=await wait(()=>json(join(directory,'shell-flow-ready.json')),15000);assert.equal(ready.workerPid,r.initialSession.root.pid);assert.equal(ready.stats.inputWrites,0);native.watchRoot(session,ready.rootPid,config.shell,rootMark);r.worker=ready;
   s.mailbox=createShellFlowMailbox({directory,fs,now,delay,isAlive:()=>s.alive&&native.snapshotSession(session).root.alive});
   s.controller=createShellFlowController({exchange:p=>s.mailbox.exchange(p),isAlive:()=>s.alive&&native.snapshotSession(session).root.alive,now});
   s.command="& '"+join(directory,'fixed-shell-flow.ps1').replaceAll("'","''")+"'\r";
   for(const marker of Object.values(config.probe.markers))assert.equal(s.command.includes(marker),false);
  }
  const ninth=join(config.output,'ninth-refused');await fs.mkdir(ninth);let refused=false;
  try{native.createSession(hostOwner,config.electron,config.creator,ninth);}catch(e){refused=String(e.message).includes('SESSION_CAPACITY_REFUSED');}assert.equal(refused,true,'NINTH_NOT_REFUSED');
  let ninthBootstrap=false;try{await fs.lstat(join(ninth,'creator-bootstrap.json'));ninthBootstrap=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  assert.equal(ninthBootstrap,false);result.ninth={code:'SESSION_CAPACITY_REFUSED',bootstrapPresent:ninthBootstrap};
  const slots=strong.slots;
  await Promise.all(slots.map(async s=>{assert.equal((await s.controller.unlock()).ok,true);s.generation=s.controller.snapshot().generation;assert.equal((await s.controller.submit(s.command)).ok,true);assert.equal((await s.controller.resize(120,30)).result.ok,true);}));
  await Promise.all(slots.map(async s=>{const pids={};await wait(async()=>{try{for(const key of ['root','branch','grandchild','detached']){const t=await fs.readFile(join(s.directory,key+'.ready'),'utf8');assert.match(t,/^[1-9][0-9]{0,9}$/);pids[key]=Number(t);}return true;}catch(e){if(e.code!=='ENOENT')throw e;}},5000);s.record.fixturePids=pids;s.record.before=native.captureSession(s.session);}));
  result.hostBefore=native.capture(hostOwner);await stage('first',{slots:result.slots.map(({slot,worker,before,fixturePids})=>({slot,worker,before,fixturePids})),host:result.hostBefore});result.phase='flood';
  delivery=createAggregateFlowDelivery({read:async(slot,cursor)=>{transportCalls++;return slots[slot].controller.read(cursor);}});strong.delivery=delivery;delivery.resume();for(const s of slots)s.token=delivery.attach(s.slot,0).value;
  await Promise.all(slots.map(s=>fs.writeFile(join(s.directory,'fixed-flood-go.request'),'go',{flag:'wx'})));
  function credits(label){const d=delivery.stats();assert.ok(d.outstandingUtf8Bytes+d.inFlightBytes<=2097152&&d.payloadUtf8Bytes===d.outstandingUtf8Bytes,'AGGREGATE_CREDIT_CAP');for(const v of d.views)assert.ok(v.pendingUtf8Bytes<=262144);result.creditSamples.push({label,ageMs:now()-age,transportCalls,...d});assert.ok(result.creditSamples.length<=110);return d;}
  function record(s,reply,tail){
   const r=reply.result,t=reply.stats;assert.ok(t.retainedUtf8Bytes<=4194304&&t.allocatedBytes<=4194304);for(const c of r.chunks)s.scanner.append(c.sequence,c.data);
   const next=tail?Math.max(r.nextSequence,t.nextSequence-32768):r.nextSequence,tailGap=next>r.nextSequence?{fromSequence:r.nextSequence,toSequence:next,droppedUtf8Bytes:next-r.nextSequence,resetParser:true,reason:'fixed-probe-tail-selection'}:null;
   s.cursor=next;s.last=t;s.record.samples.push({ageMs:now()-age,stats:t,gap:r.gap??null,tailGap,chunks:r.chunks.map(c=>({sequence:c.sequence,utf8Bytes:c.utf8Bytes,sha256:hash(c.data)}))});assert.ok(s.record.samples.length<=100);return r.nextSequence;
  }
  async function observe(s,tail=true){const reply=await delivery.read(s.token);assert.equal(reply.ok,true,'AGGREGATE_CREDIT_READ');const end=record(s,reply.value,tail);assert.equal(delivery.ack(s.token,end).ok,true);if(s.cursor!==end){assert.equal(delivery.detach(s.token).ok,true);s.token=delivery.attach(s.slot,s.cursor).value;}return s.scanner;}
  // Allow producer output to accumulate, then retain a real no-ACK window.
  await wait(async()=>{await Promise.all(slots.map(s=>observe(s,false)));return slots.every(s=>s.scanner.seen('start'));},5000);
  await delay(4000);for(let i=0;i<8;i++)await Promise.all(slots.map(async s=>{const reply=await delivery.read(s.token);assert.equal(reply.ok,true);record(s,reply.value,false);}));
  result.pressure=credits('no-ACK-pressure');assert.ok(result.pressure.outstandingUtf8Bytes>=1835008,'AGGREGATE_PRESSURE_NOT_ESTABLISHED');
  const calls=transportCalls;for(const s of slots)assert.equal((await delivery.read(s.token)).code,'CAPACITY_EXCEEDED');assert.equal(transportCalls,calls);result.blockedReadTransportCalls=0;
  await delay(1000);const locks=slots.map(s=>s.controller.lock());result.lockSynchronous=slots.every(s=>s.controller.snapshot().closed===true);assert.equal(result.lockSynchronous,true);
  for(const s of slots)assert.equal((await s.controller.submit('# fixed locally refused\r')).ok,false);
  const oldTokens=slots.map(s=>s.token);delivery.suspend();result.afterLock=credits('locked');await Promise.all(locks.map(async p=>assert.equal((await p).ok,true)));
  for(const t of oldTokens)assert.equal(delivery.ack(t,0).code,'LEASE_STALE');result.oldAckRefused=8;
  await Promise.all(slots.map(async s=>{s.record.locked=await s.controller.probeStaleInput(s.generation,'# fixed stale refused\r');assert.equal(s.record.locked.result.ok,false);assert.equal(s.record.locked.stats.inputWrites,1);}));
  // Diagnostic attachments are fixture instrumentation, never renderer leases.
  // Every diagnostic read still passes through the same finite credit authority.
  delivery.resume();for(const s of slots)s.token=delivery.attach(s.slot,s.cursor).value;
  const deadline=now()+75000;while(!slots.every(s=>s.scanner.seen('done'))){assert.ok(now()<deadline,'AGGREGATE_FLOOD_DEADLINE');await Promise.all(slots.map(s=>observe(s)));credits('diagnostic');for(const s of slots){assert.equal(s.last.inputWrites,1);assert.equal(s.last.open,false);}if(!slots.every(s=>s.scanner.seen('done')))await delay(1000);}
  for(const s of slots){const r=s.record;r.flood=await json(join(s.directory,'fixed-flood-result.json'));assert.ok(r.flood&&r.flood.minimumMs===62000&&r.flood.elapsedMs>=62000&&r.flood.elapsedMs<75000&&r.flood.generatedAsciiBytes>4194304&&r.flood.generatedAsciiBytes<=134217728);assert.equal(r.flood.blocks*8192,r.flood.generatedAsciiBytes);r.completedWhileLocked=s.last;assert.equal(s.last.inputWriteAttempts,1);assert.equal(s.last.inputAttemptSha256,hash(s.command));assert.equal(s.last.inputWriteSha256,hash(s.command));
   assert.equal(delivery.detach(s.token).ok,true);const replayToken=delivery.attach(s.slot,0).value,replay=await delivery.read(replayToken);assert.equal(replay.ok,true);assert.ok(replay.value.result.gap?.droppedUtf8Bytes>0&&replay.value.result.gap.resetParser===true);assert.equal(replay.value.stats.inputWrites,1);
   r.historyReplay={gap:replay.value.result.gap,stats:replay.value.stats,chunks:replay.value.result.chunks.map(c=>({sequence:c.sequence,utf8Bytes:c.utf8Bytes,sha256:hash(c.data)}))};assert.equal(delivery.ack(replayToken,replay.value.result.nextSequence).ok,true);delivery.detach(replayToken);s.token=delivery.attach(s.slot,s.cursor).value;
  }
  const floods=result.slots.map(s=>s.flood),frequency=floods[0].qpcFrequency;assert.ok(Number.isSafeInteger(frequency)&&frequency>0);for(const f of floods)assert.ok(f.qpcFrequency===frequency&&Number.isSafeInteger(f.startedQpc)&&Number.isSafeInteger(f.finishedQpc)&&f.finishedQpc>f.startedQpc);
  result.commonOverlapMs=Math.floor((Math.min(...floods.map(f=>f.finishedQpc))-Math.max(...floods.map(f=>f.startedQpc)))*1000/frequency);assert.ok(result.commonOverlapMs>=60000,'EIGHT_COMMON_OVERLAP');
  result.phase='fresh-unlock';await Promise.all(slots.map(async s=>{assert.equal((await s.controller.unlock()).ok,true);await observe(s);assert.equal(s.last.inputWrites,1);assert.equal((await s.controller.submit(config.probe.freshCommand)).ok,true);}));
  await wait(async()=>{await Promise.all(slots.map(s=>observe(s,false)));return slots.every(s=>s.scanner.seen('fresh')&&s.cursor===s.last.nextSequence);},3000);
  for(const s of slots){const r=s.record;assert.equal(s.last.inputWrites,2);assert.equal(s.last.inputWriteAttempts,2);assert.equal(s.last.inputWriteSha256,hash(s.command+config.probe.freshCommand));assert.equal(s.last.inputAttemptSha256,s.last.inputWriteSha256);r.finalStats=s.last;r.finalScanner=s.scanner.stats();r.controller=s.controller.metrics();r.mailbox=s.mailbox.stats();r.commands={first:{bytes:Buffer.byteLength(s.command),sha256:hash(s.command)},fresh:{bytes:Buffer.byteLength(config.probe.freshCommand),sha256:hash(config.probe.freshCommand)}};assert.ok([...r.controller.gateAckMs,...r.controller.inputAckMs].every(ms=>ms>=0&&ms<=500));}
  result.finalDelivery=credits('final');await stage('finish',{slots:result.slots.map(({slot,flood,finalStats,controller})=>({slot,flood,finalStats,controller})),commonOverlapMs:result.commonOverlapMs});
  delivery.suspend();result.phase='stop';
  for(const s of slots){s.controller.dispose();s.alive=false;const stopping=now();native.stopSession(s.session,77);s.record.stopped=await wait(()=>{const t=native.snapshotSession(s.session);return exited(t)?t:null;});s.record.stopMs=now()-stopping;s.closed=native.closeSession(s.session)===true;assert.equal(s.closed,true);s.record.sessionClosed=s.closed;
   if(s.slot===0){result.siblingsAfterFirstStop=slots.slice(1).map(q=>native.snapshotSession(q.session));for(const t of result.siblingsAfterFirstStop)assert.ok(t.active===t.held.length&&t.held.every(p=>p.alive)&&t.root.alive&&t.shell.alive);}
  }
  host.postMessage({kind:'exit'});await wait(()=>exited(native.snapshot(hostOwner)));hostClosed=native.close(hostOwner)===true;assert.equal(hostClosed,true);result.hostClosed=true;result.ageMs=now()-age;assert.ok(result.ageMs<100000);result.status='AGGREGATE_FLOW_OBSERVED_NOT_ADMITTED';
 }catch(e){result.error={code:e.code,message:e.message,stack:e.stack};}
 finally{
  delivery?.suspend();for(const s of strong.slots){s.controller?.dispose();s.alive=false;try{if(!s.closed){native.stopSession(s.session,98);await wait(()=>exited(native.snapshotSession(s.session)));native.closeSession(s.session);}}catch(e){result.cleanupError=String(e.stack??e);result.status='FAILED';}}
  try{if(hostOwner&&!hostClosed){native.stop(hostOwner,98);await wait(()=>exited(native.snapshot(hostOwner)));native.close(hostOwner);}}catch(e){result.hostCleanupError=String(e.stack??e);result.status='FAILED';}
  clearTimeout(watchdog);await fs.writeFile(join(config.output,'native-result.json'),JSON.stringify(result,null,2),{flag:'wx'});app.exit(result.status==='AGGREGATE_FLOW_OBSERVED_NOT_ADMITTED'?0:1);
 }
}
