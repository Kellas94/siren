// Fixed CI worker only. Root invokes it only after native contained bootstrap.
import assert from 'node:assert/strict';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join,isAbsolute} from 'node:path';
import {release} from 'node:os';
import net from 'node:net';
import {once} from 'node:events';
import {TerminalControlChannel} from '../../src/terminal/control-channel.mjs';
import {TerminalHistoryChannel,createHistoryResponder} from '../../src/terminal/history-channel.mjs';
import {TerminalCreatorHistory} from '../../src/terminal/remote-output.mjs';
import {createGateResponder} from '../../src/terminal/gate-link.mjs';
import {createSystemPowerShellEnvironment} from '../../src/terminal/shell-environment.mjs';
import {NormalShellProbe,NORMAL_COMMAND_KIND} from './terminal-normal-probe-core.mjs';
import {requireQualifiedConptyPlatform,requireSelectedOsConpty} from './terminal-conpty-platform.mjs';
export async function runNormalWorker(bootstrap,directory){
 assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');assert.equal(process.env.ELECTRON_RUN_AS_NODE,'1');assert.equal(isAbsolute(directory),true);assert.equal(bootstrap.sessionId,'normal-shell');
 const configBytes=await readFile(join(directory,'worker-config.json'));assert.ok(configBytes.length<4096);const config=JSON.parse(configBytes);assert.deepEqual(Object.keys(config).sort(),['packagePath','shell']);assert.ok(isAbsolute(config.packagePath)&&isAbsolute(config.shell));
 requireQualifiedConptyPlatform({platform:process.platform,arch:process.arch,windowsVersion:release()});
 const persist=async(name,value)=>{const p=join(directory,name+'.json');await writeFile(p+'.pending',JSON.stringify(value),{flag:'wx'});await rename(p+'.pending',p);};
 const milestones=async()=>{const result={};for(const stage of ['before-begin','after-begin','after-sleep','after-done']){try{const b=await readFile(join(directory,'normal-script-'+stage+'.json'));assert.ok(b.length<=8&&b.toString('utf8')==='1');result[stage]=true;}catch(e){if(e.code!=='ENOENT')throw e;result[stage]=false;}}return result;};
 const connect=async name=>{const socket=net.createConnection(name);const timer=setTimeout(()=>socket.destroy(Error('CONNECT_DEADLINE')),2500);try{await once(socket,'connect');return socket;}finally{clearTimeout(timer);}};
 const controlSocket=await connect(bootstrap.controlPipe),historySocket=await connect(bootstrap.dataPipe);
 const control=new TerminalControlChannel({stream:controlSocket,role:'creator',channelId:bootstrap.channelId,secret:bootstrap.controlSecret,deadlineMs:2500});
 const historyChannel=new TerminalHistoryChannel({stream:historySocket,role:'creator',channelId:bootstrap.channelId,sessionId:bootstrap.sessionId,secret:bootstrap.dataSecret,deadlineMs:2500});
 const sessionId=bootstrap.sessionId,channelId=bootstrap.channelId;bootstrap.dispose();
 const history=new TerminalCreatorHistory(sessionId),require=createRequire(config.packagePath),manifest=require('node-pty/package.json');assert.equal(manifest.version,'1.1.0');
 const pty=require('node-pty'),env=createSystemPowerShellEnvironment({environment:Object.fromEntries(Object.entries(process.env)),shell:config.shell,cwd:directory});
 // PowerShell startup can append AllUsers paths to a supplied PSHOME path.
 // Reset only the module path after startup; this fixed setter executes no
 // project code and carries no key or user-provided command.
 const shellArguments=['-NoLogo','-NoProfile','-NoExit','-Command',"$env:PSModulePath = $PSHOME + '\\Modules'"];
 const term=pty.spawn(config.shell,shellArguments,{cwd:directory,env,cols:100,rows:30,useConpty:true,useConptyDll:false,handleFlowControl:false});requireSelectedOsConpty({useConpty:term._agent?._useConpty,useConptyDll:term._agent?._useConptyDll});
 const probe=new NormalShellProbe({writeInput:s=>term.write(s),appendOutput:s=>{assert.equal(history.append(s).ok,true);}});assert.equal(probe.requestCommand(0).ok,false);
 let completion=false,failed=false,lockObservation=false;const fail=async error=>{if(failed)return;failed=true;await persist('worker-error',{message:error.message,pid:process.pid});process.exitCode=1;};
 term.onExit(e=>{void fail(Error('UNEXPECTED_SHELL_EXIT_'+e.exitCode));});
 term.onData(data=>{try{probe.ingest(data);if(!completion&&probe.snapshot().doneMs!==null){completion=true;void persist('worker-completion',{...probe.snapshot(),history:history.stats()}).catch(fail);}}catch(e){void fail(e);}});
 const responder=createGateResponder({channelId,gate:{apply:p=>probe.applyGate(p)},send:r=>control.send(r)});
 const lost=()=>probe.applyGate({generation:Number.MAX_SAFE_INTEGER,open:false});
 control.subscribe({closed:lost,message:p=>{const ok=responder(p);if(ok){probe.requestCommand(p.generation);if(!p.open){void persist('worker-lock',probe.snapshot()).catch(fail);if(!lockObservation){lockObservation=true;setTimeout(()=>{void (async()=>persist('worker-lock-observation',{scope:'Bounded fixed-CI diagnostic, not an approval',commandKind:NORMAL_COMMAND_KIND,milestones:await milestones(),probe:probe.snapshot(),history:history.read({sessionId,fromSequence:0,maxBytes:32768}),stats:history.stats(),control:control.stats(),historyChannel:historyChannel.stats()}))().catch(fail);},2000);}}}}});
 for(const event of ['end','close','error','timeout'])historySocket.on(event,lost);
 createHistoryResponder({channel:historyChannel,history});assert.equal(await control.ready,true);assert.equal(await historyChannel.ready,true);
 await persist('worker-ready',{commandKind:NORMAL_COMMAND_KIND,shellArguments,shellEnvironment:env,workerPid:process.pid,rootPid:term.pid,shell:config.shell,runtime:{...process.versions,arch:process.arch,platform:process.platform},nodePty:manifest.version,osConpty:term._agent._useConpty,useConptyDll:term._agent._useConptyDll,environmentKeys:Object.keys(process.env).sort((a,b)=>a.toUpperCase().localeCompare(b.toUpperCase())),initial:probe.snapshot()});
 // Fixture lifetime bound only. Native Jobs retain actual Stop authority.
 setTimeout(()=>process.exit(91),20000);setInterval(()=>{},1000);
}
