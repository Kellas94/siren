// SYNTHETIC OWNER FIXTURE ONLY. No process is started or native evidence produced.
export const fixtureKind='SYNTHETIC_NORMAL_CONTRACT_NOT_NATIVE_EVIDENCE';
export function syntheticNormalObservation(){
 const electron={path:'C:\\fixed\\electron.exe',sha256:'a'.repeat(64),bytes:100},addon={path:'C:\\fixed\\siren_terminal_creator_async.node',sha256:'b'.repeat(64),bytes:200};
 const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',conhost='C:\\Windows\\System32\\conhost.exe';
 const runtime={electron:'44.5.1',node:'24.21.0',modules:'149',napi:'10',arch:'x64',platform:'win32'};
 const identity=(pid,image=electron.path)=>({pid,image,createdFileTime:String(133000000000000000n+BigInt(pid)),alive:true,exitCode:259});
 const main=identity(10),extra=identity(11),host=identity(20),creator=identity(30),root=identity(31,shell),helper=identity(32,conhost);
 const dead=p=>({...p,alive:false,exitCode:77});
 const session=(closed=false)=>{const held=[creator,root,helper].map(p=>closed?dead(p):{...p});return {root:held[0],shell:held[1],held,active:closed?0:held.length,killOnClose:true,breakaway:false,inheritable:false,atomicBeforeResume:true,hostPid:host.pid,stopping:closed,monitorFired:false,monitorTerminateSucceeded:false,shellMonitorFired:closed,shellMonitorTerminated:false};};
 const hostSnapshot=(closed=false)=>{const held=[host,creator,root,helper].map(p=>closed?dead(p):{...p});return {root:held[0],held,active:closed?0:held.length,killOnClose:true,breakaway:false,inheritable:false,stopping:closed,monitorFired:closed,monitorTerminateSucceeded:false};};
 const probe={inputWrites:1,writeKnown:true,refusedInput:2,receivedBytes:900,beginMs:100,lockMs:200,doneMs:1300,parserCharacters:900};
 const before=[main,extra,...hostSnapshot().held].map(p=>({...p})),after=before.map(p=>p.pid===main.pid||p.pid===extra.pid?{...p,alive:false,exitCode:0}:dead(p));
 const result={admitted:false,negative:false,compileOnly:false,inputsUnchanged:true,processStarted:true,outerExitObserved:true,outerExitCode:0,qualified:true,status:'NORMAL_POWERSHELL_OBSERVED_NOT_ADMITTED',inputs:[{...addon},{...electron}],output:'C:\\fixed\\SIREN env Ω space-synthetic',
  native:{admitted:false,status:'NORMAL_POWERSHELL_OBSERVED_NOT_ADMITTED',runtime,ready:{workerPid:creator.pid,rootPid:root.pid,shell,runtime:{...runtime},nodePty:'1.1.0',osConpty:true,useConptyDll:false,environmentKeys:['COMSPEC','ELECTRON_RUN_AS_NODE','PATH','SYSTEMROOT','TEMP','TMP','WINDIR'],initial:{inputWrites:0,writeKnown:false,refusedInput:1,receivedBytes:50,beginMs:null,lockMs:null,doneMs:null,parserCharacters:50}},before:session(),hostBefore:hostSnapshot(),completion:{...probe,history:{firstSequence:0,nextSequence:900,retainedUtf8Bytes:900,droppedUtf8Bytes:0,blockCount:1,allocatedBytes:32768,pendingVtUtf8Bytes:0,omittedSequences:0}},lockAck:{ok:true,generation:2,localInputFenced:true,hostAcknowledged:true},oldViewRefused:true,lockedStats:{sessions:1,retiringCreators:0,pendingRequests:0,reservedUtf8Bytes:0,retainedUtf8Bytes:0,attachments:0,outstandingUtf8Bytes:0,frames:0},historyReplay:{begin:true,done:true,bytes:900,frames:1},stopped:{closed:true,snapshot:session(true)},asyncRetirement:{elapsedMs:15.2023,ticks:0,maxGapMs:15.2061},hostAfter:hostSnapshot(true),hostClosed:true},
  observer:{admitted:false,status:'NORMAL_SAFETY_OBSERVED_NOT_ADMITTED',main:{...main},before,after,safetyHeldBeforeGo:true,safetyOpenAtObservation:true,activeBeforeSafetyCleanup:0,cleanupVerified:true,ageMs:4000},
 };
 result.native.openAck={ok:true,generation:1,localInputFenced:false,hostAcknowledged:true};result.native.replayInputFence={generation:2,closed:true,hostAcknowledged:true};
 result.native.ready.shellArguments=['-NoLogo','-NoProfile','-NoExit','-Command',"$env:PSModulePath = $PSHOME + '\\Modules'"];
 result.native.ready.shellEnvironment={COMSPEC:'C:\\Windows\\System32\\cmd.exe',PATH:'C:\\Windows\\System32;C:\\Windows',SYSTEMROOT:'C:\\Windows',TEMP:result.output+'\\session',TMP:result.output+'\\session',WINDIR:'C:\\Windows',PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'};
 return {result,addon,electron};
}
