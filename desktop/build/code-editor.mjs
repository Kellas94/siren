import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { buildPatchedPython } from './python.mjs';

/** Local build seam only; the main renderer/package does not activate it yet. */
export async function buildCodeEditor({ baselinePath, outputDirectory } = {}) {
  if (typeof outputDirectory !== 'string' || !outputDirectory) throw new TypeError('OUTPUT_REQUIRED');
  const directory = resolve(outputDirectory); await mkdir(directory, { recursive: true });
  const python = await buildPatchedPython({ baselinePath, outputPath: join(directory, 'code-python.mjs') });
  const editorPath = fileURLToPath(new URL('../src/ui/code/editor.js', import.meta.url)).replaceAll('\\', '/');
  const clientPath = fileURLToPath(new URL('../src/ui/code/source-client.js', import.meta.url)).replaceAll('\\', '/');
  const entryPath = join(directory, 'code-entry.mjs'), bundlePath = join(directory, 'code-editor.js');
  await writeFile(entryPath, `import {parser} from './code-python.mjs';\nimport {createCodeEditor as create} from ${JSON.stringify(editorPath)};\nimport {sourceClient} from ${JSON.stringify(clientPath)};\nexport const createCodeEditor=options=>create({...options,pythonParser:parser});\nexport {sourceClient};\n`);
  const inventory = JSON.parse(await readFile(new URL('../reviews/2026-10-03-editor-product-dependencies.json', import.meta.url), 'utf8'));
  const notices = [inventory.grammar.baselineNotice.notice];
  for (const entry of inventory.packages.filter(item => item.role === 'editor-runtime')) {
    const packageRoot = new URL(`../node_modules/${entry.package}/`, import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'));
    if (manifest.version !== entry.version || manifest.license !== 'MIT') throw new Error('EDITOR_LICENSE_INVENTORY_STALE');
    for (const license of entry.licenses) {
      // w3c-keyname omits a separate file in its installed archive. Its exact
      // upstream notice was retained by the admitted dependency inventory.
      const notice = entry.separateLicenseFilePresent === false ? license.notice : await readFile(new URL(license.file, packageRoot), 'utf8');
      if (createHash('sha256').update(notice).digest('hex') !== license.sha256) throw new Error('EDITOR_LICENSE_REFUSED');
      notices.push(`${entry.package} ${entry.version}\n${notice}`);
    }
  }
  const licenseText = notices.join('\n\n');
  await writeFile(join(directory, 'code-editor.NOTICES.txt'), licenseText);
  await build({ entryPoints: [entryPath], outfile: bundlePath, bundle: true, format: 'iife', globalName: 'SirenCodeEditor', platform: 'browser',
    target: 'chrome152', minify: true, sourcemap: false, legalComments: 'eof',
    banner: { js: `/*! SIREN Code dependencies\n${licenseText.replaceAll('*/', '* /')}\n*/` },
    // Generated grammar outside the package root still resolves to the one
    // pinned product dependency closure; never install a second parser copy.
    nodePaths: [fileURLToPath(new URL('../node_modules', import.meta.url))] });
  const bytes = await readFile(bundlePath);
  return Object.freeze({ bundlePath, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    pythonModuleSha256: python.moduleSha256, sourceMaps: false });
}
