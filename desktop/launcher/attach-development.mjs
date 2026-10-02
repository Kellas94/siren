import { lstat, readdir, open, link, unlink } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ownedDirectory, ownedFile } from '../src/projects/paths.mjs';
import { atomicWrite, exclusiveWriter } from '../src/projects/atomic.mjs';
import { readOwnedBytes } from '../src/projects/io.mjs';
import { parseStrictJson, validPackagePath, versionParts, MAX_PACKAGE_BYTES } from '../src/updates/manifest.mjs';
import { hashOwnedFile } from '../src/updates/download.mjs';

const exactFields = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === fields.split(',').sort().join(',');
const committed = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const validDigest = value => exactFields(value, 'bytes,sha256') && Number.isSafeInteger(value.bytes) && value.bytes > 0 && value.bytes <= MAX_PACKAGE_BYTES && /^[a-f0-9]{64}$/.test(value.sha256);
async function absent(path) {
  try { await lstat(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error('Development launcher attachment never replaces an existing selection or launcher');
}
async function filesIn(directory, prefix = '') {
  await ownedDirectory(directory); const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!validPackagePath(relative) || entry.isSymbolicLink()) throw new Error('Unsafe application asset');
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await filesIn(path, relative));
    else if (entry.isFile() && (await lstat(await ownedFile(path))).nlink === 1) paths.push(relative);
    else throw new Error('Unowned application asset');
    if (paths.length > 50000) throw new Error('Application file count refused');
  }
  return paths;
}

