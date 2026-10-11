// Source/build attestation for one prospective hosted Docs scenario. Importing
// this file performs no capture, writes, build, launch or environment mutation.
import assert from 'node:assert/strict';
import {readFile,lstat,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const SOURCE_ROOTS=Object.freeze(['desktop/build','desktop/licenses','desktop/src']);
export const REQUIRED_FILES=Object.freeze([
 '.gitattributes','.github/workflows/docs-clean-pending-save.yml',
 'desktop/baseline/R78.html','desktop/native/process-identity.cs',
 'desktop/package-lock.json','desktop/package.json',
 'desktop/reviews/2026-10-03-editor-product-dependencies.json',
 'desktop/scripts/build-process-reader.mjs','desktop/tests/native/.gitattributes',
 'desktop/tests/native/attach-page.mjs','desktop/tests/native/condition.mjs',
 'desktop/tests/native/docs-clean-pending-save-preflight.mjs',
 'desktop/tests/native/docs-clean-pending-save.mjs','desktop/tests/native/drive.mjs',
 'desktop/tests/native/pointer.mjs'
]);
const KEYS=['schema','author','role','scope','nativeOutcome','repository','ref','runAttempt','toolchain','expectedGenerated','membershipRoots','rows'];
const TOOLCHAIN={platform:'win32',arch:'x64',node:'v24.16.0',npm:'11.13.0',electron:'44.5.1',esbuild:'0.28.2'};
const GENERATED={baselineSha256:'5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4',docsSha256:'4c5f797b0979d6f5eda5a452535b1e7878be58f55fc0b02ad00d39348a036a55'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ordered=(actual,expected)=>assert.deepEqual(Object.keys(actual),expected);
const allowed=path=>REQUIRED_FILES.includes(path)||SOURCE_ROOTS.some(root=>path.startsWith(root+'/'));
const simplePath=path=>typeof path==='string'&&path.length<=240&&/^[A-Za-z0-9_.\/-]+$/.test(path)&&path.split('/').length<=24&&path.split('/').every(part=>part!==''&&part!=='.'&&part!=='..');

export function parseInputManifest(text){
 assert.equal(typeof text,'string');assert.ok(text.length<=1024*1024);assert.ok(Buffer.byteLength(text,'utf8')<=1024*1024);
 const value=JSON.parse(text);ordered(value,KEYS);assert.equal(text,JSON.stringify(value,null,2)+'\n','CANONICAL_MANIFEST_REQUIRED');
 assert.equal(value.schema,1);assert.equal(value.author,'/root/access_transition_review');assert.equal(value.role,'OWNER_EXECUTION_PREPARATION');
 assert.equal(value.scope,'DOCS_CLEAN_PENDING_SAVE_HOSTED_SOURCE_CLOSURE');assert.equal(value.nativeOutcome,'UNEXECUTED');
 assert.equal(value.repository,'Kellas94/siren');assert.equal(value.ref,'refs/heads/probe/docs-clean-pending-save-20261011');assert.equal(value.runAttempt,1);
 assert.deepEqual(value.toolchain,TOOLCHAIN);assert.deepEqual(value.expectedGenerated,GENERATED);assert.deepEqual(value.membershipRoots,SOURCE_ROOTS);
 assert.ok(Array.isArray(value.rows)&&value.rows.length>=REQUIRED_FILES.length&&value.rows.length<=1000);
 let previous='',total=0;const seen=new Set();
 for(const row of value.rows){
  ordered(row,['path','bytes','sha256']);assert.ok(simplePath(row.path)&&allowed(row.path),'INPUT_PATH_REFUSED');assert.ok(previous<row.path,'SORTED_UNIQUE_INPUTS_REQUIRED');previous=row.path;
  const folded=row.path.toLowerCase();assert.equal(seen.has(folded),false,'CASE_ALIAS_REFUSED');seen.add(folded);
  assert.ok(Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=32*1024*1024);total+=row.bytes;assert.ok(total<=64*1024*1024);
  assert.match(row.sha256,/^[a-f0-9]{64}$/);
 }
 for(const path of REQUIRED_FILES)assert.ok(seen.has(path.toLowerCase()),'REQUIRED_INPUT_MISSING: '+path);
 assert.equal(seen.has('desktop/tests/native/docs-clean-pending-save-inputs.json'),false,'MANIFEST_SELF_REFERENCE_REFUSED');
 return value;
}

async function regular(root,path){
 let current=root;
 const parts=path.split('/');
 for(let index=0;index<parts.length;index++){
  current=join(current,parts[index]);const info=await lstat(current);assert.equal(info.isSymbolicLink(),false,'SYMLINK_INPUT_REFUSED: '+path);
  if(index<parts.length-1)assert.equal(info.isDirectory(),true);else assert.equal(info.isFile(),true);
 }
 return current;
}
async function readBounded(root,path,limit){
 const file=await regular(root,path),before=await lstat(file);assert.ok(before.size<=limit);
 const bytes=await readFile(file),after=await lstat(file);assert.equal(bytes.length,before.size);assert.equal(after.size,before.size);assert.equal(after.ino,before.ino);assert.equal(after.mtimeMs,before.mtimeMs);
 return bytes;
}
async function treeFiles(root,prefix){
 const result=[],pending=[prefix];let entryCount=0;
 while(pending.length){
  const path=pending.pop();assert.ok(path.split('/').length<=24);
  let current=root;for(const part of path.split('/')){current=join(current,part);const info=await lstat(current);assert.equal(info.isSymbolicLink(),false);assert.equal(info.isDirectory(),true);}
  const entries=await readdir(join(root,path),{withFileTypes:true});entryCount+=entries.length;assert.ok(entryCount<=1000);
  for(const entry of entries){const child=path+'/'+entry.name;assert.ok(simplePath(child));assert.equal(entry.isSymbolicLink(),false);if(entry.isDirectory())pending.push(child);else{assert.equal(entry.isFile(),true);result.push(child);}assert.ok(result.length+pending.length<=1000);}
 }
 return result.sort();
}
export async function verifySourceInputs(root,manifest){
 assert.equal(typeof root,'string');const listed=new Set(manifest.rows.map(row=>row.path));
 for(const prefix of SOURCE_ROOTS){const actual=await treeFiles(root,prefix),expected=manifest.rows.filter(row=>row.path.startsWith(prefix+'/')).map(row=>row.path);assert.deepEqual(actual,expected,'SOURCE_MEMBERSHIP_CHANGED: '+prefix);}
 for(const row of manifest.rows){const bytes=await readBounded(root,row.path,32*1024*1024);assert.equal(bytes.length,row.bytes,row.path);assert.equal(sha(bytes),row.sha256,row.path);}
 assert.equal(listed.size,manifest.rows.length);
 const pkg=JSON.parse(await readFile(join(root,'desktop/package.json'),'utf8')),lock=JSON.parse(await readFile(join(root,'desktop/package-lock.json'),'utf8'));
 assert.equal(pkg.type,'module');assert.equal(pkg.main,'src/start.mjs');assert.equal(pkg.engines.node,'>=24.16.0');assert.equal(lock.lockfileVersion,3);
 assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies);assert.deepEqual(lock.packages[''].devDependencies,pkg.devDependencies);
 assert.equal(pkg.devDependencies.electron,TOOLCHAIN.electron);assert.equal(pkg.devDependencies.esbuild,TOOLCHAIN.esbuild);
 assert.equal(sha(await readFile(join(root,'desktop/baseline/R78.html'))),GENERATED.baselineSha256);
 return {verifiedRows:manifest.rows.length,sourceBytes:manifest.rows.reduce((total,row)=>total+row.bytes,0),nativeOutcome:'UNEXECUTED'};
}
async function requireFreshCheckout(root){
 for(const path of ['desktop/generated','desktop/native/generated','desktop/node_modules']){
  let info;try{info=await lstat(join(root,path));}catch(error){if(error?.code==='ENOENT')continue;throw error;}
  assert.equal(info,undefined,'FRESH_CHECKOUT_OUTPUT_ALREADY_PRESENT: '+path);
 }
}
export async function verifyBuiltRenderer(root){
 const buildBytes=await readBounded(root,'desktop/generated/build.json',1024*1024),build=JSON.parse(buildBytes);
 assert.equal(build.schema,1);assert.equal(build.baselineSha256,GENERATED.baselineSha256);assert.equal(build.electron,TOOLCHAIN.electron);assert.equal(build.windowEntrypoints.docs,GENERATED.docsSha256);
 ordered(build.windowEntrypoints,['code','docs','diagram','presenter','audience']);
 const docs=await readBounded(root,'desktop/generated/windows/docs.html',32*1024*1024);assert.equal(sha(docs),GENERATED.docsSha256);
 for(const [role,digest]of Object.entries(build.windowEntrypoints)){assert.ok(['code','docs','diagram','presenter','audience'].includes(role));assert.match(digest,/^[a-f0-9]{64}$/);assert.equal(sha(await readBounded(root,'desktop/generated/windows/'+role+'.html',32*1024*1024)),digest);}
 const entries=[['app.html',build.rendererSha256],['home.html',build.homeEntrypoint.sha256],['presentation-render.html',build.presentationRender.entrySha256],['diagram-vector.html',build.diagramVector.entrySha256],['import-validation.html',build.importValidation.entrySha256],['code-analysis-worker.cjs',build.sourceAnalysis.entrySha256]];
 assert.equal(build.diagramVector.embedSupported,true);assert.equal(build.importValidation.baselineSha256,GENERATED.baselineSha256);
 for(const [path,digest]of entries){assert.match(digest,/^[a-f0-9]{64}$/);assert.equal(sha(await readBounded(root,'desktop/generated/'+path,32*1024*1024)),digest,path);}
 const normalized=docs.toString('utf8').replace(/\r\n?/g,'\n');
 for(const path of ['desktop/src/ui/windows/docs.js','desktop/src/ui/docs/draft.js','desktop/src/ui/docs/diagram-embeds.js'])assert.ok(normalized.includes((await readFile(join(root,path),'utf8')).replace(/\r\n?/g,'\n')),'GENERATED_DOCS_STALE: '+path);
 const electron=JSON.parse(await readBounded(root,'desktop/node_modules/electron/package.json',1024*1024));assert.equal(electron.version,TOOLCHAIN.electron);
 const binaryPath=await regular(root,'desktop/node_modules/electron/dist/electron.exe');assert.ok((await lstat(binaryPath)).size>=1024*1024);
 const reader=JSON.parse(await readBounded(root,'desktop/native/generated/process-identity.json',65536));
 const source=(await readBounded(root,'desktop/native/process-identity.cs',1024*1024)).toString('utf8').replace(/\r\n?/g,'\n');
 assert.equal(reader.sourceSha256,sha(source));
 assert.equal(reader.schema,1);assert.equal(reader.kind,'windows-process-reader');assert.match(reader.compilerSha256,/^[a-f0-9]{64}$/);
 const binary=await readBounded(root,'desktop/native/generated/process-identity.exe',131072);assert.ok(binary.length>=1024&&binary[0]===77&&binary[1]===90);assert.equal(reader.binary.sha256,sha(binary));assert.equal(reader.binary.bytes,binary.length);
 return {docsSha256:sha(docs),buildSha256:sha(buildBytes),processReader:reader,nativeOutcome:'UNEXECUTED'};
}

async function main(){
 assert.ok(process.platform==='win32'&&process.arch==='x64'&&process.version===TOOLCHAIN.node,'HOSTED_TOOLCHAIN_REQUIRED');
 assert.ok(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='Kellas94/siren'&&process.env.GITHUB_REF==='refs/heads/probe/docs-clean-pending-save-20261011'&&process.env.GITHUB_RUN_ATTEMPT==='1','HOSTED_EXACT_FIRST_ATTEMPT_ONLY');
 assert.match(process.env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);assert.match(process.env.GITHUB_RUN_ID??'',/^[1-9][0-9]*$/);
 const phase=process.argv[2];assert.ok(['source','built'].includes(phase)&&process.argv.length===3);
 const root=fileURLToPath(new URL('../../../',import.meta.url)),text=await readFile(join(root,'desktop/tests/native/docs-clean-pending-save-inputs.json'),'utf8');
 const manifest=parseInputManifest(text),source=await verifySourceInputs(root,manifest);
 const toolchain=JSON.parse(await readFile(join(root,'desktop/evidence/docs-clean-pending-save-launch/toolchain.json'),'utf8'));
 assert.equal(toolchain.node,TOOLCHAIN.node);assert.equal(toolchain.npm,TOOLCHAIN.npm);assert.equal(toolchain.commit,process.env.GITHUB_SHA);assert.equal(toolchain.runId,process.env.GITHUB_RUN_ID);assert.equal(toolchain.runAttempt,'1');
 if(phase==='source')await requireFreshCheckout(root);
 const built=phase==='built'?await verifyBuiltRenderer(root):null;
 const receipt={schema:1,author:'/root/access_transition_review',classification:'EXACT_SOURCE_AND_STATIC_BUILD_ONLY',phase,commit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,runAttempt:'1',manifestSha256:sha(text),toolchain,source,built,nativeOutcome:'UNEXECUTED',manifestAttestation:'Manifest is externally bound by the reviewed commit/freeze; this self-check does not authenticate a jointly replaced manifest and verifier.'};
 const out=join(root,'desktop/evidence/docs-clean-pending-save-launch');await mkdir(out,{recursive:true});await writeFile(join(out,phase+'-preflight.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
