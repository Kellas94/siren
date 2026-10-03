import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {ProjectStore} from '../../src/projects/store.mjs';
import {launchDesktop} from './drive.mjs';

const evidence=resolve('evidence',`local-pin-${new Date().toISOString().replaceAll(':','-')}`);await mkdir(evidence,{recursive:true});
const root=await mkdtemp(join(evidence,'data-')),projects=new ProjectStore(root);
const state=JSON.parse(await readFile(new URL('../fixtures/recovery-zoom-state.json',import.meta.url),'utf8'));
state.source='flowchart TD\n A[OWNED_PIN_SOURCE_MARKER]-->B';state.diagrams[0].source=state.source;
const python='def private_pin_draft():\n    return "OWNED_PIN_PRIVATE_MARKER"\n';
const bag={kind:'siren-desktop',schema:1,storage:{'t-industries-siren-v23-state':JSON.stringify(state),'siren-code-drafts-v1':JSON.stringify([{id:'owned-pin-draft',ref:null,name:'Private.py',language:'python',base:'',text:python,generation:1}])}};
const first=await projects.createProject({label:'OWNED_PIN_LABEL_MARKER',json:JSON.stringify(bag)});
const extraArgs=[`--siren-test-root=${root}`,`--siren-test-project=${first.project.id}`];
const result={completed:false,projectId:first.project.id,build:JSON.parse(await readFile('generated/build.json','utf8')),sourceHashes:Object.fromEntries(await Promise.all(['src/main.mjs','src/preload.cjs','src/ui/pin.js','src/account/local-pin.mjs','tests/native/drive.mjs'].map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])))};let driver;
const pin='4826',changedPin='731952';
const pinState=()=>driver.evaluate('window.sirenDesktop.getPinState()');
const screenReady=()=>driver.waitFor(`(()=>{const s=document.getElementById('desktopAccessScreen'),c=s?.querySelector('.desktop-pin-centre'),k=s?.querySelector('.desktop-pin-key[data-digit="1"]');if(!s?.open||!c||!k)return false;const r=k.getBoundingClientRect();return Number(getComputedStyle(s).opacity)>.99&&Number(getComputedStyle(c).opacity)>.99&&c.getAnimations().every(a=>a.playState!=='running')&&r.width>0&&r.height>0&&k.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`);
const stage=expected=>driver.waitFor(`document.getElementById('desktopAccessScreen')?.dataset.stage===${JSON.stringify(expected)}`);
const keys=async(value,pointer=true)=>{for(const digit of value){if(pointer)await driver.click(`.desktop-pin-key[data-digit="${digit}"]`);else{await driver.send('Input.dispatchKeyEvent',{type:'keyDown',key:digit,text:digit,code:`Digit${digit}`,windowsVirtualKeyCode:48+Number(digit)});await driver.send('Input.dispatchKeyEvent',{type:'keyUp',key:digit,code:`Digit${digit}`,windowsVirtualKeyCode:48+Number(digit)});}}};
const lockedProof=async label=>{
 await screenReady();
 const boot=await driver.evaluate('window.sirenDesktopBootstrap');
 assert.equal(boot.mode,'locked');assert.equal(boot.snapshot,null);assert.equal(boot.recoveryProjectId,null);
 assert.equal(JSON.stringify(boot).includes('OWNED_PIN_'),false,'Locked bootstrap cannot expose labels, sources or private drafts');
 assert.equal(await driver.evaluate('document.getElementById("source")?.value?.includes("OWNED_PIN_SOURCE_MARKER") || document.body.innerText.includes("OWNED_PIN_LABEL_MARKER")'),false);
 assert.equal(await driver.evaluate(`(()=>{const e=document.getElementById('workspace')||document.getElementById('source');if(!e)return true;for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n);if(n.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return true;}return e.getClientRects().length===0;})()`),true,'Workspace paint must be hidden until native PIN unlock');
 await driver.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 assert.equal(await driver.evaluate('document.getElementById("desktopAccessScreen")?.open'),true,'Escape cannot dismiss startup PIN');
 const save=await driver.evaluate(`window.sirenDesktop.saveProject(${JSON.stringify({projectId:first.project.id,baseRevision:first.revision,json:first.json,purpose:'workspace'})})`);
 const exported=await driver.evaluate(`window.sirenDesktop.exportProject(${JSON.stringify(first.project.id)})`);
 assert.equal(save.ok,false,'Locked native write must refuse');assert.equal(exported.ok,false,'Locked native export must refuse');
 if(await driver.evaluate('location.href==="siren://app/home.html"')){assert.equal(save.code,'SENDER_REFUSED');assert.equal(exported.code,'SENDER_REFUSED');}
 else{assert.match(save.code||save.message||'',/pin|lock/i);assert.match(exported.code||exported.message||'',/pin|lock/i);}
 result[label]={boot,save,exported,pin:await pinState()};await driver.screenshot(join(evidence,`${label}.png`));
};
const workspaceReady=async()=>{
 await driver.waitFor('window.sirenDesktopBootstrap?.mode === "normal" && window.sirenDesktopBootstrap?.pin?.unlocked===true');
 if(await driver.evaluate('location.href==="siren://app/home.html"')){await driver.waitFor('document.getElementById("homeModule-diagrams")?.disabled===false');await driver.click('#homeModule-diagrams');}
 await driver.waitFor('window.sirenDesktopBootstrap?.mode === "normal" && !!window.sirenDesktopBootstrap.snapshot');
 await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
 await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
 if(await driver.evaluate('document.getElementById("introOverviewDialog")?.open'))await driver.click('#closeIntroOverview');
};
try{
 driver=await launchDesktop({extraArgs});
 assert.equal(await driver.evaluate('typeof window.sirenDesktop?.getPinState'),'function','Local PIN must use a real native bridge');
 await lockedProof('first-locked');
 assert.equal((await pinState()).configured,false);
 await stage('new');await keys('48');await driver.click('#desktopPinDelete');await keys('826');
 await stage('confirm');await keys(pin,false);await workspaceReady();
 result.setup=await pinState();assert.equal(result.setup.configured,true);assert.equal(result.setup.pinLength,4);assert.equal(result.setup.unlocked,true);
 // A locked state must be enforced natively even for a caller holding an old ID.
 await driver.click('#codeModeButton');await driver.click('#textModeButton');await driver.click('#source');
 await driver.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});
 state.source='flowchart TD\n A[OWNED_PIN_CONFIRMED_SAVE]-->B';state.diagrams[0].source=state.source;
 await driver.send('Input.insertText',{text:state.source});
 await driver.evaluate('window.sirenDesktopRequestClose()');
 const saved=await projects.readProject(first.project.id);const savedBag=JSON.parse(saved.json);
 assert.equal(JSON.parse(savedBag.storage['t-industries-siren-v23-state']).diagrams[0].source,state.source);
 assert.equal(JSON.parse(savedBag.storage['siren-code-drafts-v1'])[0].text,python);
 result.savedRevision=saved.revision;
 await driver.click('#desktopOptions');await driver.click('#desktopPinSettings');
 await driver.waitFor('document.getElementById("desktopPinSettingsPanel")?.open');await driver.click('#desktopPinChange');await screenReady();
 await stage('current');await keys('0000');
 await driver.waitFor('/incorrect|wrong/i.test(document.getElementById("desktopAccessStatus")?.textContent||"") && !document.getElementById("desktopAccessPin")?.disabled');
 assert.equal((await pinState()).unlocked,true,'Wrong current PIN must not destroy an existing unlocked session');
 assert.equal(await driver.evaluate('document.getElementById("desktopAccessScreen")?.dataset.stage'),'current');
 await keys(pin);await stage('new');
 await driver.click('#desktopPinLength');await driver.send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});await driver.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await driver.waitFor('document.getElementById("desktopPinLength")?.value==="6"');await driver.click('#desktopAccessPin');await keys(changedPin,false);await stage('confirm');await keys(changedPin);
 await driver.waitFor('document.getElementById("desktopAccessScreen")?.open!==true');
 result.changed=await pinState();assert.equal(result.changed.pinLength,6);
 if(await driver.evaluate('document.getElementById("desktopPinSettingsPanel")?.open'))await driver.click('#desktopClosePinSettings');
 await driver.click('#desktopOptions');
 await driver.click('#desktopLockPin');await lockedProof('manually-locked');await stage('unlock');
 const old=await driver.evaluate(`window.sirenDesktop.unlockPin(${JSON.stringify({pin})})`);assert.equal(old.ok,false,'Changed PIN must refuse previous PIN');result.oldPinRefused=old;
 await keys('000000');await driver.waitFor('/incorrect|wrong/i.test(document.getElementById("desktopAccessStatus")?.textContent||"") && !document.getElementById("desktopAccessPin")?.disabled');assert.equal((await pinState()).unlocked,false,'Wrong UI PIN must not unlock');
 await keys(changedPin);await workspaceReady();assert.equal((await pinState()).unlocked,true);
 await driver.send('Input.dispatchKeyEvent',{type:'keyDown',key:'q',code:'KeyQ',modifiers:2,windowsVirtualKeyCode:81});await driver.waitForExit();await driver.close();
 driver=await launchDesktop({extraArgs});await lockedProof('restart-locked');assert.equal((await pinState()).unlocked,false);
 await stage('unlock');await keys(changedPin,false);await workspaceReady();
 const restarted=await projects.readProject(first.project.id),restartedBag=JSON.parse(restarted.json);
 assert.equal(JSON.parse(restartedBag.storage['t-industries-siren-v23-state']).diagrams[0].source,state.source);
 assert.equal(JSON.parse(restartedBag.storage['siren-code-drafts-v1'])[0].text,python);
 await driver.screenshot(join(evidence,'unlocked-restart.png'));
 await driver.click('#desktopOptions');await driver.click('#desktopLockPin');await lockedProof('cooldown-locked');await stage('unlock');
 for(let attempt=1;attempt<=5;attempt++){
  await keys('000000');
  if(attempt<5)await driver.waitFor('/incorrect|wrong/i.test(document.getElementById("desktopAccessStatus")?.textContent||"") && !document.getElementById("desktopAccessPin")?.disabled');
  else await driver.waitFor('/Try again in/i.test(document.getElementById("desktopAccessStatus")?.textContent||"") && document.getElementById("desktopAccessPin")?.disabled');
 }
 result.cooldown={beforeQuit:await pinState()};assert.ok(result.cooldown.beforeQuit.retryAfterMs>0,'Five actual wrong entries must create native cooldown');
 await driver.click('#desktopAccessBack');await driver.waitForExit();await driver.close();
 driver=await launchDesktop({extraArgs});await lockedProof('cooldown-restart-locked');await stage('unlock');
 result.cooldown.afterRestart=await pinState();assert.equal(result.cooldown.afterRestart.configured,true);assert.equal(result.cooldown.afterRestart.available,true);assert.equal(result.cooldown.afterRestart.unlocked,false);assert.ok(result.cooldown.afterRestart.retryAfterMs>0,'Cooldown must survive an actual process restart');
 const cooldownText=await driver.evaluate('document.getElementById("desktopAccessStatus")?.textContent');assert.match(cooldownText,/Try again in/i);assert.doesNotMatch(cooldownText,/storage.*unavailable/i);
 console.log(JSON.stringify({evidence,phase:'waiting-for-persisted-cooldown',retryAfterMs:result.cooldown.afterRestart.retryAfterMs}));
 const expiryDeadline=Date.now()+45000;let expired=false;
 while(Date.now()<expiryDeadline){const native=await pinState(),enabled=await driver.evaluate('!document.getElementById("desktopAccessPin")?.disabled');if(native.retryAfterMs===0&&enabled){result.cooldown.expired=native;expired=true;break;}await delay(150);}
 assert.equal(expired,true,'Native cooldown and actual UI controls must expire within 45 seconds');
 await keys(changedPin,false);await workspaceReady();
 const afterCooldown=JSON.parse((await projects.readProject(first.project.id)).json);
 assert.equal(JSON.parse(afterCooldown.storage['t-industries-siren-v23-state']).diagrams[0].source,state.source);assert.equal(JSON.parse(afterCooldown.storage['siren-code-drafts-v1'])[0].text,python);
 result.cooldown.unlocked=await pinState();assert.equal(result.cooldown.unlocked.unlocked,true);result.completed=true;
 console.log(JSON.stringify({completed:true,evidence,projectId:first.project.id}));
}catch(error){result.error=String(error.stack||error);if(driver){result.ui=await driver.evaluate('({bootstrap:window.sirenDesktopBootstrap,access:document.getElementById("desktopAccessScreen")?.outerHTML,activeElement:document.activeElement?.id,pinEntryLength:document.getElementById("desktopAccessPin")?.value.length,source:document.getElementById("source")?.value})').catch(()=>null);await driver.screenshot(join(evidence,'failure.png')).catch(()=>{});}throw error;}
finally{await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));if(driver){await writeFile(join(evidence,'electron.log'),driver.logs());await driver.close();}}
