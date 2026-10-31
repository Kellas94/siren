import {isAbsolute,join,relative,resolve,sep} from 'node:path';

const fail=code=>{const error=new Error(code);error.code=code;throw error;};

// This only selects the producer's own explicit output. The consumer must still
// establish process closure and compare actual Data with the captured bytes.
export function parseSourceSyncSummary(stdout,{expectedEvidenceParent,expectedCases}={}){
 if(typeof expectedEvidenceParent!=='string'||!isAbsolute(expectedEvidenceParent)||!Number.isSafeInteger(expectedCases)||expectedCases<1)fail('PRODUCER_CONTEXT_REQUIRED');
 if(!Buffer.isBuffer(stdout)||stdout.length>1024*1024)fail('PRODUCER_STDOUT_BUDGET');
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(stdout);}catch{fail('PRODUCER_UTF8_REQUIRED');}
 const lines=text.split(/\r?\n/).filter(line=>line.trim().length>0);
 if(lines.length!==1)fail('PRODUCER_ONE_RECORD_REQUIRED');
 let summary;try{summary=JSON.parse(lines[0]);}catch{fail('PRODUCER_JSON_REQUIRED');}
 // The owned producer emits JSON.stringify directly. Require that exact form
 // so duplicate fields cannot silently replace an earlier failure status.
 if(JSON.stringify(summary)!==lines[0])fail('PRODUCER_UNAMBIGUOUS_JSON_REQUIRED');
 if(!summary||typeof summary!=='object'||Array.isArray(summary))fail('PRODUCER_OBJECT_REQUIRED');
 if(Object.keys(summary).some(key=>!['evidence','status','cases'].includes(key)))fail('PRODUCER_ERROR_OR_UNKNOWN_FIELD');
 if(summary.status!=='COMPLETE')fail('PRODUCER_COMPLETE_REQUIRED');
 if(!Number.isSafeInteger(summary.cases)||summary.cases!==expectedCases)fail('PRODUCER_CASES_REQUIRED');
 if(typeof summary.evidence!=='string'||!isAbsolute(summary.evidence))fail('PRODUCER_ABSOLUTE_PATH_REQUIRED');
 const evidence=resolve(summary.evidence),child=relative(resolve(expectedEvidenceParent),evidence);
 if(!child||isAbsolute(child)||child==='..'||child.split(sep).length!==1)fail('PRODUCER_EXACT_CHILD_REQUIRED');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/.test(child))fail('PRODUCER_RUN_NAME_REQUIRED');
 return Object.freeze({evidence,resultPath:join(evidence,'result.json'),capturePath:join(evidence,'raw-captures','after-close','capture.json'),cases:summary.cases,scope:'SUMMARY_ONLY_REQUIRES_CLOSURE_AND_DATA_READBACK',admitted:false});
}
