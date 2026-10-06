import { app, safeStorage } from 'electron';
import { readSync, writeSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { pinRequest, pinResponse, encodePinFrame, decodePinFrame, writePinFrame } from './pin-protocol.mjs';

// No BrowserWindow, webContents, network, account, update or renderer bridge.
// Input is synchronous before ready so the dedicated profile is installed
// before Chromium initializes Local State. The parent owns the IO deadline.
function owned(path,directory){const expected=resolve(path),info=lstatSync(expected);if((directory?!info.isDirectory():!info.isFile())||info.isSymbolicLink()||realpathSync(expected).toLowerCase()!==expected.toLowerCase()||!directory&&info.size>65536)throw Error('Path refused');return expected;}
let request;
try{
 const flags=process.argv.filter(arg=>arg.startsWith('--siren-pin-worker'));
 if(flags.length!==1||!flags[0].startsWith('--siren-pin-worker-v1='))throw Error('Worker refused');
 const profile=resolve(flags[0].slice('--siren-pin-worker-v1='.length));
 if(basename(profile)!=='PinProtection'||basename(dirname(profile))!=='Access')throw Error('Profile refused');
 owned(dirname(dirname(profile)),true);owned(dirname(profile),true);owned(profile,true);
 const chunks=[];let size=0;for(;;){const bytes=Buffer.alloc(4096),length=readSync(0,bytes,0,bytes.length,null);if(!length)break;size+=length;if(size>32772)throw Error('Input refused');chunks.push(bytes.subarray(0,length));}
 const frame=Buffer.concat(chunks);try{request=pinRequest(decodePinFrame(frame));}finally{frame.fill(0);for(const bytes of chunks)bytes.fill(0);}
 for(const name of ['Local State','Preferences'])try{owned(join(profile,name),false);}catch(error){if(error.code!=='ENOENT'||name==='Local State'&&request.requireKey)throw error;}
 app.setPath('userData',profile);app.setPath('sessionData',profile);app.disableHardwareAcceleration();
 // The worker keeps this separate writer authority until its actual exit,
 // including when an abrupt parent termination leaves it running briefly.
 if(!app.requestSingleInstanceLock())throw Error('Profile busy');
 app.on('second-instance',()=>{});
}catch{app.exit(23);}
if(request)app.whenReady().then(()=>{
 if(!safeStorage.isEncryptionAvailable())throw Error('Protection unavailable');
 const fields=request.operation==='encrypt'?{cipher64:safeStorage.encryptString(request.text).toString('base64')}:{text:safeStorage.decryptString(Buffer.from(request.cipher64,'base64'))};
 const response=pinResponse({schema:1,nonce:request.nonce,operation:request.operation,...fields},request),frame=encodePinFrame(response);
 try{writePinFrame((bytes,offset,length)=>writeSync(3,bytes,offset,length),frame);}finally{frame.fill(0);}
 // This graceful exit persists Chromium's key before the parent launches an
 // independent decrypt process. Output alone is never the parent's receipt.
 app.quit();
}).catch(()=>app.exit(23));
