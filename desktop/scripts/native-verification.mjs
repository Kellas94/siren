import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
export const nativeGroups=Object.freeze({
 desktop:Object.freeze(['shell','protected-storage','account-transition','code-windows','desktop-ui','code-recovery','recovery-zoom','code-diagram-interaction','guided-intro','dev-first-run','access-screen','local-pin','headless-import','readonly-roster','home-entry','home-navigation','home-recovery','home-library']),
 sources:Object.freeze(['source-owner','source-read','source-analysis','source-diff','source-map','source-edit','source-link','source-link-create','docs-sources','source-sync','docs-edit','view-control-rollback','large-source-docs','code-view-flush','domain-workspaces']),
 diagrams:Object.freeze(['diagram-preview','diagram-edit','diagram-guided','diagram-style','diagram-build','diagram-vector','diagram-export','home-library-search','home-documents','docs-structured','home-source-projects','presentation-render','presentation-style','presentation-cards','presentation-windows'])
});
const root=fileURLToPath(new URL('../',import.meta.url));
function runScript(name){
 return new Promise((resolveResult,reject)=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('../tests/native/'+name+'.mjs',import.meta.url))],{cwd:root,windowsHide:true,stdio:'inherit',shell:false});
  child.once('error',reject);child.once('exit',(code,signal)=>resolveResult({code,signal}));
 });
}
/** A group verdict requires every original child exit. No retries or timeout changes. */
export async function runNativeGroup(group,{run=runScript,onResult=()=>{}}={}){
 if(typeof group!=='string'||!Object.hasOwn(nativeGroups,group))throw Error('NATIVE_GROUP_REFUSED');
 const results=[];
 for(const script of nativeGroups[group]){
  let exit;try{exit=await run(script);}catch(error){exit={code:null,signal:null,error:['ENOENT','EPERM'].includes(error.code)?error.code:'NATIVE_LAUNCH_FAILED'};}
  const item={script,code:exit?.code??null,signal:exit?.signal??null,...(exit?.error?{error:exit.error}:{})};results.push(item);await onResult(item);
 }
 const failed=results.filter(item=>item.code!==0||item.signal!==null||item.error).map(item=>item.script);
 return {group,ok:failed.length===0,results,failed};
}
if(resolve(process.argv[1]??'')===fileURLToPath(import.meta.url)){
 if(process.argv.length!==4||process.argv[2]!=='--group'||!Object.hasOwn(nativeGroups,process.argv[3]))throw Error('NATIVE_GROUP_REFUSED');
 const group=process.argv[3],directory=resolve(root,'evidence/native-verification');await mkdir(directory,{recursive:true});
 const names=['scripts/native-verification.mjs','../.github/workflows/desktop-verify.yml',...nativeGroups[group].map(name=>'tests/native/'+name+'.mjs')];
 const capture=async()=>Object.fromEntries(await Promise.all(names.map(async name=>[name,createHash('sha256').update(await readFile(resolve(root,name))).digest('hex')]))),inputs=await capture();
 const progress={group,status:'RUNNING',started:new Date().toISOString(),results:[],inputs};
 const save=()=>writeFile(resolve(directory,group+'.json'),JSON.stringify(progress,null,2));await save();
 const verdict=await runNativeGroup(group,{onResult:async item=>{progress.results.push(item);await save();console.log(JSON.stringify({nativeGroup:group,...item}));}});
 const afterInputs=await capture(),changedInputs=names.filter(name=>inputs[name]!==afterInputs[name]);Object.assign(progress,{...verdict,finished:new Date().toISOString(),afterInputs,changedInputs,status:verdict.ok&&changedInputs.length===0?'COMPLETE':'ADVERSE'});await save();console.log(JSON.stringify({group,status:progress.status,failed:verdict.failed,changedInputs}));process.exitCode=progress.status==='COMPLETE'?0:1;
}

