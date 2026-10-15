// Pure wire preparation. No startup state machine, native load or process spawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const api=await import('../src/terminal/startup-protocol.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const hash=b=>createHash('sha256').update(b).digest('hex');
const scope={sessionId:'session1',channelId:'channel1'};
const executable='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const policy={privateEnvironmentKeys:['APP_ACCOUNT_TOKEN'],expectedExecutable:executable};
function envelope(){return {version:1,...scope,projectId:'project1',startupId:'startup1',admissionEpoch:3,profileId:'powershell',cwd:'C:\\Work Ω\\project',shell:{executable,args:['-NoLogo','-NoProfile'],env:{SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32',TEMP:'C:\\Temp','ProgramFiles(x86)':'C:\\Program Files (x86)',USERNAME:'human'}},cols:80,rows:24};}
function required(){for(const name of ['validateStartupEnvelope','encodeStartupEnvelope','decodeStartupEnvelope','encodeStartupRequest','decodeStartupRequest','encodeStartupReply','validateStartupReply'])assert.equal(typeof api[name],'function',name+' must exist');}
function encoded(value=envelope()){required();const r=api.encodeStartupEnvelope(value,policy);assert.ok(r);return r;}
function begin(value=encoded()){return {type:'startup-begin',version:value.version,sessionId:value.sessionId,channelId:value.channelId,startupId:value.startupId,totalBytes:value.totalBytes,chunkCount:value.chunkCount,sha256:value.sha256};}
const common=b=>({version:b.version,sessionId:b.sessionId,channelId:b.channelId,startupId:b.startupId,sha256:b.sha256});
function chunk(b,index,data){return {...b,type:'startup-chunk',index,data};}
const clone=v=>JSON.parse(JSON.stringify(v));

test('startup protocol exposes finite profile-aligned limits without execution authority',()=>{
 required();assert.equal(api.STARTUP_LIMITS.totalBytes,1048576);assert.equal(api.STARTUP_LIMITS.chunkBytes,16384);assert.equal(api.STARTUP_LIMITS.chunks,64);
 assert.equal(api.STARTUP_LIMITS.envKeys,512);assert.equal(api.STARTUP_LIMITS.envKeyUnits,128);assert.equal(api.STARTUP_LIMITS.envValueUnits,32768);assert.equal(api.STARTUP_LIMITS.envBytes,262144);assert.equal(api.STARTUP_LIMITS.deadlineMs,10000);assert.ok(Object.isFrozen(api.STARTUP_LIMITS));
 assert.ok(Object.isFrozen(api.STARTUP_FAILURE_CODES));assert.ok(api.STARTUP_FAILURE_CODES.includes('STARTUP_AMBIGUOUS'));assert.ok(api.STARTUP_FAILURE_CODES.includes('STARTUP_UNAVAILABLE'));
});
test('envelope validation captures immutable DATA with fixed PowerShell arguments and canonical paths',()=>{
 required();const original=envelope(),r=api.validateStartupEnvelope(original,policy);assert.ok(r);assert.equal(r.shell.executable,executable);assert.deepEqual(r.shell.args,['-NoLogo','-NoProfile']);
 for(const value of [r,r.shell,r.shell.args,r.shell.env])assert.ok(Object.isFrozen(value));
 original.shell.env.PATH='changed';original.shell.args[0]='-Command';assert.equal(r.shell.env.PATH,'C:\\Windows\\System32');assert.equal(r.shell.args[0],'-NoLogo');
});
test('envelope refuses extra/missing version identity scope epoch dimensions and arbitrary commands',()=>{
 required();for(const bad of [{...envelope(),command:'PRIVATE_SECRET'},{...envelope(),version:2},{...envelope(),sessionId:'Bad ID'},{...envelope(),admissionEpoch:0},{...envelope(),cols:1},{...envelope(),cols:501},{...envelope(),rows:0},{...envelope(),rows:201},{...envelope(),profileId:'cmd'}])assert.equal(api.validateStartupEnvelope(bad,policy),null);
 for(const key of Object.keys(envelope())){const bad=envelope();delete bad[key];assert.equal(api.validateStartupEnvelope(bad,policy),null,key);}
 for(const cols of [2,500])for(const rows of [1,200])assert.ok(api.validateStartupEnvelope({...envelope(),cols,rows},policy));
});
test('canonical local paths reject UNC devices ADS separators dot traversal trailing forms NUL and malformed UTF16',()=>{
 required();for(const path of ['relative','C:relative','\\\\server\\share','\\\\?\\C:\\Work','C:/Work','C:\\Work\\..\\next','C:\\Work\\.\\next','C:\\Work\\\\next','C:\\Work\\','C:\\COM¹','C:\\NUL.txt','C:\\CONOUT$','C:\\Work.','C:\\Work ','C:\\Work:stream','C:\\bad\0path','C:\\bad\ud800'])assert.equal(api.validateStartupEnvelope({...envelope(),cwd:path},policy),null,path);
 assert.ok(api.validateStartupEnvelope({...envelope(),cwd:'C:\\'},policy));
 for(const path of ['C:\\Tools\\cmd.exe','C:\\Tools\\powershell.exe','C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\evil.exe']){const e=envelope();e.shell.executable=path;assert.equal(api.validateStartupEnvelope(e,policy),null);}
 const e=envelope();e.shell.executable='D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';assert.equal(api.validateStartupEnvelope(e,policy),null);assert.ok(api.validateStartupEnvelope(e));
});
test('fixed argument array rejects commands holes extra keys accessors subclasses and Proxies without traps',()=>{
 required();let traps=0;const hostile=new Proxy([],new Proxy({},{get(){return ()=>{traps++;throw Error('PRIVATE_SECRET');};}}));
 const accessed=['-NoLogo','-NoProfile'];Object.defineProperty(accessed,'0',{enumerable:true,get(){traps++;return '-NoLogo';}});
 for(const args of [['-NoLogo','-NoProfile','-Command','x'],['-nologo','-NoProfile'],Array(2),Object.assign(['-NoLogo','-NoProfile'],{extra:1}),accessed,hostile]){const e=envelope();e.shell.args=args;assert.equal(api.validateStartupEnvelope(e,policy),null);}
 assert.equal(traps,0);
});
test('nested Proxy and accessor records and policies are refused without executing traps',()=>{
 required();let traps=0;const p=new Proxy({},{ownKeys(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();},getOwnPropertyDescriptor(){traps++;throw Error();},get(){traps++;throw Error();}});
 for(const value of [p,Object.create(p)])assert.equal(api.validateStartupEnvelope(value,policy),null);
 for(const key of ['shell']){const e=envelope();e[key]=p;assert.equal(api.validateStartupEnvelope(e,policy),null);}
 const e=envelope();e.shell.env=p;assert.equal(api.validateStartupEnvelope(e,policy),null);
 const a=envelope();Object.defineProperty(a,'cwd',{enumerable:true,get(){traps++;return 'C:\\Work';}});assert.equal(api.validateStartupEnvelope(a,policy),null);
 assert.equal(api.validateStartupEnvelope(envelope(),p),null);assert.equal(api.validateStartupEnvelope(envelope(),{privateEnvironmentKeys:p}),null);
 assert.equal(traps,0);
});
test('environment rejects injection and configured private names rather than silently stripping them',()=>{
 required();for(const name of ['NODE_OPTIONS','nOdE_pAtH','ELECTRON_RUN_AS_NODE','VSCODE_INJECTION','SIREN_PIN','CHROME_LOG_FILE','PSModulePath','app_account_token']){const e=envelope();e.shell.env[name]='PRIVATE_SECRET';assert.equal(api.validateStartupEnvelope(e,policy),null,name);}
 const e=envelope();e.shell.env.CUSTOM='allowed';assert.ok(api.validateStartupEnvelope(e,policy));
});
test('environment validates key value count aggregate case-folding and required OS fields',()=>{
 required();for(const env of [{PATH:'a',Path:'b',SystemRoot:'C:\\Windows'},{PATH:'x'},{SystemRoot:'C:\\Windows'},{PATH:'',SystemRoot:'C:\\Windows'},{PATH:1,SystemRoot:'C:\\Windows'},{PATH:'bad\0value',SystemRoot:'C:\\Windows'},{PATH:'bad\ud800',SystemRoot:'C:\\Windows'},{PATH:'x'.repeat(32769),SystemRoot:'C:\\Windows'},{'BAD=KEY':'x',PATH:'x',SystemRoot:'C:\\Windows'}]){const e=envelope();e.shell.env=env;assert.equal(api.validateStartupEnvelope(e,policy),null);}
 const e=envelope();e.shell.env={PATH:'x',SystemRoot:'C:\\Windows',...Object.fromEntries(Array.from({length:511},(_,i)=>['VAR_'+i,'x']))};assert.equal(api.validateStartupEnvelope(e,policy),null);
 const total=envelope();total.shell.env={PATH:'x',SystemRoot:'C:\\Windows',...Object.fromEntries(Array.from({length:9},(_,i)=>['VAR_'+i,'x'.repeat(32768)]))};assert.equal(api.validateStartupEnvelope(total,policy),null);
 const boundary=envelope();boundary.shell.env={PATH:'x',SystemRoot:'C:\\Windows',...Object.fromEntries(Array.from({length:510},(_,i)=>['VAR_'+i,'x']))};assert.ok(api.validateStartupEnvelope(boundary,policy));
});
test('policy exact DATA validates bounded private keys and optional resolved executable without native claims',()=>{
 required();for(const p of [{privateEnvironmentKeys:['BAD=KEY']},{privateEnvironmentKeys:Array(129).fill('KEY')},{privateEnvironmentKeys:[],extra:true},{privateEnvironmentKeys:[],expectedExecutable:'relative'},{privateEnvironmentKeys:[],expectedExecutable:'C:\\cmd.exe'}])assert.equal(api.validateStartupEnvelope(envelope(),p),null);
 assert.ok(api.validateStartupEnvelope(envelope(),{privateEnvironmentKeys:[]}));assert.ok(api.validateStartupEnvelope(envelope(),{privateEnvironmentKeys:[],expectedExecutable:executable.toLowerCase()}));
});
test('encoding is canonical stable owned UTF8 metadata and dispose wipes only its own buffer',()=>{
 const e=envelope(),a=encoded(e),b=encoded(clone(e));assert.ok(Object.isFrozen(a));assert.equal(a.sha256,hash(a.bytes));assert.equal(a.totalBytes,a.bytes.length);assert.equal(a.chunkCount,Math.ceil(a.totalBytes/16384));assert.deepEqual(a.bytes,b.bytes);
 assert.equal(Object.keys(a).includes('bytes'),false);assert.equal(Object.keys(a).includes('dispose'),false);assert.ok(!JSON.stringify(a).includes('USERNAME'));
 assert.equal(a.dispose(),true);assert.equal(a.dispose(),true);assert.ok(a.bytes.every(v=>v===0));assert.ok(b.bytes.some(v=>v!==0));assert.equal(e.shell.env.USERNAME,'human');b.dispose();
});
test('JSON escaping is measured before body serialization or Buffer allocation on an oversized envelope',async()=>{
 required();const originalFrom=Buffer.from,originalAlloc=Buffer.alloc,originalJson=JSON.stringify;let copies=0,allocations=0,serializations=0;
 try{
  Buffer.from=function(...args){copies++;return Reflect.apply(originalFrom,Buffer,args);};Buffer.alloc=function(...args){allocations++;return Reflect.apply(originalAlloc,Buffer,args);};JSON.stringify=function(...args){serializations++;return Reflect.apply(originalJson,JSON,args);};
  const fresh=await import('../src/terminal/startup-protocol.mjs?preallocation-budget');copies=0;allocations=0;serializations=0;
  const e=envelope();for(let i=0;i<7;i++)e.shell.env['VAR_'+i]='\u0001'.repeat(32768);
  assert.equal(fresh.encodeStartupEnvelope(e,policy),null);assert.equal(copies,0);assert.equal(allocations,0);assert.equal(serializations,0);
 }finally{Buffer.from=originalFrom;Buffer.alloc=originalAlloc;JSON.stringify=originalJson;}
});
test('canonical decode binds exact bytes hash IDs and refuses noncanonical JSON duplicate fields and malformed UTF8',()=>{
 const r=encoded(),b=begin(r),decoded=api.decodeStartupEnvelope(r.bytes,b,policy);assert.ok(decoded);assert.equal(decoded.projectId,'project1');assert.equal(decoded.shell.env.USERNAME,'human');
 for(const bad of [{...b,sha256:'0'.repeat(64)},{...b,totalBytes:b.totalBytes+1},{...b,sessionId:'other'},{...b,startupId:'other'}])assert.equal(api.decodeStartupEnvelope(r.bytes,bad,policy),null);
 const text=r.bytes.toString('utf8');for(const altered of [' '+text,text.replace('"version":1','"version":1,"version":1')]){const bytes=Buffer.from(altered),meta={...b,totalBytes:bytes.length,chunkCount:Math.ceil(bytes.length/16384),sha256:hash(bytes)};assert.equal(api.decodeStartupEnvelope(bytes,meta,policy),null);}
 const invalid=Buffer.from([0xff]);assert.equal(api.decodeStartupEnvelope(invalid,{...b,totalBytes:1,chunkCount:1,sha256:hash(invalid)},policy),null);
 assert.ok(r.bytes.some(v=>v!==0),'Decode does not wipe caller-owned input');r.dispose();
});
test('begin metadata enforces finite total and exact ceil chunk count before any payload allocation',()=>{
 required();const b=begin();assert.ok(api.encodeStartupRequest(b,scope));
 for(const bad of [{...b,totalBytes:0},{...b,totalBytes:1048577},{...b,chunkCount:0},{...b,chunkCount:65},{...b,chunkCount:2},{...b,sha256:'A'.repeat(64)},{...b,extra:1},{...b,version:2}])assert.equal(api.encodeStartupRequest(bad,scope),null);
 assert.equal(api.encodeStartupRequest(b,{...scope,sessionId:'other'}),null);
 for(const totalBytes of [1,16384,16385,1048576]){const value={...b,totalBytes,chunkCount:Math.ceil(totalBytes/16384)};assert.ok(api.encodeStartupRequest(value,scope));}
});
test('chunk codecs bind full metadata canonical base64 exact index-derived length and separate owned bytes',()=>{
 const r=encoded(),b=begin(r),wire=api.encodeStartupRequest(chunk(b,0,r.bytes),b);assert.ok(wire);assert.ok(Object.isFrozen(wire));assert.equal(wire.dataBase64,r.bytes.toString('base64'));
 const decoded=api.decodeStartupRequest(wire,b);assert.ok(decoded);assert.deepEqual(decoded.data,r.bytes);decoded.data.fill(0);assert.ok(r.bytes.some(v=>v!==0));
 for(const bad of [{...wire,index:1},{...wire,index:-1},{...wire,totalBytes:wire.totalBytes+1},{...wire,chunkCount:2},{...wire,sha256:'0'.repeat(64)},{...wire,dataBase64:wire.dataBase64+'\n'},{...wire,dataBase64:'AA=='},{...wire,dataBase64:'AB=='},{...wire,dataBase64:'===='}])assert.equal(api.decodeStartupRequest(bad,b),null);
 const full={...b,totalBytes:16385,chunkCount:2};assert.ok(api.encodeStartupRequest(chunk(full,0,Buffer.alloc(16384)),full));assert.ok(api.encodeStartupRequest(chunk(full,1,Buffer.alloc(1)),full));assert.equal(api.encodeStartupRequest(chunk(full,1,Buffer.alloc(2)),full),null);r.dispose();
});
test('request schemas refuse unknown operations wrong bindings and accessors without generic dispatch',()=>{
 const b=begin();let reads=0;const seal={type:'startup-seal',...common(b)},start={type:'startup-start',...common(b),gateGeneration:1};
 for(const value of [seal,start]){assert.ok(api.encodeStartupRequest(value,b));assert.ok(api.decodeStartupRequest(value,b));assert.equal(api.encodeStartupRequest(value,scope),null);assert.equal(api.encodeStartupRequest({...value,sha256:'0'.repeat(64)},b),null);}
 assert.equal(api.encodeStartupRequest({...start,gateGeneration:0},b),null);assert.equal(api.encodeStartupRequest({...seal,type:'spawn'},b),null);
 const bad={...seal};Object.defineProperty(bad,'sha256',{enumerable:true,get(){reads++;return b.sha256;}});assert.equal(api.decodeStartupRequest(bad,b),null);assert.equal(reads,0);
});
test('fixed prepared ready and ACK replies correlate request phase hash scope index and gate',()=>{
 const b=begin(),seal={type:'startup-seal',...common(b)},start={type:'startup-start',...common(b),gateGeneration:7};
 const beginAck={type:'startup-begin-ack',...common(b),status:'accepted',code:'STARTUP_ACCEPTED'};assert.ok(api.validateStartupReply(beginAck,b));
 const prepared={type:'startup-prepared',...common(b),projectId:'project1',admissionEpoch:3,initiallyClosed:true,status:'accepted',code:'STARTUP_PREPARED'};assert.ok(api.encodeStartupReply(prepared,seal));assert.equal(api.validateStartupReply(prepared,b),null);assert.equal(api.validateStartupReply({...prepared,initiallyClosed:false},seal),null);
 const ready={type:'startup-ready',...common(b),gateGeneration:7,reportedShell:{pid:42,image:executable},status:'accepted',code:'STARTUP_READY'};const r=api.validateStartupReply(ready,start);assert.ok(r);assert.ok(Object.isFrozen(r.reportedShell));assert.equal(api.validateStartupReply({...ready,gateGeneration:8},start),null);
 for(const bad of [{...ready,sha256:'0'.repeat(64)},{...ready,sessionId:'other'},{...ready,reportedShell:{...ready.reportedShell,pid:0}},{...ready,reportedShell:{...ready.reportedShell,pid:4294967296}},{...ready,reportedShell:{...ready.reportedShell,createdFileTime:'133333333333333333'}},{...ready,reportedShell:{...ready.reportedShell,held:true}},{...ready,env:{SECRET:'x'}}])assert.equal(api.validateStartupReply(bad,start),null);
 const bytes=Buffer.alloc(b.totalBytes),wire=api.encodeStartupRequest(chunk(b,0,bytes),b),ack={type:'startup-chunk-ack',...common(b),index:0,status:'accepted',code:'STARTUP_ACCEPTED'};assert.ok(api.validateStartupReply(ack,wire));assert.equal(api.validateStartupReply({...ack,index:1},wire),null);
});
test('failure replies contain only fixed refusal codes and exact phase-bound metadata',()=>{
 const b=begin(),failure={type:'startup-failed',...common(b),phase:'begin',status:'failed',code:'STARTUP_REFUSED'};assert.ok(api.validateStartupReply(failure,b));
 for(const bad of [{...failure,code:'PRIVATE_SECRET'},{...failure,message:'PRIVATE_SECRET'},{...failure,phase:'start'},{...failure,status:'accepted'},{...failure,index:0}])assert.equal(api.validateStartupReply(bad,b),null);
 assert.equal(api.validateStartupReply(new Proxy({},{get(){throw Error('PRIVATE_SECRET');}}),b),null);
});

test('exact serialized 1 MiB envelope succeeds and the next escaped byte refuses',()=>{
 const e=envelope();e.shell.env={PATH:'x',SystemRoot:'C:\\Windows'};for(let i=0;i<6;i++)e.shell.env['PAD_'+i]='';
 const baseline=encoded(e),delta=1048576-baseline.totalBytes;baseline.dispose();let controls=Math.floor(delta/6);
 for(let i=0;i<6;i++){const n=Math.min(32768,controls);e.shell.env['PAD_'+i]='\u0001'.repeat(n);controls-=n;}
 assert.equal(controls,0);e.shell.env.PAD_5+='x'.repeat(delta%6);
 const r=encoded(e);assert.equal(r.totalBytes,1048576);assert.equal(r.chunkCount,64);assert.ok(api.decodeStartupEnvelope(r.bytes,begin(r),policy));r.dispose();
 e.shell.env.PAD_5+='x';assert.equal(api.encodeStartupEnvelope(e,policy)===null,true);assert.equal(api.validateStartupEnvelope(e,policy)===null,true);
});

test('Buffer intake refuses Proxy prototypes and ignores caller accessors without traps',()=>{
 const r=encoded(),b=begin(r);let traps=0;const p=new Proxy(Buffer.prototype,{get(){traps++;throw Error('PRIVATE_SECRET');},getPrototypeOf(){traps++;throw Error('PRIVATE_SECRET');}});
 const changed=Buffer.from(r.bytes);Object.setPrototypeOf(changed,p);const fake=Object.create(p);
 for(const bad of [changed,fake,new Proxy(Buffer.from(r.bytes),{get(){traps++;throw Error('PRIVATE_SECRET');}})]){assert.equal(api.decodeStartupEnvelope(bad,b,policy),null);assert.equal(api.encodeStartupRequest(chunk(b,0,bad),b),null);}
 const actual=Buffer.from(r.bytes);for(const key of ['length','copy','buffer','toString'])Object.defineProperty(actual,key,{get(){traps++;throw Error('PRIVATE_SECRET');}});
 assert.ok(api.decodeStartupEnvelope(actual,b,policy));assert.ok(api.encodeStartupRequest(chunk(b,0,actual),b));assert.equal(traps,0);r.dispose();
});

test('base64 pad bits and returned semantic ownership are strict at one-byte chunk boundary',()=>{
 const b={...begin(),totalBytes:1,chunkCount:1},wire={...b,type:'startup-chunk',index:0,dataBase64:'AA=='};
 const decoded=api.decodeStartupRequest(wire,b);assert.ok(decoded);assert.deepEqual(decoded.data,Buffer.from([0]));decoded.data.fill(0);
 assert.equal(api.decodeStartupRequest({...wire,dataBase64:'AB=='},b),null);assert.equal(api.decodeStartupRequest({...wire,dataBase64:'AA'},b),null);
});

test('ready image is unverified and the complete fixed reply must fit its frame budget',()=>{
 const b=begin(),start={type:'startup-start',...common(b),gateGeneration:1},reportedShell={pid:1,image:'C:\\'+('a\\'.repeat(16000))+'WindowsPowerShell\\v1.0\\powershell.exe'};
 const reply={type:'startup-ready',...common(b),gateGeneration:1,reportedShell,status:'accepted',code:'STARTUP_READY'};
 assert.ok(reportedShell.image.length<32768);assert.ok(Buffer.byteLength(JSON.stringify(reply),'utf8')>45056);assert.equal(api.validateStartupReply(reply,start)===null,true);assert.equal(api.encodeStartupReply(reply,start)===null,true);
});
