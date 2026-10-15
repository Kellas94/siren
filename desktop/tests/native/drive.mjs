import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import {waitForNativeCondition} from './condition.mjs';
import {stablePointerExpression} from './pointer.mjs';

// Target discovery identifies the page, not completion of its native preload.
// Keep authentication separate from this bounded, read-only startup qualification.
export async function waitForDesktopStartup(driver) {
  const receipt = `(()=>{const b=window.sirenDesktopBootstrap;return {url:location.href,readyState:document.readyState,bridge:typeof window.sirenDesktop?.getPinState,bootstrap:b?{mode:b.mode,readonly:b.readonly,snapshotPresent:b.snapshot!=null,pin:b.pin}:null};})()`;
  try {
    await driver.waitFor(`(()=>{const r=${receipt};return ['siren://app/home.html','siren://app/app.html'].includes(r.url)&&r.bridge==='function'&&['locked','normal','readonly','recovery'].includes(r.bootstrap?.mode)&&typeof r.bootstrap?.readonly==='boolean'&&typeof r.bootstrap?.pin?.configured==='boolean'&&typeof r.bootstrap?.pin?.unlocked==='boolean';})()`);
  } catch (error) {
    const observed = await driver.evaluate(receipt).catch(error => ({ observationError: error.message }));
    throw new Error('Native PIN startup receipt unavailable: ' + JSON.stringify(observed), { cause: error });
  }
  return driver.evaluate(receipt);
}

// Explicit fixture authorization: raw launchDesktop always exposes the real lock.
export async function waitForWorkspaceAdmission(driver){
 await driver.evaluate('window.sirenDesktopAdmitted()');
 await driver.waitFor('(async()=>{const receipt=await window.sirenWindow.getView();return receipt?.ok===true&&receipt.view?.role==="workspace";})()');
 const receipt=await driver.evaluate('window.sirenWindow.getView()');
 assert.equal(receipt?.ok,true,'Native registry admission must acknowledge');
 assert.equal(receipt.view.role,'workspace','Only the genuine workspace receipt admits these probes');
 return receipt;
}
// This uses the production native PIN receipts; it never edits bootstrap/storage.
export async function unlockDesktop(driver, { pin, autoSetup = false, surface='diagrams' } = {}) {
  assert.match(pin || '', /^(?:[0-9]{4}|[0-9]{6})$/, 'Owned fixture PIN must contain four or six digits');
  await waitForDesktopStartup(driver);
  const state = await driver.evaluate(`(()=>{if(typeof window.sirenDesktop?.getPinState!=='function')throw new Error('Native PIN bridge unavailable');return window.sirenDesktop.getPinState();})()`);
  assert.equal(typeof state?.configured, 'boolean', 'Native PIN state must report configuration');
  assert.equal(typeof state?.unlocked, 'boolean', 'Native PIN state must report lock authority');
  if (!state.configured) {
    assert.equal(autoSetup, true, 'Unconfigured PIN requires explicit autoSetup for this owned fixture');
    const setup = await driver.evaluate(`window.sirenDesktop.setupPin(${JSON.stringify({ pin, confirmation: pin })})`);
    assert.equal(setup?.ok, true, 'Owned fixture PIN setup must acknowledge');
  }
  const current = await driver.evaluate('window.sirenDesktop.getPinState()');
  assert.equal(typeof current?.unlocked, 'boolean', 'Native PIN state readback must report lock authority');
  if (!current.unlocked) {
    const unlocked = await driver.evaluate(`window.sirenDesktop.unlockPin(${JSON.stringify({ pin })})`);
    assert.equal(unlocked?.ok, true, 'Owned fixture PIN unlock must acknowledge');
  }
  const unlocked = await driver.evaluate('window.sirenDesktop.getPinState()');
  assert.equal(unlocked.configured, true, 'Native PIN configuration must be retained');
  assert.equal(unlocked.pinLength, pin.length, 'Native PIN length must match this owned fixture');
  assert.equal(unlocked.unlocked, true, 'Native unlock must actually release the gate');
  // Use the same renderer reload as the real PIN UI. The CDP Page.reload command
  // can stall on this Electron custom-protocol target even after native success.
  if (await driver.evaluate('window.sirenDesktopBootstrap?.mode === "locked"')) await driver.evaluate('setTimeout(() => location.reload(), 0); true');
  await driver.waitFor(`['siren://app/home.html','siren://app/app.html'].includes(location.href)&&typeof window.sirenDesktop?.getPinState==='function'&&['normal','readonly','recovery'].includes(window.sirenDesktopBootstrap?.mode)&&window.sirenDesktopBootstrap?.pin?.unlocked===true`);
  // Diagram/legacy probes explicitly enter their real destination. First-use
  // probes can retain Home and assert that unlock creates no implicit project.
  if(surface==='diagrams'&&await driver.evaluate('location.href==="siren://app/home.html"')){
    await driver.waitFor('typeof window.sirenHome?.getHomeState==="function" && window.sirenHomeView!=null');
    const home=await driver.evaluate('window.sirenHome.getHomeState()');assert.equal(home.ok,true);
    if(home.state.mode!=='normal'&&!home.state.capabilities.diagrams){
      await driver.evaluate('window.sirenHome.showRecovery()').catch(()=>{});
      await driver.waitFor('location.href==="siren://app/app.html" && document.getElementById("desktopRecoveryPanel")?.open===true');return unlocked;
    }
    if(home.state.selectedProjectId===null){
      assert.equal((await driver.evaluate('window.sirenHome.createProject({label:"Owned native probe project"})')).ok,true,'Fixture explicitly creates a project through production Home');
      await driver.waitFor('document.body.inert===false && !document.getElementById("homeRoot").hidden');
    }
    await driver.evaluate('window.sirenHome.openModule({surface:"diagrams"})').catch(()=>{/* The originating frame is intentionally retired; assert destination below. */});
    await driver.waitFor('location.href==="siren://app/app.html" && window.sirenDesktopBootstrap?.pin?.unlocked===true && document.getElementById("desktopHome")!=null');
  }
  if(surface==='diagrams'&&await driver.evaluate('location.href==="siren://app/app.html"'))await waitForWorkspaceAdmission(driver);
  return unlocked;
}

