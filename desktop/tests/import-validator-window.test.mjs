import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdtemp } from './fixtures/temporary.mjs';
import { createImportValidator } from '../src/projects/import-validator-window.mjs';

async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'siren-validator-window-'));const entryPath=join(root,'import-validation.html'),html='<html>Owned validator fixture</html>';
  await writeFile(entryPath,html);const entrySha256=createHash('sha256').update(html).digest('hex');let window;
  class NativeWindow extends EventEmitter {
    constructor(options){super();window=this;this.options=options;this.destroyed=false;this.visible=false;this.webContents=new EventEmitter();const wc=this.webContents;
      wc.isDestroyed=()=>this.destroyed;wc.mainFrame={url:''};wc.getURL=()=>wc.mainFrame.url;wc.setWindowOpenHandler=handler=>{this.openHandler=handler;};
      wc.session={setPermissionRequestHandler:handler=>{this.permission=handler;},setPermissionCheckHandler:handler=>{this.permissionCheck=handler;},webRequest:{onBeforeRequest:handler=>{this.beforeRequest=handler;}}};
      wc.executeJavaScript=async code=>code==='window.sirenImportValidationReady === true'?true:'{"validated":true}';
    }
    isDestroyed(){return this.destroyed;}
    async loadFile(path){this.webContents.mainFrame.url=pathToFileURL(path).href;}
    destroy(){this.destroyed=true;this.emit('closed');}
  }
  return {entryPath,entrySha256,NativeWindow,getWindow:()=>window};
}

test('native validator is hidden sandboxed has no preload and cannot open network permissions or windows',async()=>{
  const f=await fixture();const validator=await createImportValidator({...f,BrowserWindow:f.NativeWindow});const w=f.getWindow();
  assert.equal(w.options.show,false);assert.equal(w.options.webPreferences.sandbox,true);assert.equal(w.options.webPreferences.contextIsolation,true);assert.equal(w.options.webPreferences.nodeIntegration,false);assert.equal('preload' in w.options.webPreferences,false);assert.equal(w.options.webPreferences.partition.startsWith('persist:'),false);
  assert.deepEqual(w.openHandler({url:'https://example.com'}),{action:'deny'});let permitted;w.permission(null,'camera',value=>{permitted=value;});assert.equal(permitted,false);assert.equal(w.permissionCheck(),false);
  let decision;w.beforeRequest({url:'https://example.com'},value=>{decision=value;});assert.equal(decision.cancel,true);w.beforeRequest({url:pathToFileURL(f.entryPath).href},value=>{decision=value;});assert.equal(decision.cancel,false);
  assert.equal(await validator.validate('{}','selected.siren'),'{"validated":true}');await validator.dispose();assert.equal(w.isDestroyed(),true);
});

test('tampered validation entry is refused before creating native resources',async()=>{
  const f=await fixture();await writeFile(f.entryPath,'tampered');await assert.rejects(createImportValidator({...f,BrowserWindow:f.NativeWindow}),{code:'IMPORT_ENTRY_REFUSED'});assert.equal(f.getWindow(),undefined);
});

test('pending validation deadline destroys only its owned hidden window and suppresses a late reply',async()=>{
  const f=await fixture();const validator=await createImportValidator({...f,BrowserWindow:f.NativeWindow,timeoutMs:20});const w=f.getWindow();let finish;
  w.webContents.executeJavaScript=()=>new Promise(resolve=>{finish=resolve;});
  await assert.rejects(validator.validate('{}','selected.siren'),{code:'IMPORT_VALIDATION_TIMEOUT'});assert.equal(w.isDestroyed(),true);finish('{"late":true}');await validator.dispose();
});

test('same URL with a replaced main frame cannot validate using retired native identity',async()=>{
  const f=await fixture();const validator=await createImportValidator({...f,BrowserWindow:f.NativeWindow});const w=f.getWindow();w.webContents.mainFrame={url:pathToFileURL(f.entryPath).href};
  await assert.rejects(validator.validate('{}','selected.siren'),{code:'IMPORT_ENTRY_REFUSED'});await validator.dispose();assert.equal(w.isDestroyed(),true);
});

test('disposal waits for asynchronous native webContents destruction after its window is gone',async()=>{
  const f=await fixture();const validator=await createImportValidator({...f,BrowserWindow:f.NativeWindow});const w=f.getWindow();let contentsDestroyed=false;
  w.webContents.isDestroyed=()=>contentsDestroyed;
  w.destroy=()=>{w.destroyed=true;w.emit('closed');setTimeout(()=>{contentsDestroyed=true;w.webContents.emit('destroyed');},10);};
  await validator.dispose();assert.equal(contentsDestroyed,true);assert.equal(w.destroyed,true);
});

test('dedicated bundle metadata validator uses literal arguments and retains the native frame fence',async()=>{
  const f=await fixture(),validator=await createImportValidator({...f,BrowserWindow:f.NativeWindow}),w=f.getWindow();let script;
  w.webContents.executeJavaScript=async code=>{script=code;return '{"metadata":true}';};
  const text='{"opaque":"\\\"; window.privileged = true; //"}',name='chosen.siren-backup';
  assert.equal(await validator.validateBundleMetadata(text,name),'{"metadata":true}');
  assert.equal(script,`window.sirenDesktopValidateBundleMetadata(${JSON.stringify(text)},${JSON.stringify(name)})`);
  w.webContents.mainFrame={url:pathToFileURL(f.entryPath).href};
  await assert.rejects(validator.validateBundleMetadata('{}',name),{code:'IMPORT_ENTRY_REFUSED'});await validator.dispose();
});

test('pending bundle metadata cannot overlap patch validation and timeout destroys its owned validator',async()=>{
  const f=await fixture(),validator=await createImportValidator({...f,BrowserWindow:f.NativeWindow,timeoutMs:30}),w=f.getWindow();let finish;
  w.webContents.executeJavaScript=()=>new Promise(resolve=>{finish=resolve;});
  const pending=validator.validateBundleMetadata('{}','chosen.siren-backup');
  await assert.rejects(validator.validatePatch({}),{code:'IMPORT_BUSY'});
  await assert.rejects(pending,{code:'IMPORT_VALIDATION_TIMEOUT'});assert.equal(w.isDestroyed(),true);finish('{}');await validator.dispose();
});
