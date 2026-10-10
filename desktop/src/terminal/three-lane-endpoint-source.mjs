// Pure deterministic source preparation. No native load, compilation or admission.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const SOURCE='cad20d5b5920cbf56ac8921de146682ce1208020eb3f64efa09ac3b97462594f';
const BINDING='e687bcfd32044f431060fc1fe5471ae45cb3dd3bf5dbad5e8ca05b2f606655e7';
const ENDPOINT='9cbbaa14ea8a2274141051c99d800463ab47b2f0d19dc5cddf5877999233e8bf';
function replace(text,old,next,count=1){assert.equal(text.split(old).length,count+1,'THREE_LANE_SOURCE_ANCHOR_DRIFT');return text.split(old).join(next);}
function block(text,start,end,next){
 assert.equal(text.split(start).length,2,'THREE_LANE_SOURCE_ANCHOR_DRIFT');
 assert.equal(text.split(end).length,2,'THREE_LANE_SOURCE_ANCHOR_DRIFT');
 const a=text.indexOf(start),b=text.indexOf(end);assert.ok(a>=0&&b>a,'THREE_LANE_SOURCE_ANCHOR_DRIFT');
 return replace(text,text.slice(a,b),next);
}
const bootstrapReader=String.raw`// Version-specific transport bootstrap. Legacy SIRENTB1 remains unchanged.
bool ThreeLaneBootstrapFields(const unsigned char* p,size_t size,const unsigned char* (&fields)[5],size_t (&lengths)[5]){
 if(!p||size<114||size>2048)return false;const char magic[]="SIRENTB2";
 for(size_t i=0;i<8;++i)if(p[i]!=static_cast<unsigned char>(magic[i]))return false;
 size_t offset=18;
 for(size_t i=0;i<5;++i){size_t n=(static_cast<size_t>(p[8+i*2])<<8)|p[9+i*2];
  if(offset>size-96||n==0||n>size-96-offset)return false;fields[i]=p+offset;lengths[i]=n;offset+=n;
 }
 if(offset+96!=size||!BootstrapId(fields[0],lengths[0])||!BootstrapId(fields[1],lengths[1])||
  !BootstrapName(fields[2],lengths[2],"\\\\.\\pipe\\siren-terminal-control-")||
  !BootstrapName(fields[3],lengths[3],"\\\\.\\pipe\\siren-terminal-data-")||
  !BootstrapName(fields[4],lengths[4],"\\\\.\\pipe\\siren-terminal-command-"))return false;
 unsigned char present[3]{},different[3]{};
 for(size_t i=0;i<32;++i){
  present[0]|=p[offset+i];present[1]|=p[offset+32+i];present[2]|=p[offset+64+i];
  different[0]|=p[offset+i]^p[offset+32+i];different[1]|=p[offset+i]^p[offset+64+i];different[2]|=p[offset+32+i]^p[offset+64+i];
 }
 return present[0]!=0&&present[1]!=0&&present[2]!=0&&different[0]!=0&&different[1]!=0&&different[2]!=0;
}
bool ReadThreeLaneBootstrap(napi_env env,napi_value value,BootstrapPacket& packet){
 bool buffer=false;void* data=nullptr;size_t size=0;
 if(napi_is_buffer(env,value,&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,value,&data,&size)!=napi_ok)return false;
 auto* p=static_cast<unsigned char*>(data);const unsigned char* fields[5]{};size_t lengths[5]{};
 if(!ThreeLaneBootstrapFields(p,size,fields,lengths))return false;packet.bytes.assign(p,p+size);return true;
}
`;
const names=String.raw`bool PeerName(const std::wstring& name,unsigned lane){
 if(lane>=peerLaneCount)return false;
 const wchar_t* prefixes[peerLaneCount]={L"\\\\.\\pipe\\siren-terminal-control-",L"\\\\.\\pipe\\siren-terminal-data-",L"\\\\.\\pipe\\siren-terminal-command-"};
 const std::wstring prefix=prefixes[lane];
 if(name.size()!=prefix.size()+32||name.compare(0,prefix.size(),prefix)!=0)return false;
 for(size_t i=prefix.size();i<name.size();++i)if(!((name[i]>=L'0'&&name[i]<=L'9')||(name[i]>=L'a'&&name[i]<=L'f')))return false;return true;
}
bool PeerPacketNames(const BootstrapPacket& packet,std::wstring (&names)[peerLaneCount]){
 const unsigned char* fields[5]{};size_t lengths[5]{};
 if(!ThreeLaneBootstrapFields(packet.bytes.data(),packet.bytes.size(),fields,lengths))return false;
 for(unsigned lane=0;lane<peerLaneCount;++lane){names[lane].clear();for(size_t i=0;i<lengths[lane+2];++i)names[lane].push_back(static_cast<wchar_t>(fields[lane+2][i]));if(!PeerName(names[lane],lane))return false;}
 return true;
}

`;
const worker=String.raw`bool PeerAppendWait(HANDLE* waits,DWORD& count,HANDLE value){
 if(!value||count>=peerWaitLimit)return false;waits[count++]=value;return true;
}
DWORD WINAPI PeerWorker(void* context){
 std::unique_ptr<std::shared_ptr<PeerPair>> incoming(static_cast<std::shared_ptr<PeerPair>*>(context));auto p=*incoming;incoming.reset();
 for(;;){
  HANDLE waits[peerWaitLimit];DWORD count=0,timeout=100;bool notify=false,done=false,waitValid=true;
  {std::lock_guard<std::recursive_mutex> guard(p->lock);ULONGLONG now=GetTickCount64();
   for(unsigned lane=0;lane<peerLaneCount;++lane)PeerReapLocked(p.get(),lane);
   if(!p->retiring){
    if((p->bound&&!PeerHeldCurrent(p->peer))||(p->server&&!PeerHeldCurrent(p->hostWitness)))PeerRetireLocked(p.get(),"PEER_PROCESS_EXITED");
    if(now>=p->startupDeadline&&!PeerAllConnectedLocked(p.get()))PeerRetireLocked(p.get(),"PEER_STARTUP_DEADLINE");
   }
   for(auto& r:p->requests)if(r->kind!=PeerRequestKind::Read&&!r->jsDone&&now>=r->deadline){
    if(!r->error)r->error="PEER_DEADLINE";r->notify=true;PeerRetireLocked(p.get(),"PEER_DEADLINE");
   }
   if(!p->retiring){for(unsigned lane=0;lane<peerLaneCount;++lane)PeerIssueLocked(p.get(),lane);}
   if(p->retiring)done=PeerDrainLocked(p.get());
   PeerCleanupRequestsLocked(p.get());
   for(auto& r:p->requests){notify=notify||(r->notify&&!r->jsDone&&!r->delivering);
    if(r->kind!=PeerRequestKind::Read&&!r->jsDone&&r->deadline>now){ULONGLONG left=r->deadline-now;if(left<timeout)timeout=static_cast<DWORD>(left);}}
   waitValid=PeerAppendWait(waits,count,p->wake.h)&&waitValid;
   for(auto& l:p->lanes){if(l.readPending||l.connectPending)waitValid=PeerAppendWait(waits,count,l.readEvent.h)&&waitValid;if(l.writePending)waitValid=PeerAppendWait(waits,count,l.writeEvent.h)&&waitValid;}
   if(!p->retiring&&p->bound&&p->peer.process.h)waitValid=PeerAppendWait(waits,count,p->peer.process.h)&&waitValid;
   if(!p->retiring&&p->server&&p->hostWitness.process.h)waitValid=PeerAppendWait(waits,count,p->hostWitness.process.h)&&waitValid;
   if(count>(p->server?peerWaitLimit:peerWaitLimit-1))waitValid=false;
   if(!waitValid)PeerRetireLocked(p.get(),"PEER_WAIT_CAPACITY");
  }
  if(notify)PeerNotify(p.get());if(done)break;if(!waitValid)continue;
  DWORD waited=WaitForMultipleObjects(count,waits,FALSE,timeout);
  if(waited==WAIT_FAILED){std::lock_guard<std::recursive_mutex> guard(p->lock);PeerRetireLocked(p.get(),"PEER_WAIT_FAILED");}
 }
 if(p->tsfnUsable.exchange(false))napi_release_threadsafe_function(p->tsfn,napi_tsfn_release);
 return 0;
}
`;
const listeners=String.raw`napi_value PeerCreateListeners(napi_env env,napi_callback_info info){
 napi_value a[4];if(!Args(env,info,4,a))return nullptr;auto* host=Get(env,a[0]);if(!host)return nullptr;
 std::lock_guard<std::mutex> fence(host->terminationLock);
 if(host->closed||host->stopping.load()||!PeerHeldCurrent(host->root))return Refuse(env,"PEER_HOST_UNAVAILABLE");
 std::wstring names[peerLaneCount];
 for(unsigned lane=0;lane<peerLaneCount;++lane)if(!String(env,a[lane+1],names[lane])||!PeerName(names[lane],lane))return Refuse(env,"PEER_NAME_REFUSED");
 for(unsigned a=0;a<peerLaneCount;++a)for(unsigned b=a+1;b<peerLaneCount;++b)if(names[a]==names[b])return Refuse(env,"PEER_NAME_REFUSED");
 auto p=PeerNewPair(env,true);if(!p)return nullptr;p->ownerKey=host;
 if(!PeerCopyMember(host->root,p->hostWitness)||!PeerDuplicate(host->job.h,JOB_OBJECT_QUERY,p->commonJob))return Refuse(env,"PEER_IDENTITY_DUPLICATE_FAILED");
 // Duplicate the documented actual-main pseudo handle directly, never a PID.
 HANDLE actualMain=nullptr;
 if(!DuplicateHandle(GetCurrentProcess(),GetCurrentProcess(),GetCurrentProcess(),&actualMain,peerProcessRights,FALSE,0))return Refuse(env,"PEER_MAIN_IDENTITY_FAILED");
 p->mainWitness.process=Handle(actualMain);
 p->mainWitness.pid=GetCurrentProcessId();if(!ReadIdentity(p->mainWitness))return Refuse(env,"PEER_MAIN_IDENTITY_FAILED");p->mainPid=p->mainWitness.pid;
 std::vector<unsigned char> acl;SECURITY_DESCRIPTOR descriptor{};SECURITY_ATTRIBUTES security{};
 if(!PeerListenerSecurity(acl,descriptor,security))return Refuse(env,"PEER_DACL_FAILED");
 for(unsigned lane=0;lane<peerLaneCount;++lane){p->lanes[lane].name=names[lane];HANDLE pipe=CreateNamedPipeW(names[lane].c_str(),PIPE_ACCESS_DUPLEX|FILE_FLAG_FIRST_PIPE_INSTANCE|FILE_FLAG_OVERLAPPED,PIPE_TYPE_BYTE|PIPE_READMODE_BYTE|PIPE_WAIT|PIPE_REJECT_REMOTE_CLIENTS,1,32768,32768,0,&security);
  if(pipe==INVALID_HANDLE_VALUE)return Refuse(env,"PEER_LISTENER_CREATE_FAILED");p->lanes[lane].pipe=Handle(pipe);}
 if(!PeerStartThread(env,p))return nullptr;auto result=PeerWrap(env,p,&peerPairTag);if(!result)PeerAbortStartup(p.get());return result;
}
`;
const prepare=String.raw`bool PeerPrepareStartup(napi_env env,PeerPair* p,Owner* host,const BootstrapPacket& oldPacket,Handle& inheritedWitness,BootstrapPacket& packet){
 std::wstring names[peerLaneCount];if(!p||!PeerPacketNames(oldPacket,names)){Refuse(env,"PEER_BOOTSTRAP_REFUSED");return false;}
 std::lock_guard<std::recursive_mutex> guard(p->lock);
 if(!p->server||p->retiring||p->bound||p->startupPrepared||p->ownerKey!=host||!PeerHeldCurrent(p->hostWitness)||!PeerHeldCurrent(p->mainWitness)){Refuse(env,"PEER_STARTUP_REFUSED");return false;}
 for(unsigned lane=0;lane<peerLaneCount;++lane)if(names[lane]!=p->lanes[lane].name){Refuse(env,"PEER_STARTUP_REFUSED");return false;}
 if(!PeerDuplicate(p->mainWitness.process.h,peerProcessRights,inheritedWitness,true)){Refuse(env,"PEER_WITNESS_DUPLICATE_FAILED");return false;}
 const unsigned char magic[8]={'S','I','R','E','N','T','P','3'};packet.bytes.assign(magic,magic+8);
 uint64_t value=static_cast<uint64_t>(reinterpret_cast<ULONG_PTR>(inheritedWitness.h));for(int i=7;i>=0;--i)packet.bytes.push_back(static_cast<unsigned char>(value>>(i*8)));
 packet.bytes.insert(packet.bytes.end(),oldPacket.bytes.begin(),oldPacket.bytes.end());p->startupPrepared=true;return true;
}
`;

