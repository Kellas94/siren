import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {buildPatchedPython} from './python.mjs';

export async function buildAnalysisWorker({baselinePath,outputDirectory}) {
 const directory=resolve(outputDirectory);await mkdir(directory,{recursive:true});
 const python=await buildPatchedPython({baselinePath,outputPath:join(directory,'analysis-python.mjs')});
 const inventory=JSON.parse(await readFile(new URL('../reviews/2026-10-03-editor-product-dependencies.json',import.meta.url),'utf8'));
 const notices=[inventory.grammar.baselineNotice.notice];
 for(const entry of inventory.packages.filter(item=>['@lezer/common','@lezer/lr','@lezer/highlight'].includes(item.package))){
  const root=new URL(`../node_modules/${entry.package}/`,import.meta.url),manifest=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
  if(manifest.version!==entry.version||manifest.license!=='MIT')throw Error('ANALYSIS_LICENSE_INVENTORY_STALE');
  for(const license of entry.licenses){const notice=await readFile(new URL(license.file,root),'utf8');if(createHash('sha256').update(notice).digest('hex')!==license.sha256)throw Error('ANALYSIS_LICENSE_REFUSED');notices.push(`${entry.package} ${entry.version}\n${notice}`);}
 }
 const entry=join(directory,'analysis-entry.mjs'),workerPath=join(directory,'code-analysis-worker.cjs');
 await writeFile(entry,`import {parser} from './analysis-python.mjs';\nimport {runAnalysisWorker} from ${JSON.stringify(fileURLToPath(new URL('../src/sources/analysis-worker.mjs',import.meta.url)).replaceAll('\\','/'))};\nrunAnalysisWorker(parser);\n`);
 await build({entryPoints:[entry],outfile:workerPath,bundle:true,platform:'node',format:'cjs',target:'node24',minify:true,sourcemap:false,legalComments:'eof',nodePaths:[fileURLToPath(new URL('../node_modules',import.meta.url))],banner:{js:`/*! SIREN analysis dependencies\n${notices.join('\n\n').replaceAll('*/','* /')}\n*/`}});
 const bytes=await readFile(workerPath);return Object.freeze({workerPath,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,pythonModuleSha256:python.moduleSha256});
}
