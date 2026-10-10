// Inert until authenticated prepared startup explicitly calls the loader.
// Exact package entry selection; installed provenance/native behavior is a
// separate guarded qualification. Node resolution is not handle-bound I/O.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

export function loadProductionPtyProvider(...extra){
 try{
  if(extra.length)throw Error();
  const require=createRequire(import.meta.url);
  const manifestPath=fileURLToPath(new URL('../../runtime/terminal-provider/node_modules/node-pty/package.json',import.meta.url));
  const entryPath=fileURLToPath(new URL('../../runtime/terminal-provider/node_modules/node-pty/lib/index.js',import.meta.url));
  // Absolute requests alone can still try .js/.json or directory fallbacks.
  // Resolve both first and require exact canonical selections before any load.
  if(require.resolve(manifestPath)!==manifestPath||require.resolve(entryPath)!==entryPath)throw Error();
  const manifest=require(manifestPath);
  if(manifest?.name!=='node-pty'||manifest.version!=='1.1.0'||manifest.main!=='./lib/index.js'||['exports','type','imports'].some(key=>Object.hasOwn(manifest,key)))throw Error();
  const pty=require(entryPath),d=Object.getOwnPropertyDescriptor(pty,'spawn');
  if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')throw Error();
  return pty;
 }catch{throw Error('CREATOR_PROVIDER_REFUSED');}
}
