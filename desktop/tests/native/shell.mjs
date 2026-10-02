import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { launchDesktop } from './drive.mjs';

const evidence = resolve('evidence', `shell-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const driver = await launchDesktop();
const checks = [];
try {
  await driver.waitFor('document.readyState === "complete" && document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await driver.waitFor('!!document.querySelector("svg .node")');
  const runtime = await driver.evaluate('({userAgent:navigator.userAgent, title:document.title, version:document.getElementById("brandVersion").textContent, node:typeof require, process:typeof process, methods:Object.keys(window.sirenDesktop).sort()})');
  assert.equal(runtime.node, 'undefined'); assert.equal(runtime.process, 'undefined'); assert.match(runtime.userAgent, /Electron\/44\.5\.1/);
  assert.equal(runtime.methods.includes('exec'), false); assert.equal(runtime.methods.includes('readFile'), false); checks.push('actual-renderer-isolation');
  const attack = await driver.evaluate(`(async()=>({extra:await sirenDesktop.saveProject({projectId:'../secret',baseRevision:0,json:'{}',purpose:'workspace'}),frame:await (async()=>{const f=document.createElement('iframe');f.srcdoc='<p>hostile</p>';document.body.append(f);await new Promise(r=>setTimeout(r,100));const x=typeof f.contentWindow.sirenDesktop;f.remove();return x})(),window:window.open('https://example.com')===null,protocol:(await fetch('siren://app/%252e%252e/secret')).status}))()`);
  assert.equal(attack.extra.ok, false); assert.equal(attack.extra.code, 'REQUEST_REFUSED'); assert.equal(attack.frame, 'undefined'); assert.equal(attack.window, true); assert.equal(attack.protocol, 403); checks.push('hostile-renderer-boundaries');
  // The oracle must reject a planted privileged bridge, even if all other controls look healthy.
  const planted = { ...runtime, methods: [...runtime.methods, 'exec'] };
  assert.throws(() => assert.equal(planted.methods.includes('exec'), false)); checks.push('privilege-oracle-negative-control');
  // DevTools navigation bypasses will-navigate; exercise a user's actual link click.
  await driver.evaluate(`(()=>{const a=document.createElement('a');a.id='nativeHostileLink';a.href='https://example.com';a.textContent='Native hostile navigation probe';Object.assign(a.style,{position:'fixed',top:'4px',left:'4px',zIndex:2147483647,background:'white',color:'black'});document.body.append(a)})()`);
  await driver.click('#nativeHostileLink');
  await driver.waitFor('location.href === "siren://app/app.html"'); checks.push('navigation-refused');
  await driver.evaluate('document.getElementById("nativeHostileLink").remove()');
  await driver.screenshot(resolve(evidence, 'desktop.png'));
  await writeFile(resolve(evidence, 'result.json'), JSON.stringify({ scope: 'Task1 shell only; no production auth/update or project recovery certification', completed: true, pid: driver.pid, runtime, attack, checks }, null, 2));
  console.log(JSON.stringify({ completed: true, checks: checks.length, evidence }));
} finally { await writeFile(resolve(evidence, 'electron.log'), driver.logs()); await driver.close(); }