export async function launchDesktop({ root = resolve('.'), executable = resolve(root, 'node_modules/electron/dist/electron.exe'), packaged = false, extraArgs = [] } = {}) {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  // Chromium's own test switch keeps CSS frames progressing when Windows fully
  // occludes the owned probe window. It changes only test launches, not SIREN.
  // DOM hit testing still refuses controls covered by another application element.
  // https://github.com/chromium/chromium/blob/152.0.7977.130/content/public/common/content_switches.cc
  const child = spawn(executable, [...(packaged ? [] : [root]), '--disable-backgrounding-occluded-windows', `--remote-debugging-port=${port}`, ...extraArgs], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; let exited = false;
  child.on('error', error => { exited = true; logs += `\nOwned Electron launch failed: ${error.code}`; });
  child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; }); child.on('exit', () => { exited = true; });
  let target; let lastDiscovery = null;
  try {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (exited) throw new Error('Electron exited before driver attachment: ' + logs.slice(-4000));
      try { lastDiscovery = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })).json(); target = lastDiscovery.find(t => t.type === 'page' && ['siren://app/home.html','siren://app/app.html'].includes(t.url)); } catch (error) { lastDiscovery = { error: error.message }; }
      if (target) break;
      await delay(200);
    }
    if (!target) throw new Error('No owned Electron page: ' + logs.slice(-4000) + '\nDiscovery: ' + JSON.stringify(lastDiscovery));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    let serial = 0; const pending = new Map(); const events = [];
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id) { const p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(Object.assign(new Error(JSON.stringify(m.error)),{cdpCode:m.error.code,cdpMessage:m.error.message})) : p.resolve(m.result); } }
      else events.push(m);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
      pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
    });
    await send('Runtime.enable'); await send('Page.enable');
    const evaluate = async expression => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    const waitFor = expression => waitForNativeCondition(evaluate,expression,{onNavigationGap:()=>{events.push({method:'OwnedProbe.navigationObservationInterrupted',params:{cdpCode:-32000}});}});
    const screenshot = async path => { const r = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path, Buffer.from(r.data, 'base64')); };
      const click = async selector => {
        // Hosted displays can be shorter than the owned local window. Bring the
        // control into the real viewport; still refuse covered or absent hits.
        await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control');e.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});})()`);
        // Existing menus position once immediately and again on the next frame.
        // Observe that actual rectangle settling; retain the same center/hit oracle.
        await waitFor(stablePointerExpression(selector));
        const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control'); const r=e.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2;const h=document.elementFromPoint(x,y);return {x,y,hit:r.width>0&&r.height>0&&e.contains(h),cover:h?.id||h?.className||h?.tagName,rectangle:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight},scroll:{x:scrollX,y:scrollY},ancestors:Array.from((function*(n){for(;n;n=n.parentElement)yield n;})(e)).slice(0,12).map(n=>({id:n.id,className:n.className,transform:getComputedStyle(n).transform,animation:getComputedStyle(n).animationName,rect:{x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y}}))};})()`);
      if (!point.hit) throw new Error('Occluded control: ' + selector + ' by ' + point.cover + ' · ' + JSON.stringify(point));
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    };
    return { pid: child.pid, send, evaluate, waitFor, screenshot, click, events, logs: () => logs,
      processExit: () => ({pid:child.pid,exitCode:child.exitCode,signalCode:child.signalCode}),
      waitForExit: async () => {
        if (exited) return;
        await new Promise((resolve, reject) => {
          const done = () => { clearTimeout(timer); resolve(); };
          const timer = setTimeout(() => { child.removeListener('exit', done); reject(new Error('Owned SIREN did not exit after Quit')); }, 15000);
          child.once('exit', done);
        });
      },
      close: async () => { ws.close(); if (!exited) { child.kill(); await Promise.race([new Promise(r => child.once('exit', r)), delay(5000)]); } } };
  } catch (error) { if (!exited) child.kill(); throw error; }
}