export function deriveThreeLaneEndpointOwnership({source,binding,endpointSource}={}){
 for(const [text,pin] of [[source,SOURCE],[binding,BINDING],[endpointSource,ENDPOINT]])assert.ok(typeof text==='string'&&hash(text)===pin,'THREE_LANE_SOURCE_DRIFT');
 // Parent ownership embeds both CRLF and LF spans. Preserve untouched spans
 // byte-for-byte rather than normalizing its legacy startup/cleanup bodies.
 let s=source,e=endpointSource.replaceAll('\r\n','\n');
 s=replace(s,'const napi_type_tag tag={0x506eb4ba9e124a07ULL,0x880cfe94dbdc69a1ULL};','const napi_type_tag tag={0x334c414e454f574eULL,0x2026100800030001ULL};');
 s=replace(s,'const napi_type_tag sessionTag={0x5147b03e90e54fe1ULL,0x90d743423aef5889ULL};','const napi_type_tag sessionTag={0x334c414e45534553ULL,0x2026100800030002ULL};');
 s=replace(s,'struct BootstrapPipe {',bootstrapReader+'struct BootstrapPipe {');
 const begin='napi_value CreatePeerSession(',end='napi_value CreateBootstrappedSession(';
 const a=s.indexOf(begin),b=s.indexOf(end);assert.ok(a>=0&&b>a,'THREE_LANE_SOURCE_ANCHOR_DRIFT');
 const old=s.slice(a,b),next=replace(old,'!ReadBootstrap(env,a[4],packet)','!ReadThreeLaneBootstrap(env,a[4],packet)');s=replace(s,old,next);
 s=replace(s,'// Peer endpoint candidate. Separate artifact and actual Windows qualification required.','// Three-lane native source candidate. Separate Windows qualification required; NOT_ADMITTED.');
 e=replace(e,'// Closing either endpoint deliberately retires its complete two-lane pair.','// Closing any endpoint deliberately retires its complete three-lane group.');
 for(const [oldTag,newTag] of [['0x2026100800010001ULL','0x2026100800030003ULL'],['0x2026100800010002ULL','0x2026100800030004ULL'],['0x2026100800010003ULL','0x2026100800030005ULL']])e=replace(e,oldTag,newTag);
 e=replace(e,'constexpr size_t peerReadLimit=32768,peerWriteLimits[2]={2048,90120};',String.raw`constexpr unsigned peerLaneCount=3;
const char* const PeerLaneNames[peerLaneCount]={"control","history","command"};
constexpr DWORD peerWaitLimit=1+2*peerLaneCount+2;
static_assert(peerWaitLimit==9,"Three-lane main wait capacity must be nine");
constexpr size_t peerReadLimit=32768,peerWriteLimits[peerLaneCount]={2048,90120,90120};`);
 e=replace(e,'peerWriteCountLimit=32,peerCloseCountLimit=32,peerRequestLimit=100','peerWriteCountLimit=32,peerCloseCountLimit=32,peerRequestLimit=134');
 e=replace(e,'PeerLane lanes[2]','PeerLane lanes[peerLaneCount]');
 e=replace(e,'lane>1','lane>=peerLaneCount');
 e=replace(e,'struct PeerCapability {',String.raw`bool PeerAllConnectedLocked(PeerPair* p){for(auto& lane:p->lanes)if(!lane.connected)return false;return true;}
struct PeerCapability {`);
 e=replace(e,'// A consumed witness may be released after both lanes connected; the pair','// A consumed witness may be released after all three lanes connected; the group');
 e=replace(e,'cap->type==&peerWitnessTag&&cap->pair->lanes[0].connected&&cap->pair->lanes[1].connected','cap->type==&peerWitnessTag&&PeerAllConnectedLocked(cap->pair.get())');
 e=replace(e,'if(name==L"control"){lane=0;return true;}if(name==L"history"){lane=1;return true;}return false;','if(name==L"control"){lane=0;return true;}if(name==L"history"){lane=1;return true;}if(name==L"command"){lane=2;return true;}return false;');
 e=block(e,'bool PeerName(','// A single non-inherited',names);
 e=block(e,'DWORD WINAPI PeerWorker(','std::shared_ptr<PeerPair> PeerNewPair(',worker);
 e=block(e,'napi_value PeerCreateListeners(','bool PeerPrepareStartup(',listeners);
 e=block(e,'bool PeerPrepareStartup(','bool PeerBindCreator(',prepare);
 e=replace(e,'if(size<96||size>2064)','if(size<130||size>2064)');
 e=replace(e,"const unsigned char magic[8]={'S','I','R','E','N','T','P','2'};","const unsigned char magic[8]={'S','I','R','E','N','T','P','3'};");
 e=replace(e,'BootstrapPacket oldPacket;if(!ReadBootstrap(env,payload,oldPacket))','BootstrapPacket oldPacket;if(!ReadThreeLaneBootstrap(env,payload,oldPacket))');
 e=replace(e,'std::wstring control,history;if(!PeerPacketNames(oldPacket,control,history))','std::wstring names[peerLaneCount];if(!PeerPacketNames(oldPacket,names))');
 e=replace(e,'p->bound=true;p->mainPid=pid;p->creatorPid=GetCurrentProcessId();p->lanes[0].name=control;p->lanes[1].name=history;PeerObserveLocked(p.get());','p->bound=true;p->mainPid=pid;p->creatorPid=GetCurrentProcessId();for(unsigned lane=0;lane<peerLaneCount;++lane)p->lanes[lane].name=names[lane];PeerObserveLocked(p.get());');
 e=replace(e,'if(PeerReadOccupiedLocked(p.get(),cap->lane))return Refuse(env,"PEER_READ_BUSY");auto r=',String.raw`if(PeerReadOccupiedLocked(p.get(),cap->lane))return Refuse(env,"PEER_READ_BUSY");
 if(p->requests.size()>=peerRequestLimit)return Refuse(env,"PEER_REQUEST_CAPACITY");auto r=`);
 e=replace(e,'auto r=std::make_shared<PeerRequest>(PeerRequestKind::Write);r->lane=',String.raw`if(p->requests.size()>=peerRequestLimit)return Refuse(env,"PEER_REQUEST_CAPACITY");
 auto r=std::make_shared<PeerRequest>(PeerRequestKind::Write);r->lane=`);
 e=replace(e,'if(!cap->pair->lanes[0].connected||!cap->pair->lanes[1].connected)PeerRetireLocked','if(!PeerAllConnectedLocked(cap->pair.get()))PeerRetireLocked');
 e=replace(e,'cap->lane==0?"control":"history"','PeerLaneNames[cap->lane]');
 const build=JSON.parse(binding);assert.equal(build.targets[0].target_name,'siren_terminal_creator_peer','THREE_LANE_SOURCE_ANCHOR_DRIFT');build.targets[0].target_name='siren_terminal_creator_three_lane';
 // The standalone original include has CRLF; reconstruction preserves it.
 e=e.replaceAll('\n','\r\n');
 return Object.freeze({source:s,binding:build,endpointSource:e,sha256:hash(s),endpointSha256:hash(e),baseSha256:SOURCE,baseBindingSha256:BINDING,baseEndpointSha256:ENDPOINT,compiled:false,admitted:false});
}
