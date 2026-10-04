import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../../src/projects/store.mjs';
import {launchDesktop,unlockDesktop,waitForDesktopStartup} from './drive.mjs';
const root=resolve('evidence/home-recovery',new Date().toISOString().replaceAll(':','-')),data=join(root,'owned-data');await mkdir(data,{recursive:true});
const names=['src/main.mjs','src/preload.cjs','src/navigation/transition-receipts.mjs','src/ui/storage.js','src/ui/workspace/home.js','generated/home.html','generated/app.html','tests/native/home-recovery.mjs','tests/native/drive.mjs'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),capture=async()=>Object.fromEntries(await Promise.all(names.map(async n=>[n,hash(await readFile(n))]))),inputs=await capture();
const projects=new ProjectStore(data),original=await projects.createProject({label:'OWNED_RECOVERY_PRIVATE_LABEL',json:'{"source":"flowchart TD\\n A[PRIVATE]-->B"}'});
await writeFile(join(data,'session-selection.json'),JSON.stringify({schema:1,projectId:original.project.id}));await mkdir(join(data,'Recovery'));await writeFile(join(data,'Recovery/sessions.json'),'{owned corrupted journal');
let driver;const result={status:'ADVERSE',inputs,cases:[]};
try{
 driver=await launchDesktop({extraArgs:['--siren-test-root='+data]});result.ownedPid=driver.pid;
 // CDP target discovery can precede the committed frame and its native preload.
 // Qualify the real locked startup receipt before checking privacy, without unlocking.
 result.startup=await waitForDesktopStartup(driver);
 assert.equal(await driver.evaluate('location.href'),'siren://app/home.html');assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'),null);
 assert.equal(await driver.evaluate('document.body.innerText.includes("OWNED_RECOVERY_PRIVATE_LABEL")'),false);
 await unlockDesktop(driver,{pin:'4826',autoSetup:true,surface:'home'});await driver.waitFor('document.getElementById("homeRecovery")!=null');
 assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.mode'),'readonly');assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'),null);
 await driver.screenshot(join(root,'home-readonly.png'));result.cases.push({name:'real damaged-journal startup reaches metadata-only readonly Home after PIN without exposing locked project data',ok:true});
 await driver.click('#homeRecovery');await driver.waitFor('location.href==="siren://app/app.html" && document.getElementById("desktopRecoveryPanel")?.open===true');
 assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.readonly'),true);assert.equal((await driver.evaluate('window.sirenWindow.getView()')).code,'SENDER_REFUSED');
 assert.equal((await driver.evaluate('window.sirenDesktop.saveProject('+JSON.stringify({projectId:original.project.id,baseRevision:1,json:'{}',purpose:'workspace'})+')')).code,'ACCESS_REFUSED');
 assert.deepEqual(await projects.readProject(original.project.id),original);await driver.screenshot(join(root,'recovery-refused-edit.png'));
 result.cases.push({name:'real readonly Home opens existing Recovery with no source/editor grant and preserves exact owned project',ok:true});
 await driver.click('#desktopCloseRecovery');await driver.click('#desktopHome');await driver.waitFor('location.href==="siren://app/home.html" && document.getElementById("homeRecovery")!=null');
 assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'),null);assert.deepEqual(await projects.readProject(original.project.id),original);
 result.cases.push({name:'real empty readonly recovery entry returns to Home without data grant or content revision',ok:true});result.status='COMPLETE';
}catch(cause){result.error={message:cause.message,stack:cause.stack};if(driver)await driver.screenshot(join(root,'failure.png')).catch(()=>{});}
finally{if(driver){await writeFile(join(root,'electron.log'),driver.logs());await driver.close();}result.afterInputs=await capture();result.inputsUnchanged=JSON.stringify(inputs)===JSON.stringify(result.afterInputs);if(!result.inputsUnchanged)result.status='ADVERSE';await writeFile(join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,status:result.status,cases:result.cases.length,error:result.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;}
