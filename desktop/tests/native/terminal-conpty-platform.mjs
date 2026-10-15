// Test-candidate eligibility only; no product or supported-OS admission.
// Pinned node-pty1.1.0 otherwise falls back to winpty below build18309.
export function requireQualifiedConptyPlatform(value){
 const version=value?.windowsVersion;
 const parts=typeof version==='string'&&version.length<=64&&/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(version);
 const build=parts?Number(parts[3]):NaN;
 if(value?.platform!=='win32'||value?.arch!=='x64'||!parts||parts[1]!=='10'||parts[2]!=='0'||!Number.isSafeInteger(build)||build<18309||build>0xffffffff)throw new Error('CONPTY_PLATFORM_REFUSED');
}
export function requireSelectedOsConpty(value){
 if(value?.useConpty!==true||value?.useConptyDll!==false)throw new Error('CONPTY_BACKEND_REFUSED');
}
export function isQualifiedOsConptyObservation(worker){
 try{
  requireQualifiedConptyPlatform({platform:worker?.runtime?.platform,arch:worker?.runtime?.arch,windowsVersion:worker?.windowsRelease});
  requireSelectedOsConpty({useConpty:worker?.osConpty,useConptyDll:worker?.useConptyDll});return true;
 }catch{return false;}
}
