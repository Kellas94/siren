// Package fixed test inputs for a fresh local Windows Sandbox, never product data.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,constants} from 'node:fs';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url));
assert.equal(process.argv.length,4);const destination=resolve(process.argv[2]),addon=resolve(process.argv[3]);
assert(destination.startsWith('D:\\SIREN_Archive\\2026-10-10\\native-sandbox-'),'EXACT_ARCHIVE_ROOT_REQUIRED');
mkdirSync(destination);const input=join(destination,'input'),output=join(destination,'output');mkdirSync(input);mkdirSync(output);
const digest=b=>createHash('sha256').update(b).digest('hex'),files=[];
const buildReceiptPath=join(dirname(dirname(addon)),'build-result.json'),buildReceipt=JSON.parse(readFileSync(buildReceiptPath,'utf8'));
assert.equal(buildReceipt.status,'COMPILED_NOT_RUNTIME_QUALIFIED');assert.equal(resolve(buildReceipt.binary.path),addon);
assert.equal(buildReceipt.binary.sha256,digest(readFileSync(addon)));assert.equal(buildReceipt.binary.bytes,readFileSync(addon).length);
for(const path of ['ownership.cc','peer-endpoints.inc']){
 const source=join(root,'desktop/native/terminal-host-roster-candidate',path),record=buildReceipt.inputs.find(r=>resolve(r.path)===resolve(source));
 assert(record);assert.equal(digest(readFileSync(source)),record.sha256,'BUILD_SOURCE_DRIFT');
}
const copy=(source,target)=>{const bytes=readFileSync(source);mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target,constants.COPYFILE_EXCL);assert.equal(digest(readFileSync(target)),digest(bytes));files.push({path:relative(input,target),bytes:bytes.length,sha256:digest(bytes)});};
for(const path of [
 'desktop/tests/native/terminal-host-roster-local-runner.mjs',
 'desktop/tests/native/terminal-host-roster-local-worker.mjs',
 'desktop/tests/native/terminal-local-fixture-contract.mjs',
 'desktop/tests/native/terminal-local-case-verdict.mjs',
 'desktop/tests/fixtures/terminal-host-roster-local-creator.mjs',
 'desktop/tests/fixtures/terminal-host-roster-local-payload.mjs',
 'desktop/tests/fixtures/terminal-host-roster-observer-tail.cs',
 'desktop/tests/fixtures/terminal-main-owner-observer.cs',
 'desktop/src/terminal/host-async-receipt-contract.mjs',
 'desktop/src/terminal/host-async-captured-operation.mjs',
 'desktop/native/terminal-host-roster-candidate/ownership.cc',
 'desktop/native/terminal-host-roster-candidate/peer-endpoints.inc',
])copy(join(root,path),join(input,'portable',path));
copy(join(root,'desktop/tests/native/terminal-local-sandbox-bootstrap.mjs'),join(input,'bootstrap.mjs'));
copy(buildReceiptPath,join(input,'build-result.json'));
copy(addon,join(input,'candidate.node'));copy(process.execPath,join(input,'runtime/node.exe'));
for(const dll of ['msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll'])copy('D:/SIREN_Tools/VSBuildTools2022/VC/Redist/MSVC/14.44.35112/x64/Microsoft.VC143.CRT/'+dll,join(input,'runtime',dll));
const manifest={scope:'FIXED_LOCAL_TEST_BUNDLE_ONLY',nativeExecutionAdmitted:false,nodeHash:digest(readFileSync(process.execPath)),addonHash:digest(readFileSync(addon)),files};
writeFileSync(join(input,'bundle-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
const xml=p=>p.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
writeFileSync(join(destination,'qualification.wsb'),`<Configuration>
 <vGPU>Disable</vGPU><Networking>Disable</Networking><AudioInput>Disable</AudioInput><VideoInput>Disable</VideoInput><PrinterRedirection>Disable</PrinterRedirection><ClipboardRedirection>Disable</ClipboardRedirection><MemoryInMB>6144</MemoryInMB>
 <MappedFolders>
  <MappedFolder><HostFolder>${xml(input)}</HostFolder><SandboxFolder>C:\\SirenInput</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
  <MappedFolder><HostFolder>${xml(output)}</HostFolder><SandboxFolder>C:\\SirenResults</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
 </MappedFolders>
 <LogonCommand><Command>C:\\SirenInput\\runtime\\node.exe C:\\SirenInput\\bootstrap.mjs</Command></LogonCommand>
</Configuration>\n`,{flag:'wx'});
console.log(JSON.stringify({destination,files:files.length,bytes:files.reduce((a,r)=>a+r.bytes,0),nativeExecutionAdmitted:false,started:false}));
