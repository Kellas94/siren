import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ownedFile } from './paths.mjs';
import { readOwnedBytes } from './io.mjs';

const error=code=>Object.assign(new Error(code),{code});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Native-only, on-demand hidden validator. No preload, project bridge,
 * workspace registry grant, persistent profile, network or permissions. */
export async function createImportValidator({BrowserWindow,entryPath,entrySha256,timeoutMs=30000}) {
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000 || !/^[a-f0-9]{64}$/.test(entrySha256))throw error('IMPORT_ENTRY_REFUSED');
  let path;
  try {path=await ownedFile(entryPath);if(hash(await readOwnedBytes(path,32*1024*1024))!==entrySha256)throw error('IMPORT_ENTRY_REFUSED');}
  catch {throw error('IMPORT_ENTRY_REFUSED');}
  const expected=pathToFileURL(path).href;
  const window=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,devTools:false,partition:'siren-import-'+randomUUID()}});
  const wc=window.webContents;let frame,disposed=false,busy=false,disposal;
  const live=()=>!disposed && !window.isDestroyed() && !wc.isDestroyed() && window.webContents===wc && wc.getURL()===expected && wc.mainFrame===frame && frame?.url===expected;
  const dispose=()=>{
    disposed=true;
    if(disposal)return disposal;
    disposal=new Promise((resolve,reject)=>{
      let timer,settled=false;
      const finish=problem=>{
        if(settled)return;settled=true;clearTimeout(timer);window.off('closed',check);wc.off('destroyed',check);
        problem?reject(error('IMPORT_DISPOSAL_FAILED')):resolve();
      };
      const check=()=>{try{if(window.isDestroyed() && wc.isDestroyed())finish();}catch{finish(true);}};
      try {
        window.on('closed',check);wc.on('destroyed',check);
        timer=setTimeout(()=>finish(true),10000);
        if(!window.isDestroyed())window.destroy();
        check();setImmediate(check);
      } catch {finish(true);}
    });
    return disposal;
  };
  const bounded=async operation=>{
    let timer;
    try {
      return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(error('IMPORT_VALIDATION_TIMEOUT')),timeoutMs);})]);
    } catch(cause) {await dispose();throw cause;}
    finally {clearTimeout(timer);}
  };
  try {
    wc.setWindowOpenHandler(()=>({action:'deny'}));
    wc.on('will-navigate',event=>event.preventDefault());
    wc.on('will-frame-navigate',event=>event.preventDefault());
    wc.on('will-attach-webview',event=>event.preventDefault());
    wc.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    wc.session.setPermissionCheckHandler(()=>false);
    wc.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:details.url!==expected && !/^(?:data:|blob:)/.test(details.url)}));
    await bounded(async()=>{
      await window.loadFile(path);frame=wc.mainFrame;
      if(!live() || hash(await readOwnedBytes(path,32*1024*1024))!==entrySha256 || !live() || await wc.executeJavaScript('window.sirenImportValidationReady === true')!==true || !live())throw error('IMPORT_ENTRY_REFUSED');
    });
    return {
      validate:async(text,fileName)=>{
        if(!live())throw error('IMPORT_ENTRY_REFUSED');
        if(busy)throw error('IMPORT_BUSY');busy=true;
        try {
          return await bounded(async()=>{
            if(!live())throw error('IMPORT_ENTRY_REFUSED');
            const result=await wc.executeJavaScript(`window.sirenDesktopValidateImport(${JSON.stringify(text)},${JSON.stringify(fileName)})`);
            if(!live())throw error('IMPORT_ENTRY_REFUSED');return result;
          });
        } finally {busy=false;}
      },
      validatePatch:async input=>{
        if(!live())throw error('IMPORT_ENTRY_REFUSED');
        if(busy)throw error('IMPORT_BUSY');busy=true;
        try {return await bounded(async()=>{
          if(!live())throw error('IMPORT_ENTRY_REFUSED');
          const text=JSON.stringify(input);if(text.length>12*1024*1024)throw error('DOMAIN_VALIDATION_BUDGET');
          const result=await wc.executeJavaScript(`window.sirenDesktopValidateDomainPatch(${text})`);
          if(!live())throw error('IMPORT_ENTRY_REFUSED');return result===true;
        });}finally{busy=false;}
      },
      dispose
    };
  } catch(cause) {await dispose();throw cause;}
}
