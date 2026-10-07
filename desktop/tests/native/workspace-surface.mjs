import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildCodeEditor} from '../../build/code-editor.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url));
const root=resolve(desktop,'evidence/workspace-surface',new Date().toISOString().replaceAll(':','-'));
const hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(join(root,'owned-data'),{recursive:true});await mkdir(join(root,'generated/windows'),{recursive:true});
const names=['package.json','package-lock.json','baseline/R78.html','tests/native/workspace-surface.mjs','tests/native/workspace-surface-app.mjs'];
async function walk(dir){for(const item of await readdir(join(desktop,dir),{withFileTypes:true})){const name=dir+'/'+item.name;if(item.isDirectory())await walk(name);else if(item.isFile())names.push(name);}}
await walk('src');await walk('build');
const capture=async()=>Object.fromEntries(await Promise.all(names.sort().map(async name=>[name,hash(await readFile(join(desktop,name)))])));
const inputs=await capture(),data=join(root,'owned-data');
const project=await new ProjectStore(data).createProject({label:'Owned surface identity',json:JSON.stringify({workpapers:['doc_a','doc_b'].map(id=>({id,title:id,blocks:[{id:'text_'+id,kind:'text',text:'Original '+id}]}))})});
const repo=new SourceRepository(data),a=await repo.importSource({projectId:project.project.id,bytes:Buffer.from('a😀b\r\nc')}),b=await repo.importSource({projectId:project.project.id,bytes:Buffer.from('def example():\n    return 42\n')});
const build=await buildCodeEditor({baselinePath:join(desktop,'baseline/R78.html'),outputDirectory:join(root,'bundle')});
const codeScript=await readFile(build.bundlePath,'utf8')+`
window.owned={identity:crypto.randomUUID(),ready:false};
owned.start=async()=>{
 const ref=await ownedBridge.fixture();
 const bridge=Object.fromEntries(['getMetrics','readRange','applyEdit','commitSource','openRead','readChunk','closeRead'].map(method=>[method,payload=>ownedBridge.source(method,payload)]));
 const client=SirenCodeEditor.sourceClient({bridge,sourceRef:ref});
 const editor=SirenCodeEditor.createCodeEditor({container:document.getElementById('editor'),client});
 const receipt=await editor.open(ref);if(!receipt.ok)throw Error(receipt.code);
 Object.assign(owned,{editor,ready:true,status:editor.getStatus,select:editor.select,
 inspect:()=>({identity:owned.identity,text:editor.getState().doc.toString(),selection:{from:editor.getState().selection.main.from,to:editor.getState().selection.main.to},status:editor.getStatus()})});
};`;
const docsScript=await readFile(join(desktop,'src/ui/docs/draft.js'),'utf8')+`
window.owned={identity:crypto.randomUUID(),ready:false};
owned.start=async()=>{
 const context=await ownedBridge.document();
 const draft=SirenNativeDocsDraft.create({context,bridge:{applyDocument:()=>Promise.reject(Error('No fixture save authority'))}});
 const field=document.querySelector('textarea');field.value=draft.getContent().blocks[0].text;
 field.addEventListener('input',()=>{const content=draft.getContent();content.blocks[0].text=field.value;draft.setContent(content);});
 Object.assign(owned,{draft,ready:true,inspect:()=>({identity:owned.identity,text:field.value,selection:{from:field.selectionStart,to:field.selectionEnd},content:draft.getContent(),status:draft.getStatus()})});
};`;
const html=script=>{
 if(/<\/script/i.test(script))throw Error('Probe closing tag refused');
 const csp="default-src 'none'; script-src 'sha256-"+createHash('sha256').update(script).digest('base64')+"'; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'; form-action 'none'";
 return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Owned workspace surface</title><body style="margin:0"><main id="editor" style="height:100vh"></main><textarea aria-label="Owned Docs draft" style="position:fixed;top:12px;left:12px;width:90%;height:80%"></textarea><script>${script}</script>`;
};
await writeFile(join(root,'generated/windows/code.html'),html(codeScript));await writeFile(join(root,'generated/windows/docs.html'),html(docsScript));
await writeFile(join(root,'generated/app.html'),'<!doctype html><title>Owned host</title><h1>Owned host</h1>');
await writeFile(join(root,'owned-preload.cjs'),`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('ownedBridge',Object.freeze({fixture:()=>ipcRenderer.invoke('owned:fixture'),document:()=>ipcRenderer.invoke('owned:document'),source:(method,payload)=>ipcRenderer.invoke('owned:source',method,payload)}));`);
const fixtureFiles=['generated/windows/code.html','generated/windows/docs.html','generated/app.html','owned-preload.cjs'];
const fixtureHashes=Object.fromEntries(await Promise.all(fixtureFiles.map(async name=>[name,hash(await readFile(join(root,name)))])));
await writeFile(join(root,'prepared.json'),JSON.stringify({inputs,fixtureHashes,build,project,a,b},null,2));
const env={...process.env};for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH','ELECTRON_NO_ASAR','ELECTRON_EXTRA_LAUNCH_ARGS'])delete env[key];
const child=spawn(join(desktop,'node_modules/electron/dist/electron.exe'),[join(desktop,'tests/native/workspace-surface-app.mjs'),'--siren-surface-fixture='+root],{cwd:desktop,windowsHide:true,env,stdio:['ignore','pipe','pipe']});
let logs='',timedOut=false;child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
const timer=setTimeout(()=>{timedOut=true;child.kill();},90000);
const exit=await new Promise((yes,no)=>{child.once('error',no);child.once('exit',(code,signal)=>yes({code,signal}));}).finally(()=>clearTimeout(timer));
await writeFile(join(root,'electron.log'),logs);const after=await capture();let native;try{native=JSON.parse(await readFile(join(root,'native-result.json'),'utf8'));}catch{}
const result={root,ownedPid:child.pid,exit,timedOut,inputs,afterInputs:after,inputsUnchanged:JSON.stringify(inputs)===JSON.stringify(after),fixtureHashes,nativeStatus:native?.status};
result.status=exit.code===0&&!timedOut&&result.inputsUnchanged&&native?.status==='COMPLETE'?'COMPLETE':'ADVERSE';
await writeFile(join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,status:result.status,exit,error:native?.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;
