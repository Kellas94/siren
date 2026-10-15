// Source-only implementer tests. No dependency code or native binaries execute.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rename, truncate, symlink, link } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
let api = {};
try { api = await import('./terminal-production-provider-graph.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }

const manifest = () => ({ name: 'siren-terminal-provider', version: '0.1.0-dev.1', private: true, description: 'Pinned private production Terminal provider resource; candidate qualification required', dependencies: { 'node-pty': '1.1.0' } });
const lock = () => ({
  name: 'siren-terminal-provider', version: '0.1.0-dev.1', lockfileVersion: 3, requires: true,
  packages: {
    '': { name: 'siren-terminal-provider', version: '0.1.0-dev.1', dependencies: { 'node-pty': '1.1.0' } },
    'node_modules/node-addon-api': { version: '7.1.1', resolved: 'https://registry.npmjs.org/node-addon-api/-/node-addon-api-7.1.1.tgz', integrity: 'sha512-5m3bsyrjFWE1xf7nz7YXdN4udnVtXK6/Yfgn5qnahL6bCkf2yKt4k3nuTKAtT4r3IG8JNR2ncsIMdZuAzJjHQQ==', license: 'MIT' },
    'node_modules/node-pty': { version: '1.1.0', resolved: 'https://registry.npmjs.org/node-pty/-/node-pty-1.1.0.tgz', integrity: 'sha512-20JqtutY6JPXTUnL0ij1uad7Qe1baT46lyolh2sSENDd4sTzKZ4nmAFkeAARDKwmlLjPx6XKRlwRUxwjOy+lUg==', hasInstallScript: true, license: 'MIT', dependencies: { 'node-addon-api': '^7.1.0' } }
  }
});

test('source metadata validator exposes a two-package production contract', () => {
  assert.equal(typeof api.validateTerminalProductionProviderLock, 'function', 'production metadata validator is missing');
  assert.deepEqual(api.validateTerminalProductionProviderLock({ manifest: manifest(), lock: lock() }), {
    schema: 'siren-terminal-production-provider-lock/v1', admitted: false, packageNames: ['node-addon-api', 'node-pty']
  });
});

// Each mutation below was independently chosen to break a different authority
// agreement. In particular a well-formed but different SRI must never be accepted.
for (const [name, change] of [
  ['root version', (m) => { m.version = '0.1.0'; }],
  ['root private flag', (m) => { m.private = false; }],
  ['root unknown field', (m) => { m.scripts = { install: 'anything' }; }],
  ['xterm top dependency', (m) => { m.dependencies['@xterm/xterm'] = '6.0.0'; }],
  ['root lock version agreement', (_, l) => { l.version = '0.2.0'; }],
  ['root lock dependency agreement', (_, l) => { l.packages[''].dependencies['node-pty'] = '^1.1.0'; }],
  ['root lock unknown field', (_, l) => { l.packages[''].private = true; }],
  ['lock unexpected top record', (_, l) => { l.dependencies = {}; }],
  ['lock missing package', (_, l) => { delete l.packages['node_modules/node-addon-api']; }],
  ['lock unknown package', (_, l) => { l.packages['node_modules/unknown'] = {}; }],
  ['lock package null', (_, l) => { l.packages['node_modules/node-pty'] = null; }],
  ['lock package version', (_, l) => { l.packages['node_modules/node-pty'].version = '1.1.1'; }],
  ['lock resolved tarball', (_, l) => { l.packages['node_modules/node-pty'].resolved = 'https://example.invalid/a.tgz'; }],
  ['well-formed different integrity', (_, l) => { l.packages['node_modules/node-pty'].integrity = `sha512-${Buffer.alloc(64, 17).toString('base64')}`; }],
  ['lock install-script flag', (_, l) => { l.packages['node_modules/node-pty'].hasInstallScript = false; }],
  ['lock optional dependency', (_, l) => { l.packages['node_modules/node-pty'].optionalDependencies = { evil: '1' }; }],
  ['lock linked package', (_, l) => { l.packages['node_modules/node-addon-api'].link = true; }],
  ['lock transitive range', (_, l) => { l.packages['node_modules/node-pty'].dependencies['node-addon-api'] = '^8'; }],
  ['lock record unknown field', (_, l) => { l.packages['node_modules/node-addon-api'].dev = true; }]
]) test(`metadata refuses ${name}`, () => {
  const m = manifest(), l = lock(); change(m, l);
  assert.throws(() => api.validateTerminalProductionProviderLock({ manifest: m, lock: l }), /TERMINAL_PRODUCTION_PROVIDER_GRAPH_REFUSED/);
});

const evidence = fileURLToPath(new URL('../../evidence/terminal-production-provider-qualification/fixtures/', import.meta.url));
const runtime = ['prebuilds/win32-x64/conpty.node', 'prebuilds/win32-x64/conpty_console_list.node', 'lib/index.js', 'lib/windowsTerminal.js', 'lib/terminal.js', 'lib/eventEmitter2.js', 'lib/utils.js', 'lib/windowsPtyAgent.js', 'lib/windowsConoutConnection.js', 'lib/shared/conout.js', 'lib/worker/conoutSocketWorker.js', 'lib/conpty_console_list_agent.js'];
const notice = 'Copyright © țară 日本語\r\nPermission is hereby granted\r\n';
const sha = data => createHash('sha256').update(data).digest('hex');
async function put(root, relative, data) {
  const target = path.join(root, relative); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, data); return target;
}
async function fixture({ omit = [], hidden = false } = {}) {
  await mkdir(evidence, { recursive: true });
  const root = await mkdtemp(path.join(evidence, 'case-'));
  await put(root, 'package.json', JSON.stringify(manifest()));
  await put(root, 'package-lock.json', JSON.stringify(lock()));
  for (const name of ['node-addon-api', 'node-pty']) {
    const pkg = { name, version: name === 'node-pty' ? '1.1.0' : '7.1.1', license: 'MIT', scripts: { install: 'throw new Error("MUST NOT EXECUTE")' } };
    if (name === 'node-pty') { pkg.main = './lib/index.js'; pkg.dependencies = { 'node-addon-api': '^7.1.0' }; }
    await put(root, `node_modules/${name}/package.json`, JSON.stringify(pkg));
  }
  for (const rel of ['node_modules/node-pty/LICENSE', 'node_modules/node-pty/deps/winpty/LICENSE', 'node_modules/node-addon-api/LICENSE.md']) if (!omit.includes(rel)) await put(root, rel, notice);
  for (const rel of runtime) if (!omit.includes(`node_modules/node-pty/${rel}`)) await put(root, `node_modules/node-pty/${rel}`, rel.endsWith('.node') ? Buffer.from([0x4d, 0x5a, 0, 0xff]) : `throw new Error('MUST NOT EXECUTE ${rel}');\n`);
  await put(root, 'node_modules/node-addon-api/napi.h', '// inert build header\n');
  await put(root, 'node_modules/node-pty/prebuilds/win32-arm64/conpty.node', Buffer.from([0xff, 0, 0x80]));
  await put(root, 'node_modules/node-pty/prebuilds/win32-x64/winpty-agent.exe', Buffer.from([0x4d, 0x5a, 0xff]));
  if (hidden) { const value = lock(); delete value.packages['']; await put(root, 'node_modules/.package-lock.json', JSON.stringify(value)); }
  return { root, packagePath: path.join(root, 'package.json') };
}
const graphTest = (name, fn) => test(name, { skip: !api.captureTerminalProductionProviderGraph }, fn);
test('installed graph exposes capture and strict recheck without a wrapper executable', () => {
  assert.equal(typeof api.captureTerminalProductionProviderGraph, 'function');
  assert.equal(typeof api.recheckTerminalProductionProviderGraph, 'function');
});

graphTest('captures only two packages, exact bytes, required helpers and three original notices', async () => {
  const f = await fixture({ hidden: true }); const r = await api.captureTerminalProductionProviderGraph(f);
  await put(f.root, 'capture-receipt.json', JSON.stringify(r, null, 2));
  assert.equal(r.schema, 'siren-terminal-production-provider-graph/v1');
  assert.equal(r.admitted, false); assert.equal(r.evidenceClass, 'SOURCE_ONLY');
  assert.deepEqual(r.packages.map(p => p.name), ['node-addon-api', 'node-pty']);
  assert.equal(r.summary.installedFiles, 20); assert.equal(r.summary.readFiles, 23);
  assert.equal(r.selectedRuntime.length, 12); assert.equal(r.selectedNative.length, 2);
  assert.equal(r.selectedNative[0].bytes, 4); assert.equal(r.selectedNative[0].sha256, sha(Buffer.from([0x4d, 0x5a, 0, 0xff])));
  assert.equal(Object.hasOwn(r.selectedNative[0], 'text'), false);
  assert.equal(r.unselectedBinaries.length, 2); assert.equal(r.installationMetadata.length, 1);
  assert.equal(r.notices.length, 3); for (const n of r.notices) { assert.equal(n.text, notice); assert.equal(n.sha256, sha(Buffer.from(notice))); }
  assert.equal(r.rootManifest.sha256, sha(await readFile(f.packagePath)));
  assert.equal(r.lock.sha256, sha(await readFile(path.join(f.root, 'package-lock.json'))));
  assert.ok(r.buildSurface.some(item => item.relativePath.endsWith('/napi.h')));
  assert.equal(r.boundaries.packageCodeExecuted, false); assert.equal(r.boundaries.nativeExecution, false);
  assert.equal(r.buildProvenance.status, 'unknown'); assert.match(r.boundaries.filesystemGuarantee, /race/i);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
  assert.deepEqual(await api.recheckTerminalProductionProviderGraph({ ...f, receipt: JSON.parse(JSON.stringify(r)) }), { schema: r.schema, unchanged: true, admitted: false, installedFiles: 20 });
});

graphTest('rejects duplicate keys in root, lock and installed package JSON records', async () => {
  for (const [rel, bytes] of [
    ['package.json', JSON.stringify(manifest()).replace('"private":true', '"private":false,"private":true')],
    ['package-lock.json', JSON.stringify(lock()).replace('"lockfileVersion":3', '"lockfileVersion":2,"lockfileVersion":3')],
    ['node_modules/node-pty/package.json', '{"name":"evil","name":"node-pty","version":"1.1.0","license":"MIT","main":"./lib/index.js","dependencies":{"node-addon-api":"^7.1.0"}}']
  ]) { const f = await fixture(); await put(f.root, rel, bytes); await assert.rejects(api.captureTerminalProductionProviderGraph(f), /duplicate|JSON/i); }
});

graphTest('requires all twelve selected artifacts and three nonempty valid UTF-8 notices', async () => {
  for (const rel of [...runtime.map(p => `node_modules/node-pty/${p}`), 'node_modules/node-pty/LICENSE', 'node_modules/node-pty/deps/winpty/LICENSE', 'node_modules/node-addon-api/LICENSE.md']) {
    const f = await fixture({ omit: [rel] }); await assert.rejects(api.captureTerminalProductionProviderGraph(f), /missing|ENOENT/i);
  }
  for (const data of [Buffer.from([0xff]), ' \r\n']) { const f = await fixture(); await put(f.root, 'node_modules/node-pty/LICENSE', data); await assert.rejects(api.captureTerminalProductionProviderGraph(f), /UTF-8|empty/i); }
});

graphTest('rejects altered package version/dependencies and CommonJS entry escape surfaces', async () => {
  for (const change of [p => { p.version = '1.1.1'; }, p => { p.dependencies = {}; }, p => { p.main = '../../elsewhere.js'; }, p => { p.exports = './elsewhere.js'; }, p => { p.type = 'module'; }, p => { p.imports = {}; }, p => { p.optionalDependencies = { evil: '1' }; }, p => { p.peerDependencies = { evil: '1' }; }, p => { p.workspaces = ['*']; }]) {
    const f = await fixture(); const target = path.join(f.root, 'node_modules/node-pty/package.json'); const p = JSON.parse(await readFile(target, 'utf8')); change(p); await writeFile(target, JSON.stringify(p));
    await assert.rejects(api.captureTerminalProductionProviderGraph(f), /entry|dependency|package|version/i);
  }
});

graphTest('rejects xterm or any extra installed package and nested node_modules lookup trees', async () => {
  for (const rel of ['node_modules/@xterm/xterm/package.json', 'node_modules/evil/package.json', 'node_modules/node-pty/node_modules/evil/package.json', 'node_modules/node-addon-api/nested/node_modules/evil/package.json']) {
    const f = await fixture(); await put(f.root, rel, '{}'); await assert.rejects(api.captureTerminalProductionProviderGraph(f), /unknown|unexpected|nested/i);
  }
});

graphTest('rejects alternate native lookups including extension fallbacks and directory shadows', async () => {
  for (const rel of ['build/Release/conpty.node', 'build/Debug/conpty_console_list.node', 'lib/build/Release/conpty.node.js', 'lib/build/Debug/conpty_console_list.node.json', 'lib/prebuilds/win32-x64/conpty.node.node', 'BuIlD/ReLeAsE/conpty.node', 'build/Release/conpty.node/package.json', 'lib/build/Release/conpty_console_list.node/index.js', 'prebuilds/win32-x64/conpty.node.js']) {
    const f = await fixture(); await put(f.root, `node_modules/node-pty/${rel}`, 'opaque-shadow'); await assert.rejects(api.captureTerminalProductionProviderGraph(f), /shadow|alternate.*native/i);
  }
  const f = await fixture({ omit: ['node_modules/node-pty/prebuilds/win32-x64/conpty.node'] });
  await put(f.root, 'node_modules/node-pty/prebuilds/win32-x64/conpty.node/index.js', 'throw new Error("MUST NOT EXECUTE")');
  await assert.rejects(api.captureTerminalProductionProviderGraph(f), /shadow|runtime|missing/i);
});

graphTest('validates hidden installation lock instead of merely hashing a contradictory graph', async () => {
  for (const change of [l => { l.packages['node_modules/node-pty'].integrity = 'wrong'; }, l => { l.packages[''] = lock().packages['']; }, l => { l.packages['node_modules/evil'] = {}; }, l => { l.name = 'other'; }]) {
    const f = await fixture({ hidden: true }); const target = path.join(f.root, 'node_modules/.package-lock.json'); const value = JSON.parse(await readFile(target, 'utf8')); change(value); await writeFile(target, JSON.stringify(value));
    await assert.rejects(api.captureTerminalProductionProviderGraph(f), /installation|lock|package/i);
  }
});

graphTest('strict recheck refuses changed bytes, notices, removed files and even new empty directories', async () => {
  for (const rel of ['package.json', 'package-lock.json', 'node_modules/node-pty/prebuilds/win32-x64/conpty.node', 'node_modules/node-pty/LICENSE', 'node_modules/node-addon-api/napi.h']) {
    const f = await fixture(); const receipt = await api.captureTerminalProductionProviderGraph(f); const target = path.join(f.root, rel); await writeFile(target, Buffer.concat([await readFile(target), Buffer.from(' ')]));
    await assert.rejects(api.recheckTerminalProductionProviderGraph({ ...f, receipt }), /changed|mismatch/i);
  }
  const f = await fixture(); const receipt = await api.captureTerminalProductionProviderGraph(f); await mkdir(path.join(f.root, 'node_modules/node-pty/extra-empty'));
  await assert.rejects(api.recheckTerminalProductionProviderGraph({ ...f, receipt }), /changed|mismatch/i);
  const gone = await fixture(); const before = await api.captureTerminalProductionProviderGraph(gone); await rename(path.join(gone.root, 'node_modules/node-addon-api/napi.h'), path.join(gone.root, 'retained-header.h'));
  await assert.rejects(api.recheckTerminalProductionProviderGraph({ ...gone, receipt: before }), /changed|mismatch/i);
});

graphTest('refuses malformed or tampered receipts rather than promoting them to approval', async () => {
  const f = await fixture(); const before = await api.captureTerminalProductionProviderGraph(f);
  for (const change of [r => { r.admitted = true; }, r => { r.schema = 'other'; }, r => { r.packages.pop(); }, r => { r.notices[0].text += 'wrong'; }, r => { r.selectedNative = []; }, r => { r.boundaries.nativeExecution = true; }]) {
    const receipt = structuredClone(before); change(receipt); await assert.rejects(api.recheckTerminalProductionProviderGraph({ ...f, receipt }), /receipt|changed|mismatch/i);
  }
});

graphTest('refuses relative roots, traversal aliases and absent dedicated production installation', async () => {
  for (const packagePath of ['./package.json', path.join(evidence, 'not-package.json'), `${evidence}/../fixtures/package.json`, `${evidence}/nul\0/package.json`]) await assert.rejects(api.captureTerminalProductionProviderGraph({ packagePath }), /absolute|package.json|traversal|NUL/i);
  const f = await fixture(); await assert.rejects(api.captureTerminalProductionProviderGraph({ packagePath: f.root }), /package.json/i);
  const root = await mkdtemp(path.join(evidence, 'uninstalled-')); await put(root, 'package.json', JSON.stringify(manifest())); await put(root, 'package-lock.json', JSON.stringify(lock()));
  await assert.rejects(api.captureTerminalProductionProviderGraph({ packagePath: path.join(root, 'package.json') }), /ENOENT/i);
});

graphTest('refuses Node-visible directory links when the host permits inert link creation', async t => {
  const f = await fixture();
  try { await symlink(path.join(f.root, 'node_modules/node-addon-api'), path.join(f.root, 'node_modules/node-pty/alias'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (!['EPERM', 'EACCES'].includes(error.code)) throw error; t.skip(`inert directory-link creation refused by host: ${error.code}; link guard not exercised`); return; }
  await assert.rejects(api.captureTerminalProductionProviderGraph(f), /link|reparse/i);
});
graphTest('refuses Node-visible ancestor links when the host permits inert link creation', async t => {
  const plain = await fixture(); const outer = await mkdtemp(path.join(evidence, 'ancestor-'));
  try { await symlink(plain.root, path.join(outer, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (!['EPERM', 'EACCES'].includes(error.code)) throw error; t.skip(`inert ancestor-link creation refused by host: ${error.code}; ancestor-link guard not exercised`); return; }
  await assert.rejects(api.captureTerminalProductionProviderGraph({ packagePath: path.join(outer, 'linked/package.json') }), /link|reparse/i);
});
graphTest('refuses file hardlinks when the host permits inert link creation', async t => {
  const hard = await fixture();
  try { await link(path.join(hard.root, 'node_modules/node-addon-api/napi.h'), path.join(hard.root, 'node_modules/node-addon-api/alias.h')); }
  catch (error) { if (!['EPERM', 'EACCES'].includes(error.code)) throw error; t.skip(`inert hardlink creation refused by host: ${error.code}; hardlink guard not exercised`); return; }
  await assert.rejects(api.captureTerminalProductionProviderGraph(hard), /link|nonregular/i);
});

graphTest('enforces file-byte, total-byte, file-count, directory-count and depth budgets', async () => {
  const one = await fixture(); const huge = await put(one.root, 'node_modules/node-pty/oversize.bin', ''); await truncate(huge, 16 * 1024 * 1024 + 1);
  await assert.rejects(api.captureTerminalProductionProviderGraph(one), /budget|limit/i);
  const total = await fixture(); for (let i = 0; i < 7; i++) { const target = await put(total.root, `node_modules/node-pty/big-${i}.bin`, ''); await truncate(target, 14 * 1024 * 1024); }
  await assert.rejects(api.captureTerminalProductionProviderGraph(total), /budget|limit/i);
  const many = await fixture(); for (let i = 0; i < 1025; i++) await put(many.root, `node_modules/node-pty/tiny-${i}`, '');
  await assert.rejects(api.captureTerminalProductionProviderGraph(many), /budget|limit/i);
  const dirs = await fixture(); for (let i = 0; i < 1025; i++) await mkdir(path.join(dirs.root, `node_modules/node-pty/d-${i}`));
  await assert.rejects(api.captureTerminalProductionProviderGraph(dirs), /budget|limit/i);
  const deep = await fixture(); await mkdir(path.join(deep.root, 'node_modules/node-pty', ...Array(66).fill('d')), { recursive: true });
  await assert.rejects(api.captureTerminalProductionProviderGraph(deep), /budget|limit/i);
});

test('actual dedicated source manifest/lock agree without provisioning or fallback', async () => {
  const rootManifest = JSON.parse(await readFile(new URL('../../runtime/terminal-provider/package.json', import.meta.url), 'utf8'));
  const productionLock = JSON.parse(await readFile(new URL('../../runtime/terminal-provider/package-lock.json', import.meta.url), 'utf8'));
  assert.deepEqual(rootManifest, manifest()); assert.deepEqual(productionLock, lock());
  assert.equal(api.validateTerminalProductionProviderLock({ manifest: rootManifest, lock: productionLock }).admitted, false);
});
