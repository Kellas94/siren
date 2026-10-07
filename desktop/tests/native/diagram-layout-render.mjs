import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const desktop=resolve('.'),root=join(desktop,'evidence/diagram-layout-render',new Date().toISOString().replaceAll(':','-'));await mkdir(join(root,'owned-profile'),{recursive:true});
const child=spawn(join(desktop,'node_modules/electron/dist/electron.exe'),[join(desktop,'tests/native/diagram-layout-render-app.mjs'),'--evidence='+root],{cwd:desktop,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:undefined},stdio:['ignore','pipe','pipe']});let logs='',timedOut=false;
child.stdout.on('data',bytes=>logs+=bytes);child.stderr.on('data',bytes=>logs+=bytes);const timer=setTimeout(()=>{timedOut=true;child.kill();},90000);
const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));}).finally(()=>clearTimeout(timer));await writeFile(join(root,'electron.log'),logs);
let native;try{native=JSON.parse(await readFile(join(root,'result.json'),'utf8'));}catch{}
const result={root,ownedPid:child.pid,exit,timedOut,nativeStatus:native?.status,status:exit.code===0&&!timedOut&&native?.status==='COMPLETE'&&native.inputsUnchanged?'COMPLETE':'ADVERSE'};await writeFile(join(root,'driver-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,error:native?.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;
