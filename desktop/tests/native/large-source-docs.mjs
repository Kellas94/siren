import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildWindowEntrypoints} from '../../build/windows.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';

const desktop=fileURLToPath(new URL('../../',import.meta.url)),root=resolve(desktop,'evidence/large-source-docs',new Date().toISOString().replaceAll(':','-'));
await mkdir(join(root,'owned-data'),{recursive:true});
const names=['src/windows/docs.mjs','src/windows/entities.mjs','src/windows/coordinator.mjs','src/windows/registry.mjs','src/windows/factory.mjs','src/windows/ipc.mjs','src/windows/preload.cjs','src/windows/geometry.mjs','src/protocol.mjs','src/sources/manifest.mjs','src/sources/ipc.mjs','src/sources/repository.mjs','src/sources/text-model.mjs','src/sources/readers.mjs','src/projects/store.mjs','src/projects/atomic.mjs','src/navigation/contracts.mjs','src/ui/windows/entry.js','build/windows.mjs','tests/native/large-source-docs-app.mjs','tests/native/large-source-docs.mjs','package.json','package-lock.json'];
const hash=value=>createHash('sha256').update(value).digest('hex'),capture=async()=>Object.fromEntries(await Promise.all(names.map(async path=>[path,hash(await readFile(join(desktop,path)))])));
const inputs=await capture(),data=join(root,'owned-data'),projects=new ProjectStore(data),initial=await projects.createProject({label:'Owned native Docs',json:'{}'}),repo=new SourceRepository(data),projectId=initial.project.id;
const ref=await repo.importSource({projectId,bytes:Buffer.from('print("😀")\r\n'),provenance:{agentId:'synthetic-agent',releaseId:'synthetic-release'}}),point={sourceId:ref.sourceId,version:1,sha256:ref.sha256};
const metadata={workpapers:['doc-a','doc-b'].map(id=>({id,agent:{agentId:id},releases:[{id:'old-release',snapshot:{knowledge:[{id:'old-row',sourceRef:point}]}}],blocks:[{id:'block-a',kind:'knowledge',rows:[{id:'row-a',title:'Exact preserved title',sourceRef:point}]}]}))};
const saved=await commitManifest({projects,repository:repo,projectId,baseRevision:1,sourceRefs:[ref],metadata,operationId:'initial-manifest'});if(!saved.ok)throw Error(saved.code);
const project=await projects.readProject(projectId),build=await buildWindowEntrypoints(join(root,'generated'));
await writeFile(join(root,'prepared.json'),JSON.stringify({inputs,build,project,ref},null,2));
const preload=await readFile(join(desktop,'src/windows/preload.cjs'),'utf8');await writeFile(join(root,'owned-preload.cjs'),preload+`\nrequire('electron').contextBridge.exposeInMainWorld('sirenOwnedIntent',Object.freeze({invoke:intent=>require('electron').ipcRenderer.invoke('siren:owned-docs-intent',intent)}));\n`);
const child=spawn(join(desktop,'node_modules/electron/dist/electron.exe'),[join(desktop,'tests/native/large-source-docs-app.mjs'),'--siren-docs-fixture='+root],{cwd:desktop,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:undefined},stdio:['ignore','pipe','pipe']});
let logs='',timedOut=false;child.stdout.on('data',value=>{logs+=value;});child.stderr.on('data',value=>{logs+=value;});
const timer=setTimeout(()=>{timedOut=true;child.kill();},120000);
const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));}).finally(()=>clearTimeout(timer));
await writeFile(join(root,'electron.log'),logs);const after=await capture();let native;try{native=JSON.parse(await readFile(join(root,'native-result.json'),'utf8'));}catch{}
const result={root,ownedPid:child.pid,exit,timedOut,inputs,afterInputs:after,inputsUnchanged:JSON.stringify(inputs)===JSON.stringify(after),nativeStatus:native?.status};
result.status=exit.code===0&&!timedOut&&result.inputsUnchanged&&native?.status==='COMPLETE'?'COMPLETE':'ADVERSE';
await writeFile(join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,status:result.status,exit,error:native?.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;
