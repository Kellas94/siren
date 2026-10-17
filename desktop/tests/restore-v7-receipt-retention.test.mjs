import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const api=await import('./native/restore-v7/receipt-retention.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
async function fixture(t){assert.equal(typeof api.retainReceipt,'function','PRIMARY_RECEIPT_FALLBACK_NOT_IMPLEMENTED');const root=await mkdtemp(join(tmpdir(),'siren-receipt-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
test('Node exit-receipt write refusal preserves original spawn error and fallback',async t=>{
 const root=await fixture(t),path=join(root,'exit.json'),fallback=join(root,'fallback.json');await mkdir(path);
 const receipt={primaryError:{type:'Error',code:'ENOENT',message:'original spawn refusal'},finalErrors:[]},emitted=[];
 await api.retainReceipt(path,receipt,fallback,{emit:s=>emitted.push(s)});
 const raw=JSON.parse(await readFile(fallback,'utf8'));assert.deepEqual(raw.primaryError,receipt.primaryError);assert.equal(raw.primaryError.code,'ENOENT');assert.equal(raw.finalErrors.length,1);assert.equal(raw.fallbackDiagnosticOnly,true);assert.equal(emitted.length,1);assert.match(emitted[0],/original spawn refusal/);
});
test('Node receipt refusal becomes primary when no earlier error exists',async t=>{
 const root=await fixture(t),path=join(root,'exit.json');await mkdir(path);const receipt={primaryError:null,finalErrors:[]};
 await api.retainReceipt(path,receipt,join(root,'fallback.json'),{emit:()=>{}});assert.equal(receipt.primaryError.stage,'result-retention');assert.equal(receipt.finalErrors.length,0);
});
test('both Node receipt paths failing retain first error and separate retention failures',async t=>{
 const root=await fixture(t),path=join(root,'exit.json'),fallback=join(root,'fallback.json');await mkdir(path);await mkdir(fallback);
 const receipt={primaryError:{message:'first refusal'},finalErrors:[]},emitted=[];
 await api.retainReceipt(path,receipt,fallback,{emit:s=>emitted.push(s)});assert.equal(receipt.primaryError.message,'first refusal');assert.equal(receipt.finalErrors.length,2);assert.equal(emitted.length,1);assert.equal(JSON.parse(emitted[0]).finalErrors.length,2);
});
test('successful Node exit receipt preserves exact original metadata',async t=>{
 const root=await fixture(t),path=join(root,'exit.json'),receipt={primaryError:null,finalErrors:[],code:0,signal:null};
 await api.retainReceipt(path,receipt,join(root,'fallback.json'),{emit:()=>assert.fail('No fallback expected')});assert.deepEqual(JSON.parse(await readFile(path,'utf8')),receipt);
});
