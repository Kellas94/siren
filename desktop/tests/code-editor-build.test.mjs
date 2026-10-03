import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const buildModule = await import('../build/code-editor.mjs').catch(e => { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; return {}; });
test('source-backed Code editor build exists', () => assert.equal(typeof buildModule.buildCodeEditor, 'function'));
test('editor bundle is local, deterministic, retains notices and uses the frozen patched Python grammar', { skip: !buildModule.buildCodeEditor }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'siren-code-build-')); t.after(() => rm(root, { recursive: true, force: true }));
  const before = await readFile('baseline/R78.html');
  const a = await buildModule.buildCodeEditor({ baselinePath: resolve('baseline/R78.html'), outputDirectory: join(root, 'a') });
  const b = await buildModule.buildCodeEditor({ baselinePath: resolve('baseline/R78.html'), outputDirectory: join(root, 'b') });
  const bytes = await readFile(a.bundlePath);
  assert.deepEqual(bytes, await readFile(b.bundlePath));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256);
  assert.equal(a.pythonModuleSha256, '594371c934fb01689a144bd350c854497c0f2d18499fee86cc4e3209b658a589');
  assert.ok(bytes.length > 100000); assert.ok(bytes.length < 2000000);
  // Artifact controls supplement the actual browser behavior probe, not its replacement.
  assert.match(bytes.toString('utf8'), /SirenCodeEditor/); assert.match(bytes.toString('utf8'), /MIT/);
  assert.equal(a.sourceMaps, false); assert.deepEqual(await readFile('baseline/R78.html'), before);
});
