import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildCodeEditor} from '../../build/code-editor.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url)),root=resolve(desktop,'evidence/code-view-flush',new Date().toISOString().replaceAll(':','-'));
await mkdir(join(root,'owned-data'),{recursive:true});await mkdir(join(root,'generated/windows'),{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),names=['package.json','package-lock.json','baseline/R78.html','build/code-editor.mjs','build/python.mjs','reviews/2026-10-03-editor-product-dependencies.json','tests/native/code-view-flush.mjs','tests/native/code-view-flush-app.mjs'];
async function walk(dir){for(const item of await readdir(join(desktop,dir),{withFileTypes:true})){const name=dir+'/'+item.name;if(item.isDirectory())await walk(name);else if(item.isFile())names.push(name);}}
await walk('src');const capture=async()=>Object.fromEntries(await Promise.all(names.sort().map(async name=>[name,hash(await readFile(join(desktop,name)))])));
const inputs=await capture(),project=await new ProjectStore(join(root,'owned-data')).createProject({label:'Owned real Code flush',json:'{"workpapers":[{"id":"docs-original","content":"untouched"}]}'}),repo=new SourceRepository(join(root,'owned-data'));
const a=await repo.importSource({projectId:project.project.id,bytes:Buffer.from('a😀b\r\nc')}),b=await repo.importSource({projectId:project.project.id,bytes:Buffer.from('second source\n')});
const build=await buildCodeEditor({baselinePath:join(desktop,'baseline/R78.html'),outputDirectory:join(root,'bundle')});
const script=await readFile(build.bundlePath,'utf8')+`
window.ownedCode={ready:false};
window.ownedCode.start=()=>(async()=>{
  const ref=await window.ownedSource.fixture();let nonce;
  const bridge=Object.fromEntries(['getMetrics','readRange','applyEdit','commitSource','openRead','readChunk','closeRead'].map(method=>[method,payload=>window.ownedSource.invoke(method,payload,nonce)]));
  const client=SirenCodeEditor.sourceClient({bridge,sourceRef:ref}),editor=SirenCodeEditor.createCodeEditor({container:document.getElementById('editor'),client});
  const opened=await editor.open(ref);if(!opened.ok)throw Error(opened.code);
  Object.assign(window.ownedCode,{ready:true,status:editor.getStatus,select:editor.select,flushView:ticket=>{nonce=ticket;return editor.flushView();},
    resume:()=>{nonce=undefined;return editor.resumeView();},dispose:editor.dispose});
  window.ownedSource.onPrepare(async request=>{
    const result=await window.ownedCode.flushView(request.nonce);window.ownedCode.lastPrepared=result;
    return result.ok?{requestId:request.requestId,ok:true}:{requestId:request.requestId,ok:false,code:result.code};
  });
})().catch(error=>window.ownedCode.error=error.message);
`;
if(/<\/script/i.test(script))throw Error('PROBE_SCRIPT_CLOSE_REFUSED');
const csp="default-src 'none'; script-src 'sha256-"+createHash('sha256').update(script).digest('base64')+"'; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'; form-action 'none'";
await writeFile(join(root,'generated/windows/code.html'),`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Owned Code flush probe</title><body style="margin:0"><main id="editor" style="height:100vh"></main><script>${script}</script>`);
await writeFile(join(root,'owned-preload.cjs'),`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('ownedSource',Object.freeze({fixture:()=>ipcRenderer.invoke('owned:fixture'),invoke:(method,payload,nonce)=>ipcRenderer.invoke('owned:source',method,payload,nonce),onPrepare:callback=>ipcRenderer.on('owned:prepare',(_event,request)=>{Promise.resolve(callback(request)).then(reply=>ipcRenderer.invoke('owned:ack',reply)).catch(()=>{});})}));`);
await writeFile(join(root,'prepared.json'),JSON.stringify({inputs,build,project,a,b,htmlSHA256:hash(await readFile(join(root,'generated/windows/code.html'))),preloadSHA256:hash(await readFile(join(root,'owned-preload.cjs')))},null,2));
const child=spawn(join(desktop,'node_modules/electron/dist/electron.exe'),[join(desktop,'tests/native/code-view-flush-app.mjs'),'--siren-flush-fixture='+root],{cwd:desktop,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:undefined},stdio:['ignore','pipe','pipe']});
let logs='',timedOut=false;child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);const timer=setTimeout(()=>{timedOut=true;child.kill();},120000);
const exit=await new Promise((yes,no)=>{child.once('error',no);child.once('exit',(code,signal)=>yes({code,signal}));}).finally(()=>clearTimeout(timer));
await writeFile(join(root,'electron.log'),logs);const after=await capture();let native;try{native=JSON.parse(await readFile(join(root,'native-result.json'),'utf8'));}catch{}
const result={root,ownedPid:child.pid,exit,timedOut,inputs,afterInputs:after,inputsUnchanged:JSON.stringify(inputs)===JSON.stringify(after),nativeStatus:native?.status};
result.status=exit.code===0&&!timedOut&&result.inputsUnchanged&&native?.status==='COMPLETE'?'COMPLETE':'ADVERSE';
await writeFile(join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,status:result.status,exit,error:native?.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;
