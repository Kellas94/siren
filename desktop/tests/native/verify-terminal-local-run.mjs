// Recheck actual per-case observer/driver records. No product activation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {localNativeModes,localNativeCasePassed,localNativeBatchPassed} from './terminal-local-case-verdict.mjs';
assert.equal(process.argv.length,3);const root=resolve(process.argv[2]),pins=[];
const read=p=>{const b=readFileSync(p);pins.push({path:p,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});return JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));};
const manifest=read(join(root,'result.json'));assert.equal(localNativeBatchPassed(manifest),true,'COMPLETE_BOUNDED_BATCH_REQUIRED');
for(const mode of localNativeModes){const driver=read(join(root,'case-'+mode,'driver-output.json')),result=read(join(root,'case-'+mode,'observer-result.json'));assert.equal(localNativeCasePassed({mode,exit:driver.exit,result}),true,'ACTUAL_OBSERVER_RECORD_REFUSED:'+mode);}
writeFileSync(join(root,'verified.json'),JSON.stringify({author:'/root',scope:'BOUNDED_WINDOWS_NODE_LOCAL_CASES_ONLY',status:'BOUNDED_RECORDS_MATCHED',nativeExecutionAdmitted:false,pins},null,2)+'\n',{flag:'wx'});
console.log('All ten bounded case records matched; product native admission remains false.');
