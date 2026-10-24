// The Node wrapper contains small orchestration metadata, never Python FILETIMEs.
import {writeFile} from 'node:fs/promises';
import {writeSync} from 'node:fs';
export async function retainReceipt(path,receipt,fallback,{emit=text=>writeSync(2,text)}={}){
 const describe=(stage,error)=>({stage,type:error.name,message:String(error.message).slice(0,3000),code:error.code??null});
 try{await writeFile(path,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});}
 catch(error){
  const observed=describe('result-retention',error);
  if(receipt.primaryError===null)receipt.primaryError=observed;else receipt.finalErrors.push(observed);
  receipt.fallbackDiagnosticOnly=true;
  try{await writeFile(fallback,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});}
  catch(secondary){receipt.finalErrors.push(describe('fallback-retention',secondary));}
  try{emit(JSON.stringify(receipt)+'\n');}catch(secondary){receipt.finalErrors.push(describe('fallback-stderr',secondary));}
 }
}
