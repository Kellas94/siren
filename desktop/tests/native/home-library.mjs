import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../../src/projects/store.mjs';
import {launchDesktop,unlockDesktop} from './drive.mjs';
import {reserveInspectorPort,attachNativeKeyboard} from './native-keyboard.mjs';
const evidence=resolve('evidence/home-library',new Date().toISOString().replaceAll(':','-')),data=join(evidence,'owned-data');await mkdir(data,{recursive:true});
const paths=['src/main.mjs','src/ui/workspace/home.js','src/ui/workspace/workspace.css','src/windows/catalog.mjs','src/navigation/continue.mjs','generated/home.html','tests/native/home-library.mjs','tests/native/native-keyboard.mjs','tests/native/drive.mjs'];
const capture=async()=>Object.fromEntries(await Promise.all(paths.map(async name=>[name,createHash('sha256').update(await readFile(name)).digest('hex')]))),inputs=await capture();
const projects=new ProjectStore(data),original=await projects.createProject({label:'Owned Home library',json:JSON.stringify({workpapers:Array.from({length:130},(_,n)=>({id:'doc-'+n,title:'Document '+n,content:'PRIVATE_BODY_'+n}))})});
await writeFile(join(data,'session-selection.json'),JSON.stringify({schema:1,projectId:original.project.id}));
let driver,keyboard;const result={status:'ADVERSE',inputs,cases:[]};
const shortcut=(key,_code,modifiers)=>keyboard.shortcut(key==='u'?'U':key==='l'?'L':key,modifiers===3?['control','alt']:['control']);
try{
 const inspectorPort=await reserveInspectorPort();driver=await launchDesktop({extraArgs:['--siren-test-root='+data,'--inspect=127.0.0.1:'+inspectorPort]});keyboard=await attachNativeKeyboard({port:inspectorPort,pid:driver.pid});await unlockDesktop(driver,{pin:'4826',autoSetup:true,surface:'home'});
 await driver.waitFor('document.getElementById("homeSettings")!=null');
 await shortcut(',', 'Comma',2,188);await driver.waitFor('document.getElementById("homeSettingsPanel")?.open===true');
 assert.equal(await driver.evaluate('document.querySelectorAll("#homeSettingsPanel .home-project-row").length'),3);
 await driver.click('#homeSettingsUpdates');await driver.waitFor('document.getElementById("homeUpdates")?.open===true&&document.getElementById("homeUpdateStatus").textContent.includes("not configured")');
 await driver.click('#homeCheckUpdates');await driver.waitFor('document.getElementById("homeCheckUpdates").disabled===false');await driver.screenshot(join(evidence,'home-updates.png'));await driver.click('#homeUpdates .home-secondary');
 await shortcut('u','KeyU',3,85);await driver.waitFor('document.getElementById("homeUpdates")?.open===true');await driver.click('#homeUpdates .home-secondary');
 result.cases.push({name:'actual Home Ctrl+, Settings and Ctrl+Alt+U Updates route once through the native menu and display the real unconfigured publisher state',ok:true});
 await driver.click('#homeSettings');await driver.click('#homeQuickGuide');await driver.waitFor('document.getElementById("homeGuide")?.open===true');
 for(const delivered of ['Build, Guided and vector export','Desktop diagram windows include Text and Guided, plus optional Build and Style panels','Build selects real rendered flowchart blocks','Imported Mermaid colours take priority over saved block/class styles','Export SVG renders the saved diagram','Save local changes first','Guided pages show 64 lines at a time','invalid fields remain visible and prevent Lock','Edit working copy saves a new source version','Presenter keeps your notes private; Audience receives only the public slide','Refresh saved deck adopts saved changes explicitly','Cards, rich media and deck export are still being developed','Close, Lock and Quit wait for working copies to be saved','Ctrl+Alt+L'])assert.equal(await driver.evaluate('document.getElementById("homeGuide").textContent.includes('+JSON.stringify(delivered)+')'),true);
 assert.equal(await driver.evaluate('document.getElementById("homeGuide").textContent.includes("native view is read only")'),false);await driver.screenshot(join(evidence,'home-guide.png'));await driver.click('#homeGuide .home-secondary');
 result.cases.push({name:'actual Home quick guide explains delivered editable Diagrams/Docs/Code, retained studio tools, exact Continue and native shortcuts without retaining the obsolete read-only claim',ok:true});
 await driver.click('#homeModule-docs');await driver.waitFor('document.querySelectorAll(".home-library [data-entity-id]").length===64');
 assert.equal(await driver.evaluate('document.getElementById("homeLibraryMore").hidden'),false);assert.equal(await driver.evaluate('document.body.textContent.includes("PRIVATE_BODY_")'),false);
 await driver.click('#homeLibraryMore');await driver.waitFor('document.querySelectorAll(".home-library [data-entity-id]").length===128');
 await driver.click('#homeLibraryMore');await driver.waitFor('document.querySelectorAll(".home-library [data-entity-id]").length===130&&document.getElementById("homeLibraryMore").hidden===true');
 assert.equal(await driver.evaluate('new Set([...document.querySelectorAll(".home-library [data-entity-id]")].map(row=>row.dataset.entityId)).size'),130);assert.deepEqual(await projects.readProject(original.project.id),original);
 await driver.screenshot(join(evidence,'home-paged-library.png'));result.cases.push({name:'actual Home Docs library mounts 64 metadata rows then 128/130 only on native Load more input, with no private bodies and exact project retained',ok:true});
 await shortcut('l','KeyL',3,76);await driver.waitFor('window.sirenDesktopBootstrap.mode==="locked"');
 assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'),null);assert.equal(await driver.evaluate('document.querySelectorAll(".home-library").length'),0);assert.equal((await driver.evaluate('window.sirenDesktop.getPinState()')).unlocked,false);assert.deepEqual(await projects.readProject(original.project.id),original);
 result.cases.push({name:'actual native Lock shortcut remains available with a modal library open, clears its metadata and retains the complete original project',ok:true});result.status='COMPLETE';
}catch(error){result.error={message:error.message,stack:error.stack};if(driver)await driver.screenshot(join(evidence,'failure.png')).catch(()=>{});}
finally{keyboard?.close();if(driver){await writeFile(join(evidence,'electron.log'),driver.logs());await driver.close();}result.afterInputs=await capture();result.inputsUnchanged=JSON.stringify(inputs)===JSON.stringify(result.afterInputs);if(!result.inputsUnchanged)result.status='ADVERSE';await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({evidence,status:result.status,cases:result.cases.length,error:result.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;}
