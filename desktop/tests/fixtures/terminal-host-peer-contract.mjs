export function hostPeerFixture(lane='control'){
 const root={pid:101,image:'C:\\SIREN\\creator.exe',createdFileTime:'1234567890123'};
 const expected={lane,mainPid:202,root,pairOrdinal:17};
 const value={pairOrdinal:17,lane,server:true,connected:true,retiring:false,settled:false,peer:{...root,alive:true,exitCode:259,observedBeforeClose:false},mainPid:202,creatorPid:101,queriedPeerPid:101,nativeDirection:'client',bothJobsChecked:true,commonJobMember:true,sessionJobMember:true,readPending:false,writePending:false,readReservedBytes:0,writeReservedBytes:0,heldPeerClosed:false,generation:0,readIdleTimeout:false,nativeExecutionAdmitted:false};
 return {expected,value};
}
