import { readFile, writeFile, mkdir, lstat, stat, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Script, createContext } from 'node:vm';

const BASELINE_SHA256 = '5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4';
const FACTORY_SHA256 = 'c3b436db7d8d79ae712772ec1ffccb60381f9bfcf5f35646d3e838e2b9a0592b';
const CRLF_FACTORY_SHA256 = 'dc25d830dc69d310b6e61e49d955fd962ba8ca91379e145a534b6ceb348718cd';
const INDENT_FACTORY_SHA256 = '1f92f7d0232a79432fc9ef3d3813cf955789d21cb9f44b6c0e79dc366819759f';
const LR_SOURCE_SHA256 = '8d9b94f7c47b5226914e60613ec8bb49c3c3043df4e8d78ee7d19852fe34d582';
const LR_PATCHED_SHA256 = 'ed284a689b1c5b0f8ec17c869107bcce28c7dba8baecd1d5cba8a9ca103d533b';
const LR_MANIFEST_SHA256 = '2825a6410bc0c81635fb91525e2a8bca3a211c82265f5aeeac1dde6b535dc11e';
const LR_LICENSE_SHA256 = '568902fb66eaf1f11750e966b33fd7b5d7c618e65af09f35ef843635bcf5f1ba';
const MAX_BASELINE_BYTES = 32 * 1024 * 1024;
const sharedModules = Object.freeze(['@lezer/common', '@lezer/lr', '@lezer/highlight']);
const localModules = Object.freeze(['@lezer/python', '@siren/python/terms', '@siren/python/tokens', '@siren/python/highlight']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const refuse = code => { throw Object.assign(new Error(code), { code }); };
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

// Build-owned siblings are exclusive creations or exact verified prior outputs.
// Existing unrelated files, links and aliases are never overwritten or repaired.
async function sharedArtifact(path, bytes) {
  bytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  try { await writeFile(path, bytes, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size !== bytes.length
    || !samePath(await realpath(path), path) || digest(await readFile(path)) !== digest(bytes)) refuse('OUTPUT_REFUSED');
}

async function buildLR(directory) {
  const sourcePath = new URL('../node_modules/@lezer/lr/dist/index.js', import.meta.url);
  const licensePath = new URL('../node_modules/@lezer/lr/LICENSE', import.meta.url);
  const original = await readFile(sourcePath), license = await readFile(licensePath);
  if (digest(original) !== LR_SOURCE_SHA256 || digest(license) !== LR_LICENSE_SHA256
    || digest(await readFile(new URL('../node_modules/@lezer/lr/package.json', import.meta.url))) !== LR_MANIFEST_SHA256) refuse('GRAMMAR_REFUSED');
  const before = '!((_a = this.p.parser.nodeSet.types[type]) === null || _a === void 0 ? void 0 : _a.isAnonymous)';
  const after = '((_a = this.p.parser.nodeSet.types[type]) && !_a.isAnonymous)';
  const source = original.toString('utf8');
  if (source.split(before).length !== 2) refuse('GRAMMAR_REFUSED');
  let patched = source.replace(before, after);
  // Private opt-in only for emitted SIREN Python. Context-dependent cached
  // nodes may skip Python dedent tokens; let the lexer run before structural reuse.
  const tracker = `const sirenPythonIndentTrackers = new WeakSet();
class SirenPythonContextTracker extends ContextTracker {
    constructor(spec) { super(spec); sirenPythonIndentTrackers.add(this); }
}
function sirenPythonCanReuse(parse, cached) {
    if (!sirenPythonIndentTrackers.has(parse.parser.context)) return true;
    const {input, ranges} = parse;
    return ranges.length === 1 && ranges[0].from === 0 && ranges[0].to === input.length
        && !cached.prop(NodeProp.contextHash);
}
`;
  for (const [old, replacement] of [
    ['class LRParser extends Parser {', tracker + 'class LRParser extends Parser {'],
    ['            for (let cached = this.fragments.nodeAt(start); cached;) {', '            for (let cached = this.fragments.nodeAt(start); cached;) {\n                if (!sirenPythonCanReuse(this, cached)) break;'],
    ['export { ContextTracker,', 'export { SirenPythonContextTracker, ContextTracker,']
  ]) {
    if (patched.split(old).length !== 2) refuse('GRAMMAR_REFUSED');
    patched = patched.replace(old, replacement);
  }
  if (digest(patched) !== LR_PATCHED_SHA256) refuse('GRAMMAR_REFUSED');
  const lrModulePath = resolve(directory, 'python-lr.mjs');
  await sharedArtifact(lrModulePath, patched);
  await sharedArtifact(resolve(directory, 'python-lr.LICENSE.txt'), license);
  if (digest(await readFile(sourcePath)) !== LR_SOURCE_SHA256 || digest(await readFile(licensePath)) !== LR_LICENSE_SHA256
    || digest(await readFile(new URL('../node_modules/@lezer/lr/package.json', import.meta.url))) !== LR_MANIFEST_SHA256) refuse('GRAMMAR_REFUSED');
  return lrModulePath;
}

/** Build-only trusted extraction. No Python text, browser, or esbuild process is executed. */
export async function buildPatchedPython({ baselinePath, outputPath } = {}) {
  if (typeof baselinePath !== 'string' || !baselinePath || typeof outputPath !== 'string' || !outputPath || !outputPath.endsWith('.mjs')) refuse('OUTPUT_REFUSED');
  const input = resolve(baselinePath), output = resolve(outputPath);
  const directory = dirname(output);
  if (samePath(output, resolve(directory, 'python-lr.mjs')) || samePath(output, resolve(directory, 'python-lr.LICENSE.txt'))) refuse('OUTPUT_REFUSED');
  const inputInfo = await stat(input);
  if (!inputInfo.isFile()) refuse('BASELINE_REFUSED');
  if (inputInfo.size > MAX_BASELINE_BYTES) refuse('BASELINE_TOO_LARGE');
  const bytes = await readFile(input);
  if (bytes.length > MAX_BASELINE_BYTES) refuse('BASELINE_TOO_LARGE');
  if (digest(bytes) !== BASELINE_SHA256) refuse('BASELINE_REFUSED');
  if (input.toLowerCase() === output.toLowerCase()) refuse('OUTPUT_REFUSED');
  try {
    const outputInfo = await lstat(output);
    if (!outputInfo.isFile() || outputInfo.isSymbolicLink() || outputInfo.nlink !== 1 || outputInfo.dev === inputInfo.dev && outputInfo.ino === inputInfo.ino
      || (await realpath(output)).toLowerCase() === (await realpath(input)).toLowerCase()) refuse('OUTPUT_REFUSED');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }

  // parse5 normalized CRLF in the admitted candidate renderer. Apply that same
  // normalization to the hash-verified baseline before serializing its factories.
  const html = bytes.toString('utf8').replaceAll('\r\n', '\n');
  const prefix = 'const SirenPythonLanguage=(()=>{const factories=';
  const suffix = ';const cache={};function load';
  const start = html.indexOf(prefix), stop = html.indexOf(suffix, start);
  if (start < 0 || html.indexOf(prefix, start + 1) !== -1 || stop <= start) refuse('GRAMMAR_REFUSED');
  const context = createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  let factories;
  try { factories = new Script('(' + html.slice(start + prefix.length, stop) + ')').runInContext(context, { timeout: 1000 }); }
  catch { refuse('GRAMMAR_REFUSED'); }
  const expected = [...sharedModules, ...localModules];
  if (!factories || Reflect.ownKeys(factories).length !== expected.length
    || expected.some(name => typeof Object.getOwnPropertyDescriptor(factories, name)?.value !== 'function')) refuse('GRAMMAR_REFUSED');
  const factorySource = '{' + localModules.map(name => JSON.stringify(name) + ':' + factories[name].toString()).join(',') + '}';
  if (digest(factorySource) !== FACTORY_SHA256) refuse('GRAMMAR_REFUSED');
  // One physical CRLF is one newline token spanning both original code units.
  // Keep the admitted input hash; this exact derivative never normalizes source.
  let emittedFactorySource = factorySource;
  for (const token of ['newlineBracketed', 'newlineToken']) {
    const before = `input.acceptToken(${token}, 1)`;
    const after = `input.acceptToken(${token}, input.next == carriageReturn && input.peek(1) == newline ? 2 : 1)`;
    if (emittedFactorySource.split(before).length !== 2) refuse('GRAMMAR_REFUSED');
    emittedFactorySource = emittedFactorySource.replace(before, after);
  }
  if (digest(emittedFactorySource) !== CRLF_FACTORY_SHA256) refuse('GRAMMAR_REFUSED');
  for (const [before, after] of [
    ['const {ExternalTokenizer, ContextTracker} = require("@lezer/lr")', 'const {ExternalTokenizer, ContextTracker, SirenPythonContextTracker} = require("@lezer/lr")'],
    ['const trackIndent = new ContextTracker({', 'const trackIndent = new SirenPythonContextTracker({']
  ]) {
    if (emittedFactorySource.split(before).length !== 2) refuse('GRAMMAR_REFUSED');
    emittedFactorySource = emittedFactorySource.replace(before, after);
  }
  if (digest(emittedFactorySource) !== INDENT_FACTORY_SHA256) refuse('GRAMMAR_REFUSED');
  const noticeStart = html.lastIndexOf('/* Local Code parser licenses:', start);
  const noticeStop = html.indexOf('*/', noticeStart);
  if (noticeStart < 0 || noticeStop < noticeStart || noticeStop > start) refuse('GRAMMAR_REFUSED');
  const notice = html.slice(noticeStart, noticeStop + 2);
  const moduleText = `${notice}
// Frozen SIREN Python patches; installed common/highlight, one pinned opt-in LR derivative.
import * as common from '@lezer/common';
import * as lr from './python-lr.mjs';
import * as highlight from '@lezer/highlight';
const factories=${emittedFactorySource};
const externals=Object.freeze({'@lezer/common':common,'@lezer/lr':lr,'@lezer/highlight':highlight});
const cache=Object.create(null);
function load(name){
  if(Object.hasOwn(externals,name))return externals[name];
  if(Object.hasOwn(cache,name))return cache[name].exports;
  if(!Object.hasOwn(factories,name))throw new Error('Unexpected local Python module');
  const module={exports:{}};cache[name]=module;
  factories[name](module,module.exports,load);return module.exports;
}
export const parser=load('@lezer/python').parser;
export { LRParser } from './python-lr.mjs';
`;
  await mkdir(directory, { recursive: true });
  const directoryInfo = await lstat(directory);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink() || !samePath(await realpath(directory), directory)) refuse('OUTPUT_REFUSED');
  const lrModulePath = await buildLR(directory);
  await sharedArtifact(output, moduleText);
  const emitted = await readFile(output);
  if (digest(emitted) !== digest(moduleText)) refuse('GRAMMAR_READBACK_FAILED');
  return Object.freeze({ baselineSha256: BASELINE_SHA256, factorySha256: FACTORY_SHA256,
    emittedFactorySha256: INDENT_FACTORY_SHA256,
    lrModulePath, lrSourceSha256: LR_SOURCE_SHA256, lrPatchedSha256: LR_PATCHED_SHA256, lrLicenseSha256: LR_LICENSE_SHA256,
    moduleSha256: digest(emitted), outputPath: output, bytes: emitted.length, localModules, sharedModules });
}
