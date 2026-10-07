import assert from 'node:assert/strict';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { ownedDirectory, ownedFile } from '../src/projects/paths.mjs';
import { readOwnedBytes } from '../src/projects/io.mjs';
import { parseStrictJson, validPackagePath, versionParts } from '../src/updates/manifest.mjs';
import { hashOwnedFile } from '../src/updates/download.mjs';

const run = promisify(execFile);
const nativePowerShell = process.env.SIREN_PROBE_POWERSHELL || 'powershell.exe';
assert.equal(process.platform, 'win32', 'This probe requires actual Windows');
assert.ok(process.argv[2], 'Supply an attached development preview root');
const original = await ownedDirectory(resolve(process.argv[2]));
const identityBytes = await readOwnedBytes(join(original, 'BUILD-IDENTITY.json'), 1048576);
const identity = parseStrictJson(identityBytes);
assert.equal(identity.kind, 'development-preview'); assert.equal(identity.releaseAdmitted, false); assert.equal(identity.launcherQualified, false);
assert.ok(identity.launcher?.binary && identity.launcher.launcherSourceCommit);
assert.match(identity.renderer?.rendererSha256 || '', /^[a-f0-9]{64}$/, 'Bind the actual nested renderer build identity');
const selectionBytes = await readOwnedBytes(join(original, 'App/current.json'), 1048576);
const selection = parseStrictJson(selectionBytes); versionParts(selection.version);
assert.equal(selection.kind, 'development-preview'); assert.equal(selection.releaseAdmitted, false);
assert.equal(selection.sourceCommit, identity.sourceCommit);
assert.equal(identity.appRelativePath, `App/versions/${selection.version}/SIREN.exe`);
const evidence = resolve(dirname(fileURLToPath(import.meta.url)), '../evidence', `launcher-native-${randomUUID()}`);
await mkdir(evidence, { recursive: true });
const root = join(evidence, 'SIREN-Știință-owned'); await mkdir(root);
const app = join(root, 'App/versions', selection.version); await mkdir(app, { recursive: true });
const originalApp = await ownedDirectory(join(original, 'App/versions', selection.version));
const before = await hashOwnedFile(join(original, 'SIREN.exe'), 2097152);
assert.deepEqual(before, identity.launcher.binary);
for (const file of selection.files) {
  assert.ok(validPackagePath(file.path));
  const target = join(app, file.path); await mkdir(dirname(target), { recursive: true });
  await copyFile(await ownedFile(join(originalApp, file.path)), target);
  assert.deepEqual(await hashOwnedFile(target, file.bytes + 1), { bytes: file.bytes, sha256: file.sha256 });
}
await copyFile(await ownedFile(join(original, 'SIREN.exe')), join(root, 'SIREN.exe'));
await writeFile(join(root, 'App/current.json'), selectionBytes);
await writeFile(join(root, 'BUILD-IDENTITY.json'), identityBytes);
const resultPath = join(evidence, 'result.json'); const descriptor = join(evidence, 'probe-input.json');
await writeFile(descriptor, JSON.stringify({ root, appPath: join(app, 'SIREN.exe'), resultPath }));
let failure;
try {
  const result = await run(nativePowerShell, ['-NoProfile', '-NonInteractive', '-File', join(dirname(fileURLToPath(import.meta.url)), 'probe-packaged.ps1'), '-DescriptorPath', descriptor], { windowsHide: true, timeout: 100000, maxBuffer: 65536 });
  await writeFile(join(evidence, 'native-stdout.log'), result.stdout);
  await writeFile(join(evidence, 'native-stderr.log'), result.stderr);
} catch (error) {
  failure = error;
  await writeFile(join(evidence, 'native-error.log'), String(error.stack || error).slice(0, 32768) + '\n' + String(error.stdout || '').slice(0, 16384) + '\n' + String(error.stderr || '').slice(0, 16384));
}
assert.deepEqual(await readOwnedBytes(join(original, 'BUILD-IDENTITY.json'), 1048576), identityBytes);
assert.deepEqual(await readOwnedBytes(join(original, 'App/current.json'), 1048576), selectionBytes);
assert.deepEqual(await hashOwnedFile(join(original, 'SIREN.exe'), 2097152), before);
assert.deepEqual(await hashOwnedFile(join(originalApp, 'resources/app.asar'), identity.appArchive.bytes + 1), identity.appArchive);
let result;
try { result = JSON.parse(await readFile(resultPath, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT' || !failure) throw error;
  result = { completed: false, scope: 'Helper invocation failed before a native result could be recorded. No launcher success or policy change claimed.', error: String(failure.message).slice(0, 4096) };
}
await writeFile(resultPath, JSON.stringify({ ...result, nativePowerShell, originalUnchanged: true, sourceCommit: identity.sourceCommit, launcherSourceCommit: identity.launcher.launcherSourceCommit, launcherBinary: before, archive: identity.appArchive, rendererSha256: identity.renderer.rendererSha256, evidence }, null, 2));
if (failure) throw failure;
assert.equal(result.completed, true, 'Native probe did not complete: inspect retained evidence');
console.log(JSON.stringify({ completed: true, evidence, sourceCommit: identity.sourceCommit, launcherSourceCommit: identity.launcher.launcherSourceCommit, scope: result.scope }));
