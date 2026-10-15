// Explicit local build. No addon import, native execution, network or activation.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.16.0');
assert.equal(process.argv.length,4,'OUTPUT_AND_VERIFIED_DOWNLOAD_DIRECTORY_REQUIRED');
const root=fileURLToPath(new URL('../../../',import.meta.url)),output=resolve(process.argv[2]),prior=resolve(process.argv[3]);
const run=promisify(execFile),hash=b=>createHash('sha256').update(b).digest('hex');
const record=async path=>{const b=await readFile(path);return {path,bytes:b.length,sha256:hash(b)};};
const sources=[
 ['desktop/native/terminal-host-roster-candidate/ownership.cc','d7014c6401e4e1186f3180a7377594cd044b16a84006a0ef38d6b6903c366fdd'],
 ['desktop/native/terminal-host-roster-candidate/peer-endpoints.inc','aa4ccd3428a1c547a5e8dccc1116ebab45a3be6972c1229903db36c5081be476'],
];
// Full exact digests, refusal before compilation. No source transformation.
const inputs=[];for(const [path,expected] of sources){const row=await record(join(root,path));assert.equal(row.sha256,expected);inputs.push(row);}
for(const [name,expected] of [['node-v24.16.0-headers.tar.gz','ee3466c7ed5101cdc82978a5164148204bfffae0ddacda24ef6d9805bdf4fc07'],['node.lib','4ab42af597bc4f0957e9e2dcd5db18bdf223406a0c8e0b6be0f28e57977b808b']]){
 const row=await record(join(prior,'downloads',name));assert.equal(row.sha256,expected);inputs.push(row);
}
const msvc='D:/SIREN_Tools/VSBuildTools2022/VC/Tools/MSVC/14.44.35207',sdk='C:/Program Files (x86)/Windows Kits/10';
const cl=join(msvc,'bin/Hostx64/x64/cl.exe'),link=join(msvc,'bin/Hostx64/x64/link.exe');
const tar='C:/Windows/System32/tar.exe';
for(const p of [cl,link,tar,process.execPath,join(root,'desktop/native/terminal-host-roster-candidate/binding.gyp'),fileURLToPath(import.meta.url)])inputs.push(await record(p));
await mkdir(output);const build=join(output,'build');await mkdir(build);
// Extract the exact verified official archive afresh; never trust a caller's
// previously extracted header tree to correspond to the archive digest.
const extracted=join(output,'verified-headers');await mkdir(extracted);
await run(tar,['-xzf',join(prior,'downloads/node-v24.16.0-headers.tar.gz'),'-C',extracted],{windowsHide:true,timeout:30000,maxBuffer:1048576});
const headers=join(extracted,'node-v24.16.0/include/node');assert.equal((await lstat(join(headers,'node_api.h'))).isFile(),true);
const args=['/nologo','/LD','/MD','/EHsc','/std:c++20','/showIncludes','/DNAPI_VERSION=10','/D_WIN32_WINNT=0x0A00','/DWIN32_LEAN_AND_MEAN','/DNOMINMAX','/I'+headers,'/Fo'+join(build,'ownership.obj'),join(root,sources[0][0]),'/link','/OUT:'+join(build,'siren_terminal_host_roster_candidate.node'),join(prior,'downloads/node.lib'),'kernel32.lib','advapi32.lib'];
const env={...process.env,INCLUDE:[join(msvc,'include'),...['ucrt','shared','um'].map(p=>join(sdk,'Include/10.0.26100.0',p))].join(';'),LIB:[join(msvc,'lib/x64'),join(sdk,'Lib/10.0.26100.0/ucrt/x64'),join(sdk,'Lib/10.0.26100.0/um/x64')].join(';')};
const receipt={schema:1,status:'BUILD_STARTED_NOT_QUALIFIED',nativeExecutionAdmitted:false,started:new Date().toISOString(),cl,args,inputs,toolchain:{msvc:'14.44.35207',sdk:'10.0.26100.0',scope:'selected tools and compiler-reported headers; not complete transitive toolchain dependency closure'},runtime:process.versions};
await writeFile(join(output,'build-start.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
let failure;try{const r=await run(cl,args,{cwd:build,env,windowsHide:true,timeout:120000,maxBuffer:4*1048576});await writeFile(join(output,'compile.txt'),r.stdout+r.stderr,{flag:'wx'});
 const includes=[...new Set([...r.stdout.matchAll(/Note: including file:\s*(.+)/g)].map(m=>m[1].trim()))];assert(includes.length>10,'COMPILER_INCLUDE_TRACE_REQUIRED');
 receipt.reportedHeaders=await Promise.all(includes.map(record));receipt.binary=await record(join(build,'siren_terminal_host_roster_candidate.node'));receipt.status='COMPILED_NOT_RUNTIME_QUALIFIED';
}catch(e){failure=e;receipt.status='BUILD_FAILED';receipt.error=e.message;await writeFile(join(output,'compile-error.txt'),(e.stdout??'')+(e.stderr??'')+'\n'+e.stack,{flag:'wx'});}
for(const row of inputs)assert.equal((await record(row.path)).sha256,row.sha256,'BUILD_INPUT_DRIFT');
receipt.finished=new Date().toISOString();await writeFile(join(output,'build-result.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:receipt.status,headers:receipt.reportedHeaders?.length,binary:receipt.binary,nativeExecutionAdmitted:false}));if(failure)throw failure;
