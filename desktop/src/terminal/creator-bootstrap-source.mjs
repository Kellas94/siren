// Pure pinned source preparation. No compiler, native loader or process launch.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex');
const BASE_SOURCE='f0de9350b5f3ee66df6f989e43e6a70e397144cb4a2d29010e2ce93002fdef3f';
const BASE_BINDING='e9c2927fe014c1a12a9357cfcf8da8a98ded95caf6c910a923b6aacd34063366';
const helpers=String.raw`// Separate bounded stdin bootstrap; source-only until new native qualification.
struct BootstrapPacket {
 std::vector<unsigned char> bytes;
 ~BootstrapPacket(){if(!bytes.empty())SecureZeroMemory(bytes.data(),bytes.size());}
};
bool BootstrapId(const unsigned char* p,size_t size){
 if(size==0||size>128)return false;
 for(size_t i=0;i<size;++i){unsigned char c=p[i];bool alnum=(c>='a'&&c<='z')||(c>='0'&&c<='9');if(!alnum&&(i==0||(c!='_'&&c!='-')))return false;}return true;
}
bool BootstrapName(const unsigned char* p,size_t size,const char* prefix){
 size_t n=std::char_traits<char>::length(prefix);if(size!=n+32)return false;
 for(size_t i=0;i<n;++i)if(p[i]!=static_cast<unsigned char>(prefix[i]))return false;
 for(size_t i=n;i<size;++i)if(!((p[i]>='0'&&p[i]<='9')||(p[i]>='a'&&p[i]<='f')))return false;return true;
}
bool ReadBootstrap(napi_env env,napi_value value,BootstrapPacket& packet){
 bool buffer=false;void* data=nullptr;size_t size=0;
 if(napi_is_buffer(env,value,&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,value,&data,&size)!=napi_ok||!data||size<80||size>2048)return false;
 auto* p=static_cast<unsigned char*>(data);const char magic[]="SIRENTB1";
 for(size_t i=0;i<8;++i)if(p[i]!=static_cast<unsigned char>(magic[i]))return false;
 size_t offset=16;const unsigned char* fields[4];size_t lengths[4];
 for(size_t i=0;i<4;++i){size_t n=(static_cast<size_t>(p[8+i*2])<<8)|p[9+i*2];if(n==0||n>size-64-offset)return false;fields[i]=p+offset;lengths[i]=n;offset+=n;}
 if(offset+64!=size||!BootstrapId(fields[0],lengths[0])||!BootstrapId(fields[1],lengths[1])||!BootstrapName(fields[2],lengths[2],"\\\\.\\pipe\\siren-terminal-control-")||!BootstrapName(fields[3],lengths[3],"\\\\.\\pipe\\siren-terminal-data-"))return false;
 unsigned char control=0,channel=0,different=0;for(size_t i=0;i<32;++i){control|=p[offset+i];channel|=p[offset+32+i];different|=p[offset+i]^p[offset+32+i];}
 if(control==0||channel==0||different==0)return false;packet.bytes.assign(p,p+size);return true;
}
struct BootstrapPipe {
 Handle read,write,discard;
 bool Init(){
  SECURITY_ATTRIBUTES security{};security.nLength=sizeof(security);security.bInheritHandle=TRUE;
  HANDLE reader=nullptr,writer=nullptr;if(!CreatePipe(&reader,&writer,&security,4096))return false;
  read=Handle(reader);write=Handle(writer);if(!SetHandleInformation(write.h,HANDLE_FLAG_INHERIT,0))return false;
  HANDLE sink=CreateFileW(L"NUL",GENERIC_WRITE,FILE_SHARE_READ|FILE_SHARE_WRITE,&security,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr);
  if(sink==INVALID_HANDLE_VALUE)return false;discard=Handle(sink);return true;
 }
 bool Fill(const std::vector<unsigned char>& bytes){
  DWORD written=0;BOOL ok=WriteFile(write.h,bytes.data(),static_cast<DWORD>(bytes.size()),&written,nullptr);
  write=Handle();return ok&&written==bytes.size();
 }
};
`;
const attributes=String.raw` bool InitBootstrap(HANDLE* jobs,HANDLE* inherited){
  SIZE_T size=0;InitializeProcThreadAttributeList(nullptr,2,0,&size);
  if(size==0||size>65536)return false;bytes.resize(size);
  auto* p=reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(bytes.data());
  if(!InitializeProcThreadAttributeList(p,2,0,&size))return false;list=p;
  return UpdateProcThreadAttribute(list,0,PROC_THREAD_ATTRIBUTE_JOB_LIST,jobs,2*sizeof(HANDLE),nullptr,nullptr)&&UpdateProcThreadAttribute(list,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,inherited,2*sizeof(HANDLE),nullptr,nullptr);
 }
`;
function once(source,old,replacement){assert.equal(source.split(old).length,2,'BOOTSTRAP_ANCHOR_DRIFT');return source.replace(old,()=>replacement);}
export function deriveBootstrappedOwnership({source,binding}={}){
 assert.equal(typeof source,'string','BOOTSTRAP_SOURCE_DRIFT');assert.equal(typeof binding,'string','BOOTSTRAP_SOURCE_DRIFT');
 assert.equal(digest(source),BASE_SOURCE,'BOOTSTRAP_SOURCE_DRIFT');assert.equal(digest(binding),BASE_BINDING,'BOOTSTRAP_SOURCE_DRIFT');
 const start=source.indexOf('napi_value CreateSession('),end=source.indexOf('napi_value WatchRoot(');assert.ok(start>=0&&end>start,'BOOTSTRAP_ANCHOR_DRIFT');
 let boot=source.slice(start,end);
 boot=once(boot,'CreateSession(','CreateBootstrappedSession(');
 boot=once(boot,'napi_value a[4];if(!Args(env,info,4,a))return nullptr;','napi_value a[5];if(!Args(env,info,5,a))return nullptr;\n BootstrapPacket packet;if(!ReadBootstrap(env,a[4],packet))return Refuse(env,"SESSION_BOOTSTRAP_REFUSED");');
 boot=once(boot,'HANDLE jobs[]={host->job.h,p->job.h};Attributes attributes;if(!attributes.Init(jobs))', 'BootstrapPipe bootstrap;if(!bootstrap.Init())return Refuse(env,"SESSION_BOOTSTRAP_PIPE_FAILED");\n HANDLE inherited[]={bootstrap.read.h,bootstrap.discard.h};\n HANDLE jobs[]={host->job.h,p->job.h};Attributes attributes;if(!attributes.InitBootstrap(jobs,inherited))');
 boot=once(boot,'PROCESS_INFORMATION child{};','PROCESS_INFORMATION child{};\n si.StartupInfo.dwFlags|=STARTF_USESTDHANDLES;si.StartupInfo.hStdInput=bootstrap.read.h;si.StartupInfo.hStdOutput=bootstrap.discard.h;si.StartupInfo.hStdError=bootstrap.discard.h;');
 boot=once(boot,'command.data(),nullptr,nullptr,FALSE,','command.data(),nullptr,nullptr,TRUE,');
 boot=once(boot,'p->root.process=Handle(child.hProcess);','bootstrap.read=Handle();bootstrap.discard=Handle();\n p->root.process=Handle(child.hProcess);');
 boot=once(boot,'if(!RegisterWaitForSingleObject(&p->wait,','if(!bootstrap.Fill(packet.bytes))return abort("SESSION_BOOTSTRAP_WRITE_FAILED");\n if(!RegisterWaitForSingleObject(&p->wait,');
 let derived=once(source,'napi_value WatchRoot(',boot+'napi_value WatchRoot(');
 derived=once(derived,'size_t count=5;napi_value args[5];','size_t count=6;napi_value args[6];');
 derived=once(derived,'struct Attributes {',helpers+'struct Attributes {');
 derived=once(derived,'};\nnapi_value SessionSnapshot(',attributes+'};\nnapi_value SessionSnapshot(');
 derived=once(derived,'  {"createSession",','  {"createBootstrappedSession",nullptr,CreateBootstrappedSession,nullptr,nullptr,nullptr,napi_default,nullptr},\n  {"createSession",');
 const build=JSON.parse(binding);build.targets[0].target_name='siren_terminal_creator_bootstrap';
 return Object.freeze({source:derived,binding:build,sha256:digest(derived),baseSha256:BASE_SOURCE,baseBindingSha256:BASE_BINDING,compiled:false,admitted:false});
}
