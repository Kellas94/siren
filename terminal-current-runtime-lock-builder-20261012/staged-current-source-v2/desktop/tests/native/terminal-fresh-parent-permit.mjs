// Inactive fixed diagnostic IPC. HMAC continuity is not kernel peer identity.
import net from 'node:net';
import {createHash,randomBytes} from 'node:crypto';
import {types} from 'node:util';

const LIMIT=5000,PREFIX='\\\\.\\pipe\\siren-fresh-permit-';
const fail=()=>Error('FRESH_PREINPUT_PIPE_REFUSED');
const deadline=()=>Error('FRESH_PREINPUT_PIPE_DEADLINE');
function fields(value,keys){
 if(!value||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw fail();
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))throw fail();
 const out=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))throw fail();out[key]=d.value;}return out;
}
function challengeId(value){
 const c=fields(value,['schema','type','workerPid','creatorPid','shellPid','armId','token','nonce','rawSha256']);
 if(c.schema!==1||c.type!=='FRESH_PREINPUT_CHALLENGE'||![c.workerPid,c.creatorPid,c.shellPid].every(n=>Number.isSafeInteger(n)&&n>0)||!['pathext-omitted','pathext-trusted'].includes(c.armId)||!['token','nonce'].every(k=>typeof c[k]==='string'&&/^[a-f0-9]{32}$/.test(c[k]))||typeof c.rawSha256!=='string'||!/^[a-f0-9]{64}$/.test(c.rawSha256))throw fail();
 return createHash('sha256').update(JSON.stringify(c)).digest('hex');
}
function remaining(expires){const n=Math.floor(expires-performance.now());if(n<1)throw Error('FRESH_PREINPUT_PIPE_DEADLINE');return n;}
function endpoint(value){
 const b=fields(value,['pipeName','secretHex']);
 if(typeof b.pipeName!=='string'||!b.pipeName.startsWith(PREFIX)||!/^[a-f0-9]{32}$/.test(b.pipeName.slice(PREFIX.length))||typeof b.secretHex!=='string'||!/^[a-f0-9]{64}$/.test(b.secretHex))throw fail();return b;
}
export function consumeFreshParentPermitBootstrap(...extra){
 if(extra.length)throw fail();
 const keys=['SIREN_FRESH_PERMIT_PIPE','SIREN_FRESH_PERMIT_SECRET'],env=process.env;
 if(!env||types.isProxy(env))throw fail();
 const names=Reflect.ownKeys(env);if(names.length>4096||names.some(k=>typeof k!=='string'||keys.some(w=>k.toUpperCase()===w&&k!==w)))throw fail();
 const values=keys.map(k=>{const d=Object.getOwnPropertyDescriptor(env,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))throw fail();return d.value;});
 const b=endpoint({pipeName:values[0],secretHex:values[1]});
 for(const key of keys)if(!delete env[key]||Object.hasOwn(env,key))throw fail();
 return Object.freeze(b);
}
function closure(socket){
 let resolve,settled=false;const closed=new Promise(r=>resolve=r);socket.once('close',()=>{settled=true;resolve(true);});
 return async()=>{if(!settled)socket.destroy();if(settled)return true;let timer;try{return await Promise.race([closed,new Promise(r=>timer=setTimeout(()=>r(false),LIMIT))]);}finally{clearTimeout(timer);}};
}

