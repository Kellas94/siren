import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const api=await import('../src/documents/diagram-embed-svg.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const wrap=body=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">${body}</svg>`;
function sanitize(svg){assert.equal(typeof api.sanitizeDiagramEmbedSvg,'function','Missing passive SVG validator');return api.sanitizeDiagramEmbedSvg(svg,{DOMParser,XMLSerializer});}

test('real hosted Mermaid 12 branch retains all labels, explicit colours, edges and passive shadow definitions',async()=>{
 const raw=await readFile(new URL('./fixtures/docs-diagram-mermaid12-native.svg',import.meta.url),'utf8');
 // Run38084408215/commit42c89c6, diagnostic raw output; no local engine execution.
 assert.equal(createHash('sha256').update(raw).digest('hex'),'0bdaf01503aec2d0e2a615cd276ad5ea3e55b2472a7941e7148f9547a2cead55');
 const output=sanitize(raw),before=new DOMParser().parseFromString(raw,'image/svg+xml'),after=new DOMParser().parseFromString(output,'image/svg+xml');
 for(const tag of ['text','tspan','path','marker','linearGradient','feDropShadow'])assert.equal(after.getElementsByTagName(tag).length,before.getElementsByTagName(tag).length,tag);
 const ids=d=>Array.from(d.getElementsByTagName('*')).filter(n=>n.hasAttribute('id')).map(n=>n.getAttribute('id'));assert.deepEqual(ids(after),ids(before));
 for(const label of ['Input','Check','Review','Approve','Store'])assert.ok(after.documentElement.textContent.includes(label),label);
 assert.match(output,/fill:rgb\(255, 204, 0\)!important/);assert.match(output,/stroke:rgb\(21, 53, 95\)!important/);
});

test('passive shadow and tooltip styling cannot admit active elements or external paint through new properties',()=>{
 for(const body of ['<feImage href="https://outside.invalid/a"/>','<filter><feDropShadow onload="bad()"/></filter>','<style>.node{background:url(https://outside.invalid/a)}</style>','<style>.node{border:url(file:///C:/private)}</style>','<style>.node{position:expression(bad())}</style>'])assert.throws(()=>sanitize(wrap(body)),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
});
test('safe markers, gradient colors, explicit fill and text survive structured SVG validation',()=>{
 const svg=wrap('<defs><marker id="arrow" viewBox="0 0 10 10"><path d="M0 0L10 5L0 10Z" fill="#123456"/></marker><linearGradient id="paint"><stop offset="0" stop-color="#ff2233"/><stop offset="1" stop-color="#2255ff"/></linearGradient></defs><rect x="10" y="10" width="40" height="20" fill="url(#paint)"/><path d="M0 0L40 40" marker-end="url(#arrow)"/><text fill="#102030">A &amp; B</text>');
 const out=sanitize(svg),root=new DOMParser().parseFromString(out,'image/svg+xml').documentElement;assert.equal(root.getElementsByTagName('stop').item(0).getAttribute('stop-color'),'#ff2233');assert.equal(root.getElementsByTagName('rect').item(0).getAttribute('fill'),'url(#paint)');assert.equal(root.getElementsByTagName('text').item(0).textContent,'A & B');assert.ok(out.includes('marker-end="url(#arrow)"'));
});
test('unsafe SVG constructs are refused, never silently stripped into a different diagram',()=>{
 for(const body of ['<script>alert(1)</script>','<rect onload="alert(1)"/>','<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">Hidden context</div></foreignObject>','<image href="https://outside.invalid/x.png"/>','<use href="file:///C:/private"/>','<a href="javascript:alert(1)"><text>Link</text></a>','<animate attributeName="fill"/>','<rect style="fill:url(https://outside.invalid/x)"/>','<style>rect{fill:uRl(\"https://outside.invalid/x\")}</style>','<g xml:base="https://outside.invalid/"/>','<style>@import "https://outside.invalid/a";</style>','<style>rect{fill:u\\72l(https://outside.invalid/x)}</style>','<style>rect{--external:url(https://outside.invalid/x);fill:var(--external)}</style>'])assert.throws(()=>sanitize(wrap(body)),{code:'DIAGRAM_EMBED_SVG_REFUSED'},body);
});
test('malformed XML, doctype/entities, duplicate IDs and unresolved paint references are refused',()=>{
 for(const svg of ['<svg xmlns="http://www.w3.org/2000/svg"><g></svg>',wrap('<g id="same"/><g id="same"/>'),wrap('<path fill="url(#missing)"/>'),'<!DOCTYPE svg [<!ENTITY secret "payload">]>'+wrap('<text>&secret;</text>'),wrap('<text>&unbound;</text>'),'<?attack value?>'+wrap('<rect/>'),wrap('<unexpected/>')])assert.throws(()=>sanitize(svg),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
});
test('passive local stylesheet preserves layout colors and safely scoped selectors',()=>{
 const svg=wrap('<style>#flow .node rect {fill:#ffcc00;stroke:#15355f;stroke-width:2px} .label text {font-family:system-ui;font-size:15px;text-anchor:middle}</style><g id="flow" class="node"><rect width="50" height="20"/><text class="label">Original</text></g>');const out=sanitize(svg);assert.match(out,/fill:#ffcc00/);assert.match(out,/text-anchor:middle/);
});
test('root geometry, depth and byte limits fail closed',()=>{
 for(const svg of ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 NaN 300"/>','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 -1 300"/>',wrap('<g>'.repeat(66)+'<text>Deep</text>'+'</g>'.repeat(66)),wrap('<text>'+'x'.repeat(2097152)+'</text>')])assert.throws(()=>sanitize(svg),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
});
test('Mermaid passive dash keyframes and local font variables survive without admitting imports or nested URL attacks',()=>{
 const svg=wrap('<style>@keyframes edge-animation-frame {from {stroke-dashoffset:0;}} @keyframes dash {to {stroke-dashoffset:0;}} .edge-animation-slow {stroke-dasharray:9,5 !important;animation:dash 50s linear infinite;} .label {font-family:var(--mermaid-font-family);}</style><g style="--mermaid-font-family:system-ui"><text class="label">Saved</text></g>');assert.match(sanitize(svg),/@keyframes dash/);
 for(const css of ['@keyframes bad {to {fill:url(https://outside.invalid/x);}}','@font-face {font-family:outside;src:url(https://outside.invalid/f);}','@keyframes bad {from {@import "https://outside.invalid/x";}}'])assert.throws(()=>sanitize(wrap('<style>'+css+'</style>')),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
});
