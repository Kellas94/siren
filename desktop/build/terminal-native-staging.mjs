// Build-only application staging. This module never assembles or starts R.
import * as fs from 'node:fs/promises';
import {resolve,join,dirname,parse,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {types,isDeepStrictEqual} from 'node:util';
import {buildTerminalDesktopCandidate} from './terminal-window.mjs';
import {BASELINE_SHA256} from './renderer.mjs';
import {REQUIRED_APPLICATION_PATHS} from '../src/terminal/desktop-native-bootstrap.mjs';

const desktop=fileURLToPath(new URL('../',import.meta.url)),sourceRoot=dirname(desktop);
const GENERATED=Object.freeze(REQUIRED_APPLICATION_PATHS.filter(p=>p.startsWith('desktop/generated/')));
const SOURCES=Object.freeze(REQUIRED_APPLICATION_PATHS.filter(p=>p.startsWith('desktop/src/')||p==='desktop/package.json'||p==='desktop/package-lock.json'));
const PACKAGE_NAMES=Object.freeze(REQUIRED_APPLICATION_PATHS.filter(p=>p.startsWith('desktop/node_modules/')).map(p=>p.slice('desktop/node_modules/'.length,-'/package.json'.length)));
const EXTERNAL=Object.freeze([
 Object.freeze({name:'platform-distribution',requiredFiles:Object.freeze(['electron/chrome_100_percent.pak','electron/chrome_200_percent.pak','electron/d3dcompiler_47.dll','electron/dxcompiler.dll','electron/dxil.dll','electron/electron.exe','electron/ffmpeg.dll','electron/icudtl.dat','electron/LICENSE','electron/LICENSES.chromium.html','electron/resources.pak','electron/snapshot_blob.bin','electron/v8_context_snapshot.bin','electron/version','electron/vk_swiftshader_icd.json','electron/vk_swiftshader.dll','electron/vulkan-1.dll'])}),
 Object.freeze({name:'native-addon-outputs',requiredFiles:Object.freeze(['desktop/native/terminal-host-roster-candidate/build/Release/siren_terminal_host_roster_candidate.node','desktop/native/terminal-creator-three-lane/build/Release/siren_terminal_creator_three_lane.node','desktop/native/terminal-filesystem-candidate/build/Release/siren_terminal_filesystem_candidate.node'])}),
 Object.freeze({name:'dedicated-pty-provider-and-dependencies',requiredFiles:Object.freeze(['desktop/runtime/terminal-provider/node_modules/node-pty/package.json','desktop/runtime/terminal-provider/node_modules/node-pty/lib/index.js'])}),
 Object.freeze({name:'process-reader-outputs',requiredFiles:Object.freeze(REQUIRED_APPLICATION_PATHS.filter(p=>p.startsWith('desktop/native/generated/')))})
]);
const HASH=/^[a-f0-9]{64}$/,MAX_FILES=8192,MAX_FILE=268435456;
const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype),typedLength=Object.getOwnPropertyDescriptor(typedPrototype,'length').get,typedBuffer=Object.getOwnPropertyDescriptor(typedPrototype,'buffer').get;
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Error(code);};
function data(value,keys,code='STAGING_ARGUMENT_REFUSED'){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail(code);
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(k=>!keys.includes(k)))fail(code);
 const out=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail(code);out[key]=d.value;}return out;
}
function list(value,code='STAGING_ARGUMENT_REFUSED'){
 if(types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)fail(code);
 const n=Object.getOwnPropertyDescriptor(value,'length')?.value;if(!Number.isSafeInteger(n)||n<0||n>MAX_FILES||Reflect.ownKeys(value).length!==n+1)fail(code);
 const out=[];for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail(code);out.push(d.value);}return out;
}
function name(value){
 if(typeof value!=='string'||value.length>1024||!value.isWellFormed())fail('STAGING_PATH_REFUSED');
 if(value.split('/').some(p=>!p||p==='.'||p==='..'||p.length>255||/[\\<>:"|?*\x00-\x1f\x7f-\x9f]/.test(p)||/[ .]$/.test(p)||p.normalize('NFC')!==p||/~\d/.test(p)||/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i.test(p)))fail('STAGING_PATH_REFUSED');return value;
}
function rows(value){
 const seen=new Set(),out=[];let total=0;
 for(const item of list(value)){
  const r=data(item,['path','bytes','sha256']);name(r.path);const key=r.path.toUpperCase();
  if(seen.has(key))fail('STAGING_DUPLICATE_DESTINATION');seen.add(key);
  if(!Number.isSafeInteger(r.bytes)||r.bytes<0||r.bytes>MAX_FILE||typeof r.sha256!=='string'||!HASH.test(r.sha256))fail('STAGING_INPUT_ROW_REFUSED');
  total+=r.bytes;if(total>4294967296)fail('STAGING_INPUT_ROW_REFUSED');out.push(Object.freeze({...r}));
 }
 return Object.freeze(out.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0));
}
function absolute(value){if(typeof value!=='string'||value.length>2048||!isAbsolute(value)||resolve(value)!==value||value===parse(value).root)fail('STAGING_ROOT_REFUSED');return value;}
const folded=p=>process.platform==='win32'?p.toLowerCase():p;
function contains(parent,child){const r=relative(folded(parent),folded(child));return !r||r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r);}
function separate(a,b){if(contains(a,b)||contains(b,a))fail('STAGING_ROOT_ALIAS_REFUSED');}
async function existing(path,directory){
 const st=await fs.lstat(path);if(st.isSymbolicLink()||directory&&!st.isDirectory()||!directory&&(!st.isFile()||st.nlink!==1))fail('STAGING_LINK_OR_TYPE_REFUSED');
 if(folded(await fs.realpath(path))!==folded(path))fail('STAGING_LINK_OR_TYPE_REFUSED');return st;
}
async function ancestors(path){
 const chain=[];for(let p=path;;p=dirname(p)){chain.unshift(p);if(p===parse(p).root)break;}
 let missing=false;for(const p of chain){if(missing)continue;try{await existing(p,true);}catch(error){if(error.code==='ENOENT'){missing=true;continue;}throw error;}}
}
async function read(path){
 await ancestors(dirname(path));const before=await existing(path,false);if(before.size>MAX_FILE)fail('STAGING_INPUT_SIZE_REFUSED');
 const body=await fs.readFile(path),after=await existing(path,false);
 if(before.dev!==after.dev||before.ino!==after.ino||before.size!==body.length||after.size!==body.length||before.mtimeMs!==after.mtimeMs)fail('STAGING_INPUT_CHANGED_DURING_READ');
 return {body,pin:{path,bytes:body.length,sha256:hash(body)}};
}
async function inventory(root,{exclude=null}={}){
 await ancestors(root);await existing(root,true);const files=[],directories=[''],seen=new Set();
 async function visit(directory,prefix=''){
  for(const entry of(await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
   const p=prefix?prefix+'/'+entry.name:entry.name;name(p);if(p===exclude)continue;
   const key=p.toUpperCase();if(seen.has(key))fail('STAGING_DUPLICATE_DESTINATION');seen.add(key);
   const filename=join(root,...p.split('/')),st=await fs.lstat(filename);
   if(st.isDirectory()){await existing(filename,true);directories.push(p);await visit(filename,p);}else{const held=await read(filename);files.push({path:p,bytes:held.pin.bytes,sha256:held.pin.sha256});}
  }
 }
 await visit(root);return {directory:root,files:files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),directories:directories.sort()};
}
function directoryNames(files){const set=new Set(['']);for(const {path}of files){const parts=path.split('/');parts.pop();while(parts.length){set.add(parts.join('/'));parts.pop();}}return [...set].sort();}
function exact(actual,expected,code){if(!isDeepStrictEqual(actual.files,expected)||!isDeepStrictEqual(actual.directories,directoryNames(expected)))fail(code);}
async function write(path,body){await ancestors(dirname(path));await fs.mkdir(dirname(path),{recursive:true});await ancestors(dirname(path));await fs.writeFile(path,body,{flag:'wx'});return (await read(path)).pin;}
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const sameRows=(a,b)=>isDeepStrictEqual(a,b);
const packageOf=p=>p.startsWith('@')?p.split('/').slice(0,2).join('/'):p.split('/')[0];
function runtimeFrom(tooling){return tooling.filter(row=>PACKAGE_NAMES.includes(packageOf(row.path))).map(row=>Object.freeze({path:'desktop/node_modules/'+row.path,bytes:row.bytes,sha256:row.sha256})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
function byteSnapshot(value){
 if(types.isProxy(value)||!Buffer.isBuffer(value)||Object.getPrototypeOf(value)!==Buffer.prototype)fail('STAGING_RECEIPT_REFUSED');
 let n,backing;try{n=typedLength.call(value);backing=typedBuffer.call(value);}catch{fail('STAGING_RECEIPT_REFUSED');}
 if(!Number.isInteger(n)||n<1||n>16777216||types.isSharedArrayBuffer(backing))fail('STAGING_RECEIPT_REFUSED');
 const out=Buffer.alloc(n);Uint8Array.prototype.set.call(out,value);return out;
}
function parsed(bytes){try{return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));}catch{fail('STAGING_RECEIPT_REFUSED');}}
function externalSlots(){return EXTERNAL.map(slot=>({name:slot.name,bound:false,requiredFiles:[...slot.requiredFiles],completeFileAndDirectoryInventoryRequired:true,originAndSourceBuildLinkageRequired:true,independentAcceptanceRequired:true}));}
function recipeFor(ledgerSha256,runtimeDependencyFiles){return {schema:1,kind:'APPLICATION_STAGE_RECIPE_EXTERNAL_INPUTS_PENDING',applicationStageLedgerSha256:ledgerSha256,externalSlots:externalSlots(),runtimeDependencyFiles,completeRuntimeDependencyInventoryAcceptance:false,assemblyReady:false,completeRuntimeClosure:false,nativeExecutionAdmitted:false,approvedCompleteRuntimeSourceBuildReceipt:false};}
function captureRecipe(value){
 const r=data(value,['schema','kind','applicationStageLedgerSha256','externalSlots','runtimeDependencyFiles','completeRuntimeDependencyInventoryAcceptance','assemblyReady','completeRuntimeClosure','nativeExecutionAdmitted','approvedCompleteRuntimeSourceBuildReceipt'],'STAGING_RECIPE_REFUSED');
 const dependencyFiles=rows(r.runtimeDependencyFiles);
 if(typeof r.applicationStageLedgerSha256!=='string'||!HASH.test(r.applicationStageLedgerSha256)||!isDeepStrictEqual({...r},recipeFor(r.applicationStageLedgerSha256,dependencyFiles)))fail('STAGING_RECIPE_REFUSED');return r;
}

export function assessTerminalAssemblyReadiness(options){
 const v=data(options,['recipeBytes','expectedRecipeSha256']),body=byteSnapshot(v.recipeBytes);if(typeof v.expectedRecipeSha256!=='string'||!HASH.test(v.expectedRecipeSha256)||hash(body)!==v.expectedRecipeSha256)fail('STAGING_RECIPE_PIN_REFUSED');
 const recipe=captureRecipe(parsed(body));return Object.freeze({ready:false,code:'EXTERNAL_INPUTS_UNBOUND',missingMandatorySlots:Object.freeze([...recipe.externalSlots.map(slot=>slot.name),'complete-runtime-dependency-inventory-acceptance']),missingRequiredFiles:Object.freeze(recipe.externalSlots.flatMap(slot=>slot.requiredFiles)),completeRuntimeClosure:false,nativeExecutionAdmitted:false});
}

export async function verifyTerminalApplicationStage(options){
 const v=data(options,['stageDirectory','ledgerBytes','expectedLedgerSha256']),stage=absolute(v.stageDirectory),body=byteSnapshot(v.ledgerBytes);
 if(typeof v.expectedLedgerSha256!=='string'||!HASH.test(v.expectedLedgerSha256)||hash(body)!==v.expectedLedgerSha256)fail('STAGING_LEDGER_PIN_REFUSED');
 const l=data(parsed(body),['schema','status','files','directories','generatedSelection','runtimeDependencyFiles','selectedSourcePaths','contentIdentitySha256','completeRuntimeClosure','nativeExecutionAdmitted'],'STAGING_LEDGER_REFUSED'),files=rows(l.files),runtime=rows(l.runtimeDependencyFiles);
 const selected=[...SOURCES,...GENERATED,...runtime.map(row=>row.path)].sort();
 if(l.schema!==1||l.status!=='APPLICATION_STAGE_COMPLETE_EXTERNAL_INPUTS_PENDING'||l.completeRuntimeClosure!==false||l.nativeExecutionAdmitted!==false||!isDeepStrictEqual(l.generatedSelection,GENERATED)||!isDeepStrictEqual(l.selectedSourcePaths,SOURCES)||!isDeepStrictEqual(l.directories,directoryNames(files))||!isDeepStrictEqual(files.map(row=>row.path),selected)||l.contentIdentitySha256!==hash(json(files)))fail('STAGING_LEDGER_REFUSED');
 for(const p of REQUIRED_APPLICATION_PATHS.filter(p=>p.startsWith('desktop/node_modules/')))if(!files.some(row=>row.path===p))fail('STAGING_RUNTIME_DEPENDENCY_MISSING');
 const actual=await inventory(stage);exact(actual,files,'STAGING_OUTPUT_MEMBERSHIP_OR_BODY_REFUSED');
 return Object.freeze({status:l.status,applicationVerified:true,assemblyReady:false,completeRuntimeClosure:false,nativeExecutionAdmitted:false,files:files.length,directories:l.directories.length,contentIdentitySha256:l.contentIdentitySha256});
}

export async function stageTerminalApplication(options){
 const v=data(options,['outputDir','dependenciesRoot','baselinePath','expectedBaselineSha256','expectedCanonicalBaselineSha256','sourceFiles','toolingFiles','rendererFiles','runtimeDependencyFiles']);
 const out=absolute(v.outputDir),dependencies=absolute(v.dependenciesRoot),baseline=absolute(v.baselinePath),sourceFiles=rows(v.sourceFiles),tooling=rows(v.toolingFiles),renderer=rows(v.rendererFiles),runtime=rows(v.runtimeDependencyFiles);
 if(GENERATED.length!==19||PACKAGE_NAMES.length!==21||!GENERATED.includes('desktop/generated/terminal-launch-preload.cjs')||!GENERATED.includes('desktop/generated/windows/terminal-licenses.txt'))fail('STAGING_CURRENT_SELECTION_REFUSED');
 if(v.expectedBaselineSha256!==BASELINE_SHA256||v.expectedCanonicalBaselineSha256!==BASELINE_SHA256)fail('STAGING_BASELINE_PIN_REFUSED');
 if(out.split(/[\\/]/).some(part=>part.toLowerCase()==='runtime'))fail('STAGING_CONSUMED_RUNTIME_REFUSED');
 separate(out,sourceRoot);separate(out,dependencies);separate(out,dirname(baseline));
 if(!sameRows(runtime,runtimeFrom(tooling)))fail('STAGING_RUNTIME_DECLARATION_REFUSED');
 for(const p of SOURCES)if(!sourceFiles.some(row=>row.path===p))fail('STAGING_SOURCE_DECLARATION_REFUSED');
 const canonical=join(desktop,'baseline/R78.html'),toolRoot=join(desktop,'node_modules');
 await ancestors(out);try{await fs.lstat(out);fail('STAGING_OUTPUT_ALREADY_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}
 async function captureInputs(){
  const source=await inventory(sourceRoot,{exclude:'desktop/node_modules'}),tools=await inventory(toolRoot),rendererInputs=await inventory(dependencies),explicit=(await read(baseline)).pin,canonicalPin=(await read(canonical)).pin;
  exact(source,sourceFiles,'STAGING_SOURCE_INPUT_MISMATCH');exact(tools,tooling,'STAGING_TOOL_INPUT_MISMATCH');exact(rendererInputs,renderer,'STAGING_RENDERER_INPUT_MISMATCH');
  if(explicit.sha256!==BASELINE_SHA256||canonicalPin.sha256!==BASELINE_SHA256)fail('STAGING_BASELINE_BODY_REFUSED');
  return {source,tools,rendererInputs,explicitBaseline:explicit,canonicalBaseline:canonicalPin};
 }
 const before=await captureInputs();
 const lock=parsed((await read(join(desktop,'package-lock.json'))).body),dependencyInventories=[];
 for(const packageName of PACKAGE_NAMES){
  const manifest=parsed((await read(join(toolRoot,...packageName.split('/'),'package.json'))).body);
  if(manifest.name!==packageName||manifest.version!==lock.packages?.['node_modules/'+packageName]?.version)fail('STAGING_RUNTIME_MANIFEST_REFUSED');
  for(const required of Object.keys({...manifest.dependencies,...manifest.optionalDependencies}))if(!PACKAGE_NAMES.includes(required))fail('STAGING_RUNTIME_DEPENDENCY_UNDECLARED');
  dependencyInventories.push({name:packageName,version:manifest.version,files:runtime.filter(row=>row.path.startsWith('desktop/node_modules/'+packageName+'/')),completeDeclaredSelection:true,completePublishedPackageInventoryAccepted:false});
 }
 await fs.mkdir(out);const evidence=join(out,'evidence'),stage=join(out,'application-stage'),scratch=join(out,'scratch');await fs.mkdir(evidence);await fs.mkdir(stage);
 const beforePin=await write(join(evidence,'inputs-before-build.json'),json(before));
 try{
  const buildRequest={outputDir:scratch,dependenciesRoot:dependencies,baselinePath:baseline,expectedSha256:BASELINE_SHA256,nativeSourceLayout:false};
  await write(join(evidence,'ordinary-build-request.json'),json({options:buildRequest,nativeBootstrapOwnProperty:false,selection:'unchanged ordinary builder'}));
  const buildReceipt=await buildTerminalDesktopCandidate(buildRequest);
  if(buildReceipt.scope!=='SOURCE_ONLY_DESKTOP_CANDIDATE'||buildReceipt.constructorsBundled!==true||buildReceipt.nativeAdmission!==false)fail('STAGING_FULL_TERMINAL_BUILD_REQUIRED');
  await write(join(evidence,'ordinary-build-return.json'),json(buildReceipt));
  const scratchInventory=await inventory(scratch),scratchPin=await write(join(evidence,'scratch-inventory.json'),json(scratchInventory));
  const afterBuild=await captureInputs();if(!isDeepStrictEqual(before,afterBuild))fail('STAGING_INPUT_CHANGED_DURING_BUILD');
  const copies=[];
  async function copy(origin,destination,expected,category){
   const first=await read(origin);if(first.pin.bytes!==expected.bytes||first.pin.sha256!==expected.sha256)fail('STAGING_COPY_SOURCE_PIN_REFUSED');
   const copied=await write(join(stage,...destination.split('/')),first.body),after=(await read(origin)).pin;
   if(!isDeepStrictEqual(first.pin,after)||copied.bytes!==first.pin.bytes||copied.sha256!==first.pin.sha256)fail('STAGING_COPY_CHANGED');
   copies.push({path:destination,category,before:first.pin,copied,after});
  }
  const sourceTable=new Map(sourceFiles.map(row=>[row.path,row])),scratchTable=new Map(scratchInventory.files.map(row=>[row.path,row]));
  for(const p of SOURCES)await copy(join(sourceRoot,...p.split('/')),p,sourceTable.get(p),'current-application-source');
  for(const p of GENERATED){const relative=p.slice('desktop/'.length),expected=scratchTable.get(relative);if(!expected)fail('STAGING_REQUIRED_GENERATED_MISSING');await copy(join(scratch,...relative.split('/')),p,expected,'maintained-generated-output');}
  for(const row of runtime)await copy(join(sourceRoot,...row.path.split('/')),row.path,row,'declared-runtime-dependency-file');
  const actual=await inventory(stage),expected=copies.map(row=>({path:row.path,bytes:row.copied.bytes,sha256:row.copied.sha256})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  exact(actual,expected,'STAGING_OUTPUT_MEMBERSHIP_OR_BODY_REFUSED');
  const ledger={schema:1,status:'APPLICATION_STAGE_COMPLETE_EXTERNAL_INPUTS_PENDING',files:expected,directories:actual.directories,generatedSelection:[...GENERATED],runtimeDependencyFiles:[...runtime],selectedSourcePaths:[...SOURCES],contentIdentitySha256:hash(json(expected)),completeRuntimeClosure:false,nativeExecutionAdmitted:false};
  const ledgerBody=json(ledger),ledgerPin=await write(join(out,'application-stage-ledger.json'),ledgerBody),recipe=recipeFor(ledgerPin.sha256,[...runtime]),recipeBody=json(recipe),recipePin=await write(join(out,'assembly-recipe.json'),recipeBody);
  const readiness=assessTerminalAssemblyReadiness({recipeBytes:recipeBody,expectedRecipeSha256:recipePin.sha256});await write(join(out,'assembly-readiness.json'),json(readiness));
  await write(join(evidence,'copy-ledger.json'),json({copies,dependencyInventories,builderToolsExcluded:tooling.filter(row=>!PACKAGE_NAMES.includes(packageOf(row.path))),selectedRendererInputs:renderer,selectedRendererInputsAreNotCompletePackages:true,scratchSourcesEntryAndPackageAdopted:false}));
  const after=await captureInputs();if(!isDeepStrictEqual(before,after))fail('STAGING_INPUT_CHANGED_DURING_COPY');const afterPin=await write(join(evidence,'inputs-after-stage.json'),json(after));
  const verification=await verifyTerminalApplicationStage({stageDirectory:stage,ledgerBytes:ledgerBody,expectedLedgerSha256:ledgerPin.sha256});
  const receipt=Object.freeze({schema:1,status:ledger.status,stageDirectory:stage,ledger:ledgerPin,recipe:recipePin,readiness,beforeInputs:beforePin,afterInputs:afterPin,scratchInventory:scratchPin,verification,completeRuntimeClosure:false,nativeExecutionAdmitted:false,loadedModuleProvenanceVerified:false});
  await write(join(out,'application-stage-receipt.json'),json(receipt));return receipt;
 }catch(error){await write(join(evidence,'failed-stage.json'),json({name:error.name,message:error.message,partialOutputsPreserved:true,assemblyReady:false,nativeExecutionAdmitted:false}));throw error;}
}
