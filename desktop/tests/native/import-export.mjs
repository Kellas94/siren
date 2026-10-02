import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ProjectStore } from '../../src/projects/store.mjs';
import { RecoveryStore } from '../../src/recovery/checkpoints.mjs';
import { parseLegacyImport } from '../../src/projects/migration.mjs';
import { launchDesktop, unlockDesktop } from './drive.mjs';

const evidence = resolve('evidence', `import-export-${new Date().toISOString().replaceAll(':', '-')}`); await mkdir(evidence, { recursive: true });
const downloads = join(evidence, 'downloads'); await mkdir(downloads);
const root = await mkdtemp(join(evidence, 'data-')); const projects = new ProjectStore(root);
const source = 'flowchart TD\n A[Real portable export] --> B[Validated import]';
const first = await projects.createProject({ label: 'Native import/export', json: JSON.stringify({ source }) });
await new RecoveryStore(root).checkpointProject({ snapshot: first, kind: 'saved' });
let driver;
try {
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`, `--siren-test-project=${first.project.id}`] });
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  await driver.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  await driver.click('#exportButton'); await driver.click('#exportWorkspaceFormats summary'); await driver.click('#exportProjectButton');
  const until = Date.now() + 15000; let name;
  while (Date.now() < until) { name = (await readdir(downloads)).find(n => n.endsWith('.siren')); if (name) break; await delay(100); }
  assert.ok(name, 'Actual .siren export button must deliver a complete file');
  const bytes = await readFile(join(downloads, name)); const exported = JSON.parse(bytes);
  assert.equal(exported.type, 't-industries-siren-project');
  const originalDiagram = exported.state.diagrams.find(d => d.id === exported.state.activeDiagramId); assert.equal(originalDiagram.source, source);
  const validated = await driver.evaluate(`window.sirenDesktopValidateImport(${JSON.stringify(bytes.toString('utf8'))},${JSON.stringify(name)})`);
  const bag = JSON.parse(parseLegacyImport(Buffer.from(validated))); const state = JSON.parse(bag.storage['t-industries-siren-v23-state']);
  assert.equal(state.diagrams.find(d => d.id === state.activeDiagramId).source, source); assert.equal(state.activeDiagramId, exported.state.activeDiagramId);
  const imported = await projects.createProject({ label: 'Validated actual exported file', json: JSON.stringify(bag) });
  assert.equal((await new ProjectStore(root).readProject(imported.project.id)).json, JSON.stringify(bag));
  const refused = await driver.evaluate(`window.sirenDesktopValidateImport('{"source":"flowchart TD A-->B"}','internal-cache.json').then(()=>false).catch(()=>true)`);
  assert.equal(refused, true, 'Internal cache cannot be passed off as a complete explicit project export');
  await driver.screenshot(join(evidence, 'export-dialog.png'));
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Actual renderer Project (.siren) pointer export, disk file, existing Mermaid import validator, identity/source preservation, native fresh-store readback. Native OS file chooser interaction not qualified.', projectId: first.project.id, importedProjectId: imported.project.id, exportBytes: bytes.length }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));
} finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
