import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { ownedDirectory, ownedFile } from '../projects/paths.mjs';
import { readOwnedBytes } from '../projects/io.mjs';
import { encodePinFrame, decodePinFrame, pinRequest, pinResponse } from './pin-protocol.mjs';

const queues=new Map();
const refused=()=>Object.assign(new Error('Protected PIN service unavailable; existing data retained'),{code:'PIN_PROTECTION_FAILED'});
function serial(key,body){const prior=queues.get(key)||Promise.resolve(),operation=prior.then(body,body),settled=operation.catch(()=>{});queues.set(key,settled);settled.finally(()=>{if(queues.get(key)===settled)queues.delete(key);});return operation;}
export class PinProtector{
 #root;#executable;#application;#packaged;#spawn;#timeout;#uncertain=false;#expectsKey=false;
 constructor(root,{executable,application,packaged=false,spawnWorker=spawn,timeoutMs=10000}={}){
  if(typeof executable!=='string'||typeof application!=='string'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw TypeError('PIN_PROTECTION_ADAPTERS_REQUIRED');
  this.#root=resolve(root);this.#executable=resolve(executable);this.#application=resolve(application);this.#packaged=packaged;this.#spawn=spawnWorker;this.#timeout=timeoutMs;
 }
 isEncryptionAvailable(){return process.platform==='win32'&&!this.#uncertain;}
 async #profile(create){
  await ownedDirectory(this.#root);let profile=this.#root;
  for(const name of ['Access','PinProtection']){profile=join(profile,name);if(create)try{await mkdir(profile);}catch(error){if(error.code!=='EEXIST')throw error;}await ownedDirectory(profile);}
  try{const key=await readOwnedBytes(join(profile,'Local State'),65536);if(!key.length)throw refused();}catch(error){if(!create||this.#expectsKey||error.code!=='ENOENT')throw refused();}
  return profile;
 }
 async #run(operation,payload){
  if(this.#uncertain)throw refused();
  const profile=await this.#profile(operation==='encrypt');await ownedFile(this.#executable);
  const request=pinRequest({schema:1,nonce:randomBytes(16).toString('hex'),operation,requireKey:operation==='decrypt'||this.#expectsKey,...payload}),input=encodePinFrame(request);
  const env={...process.env};for(const key of Object.keys(env))if(/^(?:ELECTRON_|NODE_|VSCODE_)/i.test(key)||key==='CHROME_LOG_FILE')delete env[key];
  const flag='--siren-pin-worker-v1='+profile,args=this.#packaged?[flag]:[this.#application,flag];
  let child;try{child=this.#spawn(this.#executable,args,{cwd:dirname(this.#executable),env,shell:false,windowsHide:true,stdio:['pipe','ignore','pipe','pipe']});}catch{input.fill(0);throw refused();}
  const output=[];let size=0,stderrSize=0,failed=false,closed=false;
  try{
   const frame=await new Promise((accept,reject)=>{
    let killTimer;
    const stop=()=>{failed=true;try{child.kill('SIGKILL');}catch{}if(!killTimer)killTimer=setTimeout(()=>{this.#uncertain=true;reject(refused());},5000);};
    const timer=setTimeout(stop,this.#timeout);
    child.once('error',()=>{failed=true;});child.stdin.on('error',stop);
    child.stderr.on('data',bytes=>{stderrSize+=bytes.length;if(stderrSize>4096)stop();});child.stderr.on('error',stop);
    child.stdio[3].on('data',bytes=>{size+=bytes.length;if(size>32772){stop();return;}output.push(bytes);});child.stdio[3].on('error',stop);
    child.once('close',(code,signal)=>{closed=true;clearTimeout(timer);clearTimeout(killTimer);if(failed||code!==0||signal||!size){reject(refused());return;}accept(Buffer.concat(output));});
    child.stdin.end(input);
   });
   try{const result=pinResponse(decodePinFrame(frame),request);if(operation==='decrypt')this.#expectsKey=true;return result;}finally{frame.fill(0);}
  }catch{throw refused();}
  finally{input.fill(0);for(const bytes of output)bytes.fill(0);if(!closed)this.#uncertain=true;}
 }
 encryptString(text){return serial(this.#root.toLowerCase(),async()=>{
  // Validate before creating a profile, then bind the independent process to
  // the exact ciphertext. A normal child close is required at both boundaries.
  pinRequest({schema:1,nonce:'0'.repeat(32),operation:'encrypt',requireKey:false,text});
  const encrypted=await this.#run('encrypt',{text}),cipher=Buffer.from(encrypted.cipher64,'base64');
  const verified=await this.#run('decrypt',{cipher64:encrypted.cipher64});
  if(verified.text!==text){cipher.fill(0);throw refused();}return cipher;
 });}
 decryptString(bytes){return serial(this.#root.toLowerCase(),async()=>{
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>16374)throw refused();
  const result=await this.#run('decrypt',{cipher64:bytes.toString('base64')});return result.text;
 });}
}
