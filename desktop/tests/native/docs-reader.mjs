import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../../src/projects/store.mjs';
import {AppearanceStore} from '../../src/appearance/store.mjs';
import {launchDesktop,unlockDesktop} from './drive.mjs';
import {attachNativePage} from './attach-page.mjs';
import {copiedPackageContext} from './package-context.mjs';
const evidence=resolve('evidence/docs-reader',new Date().toISOString().replaceAll(':','-'));await mkdir(evidence,{recursive:true});const packaged=await copiedPackageContext(evidence),data=packaged?.data??join(evidence,'owned-data');await mkdir(data);
const paths=['src/ui/docs/reader.js','src/ui/windows/docs.js','src/ui/shared/shell.css','generated/windows/docs.html','generated/assets/shell.js','generated/assets/shell.css','src/main.mjs','tests/native/docs-reader.mjs'];
paths.push("tests/native/package-context.mjs");
const capture=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')]))),inputs=await capture();
const rich='<p>Context <strong>matters</strong> because <em>decisions</em> need evidence.</p><blockquote>Explain the purpose.</blockquote><ul><li>Review inputs</li><li>Verify outputs</li></ul><script>window.__readerExecuted=true</script><img src="https://reader-fixture.invalid/leak" onerror="window.__readerExecuted=true"><span onclick="window.__readerExecuted=true">SAFE_LABEL</span>';
const prompt='def agent(context):\n    return context\n'+'# Context matters\n'.repeat(1500)+'REQUIRED_END_GUARD';
const document={id:'doc-a',title:'Agent specification',agent:{id:'AG-001',governance:'Not assessed'},releases:[{id:'historic',author:'Actual original author',verdict:'not-run'}],blocks:[{id:'heading',kind:'heading',level:2,text:'Purpose and scope'},{id:'rich',kind:'text',html:rich},{id:'table',kind:'table',headerRow:true,rows:Array.from({length:25},(_,i)=>['Capability '+i,'Description '+i])},{id:'checklist',kind:'checklist',items:[{text:'Inputs reviewed',done:true},{text:'Outputs pending',done:false}]},{id:'prompt',kind:'prompt',label:'Agent instructions',text:prompt,model:'',history:[]},{id:'custom',kind:'historic-custom',original:'OPAQUE_ORIGINAL'}]};
const projects=new ProjectStore(data),original=await projects.createProject({label:'Readable Docs reference',json:JSON.stringify({workpapers:[document]})});assert.equal((await new AppearanceStore(data).set({theme:'kpmg'})).ok,true);
const result={status:'ADVERSE',inputs,cases:[],scope:'Actual read-only native Docs: rich text semantics, bounded table paging, heading navigation, documented instructions, inert hostile HTML and exact source retention. No rich text editing, images or review/release authoring claimed.'};let driver;
try{
 if(packaged)await writeFile(join(data,'session-selection.json'),JSON.stringify({schema:1,accountId:null,projectId:original.project.id}));
 driver=await launchDesktop(packaged?.launch??{extraArgs:['--siren-test-root='+data,'--siren-test-project='+original.project.id]});await unlockDesktop(driver,{pin:'4826',autoSetup:true,surface:'home'});
 const opened=await driver.evaluate('window.sirenWindow.openView({role:"docs",entityId:"doc-a"})');assert.equal(opened.ok,true);const page=await attachNativePage(driver,`siren://app/windows/docs.html?windowId=${opened.view.windowId}`);
 await page.waitFor('document.body.dataset.documentReady==="true"&&document.documentElement.dataset.theme==="kpmg"');
 assert.equal(await page.evaluate('document.querySelector(".document-reader h2")?.textContent'),'Purpose and scope');
 assert.equal(await page.evaluate('document.querySelector(".document-reader strong")?.textContent'),'matters');assert.equal(await page.evaluate('document.querySelector(".document-reader em")?.textContent'),'decisions');assert.equal(await page.evaluate('document.querySelectorAll(".document-reader blockquote,.document-reader ul:not(.document-reader-checklist) li").length'),3);
 assert.equal(await page.evaluate('document.querySelectorAll(".document-reader script,.document-reader img,.document-reader [onclick],.document-reader [onerror],.document-reader iframe").length'),0);assert.equal(await page.evaluate('window.__readerExecuted===true'),false);
 result.cases.push({name:'actual reading page retains semantic emphasis, list and quote while scripts, external images and handlers cannot enter the live document; original HTML exact',ok:true});
 assert.equal(await page.evaluate('document.querySelectorAll(".document-reader-table tr").length'),20);await page.evaluate('document.querySelector(\'.document-reader [data-block-id="table"] button\').scrollIntoView({block:"center",behavior:"instant"});true');await page.click('.document-reader [data-block-id="table"] button');assert.equal(await page.evaluate('document.querySelectorAll(".document-reader-table tr").length'),25);assert.equal(await page.evaluate('document.querySelector(".document-reader-table th").textContent'),'Capability 0');assert.equal(await page.evaluate('document.querySelectorAll(".document-reader-checklist li").length'),2);
 await page.click('.document-reader-outline');
 await page.waitFor('(()=>{const h=document.querySelector(".document-reader h2").getBoundingClientRect(),c=document.getElementById("documentContent").getBoundingClientRect();return h.top>=c.top&&h.bottom<=c.bottom&&h.top>=54;})()');
 await page.screenshot(join(evidence,'docs-readable-kpmg.png'));
 assert.equal(await page.evaluate('document.querySelector(".document-reader [data-block-id=prompt]").textContent.includes("Not executed")'),true);
 assert.equal(await page.evaluate('document.querySelector(".document-reader [data-block-id=prompt] .document-caption").textContent.includes("Excerpt")'),true);
 await page.evaluate('document.querySelector(".document-reader [data-block-id=prompt] button").scrollIntoView({block:"center",behavior:"instant"});true');await page.click('.document-reader [data-block-id=prompt] button');
 assert.equal(await page.evaluate('document.querySelector(".document-reader [data-block-id=prompt] pre").textContent.endsWith("REQUIRED_END_GUARD")'),true);
 assert.deepEqual(await projects.readProject(original.project.id),original);result.cases.push({name:'real table paging expands 20 to 25 rows; section navigation, checklist states and instruction display preserve agent/release/opaque metadata and exact complete project',ok:true});result.status='COMPLETE';
}catch(error){result.error={message:error.message,stack:error.stack};if(driver)await driver.screenshot(join(evidence,'failure.png')).catch(()=>{});}
finally{if(driver){await writeFile(join(evidence,'electron.log'),driver.logs());await driver.close();}result.afterInputs=await capture();result.inputsUnchanged=JSON.stringify(inputs)===JSON.stringify(result.afterInputs);if(!result.inputsUnchanged)result.status='ADVERSE';if(packaged){result.package={sourceCommit:packaged.receipt.sourceCommit,copy:packaged.copy,archive:packaged.receipt.appArchive,runtime:packaged.receipt.runtimeBinary};try{await packaged.verify();result.packageUnchanged=true;}catch(error){result.packageUnchanged=false;result.status='ADVERSE';result.packageError=error.message;}}await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({evidence,status:result.status,cases:result.cases.length,error:result.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;}
