import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ProjectStore } from '../../src/projects/store.mjs';
import { RecoveryStore } from '../../src/recovery/checkpoints.mjs';
import { launchDesktop, unlockDesktop } from './drive.mjs';
import { setTimeout as delay } from 'node:timers/promises';

const evidence = resolve('evidence', `portable-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'Date-Știință-'));
const store = new ProjectStore(root);
const originalSource = 'flowchart TD\n A[Native original] --> B[Agent documentation]';
const changedSource = 'flowchart TD\n A[Actual keyboard edit] --> B[Durable local project]';
const initial = await store.createProject({ label: 'Știință — native desktop', json: JSON.stringify({ source: originalSource }) });
await new RecoveryStore(root).checkpointProject({ snapshot: initial, kind: 'saved' });
const extraArgs = [`--siren-test-root=${root}`, `--siren-test-project=${initial.project.id}`];
let driver;
try {
  driver = await launchDesktop({ extraArgs });
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor(`document.getElementById('brandVersion')?.textContent === 'v1.131.0' && !!document.querySelector('svg .node')`);
  assert.equal(await driver.evaluate('document.getElementById("source").value'), originalSource);
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  await driver.click('#codeModeButton');
  await driver.click('#source');
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  await driver.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  await driver.send('Input.insertText', { text: changedSource });
  const deadline = Date.now() + 15000; let saved;
  while (Date.now() < deadline) { saved = await store.readProject(initial.project.id); if (saved.json.includes('Actual keyboard edit')) break; await delay(100); }
  const bag = JSON.parse(saved.json); assert.equal(bag.kind, 'siren-desktop');
  const workspace = JSON.parse(bag.storage['t-industries-siren-v23-state']);
  assert.equal(workspace.diagrams.find(d => d.id === workspace.activeDiagramId).source, changedSource);
  await driver.waitFor(`!![...document.querySelectorAll('svg .node')].find(n=>n.textContent.includes('Actual keyboard edit'))`);
  await driver.waitFor(`document.getElementById('saveStatusText')?.textContent === 'Saved locally' || [...document.querySelectorAll('span')].some(e=>e.textContent==='Saved locally')`);
  await driver.screenshot(join(evidence, 'edited-desktop.png'));
  await writeFile(join(evidence, 'before-kill.json'), JSON.stringify(saved));
  // Own-process force close, then a fresh actual Electron renderer must load disk bytes.
  await driver.close(); driver = await launchDesktop({ extraArgs });
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor(`document.getElementById('brandVersion')?.textContent === 'v1.131.0'`);
  assert.equal(await driver.evaluate('document.getElementById("source").value'), changedSource);
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  await driver.click('#desktopOptions');
  await driver.click('#desktopRecovery');
  await driver.waitFor('document.getElementById("desktopRecoveryPanel")?.open === true');
  const recovery = await new RecoveryStore(root).inspectRecovery({ projectId: initial.project.id });
  assert.ok(recovery.points.length > 0);
  await driver.screenshot(join(evidence, 'recovery-panel.png'));
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Development Electron; actual keyboard save, process stop/restart, disk source comparison and Recovery dialog. Packaged/helper/power-loss/production auth still pending.', projectId: initial.project.id, revision: saved.revision, sha256: saved.sha256, recoveryPoints: recovery.points.length }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));
} finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
