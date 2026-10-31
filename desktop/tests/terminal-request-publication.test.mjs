import {test} from 'node:test';import {tmpdir} from 'node:os';
import {readCommittedRequest} from './helpers/terminal-request-publication/consumer.mjs';
import assert from 'node:assert/strict';import * as fs from 'node:fs/promises';import {resolve,join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {createRequestPublisher} from './helpers/terminal-request-publication/producer.mjs';
test('committed Terminal QA request publication across both consumers',async()=>{const H=fileURLToPath(new URL('./helpers/terminal-request-publication/',import.meta.url)),mode='new',temporary=await fs.realpath(process.env.SIREN_REQUEST_PUBLICATION_TEMP_ROOT||tmpdir()),out=await fs.mkdtemp(join(temporary,'siren-qa-request-publication-'));const checks=[];
const py=process.env.SIREN_QA_PYTHON||'python';
const hash=b=>createHash('sha256').update(b).digest('hex');
const observe=async(root,filename)=>{const pyValue=JSON.parse(execFileSync(py,['-B','-I','-S','-X','utf8',join(H,'probe.py'),root,filename],{timeout:3000,maxBuffer:65536,windowsHide:true}).toString());let jsValue;try{const v=await readCommittedRequest({directory:root,filename,actorPid:21744});jsValue={status:v===null?'pending':'committed',value:v};}catch(e){jsValue={status:'error'};}if(mode==='new'){assert.equal(jsValue.status,pyValue.status,'PYTHON_NODE_COMMITTED_STATUS_MATCH');if(jsValue.status==='committed')assert.deepEqual(jsValue.value,pyValue.value);}return pyValue;};
let seq=0;const roots=[];
async function fresh(label){const p=join(out,String(++seq)+'-'+label,'native-attempt-v1');await fs.mkdir(p,{recursive:true});roots.push(p);return p;}
async function check(name,fn){try{await fn();checks.push({name,complete:true});}catch(e){checks.push({name,complete:false,error:{name:e.name,message:e.message}});}}
const routes=['ui-operator-ready','ui-folder-cancel','ui-folder-select','native-live','native-capacity','native-stopped','native-closed'];
function request(route){return {name:route.replace(/^ui-/,''),actorPid:21744,appPid:51,terminalUrl:'siren://app/windows/terminal.html?windowId=12345678-1234-1234-1234-123456789abc',shells:[]};}
for(const route of routes){const filename=route+'-request.json';
 await check(route+' actual producer public-create/partial/bodyclosed/completionclosed withheld; commit exactly joined',async()=>{
  const root=await fresh(route);const observations=[];let commit=0;
  const io={...fs,async writeFile(p,b,o){
   if(p===join(root,filename)){
    const f=await fs.open(p,'wx');try{observations.push(await observe(root,filename));await f.write(b.subarray(0,Math.floor(b.length/2)));observations.push(await observe(root,filename));await f.write(b.subarray(Math.floor(b.length/2)));}finally{await f.close();}
    observations.push(await observe(root,filename));
   }else if(p.endsWith('.completion.json')){await fs.writeFile(p,b,o);observations.push(await observe(root,filename));}
   else{assert(p.endsWith('.published'));assert.equal(b.length,0);assert.equal(++commit,1);await fs.writeFile(p,b,o);}
  }};
  const publisher=createRequestPublisher({directory:root,actorPid:21744,io});const actual=await publisher.publish({filename,request:request(route)});
  for(const observation of observations)assert.equal(observation.status,'pending',JSON.stringify(observation));
  const done=await observe(root,filename);assert.equal(done.status,'committed');assert.deepEqual(done.value.value,request(route));if(mode==='new')assert.equal(done.value.reference.sha256,actual.request.sha256);
  const before=await fs.readFile(join(root,filename));await assert.rejects(publisher.publish({filename,request:request(route)}));assert.deepEqual(await fs.readFile(join(root,filename)),before);
 });
}
if(mode==='new')for(const kind of ['malformed-body','body-hash-mismatch','malformed-completion','wrong-actor','wrong-phase','wrong-scope','nonempty-marker','completion-missing','body-missing','body-drift','completion-drift'])await check('committed '+kind+' stays fatal without pending/retry',async()=>{
 const root=await fresh(kind),filename='ui-operator-ready-request.json';await createRequestPublisher({directory:root,actorPid:21744}).publish({filename,request:request('ui-operator-ready')});
 const bp=join(root,filename),mp=bp+'.completion.json',rp=bp+'.published';const m=JSON.parse(await fs.readFile(mp));
 if(kind==='malformed-body'){await fs.writeFile(bp,'{');m.request.bytes=1;m.request.sha256=hash(Buffer.from('{'));await fs.writeFile(mp,JSON.stringify(m));}
 if(kind==='body-hash-mismatch'||kind==='body-drift')await fs.appendFile(bp,' ');
 if(kind==='malformed-completion')await fs.writeFile(mp,'{');
 if(kind==='wrong-actor'){m.actorPid++;await fs.writeFile(mp,JSON.stringify(m));}
 if(kind==='wrong-phase'){m.name='folder-cancel';await fs.writeFile(mp,JSON.stringify(m));}
 if(kind==='wrong-scope'){m.scope='other';await fs.writeFile(mp,JSON.stringify(m));}
 if(kind==='nonempty-marker')await fs.writeFile(rp,'x');
 if(kind==='completion-missing')await fs.rename(mp,mp+'.retained');
 if(kind==='body-missing')await fs.rename(bp,bp+'.retained');
 if(kind==='completion-drift'){m.request.sha256='0'.repeat(64);await fs.writeFile(mp,JSON.stringify(m));}
 assert.equal((await observe(root,filename)).status,'error');
});
const result={kind:'TC08_REQUEST_PUBLICATION_REAL_FILE_CONTROLS_V1',author:'qa-test-runner',mode,complete:checks.every(c=>c.complete),checks,roots,nativeExecuted:false,appCalls:0,sdkCalls:0,fixtureProcesses:'bounded Python read-only file consumers; no application or native host imported',limits:['No crash durability or multi-file filesystem atomicity claim.','These exercise actual producer/reader files and their publication interleavings; native actor/host integration is a separate qualification.']};await fs.writeFile(join(out,'RESULT.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({complete:result.complete,checks:checks.length,failed:checks.filter(c=>!c.complete),result:join(out,'RESULT.json')}));assert.equal(checks.length,18);assert.equal(result.complete,true,JSON.stringify(checks.filter(c=>!c.complete)));});
