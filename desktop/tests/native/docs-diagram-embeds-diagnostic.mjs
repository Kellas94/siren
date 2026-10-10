// Disposable hosted diagnostic only; never a feature approval or publisher.
import {app,BrowserWindow} from 'electron';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='Kellas94/siren'||process.env.GITHUB_REF!=='refs/heads/probe/docs-diagram-embeds-20261010')throw Error('HOSTED_DISPOSABLE_WINDOWS_ONLY');
const output=resolve('evidence/docs-diagram-embeds-native','diagnostic-'+Date.now()),entry=resolve('generated/diagram-vector.html');await mkdir(join(output,'owned-profile'),{recursive:true});
await writeFile(join(output,'diagnostic-start.json'),JSON.stringify({author:'/root',githubCommit:process.env.GITHUB_SHA,stage:'OWNED_PROFILE_CREATED_NOT_NATIVE_RESULT'}));
try{app.setPath('userData',join(output,'owned-profile'));}catch(error){await writeFile(join(output,'startup-error.json'),JSON.stringify({message:error.message,stack:error.stack}));app.exit(1);}
app.on('window-all-closed',()=>{});
const report={author:'/root',classification:'NATIVE_RENDER_DIAGNOSTIC_NOT_FEATURE_APPROVAL',githubCommit:process.env.GITHUB_SHA,entrySha256:createHash('sha256').update(await readFile(entry)).digest('hex')};
let window;
// Electron awaits the application's ESM evaluation before completing startup.
// Register work without awaiting readiness in that module evaluation.
app.whenReady().then(async()=>{
try{
 window=new BrowserWindow({show:false,width:1600,height:900,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,partition:'embed-diagnostic-'+randomUUID()}});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));await window.loadFile(entry);
 const input={diagram:{id:'flow-a',name:'Review flow',source:'flowchart LR\n A[Input] --> B{Check}\n B --> C[Review]\n B --> D[Approve]\n C --> E[Store]\n D --> E\n classDef accent fill:#ffcc00,stroke:#15355f\n class A,C accent'},appearance:'light'};
 report.production=await window.webContents.executeJavaScript(`(async()=>{try{return {ok:true,result:await window.sirenRenderDiagramEmbed(${JSON.stringify(input)})};}catch(e){return {ok:false,code:e.code,message:e.message,stack:e.stack};}})()`);
 const raw=await window.webContents.executeJavaScript(`(async()=>{const result=await window.mermaid.render('diagnosticRaw',${JSON.stringify(input.diagram.source)},document.getElementById('renderHost'));return result.svg;})()`);await writeFile(join(output,'raw.svg'),raw);
 report.rawSha256=createHash('sha256').update(raw).digest('hex');report.rawBytes=Buffer.byteLength(raw);
 report.validator=await window.webContents.executeJavaScript(`(()=>{try{return {ok:true,svg:window.SirenDiagramEmbedSvg.sanitizeDiagramEmbedSvg(${JSON.stringify(raw)})};}catch(e){return {ok:false,code:e.code,message:e.message,stack:e.stack};}})()`);
}catch(error){report.error={message:error.message,stack:error.stack};}
finally{window?.destroy();report.windowDestroyed=window?.isDestroyed()===true;await writeFile(join(output,'diagnostic.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,production:report.production?.ok,validator:report.validator?.ok,error:report.error}));app.quit();}
}).catch(error=>{console.error(error);app.exit(1);});
