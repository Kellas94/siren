export function fixture({peers=2,held=2}={}){
 const identity=pid=>({pid,image:'C:\\SIREN\\host.exe',createdFileTime:String(10000+pid)});
 const root=identity(101),rows=Array.from({length:held},(_,i)=>identity(201+i)),pairOrdinals=Array.from({length:peers},(_,i)=>17+i*3);
 const request={shutdownId:'host_shutdown_01',code:98,deadlineMs:5000};
 const expected={request,root,held:rows,pairOrdinals};
 const dead=row=>({...row,alive:false,exitCode:98});
 const receipt={version:1,...request,snapshot:{active:0,root:dead(root),held:rows.map(dead),killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:true},closed:true,scope:'HOST_AND_EXACT_PEER_ROSTER_ONLY',sessionCleanupJoined:false,peers:pairOrdinals.map(pairOrdinal=>({pairOrdinal,nativeReaped:true,jsDeliveryVerified:true,tsfnFinalized:true}))};
 return{expected,receipt};
}
