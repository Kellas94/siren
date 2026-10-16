import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir,symlink} from 'node:fs/promises';
import {join,resolve,dirname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {admitFreshData,retainPrimaryFailure,evidenceStep} from './native/source-sync-evidence.mjs';
const implementation=process.env.SIREN_ACTIVITY_EVIDENCE_IMPLEMENTATION;
const {finalizeActivityEvidence,retainActivityRawEvidence,prepareActivityData,persistActivityResult}=await import(implementation?pathToFileURL(resolve(implementation)).href:'./native/docs-activity-evidence.mjs');
const control=resolve(process.env.SIREN_ACTIVITY_CONTROL_ROOT??'');
const allowed=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
assert.ok(process.env.SIREN_ACTIVITY_CONTROL_ROOT&&control.startsWith(allowed+sep),'EXPLICIT_OWNED_CONTROL_ROOT_REQUIRED');
await mkdir(control);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(name){
 const root=join(control,name),data=join(root,'data'),evidence=join(root,'evidence');await mkdir(evidence,{recursive:true});
 await mkdir(join(data,'Projects/p/exports'),{recursive:true});await mkdir(join(data,'Projects/p/sources/s/empty'),{recursive:true});await mkdir(join(data,'Recovery/empty'),{recursive:true});
 const source=Buffer.from('\ufeffvalue = "Ș😀"\r\n'),document={id:'doc-a',blocks:[{kind:'text',html:'<p><strong>Ș😀</strong></p>'},{kind:'image',dataUri:'data:image/png;base64,AAAA',caption:'caption',opaque:'EXACT_IMAGE'}],comments:[{text:'comment',opaque:7}],revisions:[{blocks:[],opaque:'EXACT_REVISION'}],review:{trail:[{detail:'recorded'}]},signoffFromFile:{opaque:'EXACT_FILE'},releases:[{sourceRef:{sourceId:'s',version:1,sha256:sha(source)},opaque:'EXACT_RELEASE'}],opaque:{private:'EXACT_DOC',sourceRef:{sourceId:'s',version:1}}};
 const archive=Buffer.from(JSON.stringify({format:'siren-document-archive',document,documentSha256:sha(Buffer.from(JSON.stringify(document)))}));const filename='document-00000000-0000-0000-0000-000000000001.json';
 await writeFile(join(data,'Projects/p/exports',filename),archive);await writeFile(join(data,'Projects/p/workspace.json'),JSON.stringify({workpapers:[document],unknown:{preserve:'Ș😀'}}));await writeFile(join(data,'Projects/p/sources/s/blob'),source);await writeFile(join(data,'Projects/p/sources/s/.pending.tmp'),'owned pending');await writeFile(join(data,'Projects/p/sources/s/current.json'),'exact pointer');await writeFile(join(data,'session-selection.json'),'exact session');await writeFile(join(data,'pin.json'),'EXCLUDED_PIN');await writeFile(join(data,'account.json'),'EXCLUDED_ACCOUNT');await writeFile(join(data,'cache'),'EXCLUDED_CACHE');return{root,data,evidence,source,document,archive,filename};
}
function args(f,result,extra={}){return {result,driver:{logs:()=> 'owned runtime\n',close:async()=>{}},data:f.data,evidence:f.evidence,inputs:{source:'unchanged'},captureInputs:async()=>({source:'unchanged'}),...extra};}
test('capture byte-exact export, rich Docs, source bytes and empty dirs after all eight cases',async()=>{
 const f=await fixture('fidelity'),result={status:'COMPLETE',cases:Array.from({length:8},(_,i)=>({name:String(i),ok:true,...(i===6?{filename:f.filename,bytes:f.archive.length,sha256:sha(f.archive)}:{})}))};
 await finalizeActivityEvidence(args(f,result));assert.equal(result.status,'COMPLETE');assert.equal(result.cases.length,8);
 for(const phase of ['before-close-success','after-close']){const at=join(f.evidence,'raw-captures',phase),m=JSON.parse(await readFile(join(at,'capture.json'),'utf8'));assert.equal(m.captureComplete,true);assert.equal(m.stableAroundCopy,true);assert.ok(m.directories.some(r=>r.relativePath==='Recovery/empty'));assert.deepEqual(await readFile(join(at,'files/Projects/p/exports',f.filename)),f.archive);assert.deepEqual(JSON.parse(await readFile(join(at,'files/Projects/p/workspace.json'),'utf8')).workpapers[0],f.document);assert.deepEqual(await readFile(join(at,'files/Projects/p/sources/s/blob')),f.source);assert.equal(m.files.some(r=>['pin.json','account.json','cache'].includes(r.relativePath)),false);const ex=JSON.parse(await readFile(join(at,'exports.json'),'utf8'));assert.equal(ex.state,'CAPTURED_EXPORT_FILES');assert.equal(ex.files.length,1);assert.equal(ex.files[0].sha256,sha(f.archive));}
 assert.equal(result.driverCloseReturned,true);assert.equal(result.inputsUnchanged,true);assert.equal(await readFile(join(f.evidence,'raw-captures/docs-activity-runtime-before-close.log'),'utf8'),'owned runtime\n');
});
test('primary failure survives failed capture, logs, close, source readback and package verify independently',async()=>{
 const f=await fixture('precedence'),out=join(f.evidence,'raw-captures');await mkdir(out);await mkdir(join(out,'before-close-failure'));const primary={phase:'export',message:'original UI gate',stack:'original stack'},result={status:'ADVERSE',error:primary,cases:[]};retainPrimaryFailure(result,Error('original UI gate'));let closed=0,readbacks=0,verified=0;
 await finalizeActivityEvidence(args(f,result,{driver:{logs:()=>{throw Error('log rejection');},close:async()=>{closed++;throw Error('close rejection');}},captureInputs:async()=>{readbacks++;throw Error('readback rejection');},packaged:{verify:async()=>{verified++;throw Error('package rejection');}}}));
 assert.equal(result.error,primary);assert.equal(result.primaryFailure.message,'original UI gate');assert.equal(closed,1);assert.equal(readbacks,1);assert.equal(verified,1);assert.equal(result.status,'ADVERSE');assert.equal(result.rawEvidence.afterClose.captureComplete,true);assert.equal(result.packageUnchanged,false);assert.ok(result.retentionErrors.some(r=>r.stage==='driver-close'));assert.ok(result.retentionErrors.some(r=>r.stage==='source-input-readback'));assert.throws(()=>{result.error={message:'late'};},TypeError);
});
test('early failure with no admitted Data records explicit unavailable capture and no export without reading used Data',async()=>{
 const evidence=join(control,'no-data');await mkdir(evidence);const result={status:'ADVERSE',cases:[]};retainPrimaryFailure(result,Error('Data admission rejected'));
 await finalizeActivityEvidence({result,evidence,inputs:{source:'same'},captureInputs:async()=>({source:'same'})});assert.equal(result.error.message,'Data admission rejected');assert.equal(result.driverCloseReturned,false);
 for(const phase of ['before-close-failure','after-close']){const record=JSON.parse(await readFile(join(evidence,'raw-captures',phase,'exports.json'),'utf8'));assert.equal(record.state,'UNAVAILABLE_BEFORE_OWNED_DATA_ADMISSION');assert.deepEqual(record.files,[]);}
});
test('successful fixture before export records explicit no export in complete raw capture',async()=>{
 const f=await fixture('no-export');const data=join(f.root,'fresh-data');await mkdir(join(data,'Projects'),{recursive:true});const result={status:'ADVERSE',cases:[]};retainPrimaryFailure(result,Error('early UI failure'));await finalizeActivityEvidence(args({...f,data},result));const record=JSON.parse(await readFile(join(f.evidence,'raw-captures/before-close-failure/exports.json'),'utf8'));assert.equal(record.state,'NO_EXPORT_IN_CAPTURE');assert.deepEqual(record.files,[]);assert.equal(result.rawEvidence.afterClose.captureComplete,true);
});
test('failure capture precedes observations and close and cannot be silently overwritten or retried',async()=>{
 const f=await fixture('ordering'),result={status:'ADVERSE',cases:[]};retainPrimaryFailure(result,Error('primary'));const first=await retainActivityRawEvidence(result,{data:f.data,evidence:f.evidence},'beforeClose');await evidenceStep(result,'failed-observer',async()=>{assert.deepEqual(await readFile(join(f.evidence,'raw-captures/before-close-failure/files/Projects/p/exports',f.filename)),f.archive);throw Error('observer');});await finalizeActivityEvidence(args(f,result,{driver:{logs:()=>'',close:async()=>{assert.equal(result.rawEvidence.beforeClose,first);}}}));assert.equal(result.error.message,'primary');assert.equal(result.rawEvidence.beforeClose,first);assert.equal(result.rawEvidence.afterClose.captureComplete,true);
});
test('readback-only failure turns full success adverse without losing eight cases or captures',async()=>{
 const f=await fixture('readback-only'),result={status:'COMPLETE',cases:Array.from({length:8},()=>({ok:true}))};await finalizeActivityEvidence(args(f,result,{captureInputs:async()=>{throw Error('readback sentinel');}}));assert.equal(result.status,'ADVERSE');assert.equal(result.error.message,'readback sentinel');assert.equal(result.cases.length,8);assert.equal(result.rawEvidence.beforeClose.captureComplete,true);assert.equal(result.rawEvidence.afterClose.captureComplete,true);
});
test('fresh Data admission precedes package copy and owned fixture population',async()=>{
 const evidence=join(control,'fresh-package');await mkdir(evidence);const packageRoot=join(control,'preview');await mkdir(packageRoot);let copied=0;const prepared=await prepareActivityData({evidence,packageRoot,copyPackage:async()=>{copied++;const copy=join(evidence,'copy');await mkdir(copy);return {copy,data:join(copy,'Data')};}});assert.equal(copied,1);assert.equal(prepared.admissions.packageSource.state,'ABSENT');assert.equal(prepared.admissions.ownedData.state,'ABSENT');assert.deepEqual(await readdir(prepared.data),[]);assert.equal((await admitFreshData(prepared.data)).state,'EMPTY');
 const native=join(control,'native-fresh');await mkdir(native);assert.equal((await prepareActivityData({evidence:native,copyPackage:async()=>null})).admissions.ownedData.state,'ABSENT');
});
test('used package Data rejects before copying and preserves bytes without capture or deletion',async()=>{
 const evidence=join(control,'used-evidence');await mkdir(evidence);const packageRoot=join(control,'used-preview');await mkdir(join(packageRoot,'Data'),{recursive:true});const original=Buffer.from('owned negative account Ș😀');await writeFile(join(packageRoot,'Data/account.json'),original);let copied=0;await assert.rejects(prepareActivityData({evidence,packageRoot,copyPackage:async()=>{copied++;}}),/DATA_NOT_EMPTY/);assert.equal(copied,0);assert.deepEqual(await readFile(join(packageRoot,'Data/account.json')),original);
});
test('nonempty copied and native Data refuse before fixture population',async()=>{
 const evidence=join(control,'used-native');await mkdir(join(evidence,'owned-data'),{recursive:true});await writeFile(join(evidence,'owned-data/pin.json'),'preserve');await assert.rejects(prepareActivityData({evidence,copyPackage:async()=>null}),/DATA_NOT_EMPTY/);assert.equal(await readFile(join(evidence,'owned-data/pin.json'),'utf8'),'preserve');
 const copied=join(control,'used-copied');await mkdir(join(copied,'Data'),{recursive:true});await writeFile(join(copied,'Data/unknown'),'preserve');await assert.rejects(prepareActivityData({evidence,copyPackage:async()=>({data:join(copied,'Data')})}),/DATA_NOT_EMPTY/);
});
test('real owned junction and wrong Data type reject without modifying targets',async()=>{
 const root=join(control,'unsafe-root');await mkdir(root);const target=join(root,'outside');await mkdir(target);await writeFile(join(target,'preserve'),'exact');const preview=join(root,'preview');await mkdir(preview);await symlink(target,join(preview,'Data'),'junction');let copied=0;await assert.rejects(prepareActivityData({evidence:root,packageRoot:preview,copyPackage:async()=>{copied++;}}),/DATA_REPARSE_REFUSED/);assert.equal(copied,0);assert.equal(await readFile(join(target,'preserve'),'utf8'),'exact');const wrong=join(root,'wrong');await mkdir(wrong);await writeFile(join(wrong,'Data'),'ordinary file');await assert.rejects(prepareActivityData({evidence:root,packageRoot:wrong,copyPackage:async()=>null}),/DATA_DIRECTORY_REQUIRED/);
});
test('final result write failure retains primary and secondary errors, adverse exit decision and prior raw captures',async()=>{
 const f=await fixture('result-write'),result={status:'ADVERSE',cases:[],error:{message:'original UI failure',stack:'original'}};retainPrimaryFailure(result,Error('original UI failure'));await mkdir(join(f.evidence,'result.json'));
 const raw=join(f.evidence,'raw-captures');await mkdir(raw);await writeFile(join(raw,'preserve.log'),'original retained raw');
 assert.equal(await persistActivityResult({result,evidence:f.evidence}),false);assert.equal(result.status,'ADVERSE');assert.equal(result.error.message,'original UI failure');assert.ok(result.retentionErrors.some(r=>r.stage==='result-json'));assert.equal(await readFile(join(raw,'preserve.log'),'utf8'),'original retained raw');
 const ok=join(f.root,'success');await mkdir(ok);const complete={status:'COMPLETE',cases:Array.from({length:8},()=>({ok:true}))};assert.equal(await persistActivityResult({result:complete,evidence:ok}),true);assert.equal(JSON.parse(await readFile(join(ok,'result.json'),'utf8')).cases.length,8);
});
