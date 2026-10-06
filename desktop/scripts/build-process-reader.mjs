import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {processReaderSourceSha256,admitProcessReader} from '../src/recovery/native-process.mjs';
import {readOwnedBytes} from '../src/projects/io.mjs';
import {ownedDirectory} from '../src/projects/paths.mjs';
const run=promisify(execFile),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function admitCachedProcessReader(receipt,binary,compilerSha256){
 if(!/^[a-f0-9]{64}$/.test(compilerSha256)||receipt?.compilerSha256!==compilerSha256)throw Error('PROCESS_READER_COMPILER_REFUSED');
 return admitProcessReader(receipt,binary);
}
export async function buildProcessReader({desktopRoot=fileURLToPath(new URL('../',import.meta.url))}={}){
 if(process.platform!=='win32')throw Error('WINDOWS_PROCESS_READER_BUILD_ONLY');
 const source=join(desktopRoot,'native/process-identity.cs'),bytes=await readFile(source);
 if(hash(Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n')))!==processReaderSourceSha256)throw Error('PROCESS_READER_SOURCE_REFUSED');
 const output=join(desktopRoot,'native/generated');await mkdir(output,{recursive:true});await ownedDirectory(output);
 // Fixed compiler installed with Windows .NET Framework. Never use PATH,
 // download a toolchain or compile during application startup.
 const compiler=join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 if(!/^[A-Za-z]:[\\/]/.test(compiler))throw Error('COMPILER_PATH_REFUSED');
 const executable=join(output,'process-identity.exe'),metadata=join(output,'process-identity.json'),compilerSha256=hash(await readFile(compiler));
 const cached=await Promise.allSettled([readOwnedBytes(metadata,4096),readOwnedBytes(executable,131072)]);
 if(cached.every(result=>result.status==='fulfilled')){
  const receipt=JSON.parse(cached[0].value.toString('utf8'));admitCachedProcessReader(receipt,cached[1].value,compilerSha256);
  return {executable,receipt,reused:true};
 }
 if(!cached.every(result=>result.status==='rejected'&&result.reason?.code==='ENOENT'))throw Error('PROCESS_READER_CACHE_REFUSED');
 await run(compiler,['/nologo','/optimize+','/target:winexe','/out:'+executable,source],{windowsHide:true,shell:false,timeout:30000,maxBuffer:16384});
 const binary=await readFile(executable);if(binary.length<1024||binary.length>131072||binary.subarray(0,2).toString()!=='MZ')throw Error('PROCESS_READER_BINARY_REFUSED');
 const receipt={schema:1,kind:'windows-process-reader',sourceSha256:processReaderSourceSha256,compilerSha256,binary:{bytes:binary.length,sha256:hash(binary)}};
 await writeFile(metadata,JSON.stringify(receipt,null,2));return {executable,receipt,reused:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await buildProcessReader()));
