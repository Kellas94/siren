import { mkdir, mkdtemp, writeFile, readFile, chmod, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { attachDevelopmentLauncher } from '../launcher/attach-development.mjs';

// Independent real-filesystem probe. No launcher/product module is modified.
const base = resolve('desktop/reviews');
const root = await mkdtemp(join(base, 'native-attachment-probe-'));
const previewRoot = join(root, 'Preview');
const artifactPath = join(root, 'built-launcher.exe');
const artifactReceiptPath = join(root, 'launcher-receipt.json');
const expectedLauncherSourceCommit = '2'.repeat(40);
const digest = data => ({ bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
const runtime = Buffer.from('known runtime');
const archive = Buffer.from('known renderer');
const launcher = Buffer.from('MZowned launcher');
const largeMetadata = process.argv.includes('--large-metadata');
try {
  await mkdir(join(previewRoot, 'App/versions/0.1.0/resources'), { recursive: true });
  await mkdir(join(previewRoot, 'Data'));
  await writeFile(join(previewRoot, 'Data/private.txt'), 'private original');
  await writeFile(join(previewRoot, 'App/versions/0.1.0/SIREN.exe'), runtime);
  await writeFile(join(previewRoot, 'App/versions/0.1.0/resources/app.asar'), archive);
  if (largeMetadata) {
    for (let index = 0; index < 4200; index++) {
      await writeFile(join(previewRoot, 'App/versions/0.1.0', `${String(index).padStart(4, '0')}-${'x'.repeat(195)}`), '');
    }
  }
  await writeFile(join(previewRoot, 'BUILD-IDENTITY.json'), JSON.stringify({ schema: 1, kind: 'development-preview', releaseAdmitted: false, sourceCommit: '1'.repeat(40), appRelativePath: 'App/versions/0.1.0/SIREN.exe', appArchive: digest(archive), runtimeBinary: digest(runtime), launcherQualified: false }));
  await writeFile(artifactPath, launcher);
  await writeFile(artifactReceiptPath, JSON.stringify({ schema: 1, kind: 'development-preview', releaseAdmitted: false, launcherSourceCommit: expectedLauncherSourceCommit, target: 'x86_64-pc-windows-msvc', rustVersion: '1.99.0', features: ['development-preview'], binary: digest(launcher) }));
  // Windows copyFile preserves the source's READONLY attribute, causing the
  // subsequent destination r+ durability open to fail after selection publication.
  if (!largeMetadata) await chmod(artifactPath, 0o444);
  const input = { previewRoot, artifactPath, artifactReceiptPath, expectedLauncherSourceCommit };
  let firstError;
  try { await attachDevelopmentLauncher(input); } catch (error) { firstError = `${error.code}: ${error.message}`; }
  let retryError;
  try { await attachDevelopmentLauncher(input); } catch (error) { retryError = error.message; }
  const selection = await stat(join(previewRoot, 'App/current.json')).catch(() => null);
  console.log(JSON.stringify({ mode: largeMetadata ? 'large-metadata' : 'readonly-artifact', firstError, retryError, selectionPresent: !!selection, selectionBytes: selection?.size, nativeMetadataLimit: 1048576, launcherPresent: !!await stat(join(previewRoot, 'SIREN.exe')).catch(() => null), identityHasReceipt: Object.hasOwn(JSON.parse(await readFile(join(previewRoot, 'BUILD-IDENTITY.json'))), 'launcher'), dataUnchanged: (await readFile(join(previewRoot, 'Data/private.txt'), 'utf8')) === 'private original' }, null, 2));
} finally {
  await chmod(artifactPath, 0o666).catch(() => {});
  await chmod(join(previewRoot, 'SIREN.exe'), 0o666).catch(() => {});
  if (!root.startsWith(`${base}\\`)) throw new Error('Probe cleanup escaped review workspace');
  await rm(root, { recursive: true, force: true });
}
