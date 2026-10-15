import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {sanitizeDiagramEmbedSvg} from '../src/documents/diagram-embed-svg.mjs';
const dir=new URL('./fixtures/docs-diagram-families-native/',import.meta.url),pins=JSON.parse(await readFile(new URL('provenance.json',dir),'utf8'));
const sanitize=svg=>sanitizeDiagramEmbedSvg(svg,{DOMParser,XMLSerializer}),parse=svg=>new DOMParser().parseFromString(svg,'image/svg+xml');
for(const id of ['sequence','class','state','gantt','pie'])test('actual hosted '+id+' output retains exact passive structure and styling',async()=>{
 const raw=await readFile(new URL(id+'.svg',dir),'utf8'),pin=pins.files.find(r=>r.id===id);assert.equal(Buffer.byteLength(raw),pin.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),pin.sha256);
 const before=parse(raw),after=parse(sanitize(raw));const describe=d=>Array.from(d.getElementsByTagName('*')).map(n=>({tag:n.localName,attributes:Array.from(n.attributes).map(a=>[a.name,a.value]).sort(),text:Array.from(n.childNodes).filter(c=>[3,4].includes(c.nodeType)).map(c=>c.data)}));assert.deepEqual(describe(after),describe(before));
});
test('new passive SVG vocabulary cannot admit active content or external resources',()=>{
 const wrap=s=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'+s+'</svg>';
 for(const body of ['<symbol id="part"><script>bad()</script></symbol>','<symbol id="part"><use href="https://outside.invalid/x"/></symbol>','<rect name="safe" onload="bad()"/>','<style>[id$="part"]{box-shadow:url(https://outside.invalid/a)}</style>','<rect transform-origin="url(file:///C:/private)"/>','<style>rect{scale:expression(bad());}</style>','<style>rect{transition-duration:url(data:text/css,bad);}</style>'])assert.throws(()=>sanitize(wrap(body)),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
});
test('actual invalid ER declaration and ambiguous Mindmap identities stay refused',async()=>{
 for(const id of ['er','mindmap']){const raw=await readFile(new URL(id+'.svg',dir),'utf8');assert.throws(()=>sanitize(raw),{code:'DIAGRAM_EMBED_SVG_REFUSED'});}
});

test('unused neo-only local paints are inert; matching, negated and mixed selectors remain strict',()=>{
 const wrap=s=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'+s+'</svg>';
 const css='<style>#graph [data-look="neo"].node rect{fill:url(#absent)}</style>';
 assert.match(sanitize(wrap(css+'<g id="graph"><rect/></g>')),/url\(#absent\)/);
 for(const body of [css+'<g id="graph" data-look="neo" class="node"><rect/></g>','<style>#graph :not([data-look="neo"]) rect{fill:url(#absent)}</style>','<style>#graph [data-look="neo"].node rect,rect{fill:url(#absent)}</style>','<rect fill="url(#absent)"/>','<style>#graph [data-look="neo"].node-other rect{fill:url(#absent)}</style>','<style>#graph [data-look="neo"].node rect{fill:url(https://outside.invalid/a)}</style>'])assert.throws(()=>sanitize(wrap(body)),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
});
