// Resolve-only regression fixtures: never import/execute candidate package code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureTerminalCandidateGraph } from './terminal-candidate-graph.mjs';

const evidence = fileURLToPath(new URL('../../evidence/workspace-surface/terminal-candidate-graph-resolution-fixtures/', import.meta.url));
const versions = { '@xterm/addon-fit': '0.11.0', '@xterm/addon-search': '0.16.0', '@xterm/xterm': '6.0.0', 'node-addon-api': '7.1.1', 'node-pty': '1.1.0' };
const dependencies = Object.fromEntries(Object.entries(versions).filter(([name]) => name !== 'node-addon-api'));
const runtime = ['prebuilds/win32-x64/conpty.node', 'prebuilds/win32-x64/conpty_console_list.node', 'lib/index.js', 'lib/windowsTerminal.js', 'lib/terminal.js', 'lib/eventEmitter2.js', 'lib/utils.js', 'lib/windowsPtyAgent.js', 'lib/windowsConoutConnection.js', 'lib/shared/conout.js', 'lib/worker/conoutSocketWorker.js', 'lib/conpty_console_list_agent.js'];
const directories = ['build/Release', 'build/Debug', 'lib/build/Release', 'lib/build/Debug', 'lib/prebuilds/win32-x64'];
async function put(root, relative, bytes) { const target = path.join(root, relative); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); return target; }
async function fixture() {
  await mkdir(evidence, { recursive: true }); const root = await mkdtemp(path.join(evidence, 'case-'));
  const manifest = { name: 'siren-terminal-isolated-candidate', private: true, type: 'module', dependencies };
  const lock = { name: manifest.name, lockfileVersion: 3, requires: true, packages: { '': { name: manifest.name, dependencies } } };
  for (const [name, version] of Object.entries(versions)) {
    const pkg = { name, version, license: 'MIT' };
    const entry = { version, license: 'MIT', resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`, integrity: `sha512-${Buffer.alloc(64, 17).toString('base64')}` };
    if (name === 'node-pty') { pkg.main = './lib/index.js'; pkg.dependencies = { 'node-addon-api': '^7.1.0' }; entry.dependencies = pkg.dependencies; }
    lock.packages[`node_modules/${name}`] = entry;
    await put(root, `node_modules/${name}/package.json`, JSON.stringify(pkg));
    await put(root, `node_modules/${name}/${name === 'node-addon-api' ? 'LICENSE.md' : 'LICENSE'}`, 'Inert primary notice\n');
  }
  await put(root, 'package.json', JSON.stringify(manifest)); await put(root, 'package-lock.json', JSON.stringify(lock));
  await put(root, 'node_modules/node-pty/deps/winpty/LICENSE', 'Inert primary notice\n');
  for (const file of runtime) await put(root, `node_modules/node-pty/${file}`, file.endsWith('.node') ? Buffer.from([0x4d, 0x5a, 1]) : "throw Error('MUST NEVER EXECUTE');\n");
  return { root, packagePath: path.join(root, 'package.json') };
}
async function mutateManifest(f, mutate) {
  const target = path.join(f.root, 'node_modules/node-pty/package.json');
  const pkg = JSON.parse(await readFile(target, 'utf8')); mutate(pkg); await writeFile(target, JSON.stringify(pkg));
}

test('fixed primary main remains a valid inert inventory control', async () => {
  const f = await fixture(); const result = await captureTerminalCandidateGraph(f);
  assert.equal(result.selectedNative.length, 2); assert.equal(result.selectedRuntime.length, 12); assert.equal(result.admitted, false);
});
test('refuses alternate .node.js, .node.json and .node.node resolution before canonical native paths', async () => {
  for (const directory of directories) for (const name of ['conpty', 'conpty_console_list']) for (const extension of ['.js', '.json', '.node']) {
    const f = await fixture(), relative = `${directory}/${name}.node${extension}`;
    const target = await put(f.root, `node_modules/node-pty/${relative}`, extension === '.json' ? '{}' : 'INERT SHADOW');
    const request = path.join(f.root, 'node_modules/node-pty', directory, `${name}.node`);
    assert.equal(createRequire(f.packagePath).resolve(request), target, 'real Node resolver must select the inert shadow');
    await assert.rejects(captureTerminalCandidateGraph(f), /shadow|alternate.*native/i);
  }
});
test('refuses native-shaped directories before traversing their package main or index', async () => {
  for (const directory of directories) for (const name of ['conpty', 'conpty_console_list']) for (const packageMain of [false, true]) {
    const f = await fixture(), relative = `node_modules/node-pty/${directory}/${name}.node`;
    const target = await put(f.root, `${relative}/${packageMain ? 'alternate.js' : 'index.js'}`, 'INERT DIRECTORY SHADOW');
    if (packageMain) await put(f.root, `${relative}/package.json`, '{"main":"alternate.js"}');
    assert.equal(createRequire(f.packagePath).resolve(path.join(f.root, relative)), target);
    await assert.rejects(captureTerminalCandidateGraph(f), /shadow|alternate.*native/i);
  }
});
test('refuses a package main that escapes the captured installed graph', async () => {
  const f = await fixture(), outside = await put(f.root, 'outside-graph.js', 'INERT UNCAPTURED ROOT FILE');
  await mutateManifest(f, pkg => { pkg.main = '../../outside-graph.js'; });
  assert.equal(createRequire(f.packagePath).resolve('node-pty'), outside);
  await assert.rejects(captureTerminalCandidateGraph(f), /entry|resolution|main/i);
});
test('refuses missing, changed or overridden pinned node-pty entry metadata', async () => {
  const mutations = [pkg => { delete pkg.main; }, pkg => { pkg.main = './lib/windowsTerminal.js'; }, pkg => { pkg.main = ''; }, pkg => { pkg.main = { path: './lib/index.js' }; }, pkg => { pkg.exports = { '.': './lib/windowsTerminal.js', './package.json': './package.json' }; }, pkg => { pkg.type = 'module'; }, pkg => { pkg.imports = { '#outside': '../../outside.js' }; }];
  for (const mutate of mutations) { const f = await fixture(); await mutateManifest(f, mutate); await assert.rejects(captureTerminalCandidateGraph(f), /entry|resolution|main/i); }
});
