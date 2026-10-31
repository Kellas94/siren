// Opt-in private DATA producer; no renderer build, runtime provisioning or factory.
import * as fs from 'node:fs/promises';
import {join,resolve,relative,dirname,parse,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {captureNativeBootstrapInputs,captureConfiguredRuntime} from '../src/terminal/desktop-native-bootstrap.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const OUTPUTS=['runtime-tree.json','approved-source-build-receipt.json','runtime-descriptor.json','package.json','candidate-main.mjs','terminal-candidate-receipt.json'];
const fixedIdentity=s=>{const keys=['dev','ino','mode','nlink','birthtimeNs'];if(keys.some(k=>typeof s[k]!=='bigint')||s.dev<0n||s.ino<=0n||s.mode<=0n||s.nlink<1n||s.birthtimeNs<0n)fail();return Object.fromEntries(keys.map(k=>[k,s[k]]));};
const fileIdentity=s=>{fixedIdentity(s);const keys=['dev','ino','mode','nlink','size','mtimeNs','ctimeNs','birthtimeNs'];if(keys.some(k=>typeof s[k]!=='bigint')||s.size<0n)fail();return Object.fromEntries(keys.map(k=>[k,s[k]]));};
const fail=()=>{throw Error('BOOTSTRAP_OUTPUT_REFUSED');};
async function directory(target){
 const paths=[];for(let p=target;;p=dirname(p)){paths.unshift(p);if(p===parse(p).root)break;}
 let actual;for(const p of paths){const s=await fs.lstat(p,{bigint:true});if(s.isSymbolicLink()||!s.isDirectory()||await fs.realpath(p)!==p)fail();actual=s;}return fixedIdentity(actual);
}
async function membership(control,written){
 const names=[...await fs.readdir(control)],expected=['runtime',...written].sort();if(!isDeepStrictEqual(names.sort(),expected))fail();
 for(const name of names){const s=await fs.lstat(join(control,name),{bigint:true});if(s.isSymbolicLink()||(name==='runtime'?!s.isDirectory():!s.isFile()||s.nlink!==1n))fail();}
}
async function publishFile(control,name,body){
 const target=join(control,name);let handle,primary=null,closeError=null,captured=null;
 try{
  handle=await fs.open(target,'wx+');const initial=await handle.stat({bigint:true});if(!initial.isFile()||initial.nlink!==1n)fail();
  await handle.writeFile(body);const written=await handle.stat({bigint:true});if(written.size!==BigInt(body.length)||!isDeepStrictEqual(fixedIdentity(initial),fixedIdentity(written)))fail();
  const readback=Buffer.alloc(body.length);let offset=0;while(offset<body.length){const r=await handle.read(readback,offset,body.length-offset,offset);if(!Number.isInteger(r.bytesRead)||r.bytesRead<=0)fail();offset+=r.bytesRead;}
  if((await handle.read(Buffer.alloc(1),0,1,offset)).bytesRead!==0||!readback.equals(body)||!isDeepStrictEqual(fileIdentity(await handle.stat({bigint:true})),fileIdentity(written)))fail();
  const atPath=await fs.lstat(target,{bigint:true});if(atPath.isSymbolicLink()||!atPath.isFile()||atPath.nlink!==1n||await fs.realpath(target)!==target||!isDeepStrictEqual(fileIdentity(atPath),fileIdentity(written)))fail();captured=Object.freeze(fileIdentity(written));
 }catch(error){primary=error;}finally{if(handle)try{await handle.close();}catch(error){closeError=error;}}
 if(primary||closeError){const error=Error('BOOTSTRAP_OUTPUT_REFUSED',{cause:primary??closeError});error.primaryError=primary??closeError;error.finalErrors=closeError&&primary?[closeError]:[];throw error;}
 return captured;
}
async function recheckPublished(control,records){
 for(const record of records){
  const target=join(control,record.name);let handle,primary=null,closeError=null;
  try{
   const before=await fs.lstat(target,{bigint:true});if(before.isSymbolicLink()||!before.isFile()||before.nlink!==1n||await fs.realpath(target)!==target||!isDeepStrictEqual(fileIdentity(before),record.identity))fail();
   handle=await fs.open(target,'r');if(!isDeepStrictEqual(fileIdentity(await handle.stat({bigint:true})),record.identity))fail();
   const readback=Buffer.alloc(record.body.length);let offset=0;while(offset<readback.length){const r=await handle.read(readback,offset,readback.length-offset,offset);if(!Number.isInteger(r.bytesRead)||r.bytesRead<=0||r.bytesRead>readback.length-offset)fail();offset+=r.bytesRead;}
   if((await handle.read(Buffer.alloc(1),0,1,offset)).bytesRead!==0||!readback.equals(record.body)||!isDeepStrictEqual(fileIdentity(await handle.stat({bigint:true})),record.identity)||!isDeepStrictEqual(fileIdentity(await fs.lstat(target,{bigint:true})),record.identity)||await fs.realpath(target)!==target)fail();
  }catch(error){primary=error;}finally{if(handle)try{await handle.close();}catch(error){closeError=error;}}
  if(primary||closeError){const error=Error('BOOTSTRAP_OUTPUT_REFUSED',{cause:primary??closeError});error.primaryError=primary??closeError;error.finalErrors=closeError&&primary?[closeError]:[];throw error;}
 }
}
function entry(descriptorSha256){return `if(process.argv.some(arg=>arg.startsWith('--siren-pin-worker'))){
 await import('./runtime/desktop/src/start.mjs');
}else{
 const fs=await import('node:fs/promises'),path=await import('node:path'),url=await import('node:url'),crypto=await import('node:crypto');
 const C=path.resolve(url.fileURLToPath(new URL('.',import.meta.url))),R=path.join(C,'runtime');
 const fail=()=>{throw Error('BOOTSTRAP_CONTROL_REFUSED');},hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const identity=s=>{const values=[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs,s.birthtimeNs];if(values.some(x=>typeof x!=='bigint')||s.dev<0n||s.ino<=0n||s.mode<=0n||s.nlink<1n||s.size<0n)fail();return values;};
 const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
 async function read(target,limit){let h;try{const chain=[];for(let p=path.dirname(target);;p=path.dirname(p)){chain.unshift(p);if(p===path.parse(p).root)break;}for(const p of chain){const s=await fs.lstat(p,{bigint:true});if(s.isSymbolicLink()||!s.isDirectory()||await fs.realpath(p)!==p)fail();}const s=await fs.lstat(target,{bigint:true});if(s.isSymbolicLink()||!s.isFile()||s.nlink!==1n||s.size<1n||s.size>BigInt(limit)||await fs.realpath(target)!==target)fail();h=await fs.open(target,'r');if(!same(identity(s),identity(await h.stat({bigint:true}))))fail();const bytes=Buffer.alloc(Number(s.size));let n=0;while(n<bytes.length){const r=await h.read(bytes,n,bytes.length-n,n);if(!Number.isInteger(r.bytesRead)||r.bytesRead<=0)fail();n+=r.bytesRead;}if((await h.read(Buffer.alloc(1),0,1,n)).bytesRead!==0||!same(identity(s),identity(await h.stat({bigint:true})))||!same(identity(s),identity(await fs.lstat(target,{bigint:true})))||await fs.realpath(target)!==target)fail();return bytes;}finally{if(h)await h.close();}}
 try{
  const {app}=await import('electron');if(app.isPackaged!==false||app.getAppPath()!==C||app.getPath('exe')!==path.join(R,'electron/electron.exe')||process.execPath!==path.join(R,'electron/electron.exe'))fail();
  const descriptorBytes=await read(path.join(C,'runtime-descriptor.json'),1048576);if(hash(descriptorBytes)!==${JSON.stringify(descriptorSha256)})fail();
  const descriptor=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(descriptorBytes));if(!descriptor||Object.keys(descriptor).sort().join(',')!=='approvedSourceBuildReceiptSha256,runtimeTreeSha256,schema'||descriptor.schema!==1||typeof descriptor.runtimeTreeSha256!=='string'||!/^[a-f0-9]{64}$/.test(descriptor.runtimeTreeSha256)||typeof descriptor.approvedSourceBuildReceiptSha256!=='string'||!/^[a-f0-9]{64}$/.test(descriptor.approvedSourceBuildReceiptSha256))fail();
  const manifestBytes=await read(path.join(C,'runtime-tree.json'),16777216),approval=await read(path.join(C,'approved-source-build-receipt.json'),1048576);if(hash(manifestBytes)!==descriptor.runtimeTreeSha256||hash(approval)!==descriptor.approvedSourceBuildReceiptSha256)fail();
  const manifest=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(manifestBytes));if(!manifest||manifest.directory!==R||!Array.isArray(manifest.files))fail();
  for(const name of ['desktop-native-bootstrap.mjs','desktop-native-owned-tree.mjs','desktop-native-runtime-resources.mjs']){const relative='desktop/src/terminal/'+name,rows=manifest.files.filter(row=>row&&row.path===relative);if(rows.length!==1||!Number.isSafeInteger(rows[0].bytes)||rows[0].bytes<1||rows[0].bytes>16777216||typeof rows[0].sha256!=='string'||!/^[a-f0-9]{64}$/.test(rows[0].sha256))fail();const bytes=await read(path.join(R,...relative.split('/')),16777216);if(bytes.length!==rows[0].bytes||hash(bytes)!==rows[0].sha256)fail();}
  const bootstrap=await import('./runtime/desktop/src/terminal/desktop-native-bootstrap.mjs');await bootstrap.startDesktopNativeBootstrap({manifest});
 }catch(cause){throw Error('BOOTSTRAP_CONTROL_REFUSED',{cause});}
}
`;}
export async function buildTerminalNativeBootstrap({outputDir,nativeBootstrap}){
 const source=resolve(fileURLToPath(new URL('../',import.meta.url)));
 if(typeof outputDir!=='string'||!isAbsolute(outputDir)||resolve(outputDir)!==outputDir||outputDir===parse(outputDir).root)fail();
 const control=outputDir,runtime=join(control,'runtime'),within=(a,b)=>{const r=relative(a,b);return !r||r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r);};if(within(source,control)||within(control,source))fail();
 const captured=captureNativeBootstrapInputs(nativeBootstrap,runtime),controlIdentity=await directory(control);await membership(control,[]);
 for(const name of OUTPUTS){try{await fs.lstat(join(control,name));fail();}catch(error){if(error.code!=='ENOENT')throw error;}}
 const owned=await captureConfiguredRuntime(captured.manifest,runtime);if(!isDeepStrictEqual(controlIdentity,await directory(control)))fail();await membership(control,[]);if(!await owned.verifier.recheck(owned.tree))fail();
 const descriptor={schema:1,runtimeTreeSha256:captured.pins.runtimeTreeSha256,approvedSourceBuildReceiptSha256:captured.pins.approvedSourceBuildReceiptSha256},descriptorBytes=Buffer.from(JSON.stringify(descriptor,null,2)+'\n');
 const packageBytes=Buffer.from(JSON.stringify({name:'siren-terminal-native-candidate',version:'0.1.0-dev.1',private:true,type:'module',main:'candidate-main.mjs'},null,2)+'\n'),mainBytes=Buffer.from(entry(hash(descriptorBytes)));
 const receipt=Object.freeze({schema:1,kind:'TERMINAL_NATIVE_BOOTSTRAP_DATA_ONLY',scope:'FIXED_PRIVATE_BOOTSTRAP_CONFIGURED_TREE_DATA',candidatePackageSha256:hash(packageBytes),candidateMainSha256:hash(mainBytes),runtimeDescriptorSha256:hash(descriptorBytes),runtimeTreeSha256:captured.pins.runtimeTreeSha256,approvedSourceBuildReceiptSha256:captured.pins.approvedSourceBuildReceiptSha256,applicationRosterSha256:captured.pins.applicationRosterSha256,configuredTreeFiles:captured.manifest.files.length,configuredTreeDirectories:captured.manifest.directories.length,requiredApplicationFiles:captured.application.length,configuredTreeVerified:true,nativeFactoryConfigured:true,nativeExecutionAdmitted:false,completeRuntimeClosure:false,loadedModuleProvenanceVerified:false,normalPackageChanged:false});
 const bodies=[captured.inputs.runtimeManifestBytes,captured.inputs.approvedSourceBuildReceiptBytes,descriptorBytes,packageBytes,mainBytes,Buffer.from(JSON.stringify(receipt,null,2)+'\n')],written=[],published=[];let primary=null;const finalErrors=[];
 try{for(let i=0;i<OUTPUTS.length;i++){
  if(!isDeepStrictEqual(controlIdentity,await directory(control)))fail();await membership(control,written);
  if(i===OUTPUTS.length-1&&!await owned.verifier.recheck(owned.tree))fail();
  await recheckPublished(control,published);
  const identity=await publishFile(control,OUTPUTS[i],bodies[i]);published.push(Object.freeze({name:OUTPUTS[i],body:bodies[i],identity}));written.push(OUTPUTS[i]);await membership(control,written);await recheckPublished(control,published);
 }}catch(error){primary=error;}
 try{if(!await owned.verifier.recheck(owned.tree))throw Error('BOOTSTRAP_RUNTIME_RECHECK_FAILED');}catch(error){finalErrors.push(error);}
 try{await recheckPublished(control,published);}catch(error){finalErrors.push(error);}
 if(primary||finalErrors.length){const error=Error('BOOTSTRAP_OUTPUT_REFUSED',{cause:primary??finalErrors[0]});error.primaryError=primary??finalErrors[0];error.finalErrors=primary?finalErrors:finalErrors.slice(1);throw error;}
 return receipt;
}
