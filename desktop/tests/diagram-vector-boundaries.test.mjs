import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {mkdtemp} from './fixtures/temporary.mjs';
import {renderDiagramVector} from '../src/windows/diagram-vector-render.mjs';
const svg='<svg xmlns="http://www.w3.org/2000/svg"><text>Selected diagram</text></svg>';
async function fixture(t,{load,execute,destroy}={}){
 const root=await mkdtemp(join(tmpdir(),'siren-vector-render-'));t.after(()=>rm(root,{recursive:true,force:true}));const entryPath=join(root,'entry.html'),bytes=Buffer.from('<html>owned renderer</html>');await writeFile(entryPath,bytes);const expected=pathToFileURL(entryPath).href,windows=[];
 class Window extends EventEmitter{
  constructor(options){super();this.options=options;this.dead=false;windows.push(this);const wc=this.webContents=new EventEmitter();wc.dead=false;wc.isDestroyed=()=>wc.dead;wc.getURL=()=>wc.url;wc.setWindowOpenHandler=value=>wc.open=value;wc.session={setPermissionRequestHandler:value=>wc.permission=value,setPermissionCheckHandler:value=>wc.check=value,webRequest:{onBeforeRequest:value=>wc.request=value}};wc.executeJavaScript=async code=>{wc.code=code;return code==='window.sirenDiagramVectorReady === true'?true:execute?execute(this):svg;};}
  isDestroyed(){return this.dead;}
  async loadFile(){this.webContents.url=expected;this.webContents.mainFrame={url:expected};if(load)await load(this);}
  destroy(){if(destroy)return destroy(this);this.dead=true;this.webContents.dead=true;this.webContents.emit('destroyed');this.emit('closed');}
 }
 const options={BrowserWindow:Window,entryPath,entrySha256:createHash('sha256').update(bytes).digest('hex'),input:{diagram:{source:'flowchart TD\nA-->B'},appearance:'light'},scope:{isCurrent:()=>true}};return {options,windows,expected,entryPath};
}
test('isolated SVG utility denies preload, privileges, navigation/network and joins actual native destruction',async t=>{
 const f=await fixture(t);assert.equal(await renderDiagramVector(f.options),svg);const w=f.windows[0],wc=w.webContents;assert.equal(w.dead,true);assert.equal(wc.dead,true);assert.equal(w.options.show,false);for(const key of ['sandbox','contextIsolation','webSecurity'])assert.equal(w.options.webPreferences[key],true);for(const key of ['nodeIntegration','devTools'])assert.equal(w.options.webPreferences[key],false);assert.equal('preload'in w.options.webPreferences,false);assert.equal(w.options.webPreferences.partition.startsWith('persist:'),false);
 assert.deepEqual(wc.open(),{action:'deny'});let permitted;wc.permission(null,'camera',value=>permitted=value);assert.equal(permitted,false);assert.equal(wc.check(),false);
 for(const url of ['https://outside.invalid/','file:///outside.txt','data:image/svg+xml,attack','blob:attack','siren://app/app.html']){let result;wc.request({url},value=>result=value);assert.equal(result.cancel,true);}let result;wc.request({url:f.expected},value=>result=value);assert.equal(result.cancel,false);
 let prevented=0;for(const event of ['will-navigate','will-frame-navigate','will-attach-webview'])wc.emit(event,{preventDefault:()=>prevented++});assert.equal(prevented,3);assert.equal(wc.code,'window.sirenRenderDiagramVector('+JSON.stringify(f.options.input)+')');
});
test('wrong bytes, revoked scope or oversized native input create no utility',async t=>{
 const f=await fixture(t);await assert.rejects(renderDiagramVector({...f.options,entrySha256:'0'.repeat(64)}),{code:'DIAGRAM_VECTOR_ENTRY_REFUSED'});await assert.rejects(renderDiagramVector({...f.options,input:{large:'x'.repeat(8*1024*1024)}}),{code:'DIAGRAM_VECTOR_BUDGET'});await assert.rejects(renderDiagramVector({...f.options,scope:{isCurrent:()=>false}}),{code:'ACCESS_REFUSED'});assert.equal(f.windows.length,0);
});
test('changed entry or substituted frame refuses SVG publication and destroys utility',async t=>{
 const changed=await fixture(t,{load:()=>writeFile(changed.entryPath,'replaced')});await assert.rejects(renderDiagramVector(changed.options),{code:'DIAGRAM_VECTOR_ENTRY_REFUSED'});assert.equal(changed.windows[0].dead,true);
 const frame=await fixture(t,{execute:w=>{w.webContents.mainFrame={url:frame.expected};return svg;}});await assert.rejects(renderDiagramVector(frame.options),{code:'ACCESS_REFUSED'});assert.equal(frame.windows[0].webContents.dead,true);
});
test('cancel/deadline reject late work and private/oversized output cannot become an SVG receipt',async t=>{
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r),controller=new AbortController();const f=await fixture(t,{execute:async()=>{enter();await gate;return svg;}});const pending=renderDiagramVector({...f.options,scope:{isCurrent:()=>true,signal:controller.signal}});await entered;controller.abort();await assert.rejects(pending,{code:'ACCESS_REFUSED'});assert.equal(f.windows[0].webContents.dead,true);release();
 const timeout=await fixture(t,{execute:()=>new Promise(()=>{})});await assert.rejects(renderDiagramVector({...timeout.options,timeoutMs:25}),{code:'DIAGRAM_VECTOR_TIMEOUT'});assert.equal(timeout.windows[0].dead,true);
 for(const value of [{svg,notes:'PRIVATE'},'<svg '+'x'.repeat(2*1024*1024)+'</svg>']){const invalid=await fixture(t,{execute:()=>value});await assert.rejects(renderDiagramVector(invalid.options),{code:'DIAGRAM_VECTOR_REFUSED'});assert.equal(invalid.windows[0].dead,true);}
});
test('successful SVG render waits for separate webContents destruction',async t=>{
 const f=await fixture(t,{destroy:w=>{w.dead=true;w.emit('closed');setTimeout(()=>{w.webContents.dead=true;w.webContents.emit('destroyed');},30);}});assert.equal(await renderDiagramVector(f.options),svg);assert.equal(f.windows[0].webContents.dead,true);
});
