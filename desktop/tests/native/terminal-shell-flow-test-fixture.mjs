// Deliberately inert classifier data. Never evidence of native execution.
export function inertShellFlowObservation(){
 const h='a'.repeat(64),h2='b'.repeat(64),id=(pid,image='fixed')=>({pid,image,createdFileTime:String(pid+10000),alive:true,exitCode:259});
 const members=[id(3,'electron'),id(4,'powershell'),...Array.from({length:4},(_,i)=>id(i+5))],utility=id(2,'electron'),main=id(1,'electron');
 const before={active:6,killOnClose:true,breakaway:false,inheritable:false,held:members,root:members[0],shell:members[1]};
 const host={active:7,killOnClose:true,breakaway:false,inheritable:false,root:utility,held:[utility,...members]};
 const c={firstSequence:4194304,nextSequence:8388608,receivedUtf8Bytes:8388608,retainedUtf8Bytes:4194304,allocatedBytes:4194304,droppedUtf8Bytes:4194304,inputWrites:1,inputWriteAttempts:1,inputUtf8Bytes:100,inputWriteSha256:h,inputAttemptSha256:h,open:false,unavailable:false};
 const final={...c,inputWrites:2,inputWriteAttempts:2,inputUtf8Bytes:200,inputWriteSha256:h2,inputAttemptSha256:h2,open:true};
 const flood={admitted:false,elapsedMs:60005,minimumMs:60000,byteCap:134217728,generatedAsciiBytes:8388608,blocks:1024};
 const controller={nativeExecutionAdmitted:false,requests:75,dataPending:0,control:{pending:0},gateAckMs:[10,20,30],inputAckMs:[10,20]};
 const worker={workerPid:3,rootPid:4,osConpty:true,useConptyDll:false,nodePty:'1.1.0'};
 const fixturePids={root:5,branch:6,grandchild:7,detached:8};
 const ready={mainPid:1,session:structuredClone(before),host:structuredClone(host),worker:structuredClone(worker),fixturePids:structuredClone(fixturePids)};
 const finish={mainPid:1,flood:structuredClone(flood),finalStats:structuredClone(final),controller:structuredClone(controller)};
 const dead=p=>({...p,alive:false,exitCode:77}),held=[main,utility,...members];
 const native={admitted:false,status:'SHELL_FLOW_OBSERVED_NOT_ADMITTED',runtime:{electron:'44.5.1',modules:'149',arch:'x64',platform:'win32'},worker,before,hostBefore:host,fixturePids,ageMs:65000,sessionClosed:true,hostClosed:true,stopMs:30,stopped:{...before,active:0,root:dead(members[0]),shell:dead(members[1]),held:members.map(dead)},flood,completedWhileLocked:c,finalStats:final,commands:{first:{bytes:100,sha256:h},fresh:{bytes:100,sha256:h}},locked:{result:{ok:false},stats:{inputWrites:1,open:false}},samples:[{ageMs:2000,stats:c,chunks:[{sequence:4194304,utf8Bytes:32768,sha256:h}]},{ageMs:64000,stats:final,chunks:[]}],history:{maxRetained:4194304,maxAllocated:4194304,gaps:5,scanner:{seen:['start','done']}},historyReplay:{stats:c,gap:{fromSequence:0,resumeSequence:4194304,droppedUtf8Bytes:4194304,resetParser:true},chunks:[]},finalScanner:{seen:['start','done','fresh']},controller};
 const observer={admitted:false,status:'SHELL_FLOW_SAFETY_OBSERVED_NOT_ADMITTED',ready:structuredClone(ready),finish:structuredClone(finish),main,ageMs:65100,cleanupVerified:true,safetyOpenAtObservation:true,activeBeforeSafetyCleanup:0,before:held,after:held.map(dead),measurementMs:61000,peakSafetyJobMemoryBytes:1000000000,samples:[{ageMs:1000,intervalMs:0,peakSafetyJobMemoryBytes:900000000,heldCount:8,active:8},{ageMs:61000,intervalMs:60000,peakSafetyJobMemoryBytes:1000000000,heldCount:8,active:8}]};
 return {native,observer,ready,finish};
}
