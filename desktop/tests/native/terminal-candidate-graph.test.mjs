// Implementer tests. Fixtures are inert bytes and are deliberately retained.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, truncate, rename, link } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
let api = {};
try { api = await import('./terminal-candidate-graph.mjs'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const { captureTerminalCandidateGraph, recheckTerminalCandidateGraph } = api;
const behaviorTest = (name, fn) => test(name, { skip: !captureTerminalCandidateGraph }, fn);
test('collector exposes the capture and strict recheck boundary', () => {
  assert.equal(typeof captureTerminalCandidateGraph, 'function', 'capture collector is not implemented');
  assert.equal(typeof recheckTerminalCandidateGraph, 'function', 'recheck collector is not implemented');
});

const evidence = fileURLToPath(new URL('../../evidence/workspace-surface/terminal-candidate-graph-fixtures/', import.meta.url));
const versions = { '@xterm/addon-fit': '0.11.0', '@xterm/addon-search': '0.16.0', '@xterm/xterm': '6.0.0', 'node-addon-api': '7.1.1', 'node-pty': '1.1.0' };
const dependencies = { '@xterm/xterm': '6.0.0', '@xterm/addon-fit': '0.11.0', '@xterm/addon-search': '0.16.0', 'node-pty': '1.1.0' };
const closure = ['prebuilds/win32-x64/conpty.node', 'prebuilds/win32-x64/conpty_console_list.node', 'lib/index.js', 'lib/windowsTerminal.js', 'lib/terminal.js', 'lib/eventEmitter2.js', 'lib/utils.js', 'lib/windowsPtyAgent.js', 'lib/windowsConoutConnection.js', 'lib/shared/conout.js', 'lib/worker/conoutSocketWorker.js', 'lib/conpty_console_list_agent.js'];
const notice = 'Copyright © țară 日本語\r\nPermission is hereby granted\r\n';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function put(root, relative, bytes) { const target = path.join(root, relative); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); return target; }
async function sized(root, relative, bytes) { const target = await put(root, relative, ''); await truncate(target, bytes); return target; }
async function fixture({ omit = [] } = {}) {
  await mkdir(evidence, { recursive: true });
  const root = await mkdtemp(path.join(evidence, 'case-'));
  const manifest = { name: 'siren-terminal-isolated-candidate', private: true, type: 'module', dependencies };
  const lock = { name: manifest.name, lockfileVersion: 3, requires: true, packages: { '': { name: manifest.name, dependencies } } };
  for (const [name, version] of Object.entries(versions)) {
    const entry = { version, resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`, integrity: `sha512-${Buffer.alloc(64, 17).toString('base64')}`, license: 'MIT' };
    const pkg = { name, version, license: 'MIT', scripts: { install: 'throw new Error("MUST NOT EXECUTE")' } };
    if (name === 'node-pty') { entry.hasInstallScript = true; entry.dependencies = { 'node-addon-api': '^7.1.0' }; pkg.dependencies = entry.dependencies; pkg.main = './lib/index.js'; }
    lock.packages[`node_modules/${name}`] = entry;
    await put(root, `node_modules/${name}/package.json`, JSON.stringify(pkg));
    const license = `node_modules/${name}/${name === 'node-addon-api' ? 'LICENSE.md' : 'LICENSE'}`;
    if (!omit.includes(license)) await put(root, license, notice);
  }
  await put(root, 'package.json', JSON.stringify(manifest));
  await put(root, 'package-lock.json', JSON.stringify(lock));
  if (!omit.includes('node_modules/node-pty/deps/winpty/LICENSE')) await put(root, 'node_modules/node-pty/deps/winpty/LICENSE', notice);
  for (const file of closure) if (!omit.includes(`node_modules/node-pty/${file}`)) await put(root, `node_modules/node-pty/${file}`, file.endsWith('.node') ? Buffer.from([0x4d, 0x5a, 0, 0x80, 0xff]) : `throw new Error('MUST NOT EXECUTE: ${file}');\n`);
  await put(root, 'node_modules/node-pty/prebuilds/win32-x64/winpty-agent.exe', Buffer.from([0x4d, 0x5a, 0xff]));
  await put(root, 'node_modules/node-addon-api/napi.h', '// inert header\n');
  return { root, packagePath: path.join(root, 'package.json') };
}

// A dropped hash, notice, helper or unselected classification breaks this test.
behaviorTest('captures exact installed bytes, notices, fixed closure and unknown provenance without executing candidates', async () => {
  const f = await fixture();
  const result = await captureTerminalCandidateGraph(f);
  await writeFile(path.join(f.root, 'capture-receipt.json'), JSON.stringify(result, null, 2) + '\n');
  assert.equal(result.schema, 'siren-terminal-candidate-graph/v1');
  assert.equal(result.admitted, false);
  assert.equal(result.packages.length, 5);
  assert.equal(result.summary.installedFiles, 25);
  assert.equal(result.selectedRuntime.length, 12);
  assert.equal(result.selectedNative.length, 2);
  const binary = result.selectedNative.find(file => file.relativePath.endsWith('/conpty.node'));
  assert.equal(binary.sha256, sha(Buffer.from([0x4d, 0x5a, 0, 0x80, 0xff])));
  assert.equal(binary.bytes, 5);
  assert.equal(Object.hasOwn(binary, 'text'), false);
  assert.equal(result.unselectedBinaries.length, 1);
  assert.equal(result.unselectedBinaries[0].relativePath, 'node_modules/node-pty/prebuilds/win32-x64/winpty-agent.exe');
  assert.equal(result.notices.length, 6);
  for (const item of result.notices) { assert.equal(item.text, notice); assert.equal(item.sha256, sha(Buffer.from(notice))); assert.equal(item.bytes, Buffer.byteLength(notice)); }
  assert.equal(result.rootManifest.sha256, sha(await readFile(f.packagePath)));
  assert.equal(result.lock.sha256, sha(await readFile(path.join(f.root, 'package-lock.json'))));
  assert.ok(result.buildSurface.some(file => file.relativePath === 'node_modules/node-addon-api/napi.h'));
  assert.equal(result.buildProvenance.status, 'unknown');
  assert.equal(result.boundaries.nativeExecution, false);
  assert.match(result.boundaries.filesystemGuarantee, /race/i);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.deepEqual(await recheckTerminalCandidateGraph({ ...f, receipt: JSON.parse(JSON.stringify(result)) }), { schema: result.schema, unchanged: true, admitted: false, installedFiles: 25 });
});

behaviorTest('requires every selected runtime artifact and primary notice', async () => {
  for (const item of [...closure.map(file => `node_modules/node-pty/${file}`), 'node_modules/@xterm/addon-fit/LICENSE', 'node_modules/@xterm/addon-search/LICENSE', 'node_modules/@xterm/xterm/LICENSE', 'node_modules/node-addon-api/LICENSE.md', 'node_modules/node-pty/LICENSE', 'node_modules/node-pty/deps/winpty/LICENSE']) {
    const missing = await fixture({ omit: [item] });
    await assert.rejects(captureTerminalCandidateGraph(missing), /missing|ENOENT/i);
  }
  const f = await fixture(); const r = await captureTerminalCandidateGraph(f);
  const target = path.join(f.root, 'node_modules/node-pty/lib/utils.js');
  await truncate(target, 0);
  await assert.rejects(recheckTerminalCandidateGraph({ ...f, receipt: r }), /changed|mismatch|missing/i);
  const directory = await fixture({ omit: ['node_modules/node-pty/lib/utils.js'] });
  await mkdir(path.join(directory.root, 'node_modules/node-pty/lib/utils.js'));
  await assert.rejects(captureTerminalCandidateGraph(directory), /missing/i);
});

behaviorTest('recheck refuses changed selected native bytes and exact manifest or lock changes', async () => {
  for (const target of ['node_modules/node-pty/prebuilds/win32-x64/conpty.node', 'package.json', 'package-lock.json']) {
    const f = await fixture(); const receipt = await captureTerminalCandidateGraph(f);
    await put(f.root, target, Buffer.concat([await readFile(path.join(f.root, target)), Buffer.from(' ')]));
    await assert.rejects(recheckTerminalCandidateGraph({ ...f, receipt }), /changed|mismatch/i);
  }
});

behaviorTest('recheck refuses added installed files and even empty extra directories', async () => {
  for (const kind of ['file', 'directory']) {
    const f = await fixture(); const receipt = await captureTerminalCandidateGraph(f);
    if (kind === 'file') await put(f.root, 'node_modules/node-pty/unexpected.bin', 'unexpected');
    else await mkdir(path.join(f.root, 'node_modules/node-pty/unexpected-empty'));
    await assert.rejects(recheckTerminalCandidateGraph({ ...f, receipt }), /changed|mismatch/i);
  }
});

behaviorTest('refuses alternate source-resolved native load locations instead of treating them as harmless unselected bytes', async () => {
  for (const directory of ['build/Release', 'build/Debug', 'lib/build/Release', 'lib/build/Debug', 'lib/prebuilds/win32-x64', 'BuIlD/ReLeAsE']) {
    for (const name of ['conpty.node', 'conpty_console_list.node']) {
      const f = await fixture();
      await put(f.root, `node_modules/node-pty/${directory}/${name}`, Buffer.from('shadow-native'));
      await assert.rejects(captureTerminalCandidateGraph(f), /shadow|alternate.*native/i);
    }
  }
});

behaviorTest('classifies installed debug symbols and opaque binary data as unselected', async () => {
  const f = await fixture();
  await put(f.root, 'node_modules/node-pty/prebuilds/win32-x64/conpty.pdb', Buffer.from([0xff, 0, 0x80]));
  await put(f.root, 'node_modules/node-pty/unknown.bin', Buffer.from([0xfe, 0, 0x81]));
  const r = await captureTerminalCandidateGraph(f);
  assert.equal(r.unselectedBinaries.length, 3);
  assert.equal(r.unselectedBinaries.find(item => item.relativePath.endsWith('/conpty.pdb')).role, 'unselected-binary');
  assert.equal(r.unselectedBinaries.find(item => item.relativePath.endsWith('/unknown.bin')).role, 'unselected-binary');
});

behaviorTest('refuses missing files on recheck without converting refusal into boolean success', async () => {
  const f = await fixture(); const receipt = await captureTerminalCandidateGraph(f);
  // Move only an owned inert fixture file, preserving its bytes without deletion.
  await rename(path.join(f.root, 'node_modules/node-addon-api/napi.h'), path.join(f.root, 'retained-missing-napi.h'));
  await assert.rejects(recheckTerminalCandidateGraph({ ...f, receipt }), /changed|mismatch|receipt/i);
});

behaviorTest('refuses relative roots, root directory arguments, unknown versions and extra dependency roots', async () => {
  await assert.rejects(captureTerminalCandidateGraph({ packagePath: './package.json' }), /absolute/i);
  const f = await fixture(); await assert.rejects(captureTerminalCandidateGraph({ packagePath: f.root }), /package.json/i);
  const pkgPath = path.join(f.root, 'node_modules/node-pty/package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')); pkg.version = '1.1.1'; await writeFile(pkgPath, JSON.stringify(pkg));
  await assert.rejects(captureTerminalCandidateGraph(f), /version/i);
  const extra = await fixture(); await put(extra.root, 'node_modules/surprise/package.json', '{"name":"surprise","version":"1"}');
  await assert.rejects(captureTerminalCandidateGraph(extra), /unknown|unexpected/i);
});

behaviorTest('refuses file, directory and ancestor links without following them', async () => {
  const f = await fixture();
  const target = path.join(f.root, 'node_modules/node-pty/linked');
  await symlink(path.join(f.root, 'node_modules/@xterm/xterm'), target, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(captureTerminalCandidateGraph(f), /link|reparse/i);
  const outer = await mkdtemp(path.join(evidence, 'ancestor-'));
  await symlink(f.root, path.join(outer, 'linked-root'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(captureTerminalCandidateGraph({ packagePath: path.join(outer, 'linked-root/package.json') }), /link|reparse/i);
  // On Windows creating a true file symlink may require host privilege; a junction
  // at the required manifest path still proves regular-file refusal without privilege.
  const dir = await fixture(); await symlink(f.root, path.join(dir.root, 'node_modules/node-pty/file-link.js'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(captureTerminalCandidateGraph(dir), /link|reparse/i);
  const hard = await fixture();
  await link(path.join(hard.root, 'node_modules/node-addon-api/napi.h'), path.join(hard.root, 'node_modules/node-addon-api/alias.h'));
  await assert.rejects(captureTerminalCandidateGraph(hard), /link|nonregular/i);
});

behaviorTest('captures a representative 70 MiB graph under the finite 96 MiB aggregate cap', async () => {
  const f = await fixture();
  for (let i = 0; i < 5; i++) await sized(f.root, `node_modules/node-pty/representative-${i}.bin`, 14 * 1024 * 1024);
  const r = await captureTerminalCandidateGraph(f);
  assert.equal(r.limits.totalBytes, 96 * 1024 * 1024);
  assert.ok(r.summary.readBytes > 70 * 1024 * 1024);
  assert.equal(r.summary.installedFiles, 30);
});

behaviorTest('refuses files over 16 MiB, total reads over 96 MiB and more than 1024 files', async () => {
  const one = await fixture(); await sized(one.root, 'node_modules/node-pty/oversize.bin', 16 * 1024 * 1024 + 1);
  await assert.rejects(captureTerminalCandidateGraph(one), /budget|limit/i);
  const total = await fixture();
  for (let i = 0; i < 7; i++) await sized(total.root, `node_modules/node-pty/large-${i}.bin`, 14 * 1024 * 1024);
  await assert.rejects(captureTerminalCandidateGraph(total), /budget|limit/i);
  const many = await fixture(); for (let i = 0; i < 1025; i++) await put(many.root, `node_modules/node-pty/tiny-${i}`, '');
  await assert.rejects(captureTerminalCandidateGraph(many), /budget|limit/i);
});

behaviorTest('rejects malformed or tampered receipt scope and decoded notice text', async () => {
  const f = await fixture(); const r = await captureTerminalCandidateGraph(f);
  for (const mutate of [r => { r.admitted = true; }, r => { r.notices[0].text += 'changed'; }, r => { r.packages.pop(); }, r => { r.schema = 'unknown'; }, r => { r.selectedNative = []; }]) {
    const receipt = structuredClone(r); mutate(receipt);
    await assert.rejects(recheckTerminalCandidateGraph({ ...f, receipt }), /receipt|mismatch|changed/i);
  }
});
