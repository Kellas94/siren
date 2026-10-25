import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';

const desktop=fileURLToPath(new URL('../',import.meta.url)),report=process.argv[2],qualifiedInputs=process.argv[3],out=report?path.dirname(path.resolve(report)):null;
const hash=b=>createHash('sha256').update(b).digest('hex'),caseRows=[],services=[],children=[];
const originals=Object.fromEntries(['spawn','exec','execSync','execFile','execFileSync','spawnSync','fork'].map(key=>[key,childProcess[key]]));
if(qualifiedInputs){
 const binary=path.join(desktop,'node_modules/@esbuild/win32-x64/esbuild.exe');
 childProcess.spawn=function(...args){
  assert.equal(path.resolve(args[0]).toLowerCase(),path.resolve(binary).toLowerCase(),'ONLY_QUALIFIED_ESBUILD_SERVICE');
  const child=Reflect.apply(originals.spawn,this,args),record={pid:child.pid,command:args[0],argv:args[1],exitObserved:false,closeObserved:false};services.push(record);children.push(child);
  const append=phase=>appendFileSync(path.join(out,'ESBUILD-PROGRESS.jsonl'),JSON.stringify({phase,...record})+'\n');append('spawn');child.on('exit',(code,signal)=>{record.exitObserved=true;record.exitCode=code;record.signal=signal;append('exit');});child.on('close',(code,signal)=>{record.closeObserved=true;record.closeCode=code;record.closeSignal=signal;append('close');});return child;
 };
 for(const key of Object.keys(originals).filter(key=>key!=='spawn'))childProcess[key]=()=>{throw Error('UNEXPECTED_BUILD_PROCESS_API:'+key);};syncBuiltinESMExports();
}
const api=await import('../build/terminal-native-staging.mjs');
function scenario(name,title,body){test(title,async()=>{const row={name,title,status:'running',completed:false};caseRows.push(row);try{row.observations=await body();row.status='pass';}catch(error){row.status='fail';row.error={name:error.name,message:error.message};throw error;}finally{row.completed=true;}});}
async function refusal(operation,expected){let observed;try{await operation();assert.fail('EXPECTED_STAGING_REFUSAL');}catch(error){observed=error.message;assert.match(observed,expected);}return {refusal:observed};}
scenario('closed-arguments','staging arguments reject proxy and accessor hooks before effects',async()=>{let calls=0;await assert.rejects(api.stageTerminalApplication(new Proxy({}, {ownKeys(){calls++;return [];}})),/STAGING_ARGUMENT_REFUSED/);await assert.rejects(api.stageTerminalApplication({get outputDir(){calls++;return 'never';}}),/STAGING_ARGUMENT_REFUSED/);assert.equal(calls,0);return {hooksExecuted:calls};});
scenario('closed-recipe','readiness rejects an unbound approval-shaped substitute',async()=>{const body=Buffer.from(JSON.stringify({ready:true}));assert.throws(()=>api.assessTerminalAssemblyReadiness({recipeBytes:body,expectedRecipeSha256:hash(body)}),/STAGING_RECIPE_REFUSED/);return {approvalSubstituteRefused:true};});
scenario('buffer-metadata-callbacks','receipt capture ignores own Buffer metadata getters on both DATA APIs',async()=>{
 const results=[];for(const field of ['buffer','length'])for(const method of ['recipe','ledger']){
  let callbacks=0;const body=Buffer.from('{}'),expected=hash(Buffer.from('{}'));Object.defineProperty(body,field,{get(){callbacks++;throw Error('OWN_BUFFER_METADATA_GETTER');}});
  const result=await refusal(()=>method==='recipe'?api.assessTerminalAssemblyReadiness({recipeBytes:body,expectedRecipeSha256:expected}):api.verifyTerminalApplicationStage({stageDirectory:path.resolve(out??path.join(desktop,'../staging-argument-probe')),ledgerBytes:body,expectedLedgerSha256:expected}),method==='recipe'?/STAGING_RECIPE_REFUSED/:/STAGING_LEDGER_REFUSED/);
  assert.equal(callbacks,0);results.push({field,method,callbacks,...result});
 }return {results};
});
scenario('recipe-pin-callbacks','recipe expected SHA refuses nonprimitive values without coercion',async()=>{let callbacks=0;const body=Buffer.from('{}'),pin={toString(){callbacks++;return hash(body);}};const result=await refusal(()=>api.assessTerminalAssemblyReadiness({recipeBytes:body,expectedRecipeSha256:pin}),/STAGING_RECIPE_PIN_REFUSED/);assert.equal(callbacks,0);return {...result,callbacks};});
scenario('ledger-pin-callbacks','ledger expected SHA refuses nonprimitive values without coercion',async()=>{let callbacks=0;const body=Buffer.from('{}'),pin={toString(){callbacks++;return hash(body);}};const result=await refusal(()=>api.verifyTerminalApplicationStage({stageDirectory:path.resolve(out??path.join(desktop,'../staging-argument-probe')),ledgerBytes:body,expectedLedgerSha256:pin}),/STAGING_LEDGER_PIN_REFUSED/);assert.equal(callbacks,0);return {...result,callbacks};});

