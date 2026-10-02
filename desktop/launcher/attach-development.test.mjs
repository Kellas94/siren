import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { mkdtemp } from '../tests/fixtures/temporary.mjs';
import { attachDevelopmentLauncher } from './attach-development.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const source = '1'.repeat(40); const launcherSource = '2'.repeat(40);
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'launcher-attachment-'));
  const previewRoot = join(root, 'Preview'); await mkdir(join(previewRoot, 'App/versions/0.1.0/resources'), { recursive: true });
  const app = join(previewRoot, 'App/versions/0.1.0');
  const runtime = Buffer.from('known runtime'); const archive = Buffer.from('known renderer'); const launcher = Buffer.from('MZowned launcher');
  await writeFile(join(app, 'SIREN.exe'), runtime); await writeFile(join(app, 'resources/app.asar'), archive);
  await writeFile(join(app, 'license.txt'), 'runtime notice');
  await mkdir(join(previewRoot, 'Data')); await writeFile(join(previewRoot, 'Data/private.txt'), 'private project');
  await writeFile(join(previewRoot, 'BUILD-IDENTITY.json'), JSON.stringify({ schema: 1, kind: 'development-preview', releaseAdmitted: false, sourceCommit: source, appRelativePath: 'App/versions/0.1.0/SIREN.exe', appArchive: { bytes: archive.length, sha256: sha256(archive) }, runtimeBinary: { bytes: runtime.length, sha256: sha256(runtime) }, launcherQualified: false }));
  const artifactPath = join(root, 'built-launcher.exe'); const artifactReceiptPath = join(root, 'launcher-receipt.json');
  await writeFile(artifactPath, launcher);
  await writeFile(artifactReceiptPath, JSON.stringify({ schema: 1, kind: 'development-preview', releaseAdmitted: false, launcherSourceCommit: launcherSource, target: 'x86_64-pc-windows-msvc', rustVersion: '1.99.0', features: ['development-preview'], binary: { bytes: launcher.length, sha256: sha256(launcher) } }));
  return { root, previewRoot, app, artifactPath, artifactReceiptPath, expectedLauncherSourceCommit: launcherSource };
}

test('attaches exact native binary and complete typed version selection without touching project data', async () => {
  const input = await fixture(); const result = await attachDevelopmentLauncher(input);
  assert.equal(result.launcherPath, join(input.previewRoot, 'SIREN.exe'));
  assert.deepEqual(await readFile(result.launcherPath), await readFile(input.artifactPath));
  const pointer = JSON.parse(await readFile(join(input.previewRoot, 'App/current.json')));
  assert.equal(pointer.schema, 1); assert.equal(pointer.kind, 'development-preview'); assert.equal(pointer.releaseAdmitted, false);
  assert.equal(pointer.version, '0.1.0'); assert.equal(pointer.sourceCommit, source);
  assert.deepEqual(pointer.files.map(file => file.path).sort(), ['SIREN.exe','license.txt','resources/app.asar']);
  assert.equal(pointer.files.find(file => file.path === 'SIREN.exe').sha256, sha256(Buffer.from('known runtime')));
  const identity = JSON.parse(await readFile(join(input.previewRoot, 'BUILD-IDENTITY.json')));
  assert.equal(identity.launcherQualified, false); assert.equal(identity.releaseAdmitted, false);
  assert.equal(identity.launcher.launcherSourceCommit, launcherSource);
  assert.equal(await readFile(join(input.previewRoot, 'Data/private.txt'), 'utf8'), 'private project');
});

test('refuses artifact hash or committed source mismatch before creating a runnable launcher', async () => {
  for (const corrupt of ['binary', 'source']) {
    const input = await fixture();
    if (corrupt === 'binary') await writeFile(input.artifactPath, 'MZchanged launcher'); else input.expectedLauncherSourceCommit = '3'.repeat(40);
    await assert.rejects(attachDevelopmentLauncher(input));
    await assert.rejects(stat(join(input.previewRoot, 'SIREN.exe')), { code: 'ENOENT' });
    await assert.rejects(stat(join(input.previewRoot, 'App/current.json')), { code: 'ENOENT' });
  }
});

test('refuses altered payload and refuses replacing an already attached launcher', async () => {
  const damaged = await fixture(); await writeFile(join(damaged.app, 'resources/app.asar'), 'edited renderer');
  await assert.rejects(attachDevelopmentLauncher(damaged));
  await assert.rejects(stat(join(damaged.previewRoot, 'SIREN.exe')), { code: 'ENOENT' });
  const existing = await fixture(); await writeFile(join(existing.previewRoot, 'SIREN.exe'), 'original launcher');
  await assert.rejects(attachDevelopmentLauncher(existing));
  assert.equal(await readFile(join(existing.previewRoot, 'SIREN.exe'), 'utf8'), 'original launcher');
});

test('refuses release claims and executable path injection in a development attachment', async () => {
  for (const mutation of ['release', 'path']) {
    const input = await fixture(); const path = join(input.previewRoot, 'BUILD-IDENTITY.json'); const identity = JSON.parse(await readFile(path));
    if (mutation === 'release') identity.releaseAdmitted = true; else identity.appRelativePath = 'Data/SIREN.exe';
    await writeFile(path, JSON.stringify(identity)); await assert.rejects(attachDevelopmentLauncher(input));
    await assert.rejects(stat(join(input.previewRoot, 'SIREN.exe')), { code: 'ENOENT' });
  }
});
