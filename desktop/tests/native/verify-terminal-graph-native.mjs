// Pure raw-record reread. No native artifact or graph execution here.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join,win32} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {graphNativeModes,graphNativeCasePassed,graphNativeBatchPassed,graphNativeRecordsPassed,graphNativeProvenancePassed} from './terminal-graph-native-verdict.mjs';
import {validateHostAsyncReceipt} from '../../src/terminal/host-async-receipt-contract.mjs';
assert.equal(process.argv.length,3);const root=resolve(process.argv[2]),pins=[];
const read=p=>{const b=readFileSync(p);pins.push({path:p,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});return JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));};
const batch=read(join(root,'result.json'));assert.equal(graphNativeBatchPassed(batch),true);
const initial=read(join(root,'manifest.json')),records=[],details=[];
for(const mode of graphNativeModes){const dir=join(root,'case-'+mode),driver=read(join(dir,'driver-output.json')),result=read(join(dir,'observer-result.json')),blocked=['graph-held-cwd','negative-provider-held'].includes(mode)?read(join(dir,'graph-blocked.json')):null;
 const record={mode,exit:driver.exit,result,blocked};records.push(record);assert.equal(graphNativeCasePassed(record),true,mode);
 assert.deepEqual(JSON.parse(driver.stdout.trim()),result,'Driver stdout differs from observer file');
 const d={mode,config:read(join(dir,'config.json')),before:read(join(dir,'before.json')),after:mode==='negative-provider-held'?undefined:read(join(dir,'after.json')),lock:mode==='graph-lock'?read(join(dir,'graph-lock.json')):null};details.push(d);
 if(mode!=='negative-provider-held'){assert.deepEqual(d.after,result.nativeAfter);assert.equal(validateHostAsyncReceipt(d.after.expected,d.after.receipt).ok,true,mode);}
}
assert.equal(graphNativeRecordsPassed(batch,records),true,'Batch differs from actual case files');
assert.equal(graphNativeProvenancePassed(batch,initial,details),true,'Raw configuration/before/Lock/manifest mismatch');
// On the hosted checkout, rehash every actual input; do not execute any of them.
const key=p=>win32.normalize(p).toLowerCase(),inputFor=p=>batch.inputs.find(r=>key(r.path)===key(p));
for(const row of batch.inputs){const b=readFileSync(row.path);assert.equal(b.length,row.bytes,row.path);assert.equal(createHash('sha256').update(b).digest('hex'),row.sha256,row.path);}
const repo=fileURLToPath(new URL('../../../',import.meta.url)),manifestPath=fileURLToPath(new URL('./terminal-graph-native-inputs.json',import.meta.url)),source=read(manifestPath),build=read(join(root,'..','build-result.json'));
for(const row of source.inputs){const pinned=inputFor(resolve(repo,row.path));assert(pinned,row.path);assert.equal(pinned.bytes,row.bytes);assert.equal(pinned.sha256,row.sha256);}
assert.equal(build.status,'COMPILED_NOT_RUNTIME_QUALIFIED');assert.equal(build.nativeExecutionAdmitted,false);assert(/^[a-f0-9]{40}$/.test(build.commit));if(process.env.GITHUB_SHA)assert.equal(build.commit,process.env.GITHUB_SHA);
const extraPaths=[process.execPath,build.binary.path,'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',join(root,'build','graph-observer.cs'),join(root,'build','graph-observer.exe'),manifestPath];
assert.equal(batch.inputs.length,source.inputs.length+extraPaths.length);for(const p of extraPaths)assert(inputFor(p),p);assert.deepEqual(inputFor(build.binary.path),build.binary);
for(const suffix of ['ownership.cc','peer-endpoints.inc']){const path=resolve(repo,'desktop/native/terminal-host-roster-candidate',suffix),pin=inputFor(path);assert.deepEqual(build.inputs.find(r=>key(r.path)===key(path)),pin);}
writeFileSync(join(root,'verified.json'),JSON.stringify({author:'/root',scope:'BOUNDED_GRAPH_RECORDS_ONLY_NOT_PRODUCT_ADMISSION',nativeExecutionAdmitted:false,pins},null,2)+'\n',{flag:'wx'});console.log('All five fixed graph records matched; native product admission remains false.');
