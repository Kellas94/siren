// Deterministic, separate native candidate preparation. No compilation/loading.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const SOURCE='69b6780f6edf1fa838f97fbf0835a819d9433d01dbf6a4460f8294336c090659';
const BINDING='8d2847b9e34fa5466d16a2f53e94c795ab7f745d49967752e39789072eee4751';
const ENDPOINT='9cbbaa14ea8a2274141051c99d800463ab47b2f0d19dc5cddf5877999233e8bf';
function once(s,old,next){assert.equal(s.split(old).length,2,'PEER_SOURCE_ANCHOR_DRIFT');return s.replace(old,()=>next);}
const inheritedAttributes=String.raw` bool InitPeerBootstrap(HANDLE* jobs,HANDLE* inherited){
  SIZE_T size=0;InitializeProcThreadAttributeList(nullptr,2,0,&size);
  if(size==0||size>65536)return false;bytes.resize(size);
  auto* p=reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(bytes.data());
  if(!InitializeProcThreadAttributeList(p,2,0,&size))return false;list=p;
  return UpdateProcThreadAttribute(list,0,PROC_THREAD_ATTRIBUTE_JOB_LIST,jobs,2*sizeof(HANDLE),nullptr,nullptr)&&UpdateProcThreadAttribute(list,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,inherited,3*sizeof(HANDLE),nullptr,nullptr);
 }
`;
const exports=[
 ['createPeerSession','CreatePeerSession'],['createPeerListeners','PeerCreateListeners'],
 ['acceptPeerLane','PeerAcceptLane'],['connectPeerLane','PeerConnectLane'],
 ['peerRead','PeerRead'],['peerWrite','PeerWrite'],['assertPeerCurrent','PeerAssertCurrent'],
 ['closePeerEndpoint','PeerCloseEndpoint'],['closePeerListeners','PeerCloseListeners'],
 ['peerSnapshot','PeerSnapshot'],['consumePeerBootstrap','PeerConsumeBootstrap'],['closePeerWitness','PeerCloseWitness']
].map(([name,fn])=>'  {"'+name+'",nullptr,'+fn+',nullptr,nullptr,nullptr,napi_default,nullptr},\n').join('');
export function derivePeerEndpointOwnership({source,binding,endpointSource}={}){
 for(const [text,pin] of [[source,SOURCE],[binding,BINDING],[endpointSource,ENDPOINT]]){
  assert.equal(typeof text,'string','PEER_SOURCE_DRIFT');assert.equal(hash(text),pin,'PEER_SOURCE_DRIFT');
 }
 const start=source.indexOf('napi_value CreateBootstrappedSession('),end=source.indexOf('// Cleanup only:',start);
 assert.ok(start>=0&&end>start,'PEER_SOURCE_ANCHOR_DRIFT');
 let peer=source.slice(start,end).replace('CreateBootstrappedSession(','CreatePeerSession(');
 peer=once(peer,'napi_value a[5];if(!Args(env,info,5,a))','napi_value a[6];if(!Args(env,info,6,a))');
 peer=once(peer,' auto* host=Get(env,a[0]);if(!host)return nullptr;',String.raw` auto* pair=PeerPairGet(env,a[5]);if(!pair)return nullptr;
 struct Guard {PeerPair* pair;bool committed=false;~Guard(){if(!committed)PeerAbortStartup(pair);}} guard{pair};
 auto* host=Get(env,a[0]);if(!host)return nullptr;`);
 peer=once(peer,' HANDLE inherited[]={bootstrap.read.h,bootstrap.discard.h};',String.raw` Handle inheritedWitness;BootstrapPacket peerPacket;
 if(!PeerPrepareStartup(env,pair,host,packet,inheritedWitness,peerPacket))return Refuse(env,"PEER_STARTUP_REFUSED");
 HANDLE inherited[]={bootstrap.read.h,bootstrap.discard.h,inheritedWitness.h};`);
 peer=once(peer,'attributes.InitBootstrap(jobs,inherited)','attributes.InitPeerBootstrap(jobs,inherited)');
 peer=once(peer,' bootstrap.read=Handle();bootstrap.discard=Handle();',' bootstrap.read=Handle();bootstrap.discard=Handle();inheritedWitness=Handle();');
 peer=once(peer,' if(!bootstrap.Fill(packet.bytes))',String.raw` if(!PeerBindCreator(env,pair,p.get()))return abort("PEER_CREATOR_BINDING_REFUSED");
 if(!bootstrap.Fill(peerPacket.bytes))`);
 peer=once(peer,' ++sessionCount;p->counted=true;p.release();return object;',' guard.committed=true;++sessionCount;p->counted=true;p.release();return object;');
 let s=once(source,'struct Owner {','struct Owner;struct Session;\nvoid PeerRetireOwner(Owner*);void PeerRetireSession(Session*);\nstruct Owner {');
 s=once(s,' bool Dispose(){',String.raw` bool Dispose(){
  // Query-only peer Job duplicates must never postpone required termination.
  PeerRetireOwner(this);if(job.h&&!TerminateJobObject(job.h,77))return false;`);
 s=once(s,' bool DisposeSession(){',' bool DisposeSession(){\n  PeerRetireSession(this);');
 // Fence copied endpoint lifetimes only once explicit Stop has committed.
 s=once(s,' work.release();return promise;',' PeerRetireSession(p);work.release();return promise;');
 s=once(s,' if(!TerminateJobObject(p->job.h,code))return Refuse(env,"SESSION_STOP_FAILED");p->stopping.store(true);return Boolean(env,true);',' if(!TerminateJobObject(p->job.h,code))return Refuse(env,"SESSION_STOP_FAILED");p->stopping.store(true);PeerRetireSession(p);return Boolean(env,true);');
 s=once(s,' p->stopping.store(true);return Boolean(env,true);',' p->stopping.store(true);PeerRetireOwner(p);return Boolean(env,true);');
 // Add a distinct three-handle method without changing legacy startup.
 s=once(s,'};\nnapi_value SessionSnapshot(',inheritedAttributes+'};\nnapi_value SessionSnapshot(');
 s=once(s,'napi_value CreateSession(','#include "peer-endpoints.inc"\n\nnapi_value CreateSession(');
 s=once(s,'napi_value CreateBootstrappedSession(',peer+'napi_value CreateBootstrappedSession(');
 s=once(s,'NAPI_MODULE_INIT(){','NAPI_MODULE_INIT(){\n if(!PeerInitialize(env))return Refuse(env,"PEER_ENVIRONMENT_FAILED");');
 s=once(s,' const napi_property_descriptor methods[]={',' const napi_property_descriptor methods[]={\n'+exports);
 s='// Peer endpoint candidate. Separate artifact and actual Windows qualification required.\n'+s;
 const build=JSON.parse(binding);build.targets[0].target_name='siren_terminal_creator_peer';
 build.targets[0].libraries.push('advapi32.lib');
 return Object.freeze({source:s,binding:build,endpointSource,sha256:hash(s),endpointSha256:ENDPOINT,baseSha256:SOURCE,baseBindingSha256:BINDING,compiled:false,admitted:false});
}
