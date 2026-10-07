import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildImportValidation } from '../../build/import-validation.mjs';
import { ProjectStore } from '../../src/projects/store.mjs';

const desktop=fileURLToPath(new URL('../../',import.meta.url));
const root=resolve(desktop,'evidence/headless-import',new Date().toISOString().replaceAll(':','-'));
await mkdir(join(root,'owned-data'),{recursive:true});
const names=['baseline/R78.html','build/import-validation.mjs','build/renderer.mjs','src/projects/import-validation.mjs','src/projects/import-validator-window.mjs','tests/native/headless-import.mjs','tests/native/headless-import-app.mjs','package.json','package-lock.json'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const capture=async()=>Object.fromEntries(await Promise.all(names.map(async path=>[path,hash(await readFile(join(desktop,path)))])));
const inputs=await capture();
const build=await buildImportValidation({baselinePath:join(desktop,'baseline/R78.html'),outputDir:join(root,'generated')});
const original=await new ProjectStore(join(root,'owned-data')).createProject({label:'Untouched native original',json:'{"source":"independent original bytes"}'});
await writeFile(join(root,'prepared.json'),JSON.stringify({inputs,build,original},null,2));
const child=spawn(join(desktop,'node_modules/electron/dist/electron.exe'),[join(desktop,'tests/native/headless-import-app.mjs'),'--siren-import-fixture='+root],{cwd:desktop,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:undefined},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',value=>{logs+=value;});child.stderr.on('data',value=>{logs+=value;});
let timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill();},120000);
const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));}).finally(()=>clearTimeout(timer));
await writeFile(join(root,'electron.log'),logs);
const after=await capture();let native;
try {native=JSON.parse(await readFile(join(root,'native-result.json'),'utf8'));}catch{}
const unchanged=JSON.stringify(after)===JSON.stringify(inputs);
const result={root,ownedPid:child.pid,exit,timedOut,inputsUnchanged:unchanged,inputs,afterInputs:after,nativeStatus:native?.status,status:exit.code===0&&!timedOut&&unchanged&&native?.status==='COMPLETE'?'COMPLETE':'ADVERSE'};
await writeFile(join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,status:result.status,exit,error:native?.error?.message}));
process.exitCode=result.status==='COMPLETE'?0:1;
