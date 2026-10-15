import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {runInNewContext,Script} from 'node:vm';
import {parse} from 'parse5';
import {mkdtemp} from './fixtures/temporary.mjs';
import {buildDiagramVector} from '../build/diagram-vector.mjs';
import {buildDiagramEmbedContract} from '../build/diagram-embed-contract.mjs';
import {buildImportValidation} from '../build/import-validation.mjs';
import {buildDiagramWindow} from '../build/diagram-window.mjs';
test('inert native Diagram entry includes Send to Docs control, shared selection reader and themed dialog',async t=>{
 const out=await mkdtemp(join(tmpdir(),'siren-diagram-transfer-build-'));t.after(()=>rm(out,{recursive:true,force:true}));const result=await buildDiagramWindow({outputDir:out}),html=await readFile(join(out,'windows/diagram.html'),'utf8');
 assert.match(html,/id="diagramSendDocs"/);assert.match(html,/createDiagramDocsTransfer/);assert.match(html,/inspectSelection:inspectDiagramSelection/);assert.match(html,/document-diagram-selection/);assert.match(html,/docsTransfer\?\.pause/);assert.ok(result);
});
test('pure vector builder carries the dedicated passive validator inside its actual CSP hashes',async t=>{
 const root=await mkdtemp(join(tmpdir(),'siren-embed-vector-build-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const result=await buildDiagramVector({outputDir:root}),html=await readFile(result.entryPath,'utf8'),scripts=[];const walk=n=>{if(n.tagName==='script')scripts.push(n.childNodes.map(v=>v.value??'').join(''));for(const c of n.childNodes??[])walk(c);};walk(parse(html));
 assert.equal(result.embedSupported,true);assert.equal(scripts.length,2);assert.equal(createHash('sha256').update(html).digest('hex'),result.entrySha256);
 for(const script of scripts){assert.ok(html.includes("'sha256-"+createHash('sha256').update(script).digest('base64')+"'"));new Script(script);}
 assert.ok(scripts[1].includes('sanitizeDiagramEmbedSvg'));assert.ok(scripts[1].includes('sirenRenderDiagramEmbed'));assert.ok(!html.includes('sirenStore.start()'));
});
test('isolated validator gets the exact browser-safe typed contract without asset or publication authority',async t=>{
 const window={};runInNewContext(await buildDiagramEmbedContract(),{window});assert.equal(typeof window.SirenDiagramEmbedContract.normalizeDiagramEmbed,'function');assert.equal(window.SirenDiagramEmbedContract.createDiagramEmbedPublication,undefined);
 const root=await mkdtemp(join(tmpdir(),'siren-embed-import-build-'));t.after(()=>rm(root,{recursive:true,force:true}));const result=await buildImportValidation({baselinePath:new URL('../baseline/R78.html',import.meta.url),outputDir:root}),html=await readFile(join(root,'import-validation.html'),'utf8');assert.equal(createHash('sha256').update(html).digest('hex'),result.entrySha256);assert.ok(html.includes('window.SirenDiagramEmbedContract=Object.freeze'));assert.ok(html.includes("block?.kind==='diagram-embed'"));
});
