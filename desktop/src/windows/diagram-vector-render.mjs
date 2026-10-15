import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ownedFile} from '../projects/paths.mjs';
import {readOwnedBytes} from '../projects/io.mjs';
import {navigationFields} from '../navigation/contracts.mjs';
const error=code=>Object.assign(Error(code),{code});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Separate no-preload utility; SVG is produced from main-owned saved content.
 * Publication waits for actual window AND webContents destruction. */
export function renderDiagramVector(options){return renderVector({...options,embed:false});}
export function renderDiagramEmbed(options){return renderVector({...options,embed:true});}
async function renderVector({BrowserWindow,entryPath,entrySha256,input,scope,timeoutMs=10000,embed}){
 const current=()=>{try{return scope?.isCurrent()===true&&!scope.signal?.aborted;}catch{return false;}};
 if(!current())throw error('ACCESS_REFUSED');
 if(typeof BrowserWindow!=='function'||typeof entrySha256!=='string'||!/^[a-f0-9]{64}$/.test(entrySha256)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw error('DIAGRAM_VECTOR_ENTRY_REFUSED');
 let path,argument;try{path=await ownedFile(entryPath);if(!current())throw error('ACCESS_REFUSED');if(hash(await readOwnedBytes(path,32*1024*1024))!==entrySha256)throw error('DIAGRAM_VECTOR_ENTRY_REFUSED');argument=JSON.stringify(input);if(Buffer.byteLength(argument)>8*1024*1024)throw error('DIAGRAM_VECTOR_BUDGET');}catch(cause){throw error(!current()?'ACCESS_REFUSED':cause.code==='DIAGRAM_VECTOR_BUDGET'?cause.code:'DIAGRAM_VECTOR_ENTRY_REFUSED');}
 if(!current())throw error('ACCESS_REFUSED');
 const expected=pathToFileURL(path).href,window=new BrowserWindow({show:false,width:1600,height:900,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,devTools:false,partition:'siren-diagram-vector-'+randomUUID()}}),wc=window.webContents;
 let frame,disposed=false,disposal;
 const live=()=>{try{return !disposed&&current()&&!window.isDestroyed()&&!wc.isDestroyed()&&window.webContents===wc&&wc.getURL()===expected&&wc.mainFrame===frame&&frame?.url===expected;}catch{return false;}};
 const dispose=()=>{disposed=true;if(disposal)return disposal;disposal=new Promise((resolve,reject)=>{let timer,settled=false;const finish=bad=>{if(settled)return;settled=true;clearTimeout(timer);window.off('closed',check);wc.off('destroyed',check);bad?reject(error('DIAGRAM_VECTOR_DISPOSAL_FAILED')):resolve();},check=()=>{try{if(window.isDestroyed()&&wc.isDestroyed())finish();}catch{finish(true);}};try{window.on('closed',check);wc.on('destroyed',check);timer=setTimeout(()=>finish(true),10000);if(!window.isDestroyed())window.destroy();check();setImmediate(check);}catch{finish(true);}});return disposal;};
 let timer,abort;try{
  wc.setWindowOpenHandler(()=>({action:'deny'}));for(const name of ['will-navigate','will-frame-navigate','will-attach-webview'])wc.on(name,event=>event.preventDefault());
  wc.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));wc.session.setPermissionCheckHandler(()=>false);wc.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:details.url!==expected}));
  const work=(async()=>{if(!current())throw error('ACCESS_REFUSED');await window.loadFile(path);frame=wc.mainFrame;if(!live()||hash(await readOwnedBytes(path,32*1024*1024))!==entrySha256||!live()||await wc.executeJavaScript('window.sirenDiagramVectorReady === true')!==true||!live())throw error('DIAGRAM_VECTOR_ENTRY_REFUSED');
   const result=await wc.executeJavaScript(`window.${embed?'sirenRenderDiagramEmbed':'sirenRenderDiagramVector'}(${argument})`);if(!live())throw error('ACCESS_REFUSED');
   let output=result;if(embed){try{output=navigationFields(result,['svg','rendererVersion','styleHash']);}catch{throw error('DIAGRAM_VECTOR_REFUSED');}if(typeof output.rendererVersion!=='string'||!output.rendererVersion.length||output.rendererVersion.length>80||typeof output.styleHash!=='string'||!/^[a-f0-9]{64}$/.test(output.styleHash))throw error('DIAGRAM_VECTOR_REFUSED');}
   const svg=embed?output.svg:output;if(typeof svg!=='string'||Buffer.byteLength(svg)>2*1024*1024||!/^<svg\b/.test(svg)||!svg.endsWith('</svg>'))throw error('DIAGRAM_VECTOR_REFUSED');return embed?Object.freeze(output):svg;
  })();
  const cancelled=new Promise((_,reject)=>{abort=()=>reject(error('ACCESS_REFUSED'));scope.signal?.addEventListener('abort',abort,{once:true});if(!current())abort();});
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(error('DIAGRAM_VECTOR_TIMEOUT')),timeoutMs);});
  const result=await Promise.race([work,cancelled,timeout]);if(!live())throw error('ACCESS_REFUSED');await dispose();if(!current())throw error('ACCESS_REFUSED');return result;
 }finally{clearTimeout(timer);if(abort)scope.signal?.removeEventListener('abort',abort);await dispose();}
}
