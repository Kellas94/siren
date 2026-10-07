import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {mkdtemp} from './fixtures/temporary.mjs';
import {renderPresentationPreview} from '../src/windows/presentation-render.mjs';
async function fixture(t,{load,execute,destroy}={}){
 const root=await mkdtemp(join(tmpdir(),'siren-public-render-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const entryPath=join(root,'entry.html'),bytes=Buffer.from('<html>owned renderer</html>');await writeFile(entryPath,bytes);
 const entrySha256=createHash('sha256').update(bytes).digest('hex'),windows=[],expected=pathToFileURL(entryPath).href;
 class Window extends EventEmitter{
  constructor(options){super();this.options=options;this.dead=false;windows.push(this);const wc=this.webContents=new EventEmitter();wc.dead=false;wc.isDestroyed=()=>wc.dead;wc.getURL=()=>wc.url;wc.setWindowOpenHandler=value=>{wc.open=value;};wc.session={setPermissionRequestHandler:value=>{wc.permission=value;},setPermissionCheckHandler:value=>{wc.check=value;},webRequest:{onBeforeRequest:value=>{wc.request=value;}}};wc.executeJavaScript=async code=>{wc.code=code;if(code==='window.sirenPresentationRenderReady === true')return true;return execute?execute(this):{kind:'image',title:'Public',image:'data:image/png;base64,AAAA'};};}
  isDestroyed(){return this.dead;}
  async loadFile(){this.webContents.url=expected;this.webContents.mainFrame={url:expected};if(load)await load(this);}
  destroy(){if(destroy)return destroy(this);this.dead=true;this.webContents.dead=true;this.webContents.emit('destroyed');this.emit('closed');}
 }
 const input={slide:{title:'Public',render:{entry:{type:'overview'}}},context:{source:'flowchart TD\nA-->B'}};
 const scope={isCurrent:()=>true},options={BrowserWindow:Window,entryPath,entrySha256,input,scope};
 return {options,windows,expected,entryPath};
}
test('public utility denies permissions, navigation, new windows and network and confirms both native objects destroyed',async t=>{
 const f=await fixture(t);const result=await renderPresentationPreview(f.options),w=f.windows[0],wc=w.webContents;
 assert.equal(result.kind,'image');assert.equal(w.dead,true);assert.equal(wc.dead,true);assert.equal(w.options.show,false);assert.equal(w.options.webPreferences.sandbox,true);assert.equal(w.options.webPreferences.contextIsolation,true);assert.equal(w.options.webPreferences.nodeIntegration,false);assert.equal(w.options.webPreferences.devTools,false);assert.equal('preload'in w.options.webPreferences,false);assert.equal(w.options.webPreferences.partition.startsWith('persist:'),false);
 assert.deepEqual(wc.open(),{action:'deny'});let permitted;wc.permission(null,'camera',value=>permitted=value);assert.equal(permitted,false);assert.equal(wc.check(),false);
 for(const url of ['https://outside.invalid/','file:///outside.txt','siren://app/app.html']){let reply;wc.request({url},value=>reply=value);assert.equal(reply.cancel,true);}
 let prevented=0;for(const event of ['will-navigate','will-frame-navigate','will-attach-webview'])wc.emit(event,{preventDefault:()=>prevented++});assert.equal(prevented,3);
 assert.equal(wc.code,'window.sirenRenderPublicSlide('+JSON.stringify(f.options.input)+')');
});
test('wrong entry bytes, excessive input and revoked scope create no renderer',async t=>{
 const f=await fixture(t);await assert.rejects(renderPresentationPreview({...f.options,entrySha256:'0'.repeat(64)}),{code:'PRESENTATION_ENTRY_REFUSED'});
 await assert.rejects(renderPresentationPreview({...f.options,input:{large:'x'.repeat(8*1024*1024)}}),{code:'PRESENTATION_RENDER_BUDGET'});
 await assert.rejects(renderPresentationPreview({...f.options,scope:{isCurrent:()=>false}}),{code:'ACCESS_REFUSED'});assert.equal(f.windows.length,0);
});
test('entry bytes replaced during loading and substituted main frame cannot publish',async t=>{
 const changed=await fixture(t,{load:async()=>writeFile(changed.entryPath,'replaced owned renderer')});await assert.rejects(renderPresentationPreview(changed.options),{code:'PRESENTATION_ENTRY_REFUSED'});assert.equal(changed.windows[0].dead,true);
 const frame=await fixture(t,{execute:w=>{w.webContents.mainFrame={url:frame.expected};return {kind:'image',title:'Public',image:'data:image/png;base64,AAAA'};}});await assert.rejects(renderPresentationPreview(frame.options),{code:'ACCESS_REFUSED'});assert.equal(frame.windows[0].webContents.dead,true);
});
test('cancellation while a renderer is pending destroys it and refuses its late result',async t=>{
 let entered,release;const admitted=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve),controller=new AbortController();
 const f=await fixture(t,{execute:async()=>{entered();await gate;return {kind:'image',title:'Public',image:'data:image/png;base64,AAAA'};}});
 const pending=renderPresentationPreview({...f.options,scope:{isCurrent:()=>true,signal:controller.signal}});await admitted;controller.abort();await assert.rejects(pending,{code:'ACCESS_REFUSED'});assert.equal(f.windows[0].dead,true);assert.equal(f.windows[0].webContents.dead,true);release();
});
test('deadline expiry and private extra fields cannot become public rendering receipts',async t=>{
 const timeout=await fixture(t,{execute:()=>new Promise(()=>{})});await assert.rejects(renderPresentationPreview({...timeout.options,timeoutMs:25}),{code:'PRESENTATION_RENDER_TIMEOUT'});assert.equal(timeout.windows[0].dead,true);
 const privateResult=await fixture(t,{execute:()=>({kind:'image',title:'Public',image:'data:image/png;base64,AAAA',notes:'PRIVATE'})});await assert.rejects(renderPresentationPreview(privateResult.options),{code:'PUBLIC_SLIDE_REFUSED'});assert.equal(privateResult.windows[0].dead,true);
});
test('a successful render waits for separate webContents destruction before returning',async t=>{
 const f=await fixture(t,{destroy:w=>{w.dead=true;w.emit('closed');setTimeout(()=>{w.webContents.dead=true;w.webContents.emit('destroyed');},30);}});
 await renderPresentationPreview(f.options);assert.equal(f.windows[0].webContents.dead,true);
});
