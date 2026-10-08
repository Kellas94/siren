// Exercise the actual test-builder sources with inert filesystem/process seams.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

async function exercise(name, failure) {
  const url = new URL(`./build-terminal-electron-${name}.mjs`, import.meta.url);
  const original = await readFile(url, 'utf8');
  const source = original.replace(/^import .*;\r?\n/gm, '').replaceAll('import.meta.url', JSON.stringify(url.href));
  const events = [], writes = new Map();
  const graph = { schema: 'inert-test-graph', admitted: false, summary: { installedFiles: 489, installedBytes: 71541053 } };
  const receipt = negative => JSON.stringify({ negative, compileOnly: false, processStarted: true, qualified: true, outerExitObserved: true, outerExitCode: negative ? 1 : 0, inputsUnchanged: true, native: {} });
  const execute = async (_executable, args) => {
    events.push(args.includes('--negative') ? 'negative' : 'positive');
    if (args.includes('--negative')) throw Object.assign(new Error('expected fixture refusal'), { code: 1, stdout: receipt(true), stderr: '' });
    return { stdout: receipt(false), stderr: '' };
  };
  const context = vm.createContext({
    assert, Buffer, URL, join, dirname, parse, fileURLToPath, createHash, randomUUID,
    process: { execPath: 'INERT-NOT-EXECUTED' }, console: { log() {} },
    promisify: fn => fn, execFile: execute,
    readFile: async () => Buffer.from('inert source bytes'),
    writeFile: async (path, bytes) => writes.set(path, Buffer.isBuffer(bytes) ? bytes.toString('utf8') : bytes),
    mkdir: async () => {}, lstat: async () => ({ isSymbolicLink: () => false }),
    isElectronBrokerObserved: () => true, isExpectedElectronBrokerRefusal: () => true,
    isElectronCapacityObserved: () => true, isExpectedElectronCapacityRefusal: () => true,
    captureTerminalCandidateGraph: async options => {
      assert.match(options.packagePath.replaceAll('\\', '/'), /tests\/fixtures\/terminal-node-pty\/package.json$/);
      events.push('capture');
      if (failure === 'capture') throw new Error('INERT_CAPTURE_REFUSED');
      return graph;
    },
    recheckTerminalCandidateGraph: async options => {
      events.push('recheck'); assert.equal(options.receipt, graph);
      if (failure === 'drift') throw new Error('INERT_GRAPH_CHANGED');
      return { unchanged: failure !== 'false', admitted: false, installedFiles: 489 };
    }
  });
  let error;
  try { await vm.runInContext(`(async () => {\n${source}\n})()`, context, { timeout: 2000 }); }
  catch (caught) { error = caught; }
  const saved = [...writes].filter(([path]) => path.endsWith('receipt.json')).map(([, bytes]) => JSON.parse(bytes)).at(-1);
  return { events, writes, saved, error };
}

for (const name of ['broker', 'capacity']) {
  test(`${name}: captures exact graph before native phases and rechecks before success`, async () => {
    const result = await exercise(name);
    assert.equal(result.error, undefined);
    assert.deepEqual(result.events, ['capture', 'negative', 'positive', 'recheck']);
    const [graphPath, bytes] = [...result.writes].find(([path]) => path.endsWith('dependency-graph.json')) ?? [];
    assert.ok(graphPath, 'original graph must be retained');
    assert.equal(result.saved.dependencyGraph.path, graphPath);
    assert.equal(result.saved.dependencyGraph.bytes, Buffer.byteLength(bytes));
    assert.equal(result.saved.dependencyGraph.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(result.saved.dependencyGraph.unchanged, true);
    assert.ok(result.saved.inputs.some(input => input.path.endsWith('terminal-candidate-graph.mjs')));
    assert.equal(result.saved.admitted, false);
  });
  test(`${name}: graph capture refusal prevents all native execution`, async () => {
    const result = await exercise(name, 'capture');
    assert.match(result.error?.message ?? '', /INERT_CAPTURE_REFUSED/);
    assert.deepEqual(result.events, ['capture']);
    assert.equal(result.saved.status, 'FAILED');
  });
  test(`${name}: changed graph or non-success recheck cannot become native success`, async () => {
    for (const failure of ['drift', 'false']) {
      const result = await exercise(name, failure);
      assert.ok(result.error, 'graph drift must reject the builder');
      assert.deepEqual(result.events, ['capture', 'negative', 'positive', 'recheck']);
      assert.equal(result.saved.status, 'FAILED');
      assert.equal(result.saved.dependencyGraph.unchanged, false);
    }
  });
}
