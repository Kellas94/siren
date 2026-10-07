import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ownedFile} from '../projects/paths.mjs';
import {readOwnedBytes} from '../projects/io.mjs';

const error=code=>Object.assign(Error(code),{code});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
/** One owned, ephemeral render job. No preload, source/window IPC, persistent
 * profile or network. Completion includes verified native destruction; an
 * aborted/refused render can never publish a public frame. */
export async function renderPresentationPreview({BrowserWindow,entryPath,entrySha256,input,scope,timeoutMs=10000}){
 const current=()=>{try{return scope?.isCurrent()===true&&!scope.signal?.aborted;}catch{return false;}};
 if(!current())throw error('ACCESS_REFUSED');
 if(typeof BrowserWindow!=='function'||!/^[a-f0-9]{64}$/.test(entrySha256)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw error('PRESENTATION_ENTRY_REFUSED');
 let path,argument;try{path=await ownedFile(entryPath);if(!current())throw error('ACCESS_REFUSED');if(hash(await readOwnedBytes(path,32*1024*1024))!==entrySha256)throw error('PRESENTATION_ENTRY_REFUSED');argument=JSON.stringify(input);if(Buffer.byteLength(argument)>8*1024*1024)throw error('PRESENTATION_RENDER_BUDGET');}catch(cause){throw error(!current()?'ACCESS_REFUSED':cause.code==='PRESENTATION_RENDER_BUDGET'?cause.code:'PRESENTATION_ENTRY_REFUSED');}
 if(!current())throw error('ACCESS_REFUSED');
 const expected=pathToFileURL(path).href,window=new BrowserWindow({show:false,width:1600,height:900,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,devTools:false,partition:'siren-presentation-'+randomUUID()}}),wc=window.webContents;
 let frame,disposed=false,disposal;
 const live=()=>{try{return !disposed&&current()&&!window.isDestroyed()&&!wc.isDestroyed()&&window.webContents===wc&&wc.getURL()===expected&&wc.mainFrame===frame&&frame?.url===expected;}catch{return false;}};
 const dispose=()=>{
  disposed=true;if(disposal)return disposal;
  disposal=new Promise((resolve,reject)=>{let timer,settled=false;const finish=bad=>{if(settled)return;settled=true;clearTimeout(timer);window.off('closed',check);wc.off('destroyed',check);bad?reject(error('PRESENTATION_DISPOSAL_FAILED')):resolve();},check=()=>{try{if(window.isDestroyed()&&wc.isDestroyed())finish();}catch{finish(true);}};
   try{window.on('closed',check);wc.on('destroyed',check);timer=setTimeout(()=>finish(true),10000);if(!window.isDestroyed())window.destroy();check();setImmediate(check);}catch{finish(true);}
  });return disposal;
 };
 let timer,abort;try{
  wc.setWindowOpenHandler(()=>({action:'deny'}));wc.on('will-navigate',event=>event.preventDefault());wc.on('will-frame-navigate',event=>event.preventDefault());wc.on('will-attach-webview',event=>event.preventDefault());
  wc.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));wc.session.setPermissionCheckHandler(()=>false);
  wc.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:details.url!==expected&&!/^(?:data:|blob:)/.test(details.url)}));
  const work=(async()=>{
   if(!current())throw error('ACCESS_REFUSED');await window.loadFile(path);frame=wc.mainFrame;if(!live()||hash(await readOwnedBytes(path,32*1024*1024))!==entrySha256||!live()||await wc.executeJavaScript('window.sirenPresentationRenderReady === true')!==true||!live())throw error('PRESENTATION_ENTRY_REFUSED');
   const result=await wc.executeJavaScript(`window.sirenRenderPublicSlide(${argument})`);if(!live())throw error('ACCESS_REFUSED');
   if(result?.kind!=='image'||typeof result.title!=='string'||typeof result.image!=='string'||result.image.length>2800000||!result.image.startsWith('data:image/png;base64,')||Object.keys(result).sort().join(',')!=='image,kind,title')throw error('PUBLIC_SLIDE_REFUSED');return result;
  })();
  const cancelled=new Promise((_,reject)=>{abort=()=>reject(error('ACCESS_REFUSED'));scope.signal?.addEventListener('abort',abort,{once:true});if(!current())abort();});
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(error('PRESENTATION_RENDER_TIMEOUT')),timeoutMs);});
  const result=await Promise.race([work,cancelled,timeout]);if(!live())throw error('ACCESS_REFUSED');await dispose();if(!current())throw error('ACCESS_REFUSED');return result;
 }finally{clearTimeout(timer);if(abort)scope.signal?.removeEventListener('abort',abort);await dispose();}
}
