import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
const root=resolve('evidence/readonly-roster',new Date().toISOString().replaceAll(':','-')),data=join(root,'owned-data');
await mkdir(data,{recursive:true});await mkdir(join(root,'generated/windows'),{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),names=['package.json','package-lock.json','tests/native/readonly-roster.mjs','tests/native/readonly-roster-app.mjs'];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())await walk(path);else names.push(path);}}
await walk('src');const capture=async()=>Object.fromEntries(await Promise.all(names.sort().map(async path=>[path,hash(await readFile(path))])));
const inputs=await capture(),projects=new ProjectStore(data),sources=new SourceRepository(data),initial=await projects.createProject({label:'Owned readonly roster',json:'{}'}),projectId=initial.project.id;
const text='print("Exact selected Ș😀")\r\n',source=await sources.importSource({projectId,bytes:Buffer.from(text)}),document={id:'doc-a',title:'Exact readonly document',content:'Context to preserve',releases:[{verdict:'not-run'}]};
assertReceipt(await commitManifest({projects,repository:sources,projectId,baseRevision:1,sourceRefs:[source],metadata:{workpapers:[document]},operationId:'readonly-native-start'}));
assertReceipt(await sources.applyEdit({projectId,edit:{sourceId:source.sourceId,expectedVersion:1,operationId:'newer-unselected-private',start:0,end:0,insertedText:'PRIVATE_FUTURE_DRAFT\n'}}));
function assertReceipt(receipt){if(!receipt.ok)throw Error(receipt.code);}
const snapshot=await projects.readProject(projectId);
const script=`window.owned={};owned.start=async()=>{const result=await ownedBridge.read();if(!result.ok)throw Error(result.code);owned.domain=result.domain;owned.ready=true;document.body.dataset.ready='true';};ownedBridge.onPrepare(async request=>{owned.paused=true;document.body.style.visibility='hidden';const result=owned.domain==='workspace'?await ownedBridge.sealPrimary(request.nonce):{ok:true};return {requestId:request.requestId,ok:result.ok};});ownedBridge.onCover(()=>{document.body.dataset.covered='true';document.body.style.visibility='hidden';});owned.resume=()=>{owned.paused=false;document.body.style.visibility='visible';document.body.dataset.covered='false';};`;
const html=`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'"><title>Owned readonly transport fixture</title><p>Readonly protocol fixture</p><script>${script}</script>`;
const preload=`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('ownedBridge',Object.freeze({read:()=>ipcRenderer.invoke('owned:read'),sealPrimary:nonce=>ipcRenderer.invoke('owned:primary',nonce),onCover:callback=>ipcRenderer.on('owned:cover',()=>callback()),onPrepare:callback=>ipcRenderer.on('owned:prepare',(_event,request)=>{Promise.resolve(callback(request)).then(reply=>ipcRenderer.invoke('owned:ack',reply)).catch(()=>{});})}));`;
for(const path of ['app.html','home.html','windows/code.html','windows/docs.html'])await writeFile(join(root,'generated',path),html);
await writeFile(join(root,'owned-preload.cjs'),preload);await writeFile(join(root,'prepared.json'),JSON.stringify({snapshot,source,document,text,htmlSHA256:hash(Buffer.from(html)),preloadSHA256:hash(Buffer.from(preload))}));
const child=spawn(resolve('node_modules/electron/dist/electron.exe'),[resolve('tests/native/readonly-roster-app.mjs'),'--siren-readonly-roster='+root],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});
let logs='',timedOut=false;child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);const timer=setTimeout(()=>{timedOut=true;child.kill();},60000);
const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));}).finally(()=>clearTimeout(timer));
await writeFile(join(root,'electron.log'),logs);let native;try{native=JSON.parse(await readFile(join(root,'native-result.json'),'utf8'));}catch{}
const afterInputs=await capture(),inputsUnchanged=JSON.stringify(inputs)===JSON.stringify(afterInputs),status=exit.code===0&&!timedOut&&inputsUnchanged&&native?.status==='COMPLETE'?'COMPLETE':'ADVERSE';
await writeFile(join(root,'result.json'),JSON.stringify({root,ownedPid:child.pid,status,exit,timedOut,inputs,afterInputs,inputsUnchanged,native},null,2));console.log(JSON.stringify({root,status,exit,error:native?.error?.message}));process.exitCode=status==='COMPLETE'?0:1;
