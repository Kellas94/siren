import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,realpath,readFile,writeFile,cp,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {captureOwnedData,finalizeEvidence,retainPrimaryFailure,retainRawEvidence,evidenceStep,admitFreshData} from './native/source-sync-evidence.mjs';
const owned=process.env.SIREN_RETENTION_CONTROL_ROOT?resolve(process.env.SIREN_RETENTION_CONTROL_ROOT):await mkdtemp(join(await realpath(tmpdir()),'siren-source-sync-evidence-'));
const allowed=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
if(process.env.SIREN_RETENTION_CONTROL_ROOT){assert.ok(owned.startsWith(allowed+'\\')||owned.startsWith(allowed+'/'),'OWNED_CONTROL_ROOT_REQUIRED');await mkdir(owned);}
async function fixture(name){const root=join(owned,name),data=join(root,'data'),evidence=join(root,'evidence');await mkdir(evidence,{recursive:true});await mkdir(join(data,'Projects/p/sources/s/empty'),{recursive:true});await mkdir(join(data,'Recovery/empty'),{recursive:true});await writeFile(join(data,'Projects/p/sources/s/current.json'),'pointer-original');await writeFile(join(data,'Projects/p/writer.lock'),'owned lock');await writeFile(join(data,'Projects/p/sources/s/.pending.tmp'),Buffer.from('Ș😀\r\nexact'));await writeFile(join(data,'session-selection.json'),'owned selected');return{root,data,evidence};}
const rawRoot=async f=>{const out=join(f.evidence,'raw-captures');await mkdir(out);return out;};
test('cleanup refusal retains original failure and still writes complete post-close raw capture and source readback',async()=>{
 const f=await fixture('close-failure'),primary={message:'Original first Source saved gate',stack:'original-stack'},result={status:'ADVERSE',error:primary,cases:[]};let called=0;
 await finalizeEvidence({result,driver:{close:async()=>{throw Error('cleanup-only-refusal');},logs:()=>''},data:f.data,evidence:f.evidence,inputs:{source:'exact'},captureInputs:async()=>{called++;return{source:'exact'};}});
 assert.equal(result.error,primary);assert.equal(result.status,'ADVERSE');assert.equal(called,1);assert.equal(result.rawEvidence.afterClose.captureComplete,true);assert.ok(result.retentionErrors.some(r=>r.stage==='driver-close'));
});
test('full five-case success gets two complete captures; post-close read failure turns status adverse without losing five cases',async()=>{
 const f=await fixture('five-success'),result={status:'COMPLETE',cases:Array.from({length:5},(_,i)=>({name:String(i),ok:true}))};let closed=false;
 await finalizeEvidence({result,driver:{close:async()=>{closed=true;},logs:()=>''},data:f.data,evidence:f.evidence,inputs:{source:'same'},captureInputs:async()=>{throw Error('readback-control');}});
 assert.equal(closed,true);assert.equal(result.status,'ADVERSE');assert.equal(result.cases.length,5);assert.equal(result.rawEvidence.beforeClose.captureComplete,true);assert.equal(result.rawEvidence.afterClose.captureComplete,true);assert.equal(result.inputsUnchanged,false);assert.ok(result.retentionErrors.some(r=>r.stage==='source-input-readback'));
});
test('actual capture preserves dot filenames, lock, exact bytes, empty dirs and stable pointer inventories',async()=>{
 const f=await fixture('positive'),out=await rawRoot(f),before=await readFile(join(f.data,'Projects/p/sources/s/.pending.tmp'));
 const m=await captureOwnedData({dataRoot:f.data,outputRoot:out,phase:'before-close-failure'});assert.equal(m.captureComplete,true);assert.equal(m.stableAroundCopy,true);assert.equal(m.coherence,'LIVE_NOT_COHERENT');assert.ok(m.directories.some(r=>r.relativePath==='Recovery/empty'));assert.ok(m.pointerStability.every(r=>r.unchanged));assert.deepEqual(await readFile(join(out,'before-close-failure/files/Projects/p/sources/s/.pending.tmp')),before);assert.equal(m.beforeDirectoryPathsetSha256,m.afterDirectoryPathsetSha256);
});
test('missing mandatory Projects and optional Recovery/session absence remain distinguishable',async()=>{
 const root=join(owned,'absent'),data=join(root,'data'),out=join(root,'out');await mkdir(data,{recursive:true});await mkdir(out);const adverse=await captureOwnedData({dataRoot:data,outputRoot:out,phase:'before-close-failure'});assert.equal(adverse.captureComplete,false);assert.equal(adverse.errors[0].code,'ENOENT');
 await mkdir(join(data,'Projects'));const good=await captureOwnedData({dataRoot:data,outputRoot:out,phase:'after-close'});assert.equal(good.captureComplete,true);assert.ok(good.before.some(r=>r.relativePath==='Recovery'&&r.absent));assert.ok(good.before.some(r=>r.relativePath==='session-selection.json'&&r.absent));
});
test('nested read refusal is adverse and is never swallowed as absent Projects',async()=>{
 const f=await fixture('nested-enoent'),out=await rawRoot(f),read=fs.promises.readFile;
 try{fs.promises.readFile=async(path,...args)=>{if(resolve(path)===join(f.data,'Projects/p/sources/s/current.json'))throw Object.assign(Error('inert nested refusal'),{code:'ENOENT'});return read(path,...args);};syncBuiltinESMExports();const m=await captureOwnedData({dataRoot:f.data,outputRoot:out,phase:'after-close'});assert.equal(m.captureComplete,false);assert.equal(m.errors[0].code,'ENOENT');assert.equal(m.before?.some(r=>r.relativePath==='Projects'&&r.absent)??false,false);}finally{fs.promises.readFile=read;syncBuiltinESMExports();}
});
test('owned junction and root overlap cannot broaden the source capture',async()=>{
 const f=await fixture('junction'),out=await rawRoot(f),outside=join(f.root,'outside');await mkdir(outside);await writeFile(join(outside,'not-owned-data'),'external fixture');await symlink(outside,join(f.data,'Projects/redirect'),'junction');const m=await captureOwnedData({dataRoot:f.data,outputRoot:out,phase:'after-close'});assert.equal(m.captureComplete,false);assert.equal(m.errors[0].message,'SYMLINK_OR_JUNCTION_REFUSED');assert.equal(m.files.some(r=>r.relativePath.includes('not-owned-data')),false);await assert.rejects(captureOwnedData({dataRoot:f.data,outputRoot:f.data,phase:'after-close'}),/CAPTURE_ROOT_OVERLAP/);
});
test('strict capture budgets reject files beyond the configured finite bound',async()=>{
 const f=await fixture('budget'),out=await rawRoot(f),m=await captureOwnedData({dataRoot:f.data,outputRoot:out,phase:'after-close',limits:{files:1,fileBytes:16*1024**2,totalBytes:128*1024**2}});assert.equal(m.captureComplete,false);assert.equal(m.errors[0].message,'CAPTURE_BUDGET_EXCEEDED');assert.equal(await readFile(join(f.data,'Projects/p/sources/s/current.json'),'utf8'),'pointer-original');
});
test('failure raw capture precedes failing observation and close; primary error is immutable and capture is not retried',async()=>{
 const f=await fixture('observation-failure'),result={status:'ADVERSE',cases:[]};retainPrimaryFailure(result,Error('original-native-failure'));
 const before=await retainRawEvidence(result,{data:f.data,evidence:f.evidence},'beforeClose');assert.equal(before.captureComplete,true);
 await evidenceStep(result,'observation-control',async()=>{assert.equal(await readFile(join(f.evidence,'raw-captures/before-close-failure/files/Projects/p/sources/s/current.json'),'utf8'),'pointer-original');throw Error('observer-only-failure');});
 let closed=false;await finalizeEvidence({result,driver:{logs:()=>'',close:async()=>{closed=true;assert.equal(result.rawEvidence.beforeClose,before);}},data:f.data,evidence:f.evidence,inputs:{original:'same'},captureInputs:async()=>({original:'same'})});
 assert.equal(closed,true);assert.equal(result.error.message,'original-native-failure');assert.equal(result.rawEvidence.beforeClose,before);assert.equal(result.rawEvidence.afterClose.captureComplete,true);assert.throws(()=>{result.error={message:'wrong-late-error'};},TypeError);
});
test('limits cannot exceed the fixed public capture budgets',async()=>{
 const f=await fixture('raised-limit'),out=await rawRoot(f);await assert.rejects(captureOwnedData({dataRoot:f.data,outputRoot:out,phase:'after-close',limits:{files:4097,fileBytes:16*1024**2,totalBytes:128*1024**2}}),/CAPTURE_LIMITS_REFUSED/);
});
test('wrong top-level scope types cannot broaden raw capture',async()=>{
 const root=join(owned,'wrong-types'),data=join(root,'data'),out=join(root,'out');await mkdir(data,{recursive:true});await mkdir(out);await writeFile(join(data,'Projects'),'not a directory');const badProjects=await captureOwnedData({dataRoot:data,outputRoot:out,phase:'before-close-failure'});assert.equal(badProjects.captureComplete,false);assert.equal(badProjects.errors[0].message,'SCOPE_DIRECTORY_REQUIRED');
 const separate=join(root,'session-data');await mkdir(join(separate,'Projects'),{recursive:true});await mkdir(join(separate,'session-selection.json'));const badSession=await captureOwnedData({dataRoot:separate,outputRoot:out,phase:'after-close'});assert.equal(badSession.captureComplete,false);assert.equal(badSession.errors[0].message,'SCOPE_FILE_REQUIRED');
});
test('fresh Data admission accepts absent and empty directories without creating or changing them',async()=>{
 const root=join(owned,'fresh-admission');await mkdir(root);const missing=join(root,'Data');assert.equal((await admitFreshData(missing)).state,'ABSENT');await assert.rejects(readFile(missing),{code:'ENOENT'});await mkdir(missing);assert.equal((await admitFreshData(missing)).state,'EMPTY');
});
test('used Data is refused read-only before copying, including PIN/account/cache or project content',async()=>{
 const root=join(owned,'used-admission'),data=join(root,'Data');await mkdir(join(data,'Projects/p'),{recursive:true});const original=Buffer.from('owned negative userdata Ș😀\r\n');const file=join(data,'Projects/p/user.json');await writeFile(file,original);await assert.rejects(admitFreshData(data),/DATA_NOT_EMPTY/);assert.deepEqual(await readFile(file),original);
 const account=join(root,'account-Data');await mkdir(account);await writeFile(join(account,'pin.json'),'owned-negative-pin-only');await assert.rejects(admitFreshData(account),/DATA_NOT_EMPTY/);assert.equal(await readFile(join(account,'pin.json'),'utf8'),'owned-negative-pin-only');
});
test('fresh Data admission rejects a real junction or wrong file type without altering target',async()=>{
 const root=join(owned,'fresh-junction'),target=join(root,'target');await mkdir(target,{recursive:true});await writeFile(join(target,'preserve'),'owned external negative');const data=join(root,'Data');await symlink(target,data,'junction');await assert.rejects(admitFreshData(data),/DATA_REPARSE_REFUSED/);assert.equal(await readFile(join(target,'preserve'),'utf8'),'owned external negative');const file=join(root,'file-Data');await writeFile(file,'preserve-file');await assert.rejects(admitFreshData(file),/DATA_DIRECTORY_REQUIRED/);assert.equal(await readFile(file,'utf8'),'preserve-file');
});
