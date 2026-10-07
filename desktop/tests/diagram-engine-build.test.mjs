import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {mkdtemp} from './fixtures/temporary.mjs';
import {parse} from 'parse5';
const module=await import('../build/diagram.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('native diagram engine carries exact pinned Mermaid/ELK scripts and notices without the full application startup',async t=>{
 assert.equal(typeof module.buildDiagramEngine,'function','Native Diagram build seam must exist');const root=await mkdtemp(join(tmpdir(),'siren-diagram-build-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const baselinePath=new URL('../baseline/R78.html',import.meta.url),original=await readFile(baselinePath),result=await module.buildDiagramEngine({baselinePath,outputDirectory:root}),scripts=[];
 const walk=n=>{if(n.tagName==='script')scripts.push(n.childNodes.map(c=>c.value||'').join(''));for(const child of n.childNodes||[])walk(child);};walk(parse(original.toString('utf8')));
 const actual=await readFile(result.bundlePath);assert.deepEqual(actual,Buffer.from(scripts.slice(0,2).join('\n')));assert.equal(hash(actual),result.sha256);assert.equal(result.bytes,actual.length);assert.deepEqual(result.scriptSha256,scripts.slice(0,2).map(s=>hash(Buffer.from(s))));
 assert.equal(actual.includes(Buffer.from('sirenStore.start()')),false);assert.equal(actual.includes(Buffer.from('window.__SIREN_ELK')),true);assert.match(actual.toString(),/Copyright|copyright/);assert.deepEqual(await readFile(baselinePath),original);
});
test('tampered frozen input cannot emit a native diagram engine or substitute an external-host build',async t=>{
 assert.equal(typeof module.buildDiagramEngine,'function');const root=await mkdtemp(join(tmpdir(),'siren-diagram-tamper-'));t.after(()=>rm(root,{recursive:true,force:true}));const baselinePath=join(root,'changed.html'),outputDirectory=join(root,'output');await writeFile(baselinePath,'<script src="https://example.com/mermaid.js"></script>');
 await assert.rejects(module.buildDiagramEngine({baselinePath,outputDirectory}),/Frozen diagram baseline/);await assert.rejects(access(outputDirectory),{code:'ENOENT'});
});
