import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {readOwnedBytes} from '../projects/io.mjs';
const run=promisify(execFile);
export const processReaderSourceSha256='4d751525c646cdc652d5f2e263697ec1b033568167b99cfcabc993c625b726a8';
export const hashProcessReader=bytes=>createHash('sha256').update(bytes).digest('hex');
export function processReaderPaths(moduleUrl=import.meta.url){
 const folder=dirname(fileURLToPath(moduleUrl)),packaged=/[\\/]app\.asar[\\/]src[\\/]recovery$/.test(folder);
 const root=packaged?join(folder,'../../..'):join(folder,'../../native/generated');
 return {executable:join(root,packaged?'siren-process-identity.exe':'process-identity.exe'),metadata:join(root,packaged?'siren-process-identity.json':'process-identity.json')};
}
export function admitProcessReader(metadata,binary){
 if(metadata?.schema!==1||metadata.kind!=='windows-process-reader'||metadata.sourceSha256!==processReaderSourceSha256||
  !Number.isSafeInteger(metadata.binary?.bytes)||metadata.binary.bytes<1024||metadata.binary.bytes>131072||binary.length!==metadata.binary.bytes||
  binary.subarray(0,2).toString()!=='MZ'||!/^([a-f0-9]{64})$/.test(metadata.binary.sha256)||hashProcessReader(binary)!==metadata.binary.sha256)throw Error('PROCESS_READER_IDENTITY_REFUSED');
 return true;
}
export async function runWindowsIdentity(pid,options,{read=readOwnedBytes,execute=run}={}){
 if(!Number.isSafeInteger(pid)||pid<1||pid>0xffffffff)throw Error('PROCESS_PID_REFUSED');
 const paths=processReaderPaths(),metadata=JSON.parse((await read(paths.metadata,4096)).toString('utf8'));
 admitProcessReader(metadata,await read(paths.executable,131072));
 return execute(paths.executable,[String(pid)],{...options,shell:false,windowsHide:true});
}
