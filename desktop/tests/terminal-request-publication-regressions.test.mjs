// Local real-file QA only. No application, SDK, native host or process discovery.
import {test} from 'node:test';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {dirname,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequestPublisher} from './helpers/terminal-request-publication/producer.mjs';
import {readCommittedRequest} from './helpers/terminal-request-publication/consumer.mjs';

const here=dirname(fileURLToPath(import.meta.url)),helpers=join(here,'helpers','terminal-request-publication');
const temporary=await fs.realpath(tmpdir());
const requestedParent=await fs.realpath(process.env.SIREN_REQUEST_PUBLICATION_TEMP_ROOT||temporary);
const parentRel=relative(temporary,requestedParent);
assert(!isAbsolute(parentRel)&&parentRel!=='..'&&!parentRel.startsWith('..\\')&&!parentRel.startsWith('../'),'FIXTURE_PARENT_OUTSIDE_OS_TEMP');
const owned=await fs.mkdtemp(join(requestedParent,'siren-qa-request-regressions-'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const encode=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const filename='ui-operator-ready-request.json';
const actorPid=21744;
const request=()=>({name:'operator-ready',actorPid,appPid:51,terminalUrl:'siren://app/windows/terminal.html?windowId=12345678-1234-1234-1234-123456789abc',shells:[]});
const save=(path,value)=>fs.writeFile(path,encode(value),{flag:'wx'});
let probeOrdinal=0;

async function output(label){
  return fs.mkdtemp(join(owned,label+'-'));
}
async function fresh(out,label){const root=join(out,label,'native-attempt-v1');await fs.mkdir(root,{recursive:true});return root;}
async function snapshot(path){
  try{
    const before=await fs.lstat(path,{bigint:true}),body=await fs.readFile(path),after=await fs.lstat(path,{bigint:true});
    const identity=s=>['dev','ino','mode','nlink','size','mtimeNs','ctimeNs','birthtimeNs'].map(k=>String(s[k]));
    assert.deepEqual(identity(before),identity(after));
    return {exists:true,bytes:body.length,sha256:hash(body),identity:identity(after)};
  }catch(error){if(error.code==='ENOENT')return {exists:false};throw error;}
}
async function observe(out,root,label){
  const prefix=join(out,String(++probeOrdinal).padStart(2,'0')+'-'+label);
  const python=process.env.SIREN_QA_PYTHON||'python';
  const argv=['-B','-I','-S','-X','utf8',join(helpers,'constant-probe.py'),root,filename];
  await save(prefix+'-REQUEST.json',{executable:python,argv,shell:false,timeoutMs:3000,maxBuffer:65536,windowsHide:true,synthetic:true});
  const observed=spawnSync(python,argv,{shell:false,timeout:3000,maxBuffer:65536,windowsHide:true,encoding:'buffer'});
  // Record the actual child outcome before saving or interpreting its streams.
  await save(prefix+'-ACTUAL.json',{exitCode:observed.status,signal:observed.signal,error:observed.error?{name:observed.error.name,code:observed.error.code??null,message:observed.error.message}:null});
  await fs.writeFile(prefix+'-stdout.bin',observed.stdout??Buffer.alloc(0),{flag:'wx'});
  await fs.writeFile(prefix+'-stderr.bin',observed.stderr??Buffer.alloc(0),{flag:'wx'});
  assert.equal(observed.error,undefined);assert.equal(observed.signal,null);assert.equal(observed.status,0);
  const py=JSON.parse(observed.stdout.toString('utf8'));
  let node;try{const value=await readCommittedRequest({directory:root,filename,actorPid});node={status:value===null?'pending':'committed'};}catch(error){node={status:'error',error:{name:error.name,message:error.message}};}
  return {python:py,node,pythonEvidencePrefix:prefix};
}

test('fresh publisher refuses a committed name before recreating removed body; committed corruption is preserved',async()=>{
  const out=await output('duplicates'),records=[];
  for(const kind of ['body-removed','body-corrupt']){
    const root=await fresh(out,kind),bodyPath=join(root,filename),completionPath=bodyPath+'.completion.json',markerPath=bodyPath+'.published';
    await createRequestPublisher({directory:root,actorPid}).publish({filename,request:request()});
    if(kind==='body-removed')await fs.rename(bodyPath,bodyPath+'.retained');
    else await fs.writeFile(bodyPath,Buffer.from('{committed-corruption'));
    const before={body:await snapshot(bodyPath),completion:await snapshot(completionPath),marker:await snapshot(markerPath),entries:(await fs.readdir(root)).sort()};
    const writes=[];
    const io={...fs,async writeFile(path,bytes,options){writes.push({path,bytes:bytes.length,flag:options?.flag??null});return fs.writeFile(path,bytes,options);}};
    const freshPublisher=createRequestPublisher({directory:root,actorPid,io});
    let refusal=null;try{await freshPublisher.publish({filename,request:request()});}catch(error){refusal={name:error.name,message:error.message,code:error.code??null};}
    const after={body:await snapshot(bodyPath),completion:await snapshot(completionPath),marker:await snapshot(markerPath),entries:(await fs.readdir(root)).sort()};
    const readers=await observe(out,root,kind);
    records.push({kind,root,refusal,writeAttempts:writes,before,after,readers,removedPathPreservation:kind==='body-removed'?await snapshot(bodyPath+'.retained'):null});
  }
  await save(join(out,'RESULT.json'),{kind:'REQUEST_PUBLICATION_FRESH_DUPLICATE_REGRESSION_V1',synthetic:true,records,nativeExecuted:false,appCalls:0,sdkCalls:0});
  console.log(JSON.stringify({group:'fresh-duplicate',result:join(out,'RESULT.json')}));
  for(const row of records){
    assert(row.refusal,'Fresh publisher must refuse a previously committed name');
    assert.equal(row.writeAttempts.length,0,'Committed name must be refused before any write attempt');
    assert.deepEqual(row.after,row.before,'Removed body must stay removed and corrupt evidence must remain exact');
    assert.equal(row.readers.node.status,'error');assert.equal(row.readers.python.status,'error');
    if(row.kind==='body-removed')assert.equal(row.removedPathPreservation.exists,true);
  }
});

test('Node and Python both reject NaN Infinity and -Infinity in committed body and completion JSON',async()=>{
  const out=await output('constants'),records=[];
  for(const site of ['body','completion'])for(const [index,constant]of ['NaN','Infinity','-Infinity'].entries()){
    const root=await fresh(out,site+'-'+index),bodyPath=join(root,filename),completionPath=bodyPath+'.completion.json';
    await createRequestPublisher({directory:root,actorPid}).publish({filename,request:request()});
    const completion=JSON.parse(await fs.readFile(completionPath,'utf8'));
    if(site==='body'){
      // The receipt is rejoined to the exact deliberately nonstandard bytes.
      const bad=Buffer.from(JSON.stringify(request()).slice(0,-1)+',"qaConstant":'+constant+'}');
      await fs.writeFile(bodyPath,bad);completion.request.bytes=bad.length;completion.request.sha256=hash(bad);await fs.writeFile(completionPath,encode(completion));
    }else{
      // A shadowed first kind value would evade later closed-schema checks in
      // Python's default decoder. This tests parsing, without a duplicate-key policy change.
      const bad=Buffer.from('{"kind":'+constant+','+JSON.stringify(completion).slice(1));
      await fs.writeFile(completionPath,bad);
    }
    const before={body:await snapshot(bodyPath),completion:await snapshot(completionPath),marker:await snapshot(bodyPath+'.published')};
    const readers=await observe(out,root,site+'-'+index);
    const after={body:await snapshot(bodyPath),completion:await snapshot(completionPath),marker:await snapshot(bodyPath+'.published')};
    records.push({site,constant,root,before,after,readers});
  }
  const validRoot=await fresh(out,'standard-string');
  await createRequestPublisher({directory:validRoot,actorPid}).publish({filename,request:{...request(),qaString:'NaN Infinity -Infinity'}});
  const positive=await observe(out,validRoot,'standard-string');
  await save(join(out,'RESULT.json'),{kind:'REQUEST_PUBLICATION_NONSTANDARD_JSON_REGRESSION_V1',synthetic:true,records,positiveStandardString:positive,nativeExecuted:false,appCalls:0,sdkCalls:0});
  console.log(JSON.stringify({group:'nonstandard-json',result:join(out,'RESULT.json')}));
  assert.equal(records.length,6);
  for(const row of records){assert.deepEqual(row.after,row.before);assert.equal(row.readers.node.status,'error',row.site+' '+row.constant);assert.equal(row.readers.python.status,'error',row.site+' '+row.constant);}
  assert.equal(positive.node.status,'committed');assert.equal(positive.python.status,'committed');
});