if(qualifiedInputs){
 const config=JSON.parse(await fs.readFile(path.resolve(qualifiedInputs),'utf8'));
 let first,second,ledgerBytes,recipeBytes;
 const options=label=>({...config,outputDir:path.join(out,label)});
 async function clone(label){const target=path.join(out,label);try{await fs.lstat(target);assert.fail('FRESH_CONTROL_REQUIRED');}catch(error){assert.equal(error.code,'ENOENT');}await fs.cp(first.stageDirectory,target,{recursive:true,errorOnExist:true,force:false});return target;}
 const verify=stageDirectory=>api.verifyTerminalApplicationStage({stageDirectory,ledgerBytes,expectedLedgerSha256:first.ledger.sha256});
 scenario('actual-stage','current renderer Terminal and exact application selection produce an external-pending stage',async()=>{
  first=await api.stageTerminalApplication(options('positive'));
  assert.equal(first.status,'APPLICATION_STAGE_COMPLETE_EXTERNAL_INPUTS_PENDING');assert.equal(first.readiness.ready,false);assert.equal(first.completeRuntimeClosure,false);assert.equal(first.nativeExecutionAdmitted,false);
  ledgerBytes=await fs.readFile(first.ledger.path);recipeBytes=await fs.readFile(first.recipe.path);const ledger=JSON.parse(ledgerBytes),copies=JSON.parse(await fs.readFile(path.join(out,'positive/evidence/copy-ledger.json'),'utf8'));
  assert.equal(ledger.generatedSelection.length,19);assert(ledger.generatedSelection.includes('desktop/generated/terminal-launch-preload.cjs'));assert(ledger.generatedSelection.includes('desktop/generated/windows/terminal-licenses.txt'));
  assert.equal(copies.dependencyInventories.length,21);assert.equal(copies.scratchSourcesEntryAndPackageAdopted,false);assert(copies.copies.filter(row=>row.category==='current-application-source').every(row=>!row.before.path.includes(path.sep+'scratch'+path.sep)));assert(!ledger.files.some(row=>row.path==='candidate-main.mjs'||row.path.startsWith('desktop/native/generated/')));
  for(const row of copies.copies){assert.equal(row.before.bytes,row.copied.bytes);assert.equal(row.before.sha256,row.copied.sha256);assert.deepEqual(row.before,row.after);}
  const validated=await verify(first.stageDirectory);assert.equal(validated.applicationVerified,true);return {receipt:first,copyRows:copies.copies.length,dependencyPackages:copies.dependencyInventories.length,generatedRows:ledger.generatedSelection.length,validation:validated};
 });
 scenario('repeat-stage','same qualified inputs repeat the selected application content identity',async()=>{
  second=await api.stageTerminalApplication(options('repeat'));assert.equal(second.verification.contentIdentitySha256,first.verification.contentIdentitySha256);
  const a=JSON.parse(ledgerBytes),b=JSON.parse(await fs.readFile(second.ledger.path));assert.deepEqual(a.files,b.files);return {firstContentIdentity:a.contentIdentitySha256,secondContentIdentity:b.contentIdentitySha256,allSelectedRowsEqual:true,absoluteCopyAndReceiptPathsComparedAsMetadataOnly:true};
 });
 scenario('parsed-ledger-sha-array','parsed recipe ledger SHA refuses an array after a genuine recipe positive control',async()=>{
  const positive=api.assessTerminalAssemblyReadiness({recipeBytes,expectedRecipeSha256:first.recipe.sha256});assert.equal(positive.ready,false);assert.equal(positive.code,'EXTERNAL_INPUTS_UNBOUND');
  const altered=JSON.parse(recipeBytes);assert.equal(typeof altered.applicationStageLedgerSha256,'string');const original=altered.applicationStageLedgerSha256;altered.applicationStageLedgerSha256=[original];const bytes=Buffer.from(JSON.stringify(altered));
  assert.throws(()=>api.assessTerminalAssemblyReadiness({recipeBytes:bytes,expectedRecipeSha256:hash(bytes)}),/STAGING_RECIPE_REFUSED/);return {genuineRecipePositiveControl:true,originalLedgerSha256:original,alteration:'one valid SHA string replaced by a one-element JSON array',outerRecipePinValid:true,refusal:'STAGING_RECIPE_REFUSED',approvalOrReadinessTrue:false};
 });
 scenario('missing-generated','missing maintained Terminal generated asset refuses physical readback',async()=>{const stage=await clone('negative-missing-generated');await fs.unlink(path.join(stage,'desktop/generated/windows/terminal.html'));return refusal(()=>verify(stage),/STAGING_OUTPUT_MEMBERSHIP_OR_BODY_REFUSED/);});
 scenario('missing-runtime-file','omitting one declared dependency JS file refuses physical readback',async()=>{const stage=await clone('negative-missing-runtime-file'),row=config.runtimeDependencyFiles.find(row=>row.path.endsWith('.js'));assert(row);await fs.unlink(path.join(stage,...row.path.split('/')));return {...await refusal(()=>verify(stage),/STAGING_OUTPUT_MEMBERSHIP_OR_BODY_REFUSED/),omittedPath:row.path};});
 scenario('omitted-runtime-declaration','runtime declaration cannot omit a qualified package file before build',async()=>{const input=options('negative-runtime-declaration');input.runtimeDependencyFiles=input.runtimeDependencyFiles.slice(1);return refusal(()=>api.stageTerminalApplication(input),/STAGING_RUNTIME_DECLARATION_REFUSED/);});
 scenario('stale-build-pin','stale current builder source pin refuses before any build effect',async()=>{const input=options('negative-stale-source');input.sourceFiles=input.sourceFiles.map(row=>row.path==='desktop/build/terminal-window.mjs'?{...row,sha256:'0'.repeat(64)}:row);const result=await refusal(()=>api.stageTerminalApplication(input),/STAGING_SOURCE_INPUT_MISMATCH/);await assert.rejects(fs.lstat(input.outputDir),{code:'ENOENT'});return {...result,outputCreated:false};});
 scenario('overlay','undeclared application overlay refuses exact membership',async()=>{const stage=await clone('negative-overlay');await fs.writeFile(path.join(stage,'undeclared-overlay.txt'),'owned-control\n',{flag:'wx'});return refusal(()=>verify(stage),/STAGING_OUTPUT_MEMBERSHIP_OR_BODY_REFUSED/);});
 scenario('changed-byte','changed current MAIN copied byte refuses without executing it',async()=>{const stage=await clone('negative-byte'),target=path.join(stage,'desktop/src/main.mjs'),body=await fs.readFile(target);body[0]^=1;await fs.writeFile(target,body);return refusal(()=>verify(stage),/STAGING_OUTPUT_MEMBERSHIP_OR_BODY_REFUSED/);});
 scenario('case-collision','duplicate case-colliding destination refuses before effects',async()=>{const input=options('negative-case-collision'),row=input.runtimeDependencyFiles[0];input.runtimeDependencyFiles=[...input.runtimeDependencyFiles,{...row,path:row.path.toUpperCase()}];return refusal(()=>api.stageTerminalApplication(input),/STAGING_DUPLICATE_DESTINATION/);});
 scenario('external-unbound','all mandatory external slots remain refused and cannot be marked bound',async()=>{
  const refused=api.assessTerminalAssemblyReadiness({recipeBytes,expectedRecipeSha256:first.recipe.sha256});assert.equal(refused.ready,false);assert.equal(refused.code,'EXTERNAL_INPUTS_UNBOUND');assert.equal(refused.missingMandatorySlots.length,5);assert(refused.missingRequiredFiles.includes('electron/electron.exe'));assert(refused.missingRequiredFiles.includes('desktop/native/generated/process-identity.exe'));
  const forged=JSON.parse(recipeBytes);forged.externalSlots[0].bound=true;const changed=Buffer.from(JSON.stringify(forged));assert.throws(()=>api.assessTerminalAssemblyReadiness({recipeBytes:changed,expectedRecipeSha256:hash(changed)}),/STAGING_RECIPE_REFUSED/);return {readiness:refused,callerBoundSubstituteRefused:true};
 });
}
after(async()=>{
 try{const module=await import(pathToFileURL(path.join(desktop,'node_modules/esbuild/lib/main.js')).href);await (module.default??module).stop();}finally{
  let timer;try{await Promise.race([Promise.all(children.map((child,index)=>services[index].closeObserved?Promise.resolve():new Promise(resolve=>child.once('close',resolve)))),new Promise(resolve=>{timer=setTimeout(resolve,5000);})]);}finally{clearTimeout(timer);}
  Object.assign(childProcess,originals);syncBuiltinESMExports();
  if(report)await fs.writeFile(report,JSON.stringify({kind:'TERMINAL_APPLICATION_STAGING_QA_V1',author:'/root/main_native_carrier_implementation',completed:caseRows.every(row=>row.completed),mode:qualifiedInputs?'genuine-qualified-current-build-and-controls':'closed-contract-only-no-external-inputs',cases:caseRows,services,serviceExitLimit:'Unobserved exit remains unknown; Node exit is separate.',actualTerminalNativeOrElectronExecution:false},null,2)+'\n',{flag:'wx'});
 }
});
