import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {mkdtemp} from './fixtures/temporary.mjs';
import {buildWorkspaceEntrypoint} from '../build/workspace.mjs';
import {resolveLocalResource} from '../src/protocol.mjs';
import {allowedAppFile} from '../scripts/package.mjs';

test('Home is a bounded standalone entry with exact local script identities and no diagram initialization',async()=>{
  const root=await mkdtemp(join(tmpdir(),'siren-home-entry-'));
  const receipt=await buildWorkspaceEntrypoint({outputDir:root});
  const bytes=await readFile(join(root,'home.html')),html=bytes.toString('utf8');
  assert.equal(receipt.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(receipt.bytes,bytes.length);assert.ok(bytes.length<64*1024);
  const nodes=[];const visit=n=>{nodes.push(n);for(const child of n.childNodes||[])visit(child);};visit(parse(html));
  const scripts=nodes.filter(n=>n.tagName==='script');assert.equal(scripts.length,4);
  assert.match(html,/sirenWindowDock/);assert.match(html,/nativeWindowShelf/);
  for(const script of scripts){assert.equal(script.attrs.some(a=>a.name==='src'),false);const code=script.childNodes.map(n=>n.value||'').join('');assert.ok(html.includes("'sha256-"+createHash('sha256').update(code).digest('base64')+"'"));}
  // The exact SVG namespace is a DOM identifier, not a fetched resource.
  // Continue refusing every other URL and external script source.
  const withoutSvgNamespace=html.replaceAll('"http://www.w3.org/2000/svg"','""');
  assert.equal(/script-src 'unsafe-inline'|https?:\/\/|localStorage|createSirenDesktopStore|mermaid\.initialize|loadPersistedState|diagramRender|sourceText|codeFiles/.test(withoutSvgNamespace),false);
  assert.match(html,/<html[^>]*data-desktop-locked="true"/);
  assert.equal(await resolveLocalResource({url:'siren://app/home.html',rendererRoot:root}),join(root,'home.html'));
  assert.equal(allowedAppFile('generated/home.html',new Set()),true);
  for(const url of ['siren://app/home.html?projectId=forged','siren://app/home.html#module','siren://app/%68ome.html','siren://app/../home.html','siren://app/windows/../home.html','siren://app/Home.html'])await assert.rejects(resolveLocalResource({url,rendererRoot:root}));
  assert.equal(allowedAppFile('generated/home-other.html',new Set()),false);
});