export async function createFreshParentPermitServer(options){
 const {TerminalControlChannel}=fields(options,['TerminalControlChannel']);if(typeof TerminalControlChannel!=='function')throw fail();
 const secret=randomBytes(32),bootstrap=Object.freeze({pipeName:PREFIX+randomBytes(16).toString('hex'),secretHex:secret.toString('hex')});
 let socket,closeSocket,channel,channelId,expires,timer,invalid=false,begun=false,sent=false,acked=false,disposed=false,connections=0,rejectAck,resolveAck,resolveChannel;
 const attached=new Promise(resolve=>resolveChannel=resolve);
 const ack=new Promise((resolve,reject)=>{resolveAck=resolve;rejectAck=reject;});ack.catch(()=>{});
 const refusal=()=>begun&&performance.now()>=expires?deadline():fail();
 const refuse=()=>{invalid=true;rejectAck(refusal());resolveChannel(null);channel?.dispose();try{socket?.destroy();}catch{}};
 const attach=()=>{
  if(!socket||!begun||channel||invalid)return;
  try{
   channel=new TerminalControlChannel({stream:socket,role:'main',channelId,secret,deadlineMs:remaining(expires)});
   channel.subscribe({message:p=>{
    if(!sent||acked||p.channelId!==channelId||p.requestId!==1||p.generation!==0||p.open!==true||p.ok!==true||performance.now()>=expires){refuse();return;}
    acked=true;clearTimeout(timer);resolveAck(true);
   },closed:()=>{if(!acked)refuse();}});
   // Runs after the unchanged decoder. Partial trailing frames are extras too.
   socket.on('data',()=>{if(acked&&(!channel.isAvailable()||channel.stats().bufferedBytes!==0))refuse();});
   resolveChannel(channel);
  }catch{refuse();}
 };
 const server=net.createServer(s=>{if(++connections!==1||disposed||invalid){try{s.destroy();}catch{}refuse();return;}socket=s;closeSocket=closure(s);s.on('error',refuse);attach();});
 server.on('error',refuse);
 let startTimer,startExpired=false;try{await new Promise((resolve,reject)=>{server.once('error',()=>reject(fail()));startTimer=setTimeout(()=>{startExpired=true;reject(deadline());},LIMIT);server.listen(bootstrap.pipeName,resolve);});}catch{clearTimeout(startTimer);disposed=true;server.once('listening',()=>{try{server.close();}catch{}});let t;try{await new Promise(resolve=>{t=setTimeout(resolve,LIMIT);try{server.close(resolve);}catch{resolve();}});}finally{clearTimeout(t);secret.fill(0);}throw startExpired?deadline():fail();}finally{clearTimeout(startTimer);}
 let closePromise;
 const dispose=()=>{
  if(closePromise)return closePromise;disposed=true;if(!acked)refuse();clearTimeout(timer);channel?.dispose();secret.fill(0);
  closePromise=(async()=>{const socketClosed=closeSocket?await closeSocket():true;let t;try{const listenerClosed=await new Promise(resolve=>{t=setTimeout(()=>resolve(false),LIMIT);try{server.close(()=>resolve(true));}catch{resolve(false);}});return socketClosed&&listenerClosed;}finally{clearTimeout(t);}})();return closePromise;
 };
 return Object.freeze({bootstrap,
  begin(value){if(begun||disposed||invalid){refuse();throw fail();}channelId=challengeId(value);begun=true;expires=performance.now()+LIMIT;timer=setTimeout(refuse,LIMIT);attach();},
  async authorize(){if(!begun||sent||disposed||invalid){const e=refusal();refuse();throw e;}try{
   // A child may connect just after the stdout challenge; no new deadline.
   await attached;
   if(invalid||!await channel.ready||invalid)throw fail();remaining(expires);sent=true;
   if(!channel.send({channelId,requestId:1,generation:0,open:true}))throw fail();await ack;
   if(invalid||!acked)throw fail();remaining(expires);return true;
  }catch{const e=refusal();refuse();throw e;}},
  isCurrent(){return !disposed&&!invalid&&acked&&channel?.isAvailable()===true;},
  hasRefusal(){return invalid;},
  revoke(){refuse();},
  dispose
 });
}

export async function receiveFreshParentPermit(options){
 const {TerminalControlChannel,bootstrap,challenge}=fields(options,['TerminalControlChannel','bootstrap','challenge']);if(typeof TerminalControlChannel!=='function')throw fail();
 const b=endpoint(bootstrap),channelId=challengeId(challenge),startedMs=performance.now(),expires=startedMs+LIMIT,secret=Buffer.from(b.secretHex,'hex');
 let socket,channel,timer,invalid=false,seen=false,resolvePermit,rejectPermit,closeSocket;
 const permit=new Promise((resolve,reject)=>{resolvePermit=resolve;rejectPermit=reject;});permit.catch(()=>{});
 const refusal=()=>performance.now()>=expires?deadline():fail();
 const refuse=()=>{invalid=true;rejectPermit(refusal());channel?.dispose();try{socket?.destroy();}catch{}};
 try{
  socket=net.createConnection(b.pipeName);closeSocket=closure(socket);socket.on('error',refuse);socket.on('end',()=>{invalid=true;if(!seen)refuse();});
  channel=new TerminalControlChannel({stream:socket,role:'creator',channelId,secret,deadlineMs:remaining(expires)});secret.fill(0);
  channel.subscribe({message:p=>{
   if(seen||p.channelId!==channelId||p.requestId!==1||p.generation!==0||p.open!==true||performance.now()>=expires){refuse();return;}
   seen=true;if(!channel.send({channelId,requestId:1,generation:0,open:true,ok:true})){refuse();return;}resolvePermit(true);
  },closed:()=>{invalid=true;if(!seen)refuse();}});
  socket.on('data',()=>{if(seen&&(!channel.isAvailable()||channel.stats().bufferedBytes!==0))refuse();});
  timer=setTimeout(refuse,remaining(expires));
  process.stdout.write('SIREN_FRESH_PREINPUT '+JSON.stringify(challenge)+'\n');
  if(!await channel.ready)throw fail();await permit;remaining(expires);if(invalid||!seen)throw fail();clearTimeout(timer);
  return Object.freeze({startedMs,endedMs:performance.now(),isCurrent:()=>!invalid&&channel.isAvailable(),
   async dispose(){invalid=true;channel.dispose();return await closeSocket();}});
 }catch{const e=refusal();refuse();if(closeSocket)await closeSocket();throw e;}finally{clearTimeout(timer);secret.fill(0);}
}
