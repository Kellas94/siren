import test from 'node:test';
import assert from 'node:assert/strict';
import * as admission from '../src/projects/import-validation.mjs';

const invoke=(input,options)=>admission.validateImportedBundleMetadata(input,options);
const json=JSON.stringify({kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':'{"diagrams":[],"workpapers":[]}'},opaque:{author:'file claim'}});

test('source bundle admission uses its dedicated metadata method and disposes the validator',async()=>{
 let disposed=false,seen;
 const result=await invoke({json,fileName:'chosen.siren-backup'},{isCurrent:()=>true,createValidator:async()=>({validate:()=>assert.fail('Legacy text door cannot admit source metadata'),validateBundleMetadata:async(text,name)=>{seen={text,name};return text;},dispose:async()=>{disposed=true;}})});
 assert.equal(result,json);assert.deepEqual(seen,{text:json,name:'chosen.siren-backup'});assert.equal(disposed,true);
});

test('stale source bundle metadata admission creates no validator resource',async()=>{
 let created=0;
 await assert.rejects(invoke({json,fileName:'chosen.siren-backup'},{isCurrent:()=>false,createValidator:()=>{created++;assert.fail();}}),{code:'ACCESS_REFUSED'});assert.equal(created,0);
});

test('invalid metadata encoding, shape and native file name are refused before resource creation',async()=>{
 let created=0;const options={isCurrent:()=>true,createValidator:()=>{created++;assert.fail();}};
 for(const input of [{json:'[]',fileName:'chosen.siren-backup'},{json:'null',fileName:'chosen.siren-backup'},{json:'{',fileName:'chosen.siren-backup'},{json:'{"x":"\ud800"}',fileName:'chosen.siren-backup'},{json,fileName:'../private.siren-backup'},{json,fileName:'C:\\private.siren-backup'}])await assert.rejects(invoke(input,options));
 assert.equal(created,0);
});

test('Lock while bundle metadata is pending refuses its reply and destroys the validator',async()=>{
 let current=true,disposed=false;
 await assert.rejects(invoke({json,fileName:'chosen.siren-backup'},{isCurrent:()=>current,createValidator:async()=>({validateBundleMetadata:async()=>{current=false;return json;},dispose:async()=>{disposed=true;}})}),{code:'ACCESS_REFUSED'});assert.equal(disposed,true);
});

test('unavailable dedicated method, malformed reply and failed disposal cannot admit a copy',async()=>{
 for(const variant of ['missing','bad-reply','disposal']){
  let disposed=false;const validator={dispose:async()=>{disposed=true;if(variant==='disposal')throw Error('Actual disposal refused');}};
  if(variant!=='missing')validator.validateBundleMetadata=async()=>variant==='bad-reply'?'[]':json;
  await assert.rejects(invoke({json,fileName:'chosen.siren-backup'},{isCurrent:()=>true,createValidator:async()=>validator}),{code:variant==='disposal'?'IMPORT_DISPOSAL_FAILED':variant==='missing'?'IMPORT_VALIDATOR_UNAVAILABLE':'IMPORT_INVALID'});assert.equal(disposed,true);
 }
});
