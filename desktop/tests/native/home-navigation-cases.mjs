import assert from 'node:assert/strict';
import {join} from 'node:path';
import {RecoveryStore} from '../../src/recovery/checkpoints.mjs';
export async function runHomeNavigation({driver,attachPage,data,evidence,projects,sources,first,selected,text,a,result}){
 const recovery=new RecoveryStore(data,{sources}),points=await recovery.scan();
 await driver.click('#desktopHome');await driver.waitFor('location.href==="siren://app/home.html" && document.getElementById("homeModule-docs")!=null');
 assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'),null);
 assert.equal(await driver.evaluate('document.body.textContent.includes("OTHER_DOC_PRIVATE_CONTENT")'),false);
 assert.equal(await driver.evaluate('document.querySelectorAll("#homeRoot [data-window-id]").length'),3);
 await driver.screenshot(join(evidence,'home-open-windows.png'));
 await driver.click('#homeModule-docs');await driver.waitFor('document.querySelector(".home-library [data-entity-id=doc-a]")!=null');
 await driver.click('.home-library [data-entity-id=doc-a]');await driver.waitFor('document.querySelectorAll("#homeRoot [data-window-id]").length===4');
 let state=await driver.evaluate('window.sirenHome.getHomeState()');assert.equal(state.state.continuation.location.surface,'docs');assert.equal(state.state.continuation.location.entityId,'doc-a');
 await driver.click('#homeContinue');await driver.waitFor('document.querySelectorAll("#homeRoot [data-window-id]").length===5');
 await driver.click('#homeModule-code');await driver.waitFor(`document.querySelector(${JSON.stringify('.home-library [data-entity-id="'+a.sourceId+'"]')})!=null`);
 await driver.click('.home-library [data-entity-id="'+a.sourceId+'"]');await driver.waitFor('document.querySelectorAll("#homeRoot [data-window-id]").length===6');
 state=await driver.evaluate('window.sirenHome.getHomeState()');assert.deepEqual(state.state.continuation.location.sourceRef,{sourceId:a.sourceId,version:1,sha256:a.sha256});
 await driver.click('#homeContinue');await driver.waitFor('document.querySelectorAll("#homeRoot [data-window-id]").length===7');
 const views=(await driver.evaluate('window.sirenWindow.listViews()')).views.filter(v=>v.role==='code'&&v.entityId===a.sourceId);
 for(const view of views){const page=await attachPage('siren://app/windows/code.html?windowId='+view.windowId);await page.waitFor('document.body.dataset.sourceReady==="true"');assert.equal(await page.evaluate('document.body.dataset.sourceSha256'),a.sha256);}
 assert.deepEqual(await projects.readProject(first.project.id),selected);assert.deepEqual(await recovery.scan(),points);
 result.cases.push({name:'actual Home metadata-only windows shelf, readonly Docs/Code libraries and Continue open exact saved native entities/version without changing content or recovery points',ok:true});
 await driver.click('#homeModule-diagrams');await driver.waitFor('location.href==="siren://app/app.html" && document.getElementById("desktopHome")!=null');
 await driver.waitFor('document.getElementById("confirmDialog")?.open===true');await driver.click('#cancelConfirmButton');
 await driver.click('#desktopHome');await driver.waitFor('location.href==="siren://app/home.html" && document.querySelectorAll("#homeRoot [data-window-id]").length===7');
 assert.deepEqual(await recovery.scan(),points);assert.deepEqual(await projects.readProject(first.project.id),selected);
 result.cases.push({name:'actual Home to Diagrams to Home prepares seven native views and preserves their state and exact selected project without redundant checkpoint',ok:true});
 await driver.click('#homeNewProject');await driver.waitFor('document.querySelector("#homeProjectName")!=null');await driver.click('#homeProjectName');await driver.send('Input.insertText',{text:'Explicit Home navigation project Ș😀'});
 await driver.click('.home-create button[type=submit]');await driver.waitFor(`(async()=>{const r=await window.sirenHome.getHomeState();return r.ok&&r.state.selectedProjectId!==${JSON.stringify(first.project.id)}&&document.body.inert===false&&!document.getElementById('homeRoot').hidden&&document.querySelector('.home-create')==null})()`);
 state=await driver.evaluate('window.sirenHome.getHomeState()');assert.notEqual(state.state.selectedProjectId,first.project.id);assert.equal(state.state.views.length,0);
 assert.equal((await driver.send('Target.getTargets')).targetInfos.some(t=>t.url.startsWith('siren://app/windows/')),false);
 assert.equal((await projects.readProject(state.state.selectedProjectId)).project.label,'Explicit Home navigation project Ș😀');
 await driver.click('.home-project-row[data-project-id="'+first.project.id+'"]');await driver.waitFor(`(async()=>{const r=await window.sirenHome.getHomeState();return r.ok&&r.state.selectedProjectId===${JSON.stringify(first.project.id)}&&document.body.inert===false&&!document.getElementById('homeRoot').hidden})()`);
 state=await driver.evaluate('window.sirenHome.getHomeState()');assert.equal(state.state.selectedProjectId,first.project.id);assert.equal(state.state.views.length,0);
 assert.deepEqual(await projects.readProject(first.project.id),selected);assert.deepEqual(await sources.exportSource({projectId:first.project.id,sourceId:a.sourceId,version:1}),Buffer.from(text));assert.deepEqual(await recovery.scan(),points);
 await driver.screenshot(join(evidence,'home-selected-restored.png'));
 result.cases.push({name:'actual Home explicit New and recent-project reopening retire old windows, verify durable selection and preserve the prior source project and checkpoints',ok:true});
}
