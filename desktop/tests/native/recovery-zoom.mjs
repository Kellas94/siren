import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../../src/projects/store.mjs';
import {RecoveryStore} from '../../src/recovery/checkpoints.mjs';
import {launchDesktop} from './drive.mjs';

// Complete normalized state from an owned native fixture, with synthetic source
// and view settings. No CI logs, user projects, or ignored evidence are required.
const fixture=JSON.parse(await readFile(new URL('../fixtures/recovery-zoom-state.json',import.meta.url),'utf8'));
const html=await readFile('generated/app.html','utf8');
const comparisonLine=html.split('\n').findIndex(line=>line.includes('if (current === drafted) return;'));
assert.ok(comparisonLine>0,'Recovery comparison must remain available');
const evidence=resolve('evidence',`recovery-zoom-${new Date().toISOString().replaceAll(':','-')}`);await mkdir(evidence,{recursive:true});
const result={completed:false,rendererSha256:createHash('sha256').update(html).digest('hex'),cases:[]};
for(const kind of ['matching','source','zoom','docs']){
 const state=structuredClone(fixture);
 const draft={savedAt:'2026-10-02T12:00:00.000Z',activeDiagramId:state.activeDiagramId,source:state.source,diagrams:structuredClone(state.diagrams),workpapers:structuredClone(state.workpapers),map:structuredClone(state.map)};
 if(kind==='source'){draft.source='flowchart TD\n A[Unsaved source]-->B';draft.diagrams[0].source=draft.source;}
 if(kind==='zoom')draft.diagrams[0].zoom=45;
 if(kind==='docs')draft.workpapers.push({id:'owned-unsaved-doc',ref:'WP-001',title:'Draft-only document',type:'memo',status:'draft',createdAt:draft.savedAt,updatedAt:draft.savedAt,links:[],comments:[],revisions:[],blocks:[]});
 const bag={kind:'siren-desktop',schema:1,storage:{'t-industries-siren-v23-state':JSON.stringify(state),'t-industries-siren-v23-state-draft':JSON.stringify(draft),'t-industries-siren-v23-state-clean-exit':'no'}};
 const root=await mkdtemp(join(evidence,`${kind}-data-`)),projects=new ProjectStore(root);
 const first=await projects.createProject({label:`Recovery zoom ${kind}`,json:JSON.stringify(bag)});
 await new RecoveryStore(root).checkpointProject({snapshot:first,kind:'saved'});
 let driver;const observed={kind};result.cases.push(observed);
 try{
  driver=await launchDesktop({extraArgs:[`--siren-test-root=${root}`,`--siren-test-project=${first.project.id}`]});
  await driver.send('Debugger.enable');
  // Read the real lexical comparison, leaving its behavior and confirmation intact.
  await driver.send('Debugger.setBreakpointByUrl',{url:'siren://app/app.html',lineNumber:comparisonLine,condition:'window.__recoveryZoomProof={current:JSON.parse(current),drafted:JSON.parse(drafted),equal:current===drafted}; false'});
  await driver.waitFor('!!window.__recoveryZoomProof');
  observed.comparison=await driver.evaluate('window.__recoveryZoomProof');
  observed.ui=await driver.evaluate('({open:document.getElementById("confirmDialog")?.open,text:document.getElementById("confirmDialog")?.textContent,source:document.getElementById("source")?.value})');
  observed.bootstrapBag=await driver.evaluate('window.sirenDesktopBootstrap.snapshot.json');
  assert.equal(observed.comparison.current.diagrams[0].zoom,31,'Recovery must compare the restored view before startup auto-fit');
  assert.equal(observed.ui.source,state.source,'Draft is never silently applied');
  assert.equal(observed.comparison.equal,kind==='matching');
  assert.equal(observed.ui.open,kind!=='matching');
  if(kind!=='matching')assert.match(observed.ui.text,/Recover unsaved work\?/);
  if(kind==='source')assert.equal(observed.comparison.drafted.diagrams[0].source,draft.source);
  if(kind==='zoom')assert.equal(observed.comparison.drafted.diagrams[0].zoom,45);
  if(kind==='docs')assert.equal(observed.comparison.drafted.workpapers[0].title,'Draft-only document');
  await driver.screenshot(join(evidence,`${kind}.png`));observed.passed=true;
 }catch(error){observed.error=String(error.stack||error);throw error;}
 finally{await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));if(driver){await writeFile(join(evidence,`${kind}-electron.log`),driver.logs());await driver.close();}}
}
result.completed=true;await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({completed:true,evidence,cases:result.cases.map(c=>({kind:c.kind,passed:c.passed,prompt:c.ui.open}))}));
