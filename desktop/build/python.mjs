import { readFile, writeFile, mkdir, lstat, stat, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Script, createContext } from 'node:vm';

const BASELINE_SHA256 = '5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4';
const FACTORY_SHA256 = 'c3b436db7d8d79ae712772ec1ffccb60381f9bfcf5f35646d3e838e2b9a0592b';
const MAX_BASELINE_BYTES = 32 * 1024 * 1024;
const sharedModules = Object.freeze(['@lezer/common', '@lezer/lr', '@lezer/highlight']);
const localModules = Object.freeze(['@lezer/python', '@siren/python/terms', '@siren/python/tokens', '@siren/python/highlight']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const refuse = code => { throw Object.assign(new Error(code), { code }); };

/** Build-only trusted extraction. No Python text, browser, or esbuild process is executed. */
export async function buildPatchedPython({ baselinePath, outputPath } = {}) {
  if (typeof baselinePath !== 'string' || !baselinePath || typeof outputPath !== 'string' || !outputPath || !outputPath.endsWith('.mjs')) refuse('OUTPUT_REFUSED');
  const input = resolve(baselinePath), output = resolve(outputPath);
  const inputInfo = await stat(input);
  if (!inputInfo.isFile()) refuse('BASELINE_REFUSED');
  if (inputInfo.size > MAX_BASELINE_BYTES) refuse('BASELINE_TOO_LARGE');
  const bytes = await readFile(input);
  if (bytes.length > MAX_BASELINE_BYTES) refuse('BASELINE_TOO_LARGE');
  if (digest(bytes) !== BASELINE_SHA256) refuse('BASELINE_REFUSED');
  if (input.toLowerCase() === output.toLowerCase()) refuse('OUTPUT_REFUSED');
  try {
    const outputInfo = await lstat(output);
    if (!outputInfo.isFile() || outputInfo.isSymbolicLink() || outputInfo.dev === inputInfo.dev && outputInfo.ino === inputInfo.ino
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
  const noticeStart = html.lastIndexOf('/* Local Code parser licenses:', start);
  const noticeStop = html.indexOf('*/', noticeStart);
  if (noticeStart < 0 || noticeStop < noticeStart || noticeStop > start) refuse('GRAMMAR_REFUSED');
  const notice = html.slice(noticeStart, noticeStop + 2);
  const moduleText = `${notice}
// Extracted unchanged local patches from frozen SIREN R78; shared modules use one installed instance.
import * as common from '@lezer/common';
import * as lr from '@lezer/lr';
import * as highlight from '@lezer/highlight';
const factories=${factorySource};
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
`;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, moduleText, 'utf8');
  const emitted = await readFile(output);
  if (digest(emitted) !== digest(moduleText)) refuse('GRAMMAR_READBACK_FAILED');
  return Object.freeze({ baselineSha256: BASELINE_SHA256, factorySha256: FACTORY_SHA256,
    moduleSha256: digest(emitted), outputPath: output, bytes: emitted.length, localModules, sharedModules });
}