// Development-only bootstrap. This does not authenticate a publisher, apply an
// update, bypass activation, or admit a release. The compiled preview feature is
// explicit in the artifact receipt and must never be enabled in a release build.
export async function attachDevelopmentLauncher({ previewRoot, artifactPath, artifactReceiptPath, expectedLauncherSourceCommit }) {
  previewRoot = await ownedDirectory(resolve(previewRoot));
  if (!committed(expectedLauncherSourceCommit)) throw new Error('Exact committed launcher source required');
  const identityPath = join(previewRoot, 'BUILD-IDENTITY.json');
  const identityBytes = await readOwnedBytes(identityPath, 1048576);
  const identity = parseStrictJson(identityBytes);
  if (identity.schema !== 1 || identity.kind !== 'development-preview' || identity.releaseAdmitted !== false || !committed(identity.sourceCommit) || identity.launcherQualified !== false) throw new Error('Only an unqualified development preview may be attached');
  const match = typeof identity.appRelativePath === 'string' && identity.appRelativePath.match(/^App\/versions\/([0-9]+\.[0-9]+\.[0-9]+)\/SIREN\.exe$/);
  if (!match) throw new Error('Fixed version executable required');
  const version = match[1]; versionParts(version);
  const appRoot = await ownedDirectory(join(previewRoot, 'App/versions', version));
  const launcherPath = join(previewRoot, 'SIREN.exe'); const pointerPath = join(previewRoot, 'App/current.json');
  await absent(launcherPath); await absent(pointerPath);
  const artifact = parseStrictJson(await readOwnedBytes(artifactReceiptPath, 65536));
  if (!exactFields(artifact, 'schema,kind,releaseAdmitted,launcherSourceCommit,target,rustVersion,features,binary') || artifact.schema !== 1 || artifact.kind !== 'development-preview' || artifact.releaseAdmitted !== false || artifact.launcherSourceCommit !== expectedLauncherSourceCommit || artifact.target !== 'x86_64-pc-windows-msvc' || artifact.rustVersion !== '1.99.0' || JSON.stringify(artifact.features) !== '["development-preview"]' || !validDigest(artifact.binary) || artifact.binary.bytes > 2097152) throw new Error('Native development artifact identity refused');
  const launcherBytes = await readOwnedBytes(artifactPath, 2097152);
  if (launcherBytes.length !== artifact.binary.bytes || createHash('sha256').update(launcherBytes).digest('hex') !== artifact.binary.sha256) throw new Error('Native development artifact hash refused');
  if (launcherBytes.subarray(0, 2).toString() !== 'MZ') throw new Error('Windows native launcher required');
  const entries = await filesIn(appRoot); const files = []; const names = new Set(); let total = 0;
  for (const path of entries.sort()) {
    const alias = path.toLowerCase(); if (names.has(alias)) throw new Error('Case-colliding assets refused'); names.add(alias);
    const digest = await hashOwnedFile(join(appRoot, path), MAX_PACKAGE_BYTES); total += digest.bytes;
    if (total > MAX_PACKAGE_BYTES) throw new Error('Application extracted byte limit exceeded');
    files.push({ path, ...digest });
  }
  for (const [path, expected] of [['SIREN.exe', identity.runtimeBinary], ['resources/app.asar', identity.appArchive]]) {
    const actual = files.find(file => file.path === path);
    if (!validDigest(expected) || !actual || actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) throw new Error('Development package payload changed');
  }
  const pointerBytes = Buffer.from(JSON.stringify({ schema: 1, kind: 'development-preview', releaseAdmitted: false, version, sourceCommit: identity.sourceCommit, files }));
  const attachedIdentityBytes = Buffer.from(JSON.stringify({ ...identity, launcher: artifact }, null, 2));
  if (pointerBytes.length > 1048576 || attachedIdentityBytes.length > 1048576) throw new Error('Selection metadata exceeds consumer size limit');
  await exclusiveWriter(previewRoot, async () => {
    await absent(launcherPath); await absent(pointerPath);
    if (!(await readOwnedBytes(identityPath, 1048576)).equals(identityBytes)) throw new Error('Development package identity changed during attachment');
    const stagePath = join(previewRoot, `launcher-${randomUUID()}.pending`); let published = false;
    try {
      // A new writable file does not inherit the downloaded artifact's READONLY
      // attribute. Flush/readback before publishing any launchable entry point.
      const stage = await open(stagePath, 'wx', 0o600);
      try { await stage.writeFile(launcherBytes); await stage.sync(); } finally { await stage.close(); }
      const staged = await hashOwnedFile(stagePath, artifact.binary.bytes);
      if (staged.bytes !== artifact.binary.bytes || staged.sha256 !== artifact.binary.sha256) throw new Error('Native launcher stage failed readback');
      await atomicWrite(pointerPath, pointerBytes, { selection: true });
      await atomicWrite(identityPath, attachedIdentityBytes);
      // link() is an atomic, exclusive publication: it refuses an existing
      // destination. Remove only this transaction's named staging link below.
      await link(await ownedFile(stagePath), launcherPath); published = true;
    } catch (error) {
      const cleanupErrors = [];
      if (!published) {
        try { if ((await readOwnedBytes(pointerPath, 1048576)).equals(pointerBytes)) await unlink(await ownedFile(pointerPath)); } catch (cleanup) { if (cleanup.code !== 'ENOENT') cleanupErrors.push(cleanup); }
        try {
          const currentIdentity = await readOwnedBytes(identityPath, 1048576);
          if (currentIdentity.equals(attachedIdentityBytes)) await atomicWrite(identityPath, identityBytes);
          else if (!currentIdentity.equals(identityBytes)) cleanupErrors.push(new Error('Changed identity preserved for manual recovery'));
        } catch (cleanup) { cleanupErrors.push(cleanup); }
      }
      if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], 'Development attachment failed; incomplete owned metadata retained for inspection');
      throw error;
    } finally {
      try { await unlink(await ownedFile(stagePath)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  });
  return { launcherPath, selectionPath: pointerPath, version, launcherQualified: false, releaseAdmitted: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [previewRoot, artifactPath, artifactReceiptPath, expectedLauncherSourceCommit] = process.argv.slice(2);
  console.log(JSON.stringify(await attachDevelopmentLauncher({ previewRoot, artifactPath, artifactReceiptPath, expectedLauncherSourceCommit })));
}
