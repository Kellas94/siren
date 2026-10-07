import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, access, link } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { LRParser } from '@lezer/lr';
import { Tree } from '@lezer/common';
import { highlightTree, classHighlighter } from '@lezer/highlight';
import { parser as upstream } from '@lezer/python';

let buildPatchedPython;
try { ({ buildPatchedPython } = await import('../build/python.mjs')); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
test('patched grammar build helper exists independently of renderer integration', () => assert.equal(typeof buildPatchedPython, 'function'));
const check = (name, body) => test(name, { skip: !buildPatchedPython }, body);
const BASELINE = '5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4';
const FACTORIES = 'c3b436db7d8d79ae712772ec1ffccb60381f9bfcf5f35646d3e838e2b9a0592b';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function owned(t) {
  const parent = resolve('evidence'); await mkdir(parent, { recursive: true }); const root = await mkdtemp(join(parent, 'python-build-test-'));
  t.after(() => rm(root, { recursive: true, force: true })); return root;
}
const errors = (parser, text) => { const found = []; parser.parse(text).iterate({ enter(node) { if (node.type.isError) found.push([node.from, node.to]); } }); return found; };
async function built(t) { const root = await owned(t); const outputPath = join(root, 'patched-python.mjs'); const receipt = await buildPatchedPython({ baselinePath: resolve('baseline/R78.html'), outputPath }); return { root, outputPath, receipt, parser: (await import(pathToFileURL(outputPath).href)).parser }; }

check('extracts exactly the admitted factory bytes and emits a deterministic module using shared installed Lezer', async t => {
  const original = await readFile('baseline/R78.html'); const { root, outputPath, receipt, parser } = await built(t);
  assert.equal(receipt.baselineSha256, BASELINE); assert.equal(receipt.factorySha256, FACTORIES);
  assert.deepEqual(receipt.localModules, ['@lezer/python', '@siren/python/terms', '@siren/python/tokens', '@siren/python/highlight']);
  assert.deepEqual(receipt.sharedModules, ['@lezer/common', '@lezer/lr', '@lezer/highlight']);
  const bytes = await readFile(outputPath); assert.equal(receipt.moduleSha256, digest(bytes)); assert.equal(receipt.bytes, bytes.length);
  assert.equal(parser instanceof LRParser, true); assert.equal(parser.parse('x=1\n') instanceof Tree, true);
  const next = join(root, 'again.mjs'); const second = await buildPatchedPython({ baselinePath: resolve('baseline/R78.html'), outputPath: next });
  assert.equal(second.moduleSha256, receipt.moduleSha256); assert.deepEqual(await readFile(next), bytes); assert.deepEqual(await readFile('baseline/R78.html'), original);
  assert.equal(bytes.toString().includes('Local Code parser licenses'), true);
});

check('malformed and changed baseline bytes are refused before any output or arbitrary evaluation', async t => {
  const root = await owned(t); const fake = join(root, 'untrusted.html'), outputPath = join(root, 'parser.mjs');
  await writeFile(fake, 'const SirenPythonLanguage=(()=>{const factories=(()=>{while(true){}})();const cache={};function load');
  await assert.rejects(buildPatchedPython({ baselinePath: fake, outputPath, expectedSha256: digest(await readFile(fake)) }), { code: 'BASELINE_REFUSED' });
  await assert.rejects(access(outputPath), { code: 'ENOENT' });
  await writeFile(outputPath, 'retained output'); const bytes = await readFile('baseline/R78.html'); await writeFile(fake, Buffer.concat([bytes, Buffer.from('\n')]));
  await assert.rejects(buildPatchedPython({ baselinePath: fake, outputPath }), { code: 'BASELINE_REFUSED' }); assert.equal(await readFile(outputPath, 'utf8'), 'retained output');
});

check('baseline size is bounded before extraction and existing hard-linked input is never overwritten', async t => {
  const root = await owned(t), huge = join(root, 'huge.html'), outputPath = join(root, 'parser.mjs');
  await writeFile(huge, Buffer.alloc(32 * 1024 * 1024 + 1));
  await assert.rejects(buildPatchedPython({ baselinePath: huge, outputPath }), { code: 'BASELINE_TOO_LARGE' }); await assert.rejects(access(outputPath), { code: 'ENOENT' });
  const copy = join(root, 'frozen-copy.html'); await writeFile(copy, await readFile('baseline/R78.html')); await link(copy, outputPath);
  await assert.rejects(buildPatchedPython({ baselinePath: copy, outputPath }), { code: 'OUTPUT_REFUSED' }); assert.equal(digest(await readFile(copy)), BASELINE);
});

check('patched empty class patterns remain fixed against actual unpatched upstream control', async t => {
  const { parser } = await built(t); const text = 'match value:\n    case Point():\n        pass\n';
  assert.deepEqual(errors(parser, text), []); assert.ok(errors(upstream, text).length > 0);
  assert.ok(parser.parse(text).toString().includes('ClassPattern(VariableName,PatternArgList("(",")"))'));
});

check('patched parenthesized with items remain fixed against upstream control', async t => {
  const { parser } = await built(t); const text = 'with (open("x") as f,\n      open("y") as g):\n    pass\n';
  assert.deepEqual(errors(parser, text), []); assert.ok(errors(upstream, text).length > 0); assert.ok(parser.parse(text).toString().includes('WithItemList'));
});

check('formfeed indentation remains fixed against upstream control', async t => {
  const { parser } = await built(t); const text = 'if True:\n\f    x = 1\n';
  assert.deepEqual(errors(parser, text), []); assert.ok(errors(upstream, text).length > 0); assert.equal(parser.parse(text).topNode.getChild('IfStatement').getChild('Body').getChild('AssignStatement').name, 'AssignStatement');
});

check('decorated async functions and multiline literals parse without executing Python', async t => {
  const { parser } = await built(t);
  for (const text of ['@decorator\nasync def run(x: int) -> str:\n    return f"value={x}"\n', 'async def collect():\n    values = [\n        "Ș😀",\n        """first\nsecond""",\n    ]\n    return values\n']) assert.deepEqual(errors(parser, text), []);
  const tree = parser.parse('@decorator\nasync def run():\n    pass\n'); assert.equal(tree.topNode.getChild('DecoratedStatement').getChild('FunctionDefinition').getChild('async').name, 'async');
  assert.ok(errors(parser, 'def broken(:\n    pass\n').length > 0);
});

check('local grammar highlighting uses the same installed highlight properties', async t => {
  const { parser } = await built(t); const tokens = [];
  highlightTree(parser.parse('def run():\n    return "Ș😀" # comment\n'), classHighlighter, (from, to, classes) => tokens.push({ from, to, classes }));
  assert.ok(tokens.some(token => token.classes.includes('tok-keyword'))); assert.ok(tokens.some(token => token.classes.includes('tok-string'))); assert.ok(tokens.some(token => token.classes.includes('tok-comment')));
});
