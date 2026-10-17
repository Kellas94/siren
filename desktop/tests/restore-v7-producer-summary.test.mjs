import assert from 'node:assert/strict';
import test from 'node:test';
import {join,resolve} from 'node:path';

let parseSourceSyncSummary;
try { ({parseSourceSyncSummary}=await import('./native/restore-v7/producer-summary.mjs')); }
catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }

const parent=resolve('evidence/source-sync');
const evidence=join(parent,'2026-10-17T00-33-08.522Z');
const summary={evidence,status:'COMPLETE',cases:5};
const context={expectedEvidenceParent:parent,expectedCases:5};
const bytes=value=>Buffer.from(JSON.stringify(value)+'\n');
function invoke(value=bytes(summary),options=context){
 assert.equal(typeof parseSourceSyncSummary,'function','Explicit producer summary parser has not been implemented');
 return parseSourceSyncSummary(value,options);
}
function refused(value,code,options=context){assert.throws(()=>invoke(value,options),error=>error.code===code);}

test('explicit successful producer summary yields only its exact paths and no admission',()=>{
 const result=invoke();
 assert.equal(result.evidence,evidence);
 assert.equal(result.resultPath,join(evidence,'result.json'));
 assert.equal(result.capturePath,join(evidence,'raw-captures','after-close','capture.json'));
 assert.equal(result.cases,5);
 assert.equal(result.scope,'SUMMARY_ONLY_REQUIRES_CLOSURE_AND_DATA_READBACK');
 assert.equal(result.admitted,false);
});

test('CRLF and a Unicode owned parent preserve the explicit producer path',()=>{
 const unicode=join(parent,'Știință 😀');
 const result=invoke(Buffer.from(JSON.stringify({...summary,evidence:join(unicode,'2026-10-17T00-33-08.522Z')})+'\r\n'),{...context,expectedEvidenceParent:unicode});
 assert.equal(result.evidence,join(unicode,'2026-10-17T00-33-08.522Z'));
});

test('empty stdout refuses rather than discovering another run',()=>refused(Buffer.alloc(0),'PRODUCER_ONE_RECORD_REQUIRED'));
test('two summaries refuse even when byte identical',()=>refused(Buffer.concat([bytes(summary),bytes(summary)]),'PRODUCER_ONE_RECORD_REQUIRED'));
test('extra stdout diagnostics require an explicit protocol change',()=>refused(Buffer.concat([Buffer.from('diagnostic\n'),bytes(summary)]),'PRODUCER_ONE_RECORD_REQUIRED'));
test('malformed JSON is refused',()=>refused(Buffer.from('{"evidence":\n'),'PRODUCER_JSON_REQUIRED'));
test('duplicate status fields cannot hide an earlier ADVERSE value',()=>refused(Buffer.from('{"evidence":'+JSON.stringify(evidence)+',"status":"ADVERSE","status":"COMPLETE","cases":5}\n'),'PRODUCER_UNAMBIGUOUS_JSON_REQUIRED'));
test('invalid UTF8 bytes are refused',()=>refused(Buffer.from([0xff]),'PRODUCER_UTF8_REQUIRED'));
test('bounded stdout refuses excessive input',()=>refused(Buffer.alloc(1024*1024+1,32),'PRODUCER_STDOUT_BUDGET'));
test('ADVERSE status never becomes a successful handoff',()=>refused(bytes({...summary,status:'ADVERSE'}),'PRODUCER_COMPLETE_REQUIRED'));
test('missing cases cannot stand in for executed scenarios',()=>{const {cases,...value}=summary;refused(bytes(value),'PRODUCER_CASES_REQUIRED');});
test('wrong case count is refused',()=>refused(bytes({...summary,cases:4}),'PRODUCER_CASES_REQUIRED'));
test('present error field is refused even with COMPLETE',()=>refused(bytes({...summary,error:'cleanup failed'}),'PRODUCER_ERROR_OR_UNKNOWN_FIELD'));
test('unrecognized fields require a reviewed protocol update',()=>refused(bytes({...summary,newest:true}),'PRODUCER_ERROR_OR_UNKNOWN_FIELD'));
test('a sibling evidence directory is refused',()=>refused(bytes({...summary,evidence:join(parent+'-other','2026-10-17T00-33-08.522Z')}),'PRODUCER_EXACT_CHILD_REQUIRED'));
test('a nested path is refused',()=>refused(bytes({...summary,evidence:join(evidence,'nested')}),'PRODUCER_EXACT_CHILD_REQUIRED'));
test('relative evidence path is refused',()=>refused(bytes({...summary,evidence:'evidence/source-sync/2026-10-17T00-33-08.522Z'}),'PRODUCER_ABSOLUTE_PATH_REQUIRED'));
test('a non-run directory is refused',()=>refused(bytes({...summary,evidence:join(parent,'latest')}),'PRODUCER_RUN_NAME_REQUIRED'));
test('array payload is refused',()=>refused(bytes([summary]),'PRODUCER_OBJECT_REQUIRED'));
test('invalid caller expected-case contract is refused',()=>refused(bytes(summary),'PRODUCER_CONTEXT_REQUIRED',{...context,expectedCases:0}));
