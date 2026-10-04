import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {parse} from 'parse5';
const baselineHash='5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Frozen standalone diagram engines, with their original bundled notices.
 * Native diagrams do not load the full application's startup/storage closure.
 * This build seam alone does not activate a new native role or edit grant. */
export async function buildDiagramEngine({baselinePath,outputDirectory}={}){
 if(typeof outputDirectory!=='string'||!outputDirectory)throw TypeError('DIAGRAM_OUTPUT_REQUIRED');
 const original=await readFile(baselinePath);if(hash(original)!==baselineHash)throw Error('Frozen diagram baseline SHA-256 mismatch');
 const scripts=[];function walk(node){if(node.tagName==='script')scripts.push(node);for(const child of node.childNodes||[])walk(child);}walk(parse(original.toString('utf8')));
 if(scripts.length!==3||scripts.some(node=>node.attrs.some(attr=>attr.name==='src')))throw Error('Frozen diagram engine scripts refused');
 const source=scripts.slice(0,2).map(node=>node.childNodes.map(child=>child.value||'').join(''));
 if(!source[0].startsWith('"use strict";var __esbuild_esm_mermaid_nm;')||!source[0].includes('globalThis["mermaid"] = globalThis.__esbuild_esm_mermaid_nm["mermaid"].default;')||!source[1].includes('window.__SIREN_ELK = (function () {'))throw Error('Frozen diagram engine identity refused');
 for(const code of source)new Script(code);
 const bytes=Buffer.from(source.join('\n'));if(/<\/script/i.test(bytes.toString('utf8')))throw Error('Diagram engine closing script tag refused');
 const directory=resolve(outputDirectory);await mkdir(directory,{recursive:true});const bundlePath=join(directory,'diagram-engine.js');await writeFile(bundlePath,bytes);
 return Object.freeze({bundlePath,bytes:bytes.length,sha256:hash(bytes),baselineSha256:baselineHash,scriptSha256:source.map(code=>hash(Buffer.from(code)))});
}
