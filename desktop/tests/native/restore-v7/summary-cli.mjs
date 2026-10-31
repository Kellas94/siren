import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {readFile,open} from 'node:fs/promises';
const result={status:'ADVERSE',primaryError:null,finalErrors:[]};
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
try{
 const go=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('HELD_JOB_GO_TIMEOUT')),15000);lines.once('line',text=>{clearTimeout(timer);try{resolve(JSON.parse(text));}catch(error){reject(error);}});});lines.close();
 assert.equal(go.pid,process.pid);assert.equal(go.assignment.assignedActualHeldHandlePID,process.pid);assert.equal(go.assignment.limitKillOnJobClose,true);
 const input=JSON.parse(await readFile(new URL('./operation/summary-input.json',import.meta.url),'utf8'));
 const {parseSourceSyncSummary}=await import('./producer-summary.mjs');
 result.value=parseSourceSyncSummary(Buffer.from(input.stdoutBase64,'base64'),input.context);result.status='SUMMARY_COMPLETE_REQUIRES_DATA_READBACK';
}catch(error){result.primaryError={name:error.name,message:error.message,code:error.code??null};}
finally{
 lines.close();let handle;
 try{handle=await open(new URL('./operation/summary-result.json',import.meta.url),'wx');await handle.writeFile(JSON.stringify(result,null,2)+'\n');await handle.sync();}
 catch(error){result.finalErrors.push({stage:'result-retention',name:error.name,message:error.message});result.status='ADVERSE';}
 finally{if(handle)try{await handle.close();}catch(error){result.finalErrors.push({stage:'file-close',name:error.name,message:error.message});result.status='ADVERSE';}}
}
console.log(JSON.stringify(result));if(result.status!=='SUMMARY_COMPLETE_REQUIRES_DATA_READBACK')process.exitCode=1;
