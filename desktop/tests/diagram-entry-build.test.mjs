import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {mkdtemp} from './fixtures/temporary.mjs';
const implementation=await import('../build/diagram-window.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
test('native Diagram builds only the frozen engines and selected view with exact CSP script identities',async()=>{
 assert.equal(typeof implementation.buildDiagramWindow,'function');const root=await mkdtemp(join(tmpdir(),'siren-diagram-entry-')),built=await implementation.buildDiagramWindow({outputDir:root});
 const html=await readFile(join(root,'windows','diagram.html'),'utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
 assert.equal(scripts.length,3);assert.equal(scripts[1],await readFile(new URL('../src/ui/windows/diagram-transfer.js',import.meta.url),'utf8'));assert.ok(scripts[2].includes('SirenNativeDiagramTransfer.whenPlaced()'));for(const code of scripts)assert.ok(html.includes("'sha256-"+createHash('sha256').update(code).digest('base64')+"'"));
 assert.equal(createHash('sha256').update(html).digest('hex'),built.sha256);
 assert.ok(html.includes('id="diagramViewport"')&&html.includes('id="diagramSource"'));
 assert.equal(/sirenDesktopBootstrap|createSirenDesktopStore|function initializeApp\(/.test(html),false);assert.equal(html.includes("script-src 'unsafe-inline'"),false);assert.equal(html.includes('connect-src'),false);
});
test('isolated SVG entry freezes style and engine fragments with exact CSP hashes and no full application or preload startup',async()=>{
 const {buildDiagramVector}=await import('../build/diagram-vector.mjs'),root=await mkdtemp(join(tmpdir(),'siren-vector-entry-')),built=await buildDiagramVector({outputDir:root}),html=await readFile(built.entryPath,'utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
 assert.equal(scripts.length,2);for(const code of scripts)assert.ok(html.includes("'sha256-"+createHash('sha256').update(code).digest('base64')+"'"));assert.equal(createHash('sha256').update(html).digest('hex'),built.entrySha256);
 assert.equal(/sirenDesktopBootstrap|createSirenDesktopStore|sirenDiagramRead|sirenSource|function initializeApp\(/.test(html),false);assert.equal(html.includes("script-src 'unsafe-inline'"),false);assert.equal(html.includes('connect-src'),false);assert.ok(html.includes('id="renderHost"'));
});
