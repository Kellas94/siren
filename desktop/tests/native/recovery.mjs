import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ProjectStore } from '../../src/projects/store.mjs';
import { RecoveryStore } from '../../src/recovery/checkpoints.mjs';
import { launchDesktop } from './drive.mjs';

const evidence = resolve('evidence', `recovery-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-'));
const projects = new ProjectStore(root); const recovery = new RecoveryStore(root);
const json = JSON.stringify({ source: 'flowchart TD\n A[Verified recovered source] --> B[Original remains damaged]' });
const original = await projects.createProject({ label: 'Corrupt original', json });
const point = await recovery.checkpointProject({ snapshot: original, kind: 'saved' });
const directory = join(root, 'Projects', original.project.id);
const selection = JSON.parse(await readFile(join(directory, 'current.json'), 'utf8'));
const damaged = join(directory, 'revisions', selection.file);
await writeFile(damaged, '{ORIGINAL DAMAGED BY TEST');
let driver;
try {
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`, `--siren-test-project=${original.project.id}`] });
  await driver.waitFor('document.getElementById("desktopRecoveryPanel")?.open === true');
  assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.mode'), 'recovery');
  assert.equal(await driver.evaluate('document.getElementById("brandVersion").textContent'), '', 'Recovery mode must not initialize the normal workspace');
  await driver.screenshot(join(evidence, 'corrupt-project-offer.png'));
  await driver.click('#desktopRecoveryPanel .desktop-recovery-row button');
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  const boot = await driver.evaluate('window.sirenDesktopBootstrap');
  assert.notEqual(boot.snapshot.project.id, original.project.id);
  assert.equal(await driver.evaluate('document.getElementById("source").value'), JSON.parse(json).source);
  assert.equal(await readFile(damaged, 'utf8'), '{ORIGINAL DAMAGED BY TEST');
  assert.equal((await projects.readProject(boot.snapshot.project.id)).json, json);
  const savedPoint = await recovery.readPoint(point.id); assert.equal(savedPoint.snapshot.json, json);
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Actual recovery-mode suppression and pointer restore into a new verified project; source and damaged-original byte oracles', oldProjectId: original.project.id, recoveredProjectId: boot.snapshot.project.id, pointId: point.id }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));
} catch (error) {
  if (driver) { await driver.screenshot(join(evidence, 'failed-ui.png')); await writeFile(join(evidence, 'failed-ui.json'), JSON.stringify(await driver.evaluate('({url:location.href,boot:window.sirenDesktopBootstrap,dialog:document.getElementById("desktopRecoveryPanel")?.textContent,version:document.getElementById("brandVersion")?.textContent})'), null, 2)); }
  throw error;
} finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
