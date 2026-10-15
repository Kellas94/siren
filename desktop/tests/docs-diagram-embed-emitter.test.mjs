import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import * as api from '../src/documents/diagram-embed-svg.mjs';
const env={DOMParser,XMLSerializer},parse=s=>new DOMParser().parseFromString(s,'image/svg+xml');
const normalize=s=>(api.normalizeMermaidEmbedSvg??(v=>v))(s,env),sanitize=s=>api.sanitizeDiagramEmbedSvg(s,env);
const wrap=s=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'+s+'</svg>';
for(const family of ['er','mindmap'])test('actual '+family+' emission becomes valid without losing geometry, labels, paints or declarations',async()=>{
 const raw=await readFile(new URL('./fixtures/docs-diagram-families-native/'+family+'.svg',import.meta.url),'utf8');
 assert.throws(()=>sanitize(raw),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
 const normalized=normalize(raw),out=sanitize(normalized),before=Array.from(parse(raw).getElementsByTagName('*')),after=Array.from(parse(out).getElementsByTagName('*'));
 assert.equal(after.length,before.length);const ids=new Set();
 before.forEach((node,i)=>{const actual=after[i];assert.equal(actual.localName,node.localName);assert.equal(actual.textContent,node.textContent);assert.equal(actual.attributes.length,node.attributes.length);
  for(const a of Array.from(node.attributes)){
   const value=actual.getAttribute(a.name);
   if(a.name==='style')assert.equal(value,a.value.split(';').filter(s=>s.trim()!=='undefined').join(';'));
   else if(a.name==='id'){assert.ok(value);assert.ok(!ids.has(value));ids.add(value);if(value!==a.value)assert.ok(node.localName==='linearGradient'||node.localName==='path'&&node.parentNode.getAttribute('id')===a.value);}
   else assert.equal(value,a.value,a.name);
  }
 });assert.equal(normalize(normalized),normalized,'idempotent');
});
test('emitter correction refuses ambiguous identities and meaningful reference changes',()=>{
 for(const body of [
  '<g id="same"/><g id="same"/>',
  '<g id="n" class="node mindmap-node"><path id="n" class="node-bkg"/></g><use href="#n"/>',
  '<style>#n{fill:red}</style><g id="n" class="node mindmap-node"><path id="n" class="node-bkg"/></g>',
  '<defs><linearGradient id="p"><stop stop-color="red"/></linearGradient><linearGradient id="p"><stop stop-color="blue"/></linearGradient></defs>',
  '<style>#p{opacity:0}</style><defs><linearGradient id="p"/><linearGradient id="p"/></defs>',
  '<rect style="undefined"/>',
  '<path data-edge="true" style="undefined: red;fill:blue"/>',
  '<path data-edge="true" style="undefined;fill:url(https://outside.invalid/x)"/>',
  '<g id="same"/><script id="same">bad()</script>'
 ])assert.throws(()=>sanitize(normalize(wrap(body))),{code:'DIAGRAM_EMBED_SVG_REFUSED'},body);
});
test('equivalent duplicate gradients keep paint references and receive collision-free identities',()=>{
 const gradient='<linearGradient id="p"><stop stop-color="#123456"/></linearGradient>',raw=wrap('<defs>'+gradient+gradient+'</defs><rect id="siren-emitter-1" fill="url(#p)"/>');
 const out=sanitize(normalize(raw)),doc=parse(out),gradients=Array.from(doc.getElementsByTagName('linearGradient'));
 assert.equal(gradients.length,2);assert.equal(gradients[0].getAttribute('id'),'p');assert.notEqual(gradients[1].getAttribute('id'),'p');assert.notEqual(gradients[1].getAttribute('id'),'siren-emitter-1');assert.equal(doc.getElementsByTagName('rect')[0].getAttribute('fill'),'url(#p)');
});
test('undefined text inside a quoted value or CSS function is never rewritten',()=>{
 for(const style of ['font-family:&quot;a;undefined;fill:red&quot;','stroke:var(--a;undefined;fill:red)'])assert.throws(()=>normalize(wrap('<path data-edge="true" style="'+style+'"/>')),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
});
test('partial identity and style attribute selectors cannot change meaning during correction',()=>{
 const node='<g id="node_1" class="mindmap-node"><path id="node_1" class="node-bkg"/></g>';
 for(const selector of ['[id^="node_"]','[id$="_1"]','[id*="ode"]',':not([id|="node"])','[|id^="node_"]'])assert.throws(()=>normalize(wrap('<style>'+selector+'{fill:red}</style>'+node)),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
 assert.throws(()=>normalize(wrap('<style>[style*="undefined"]{stroke:red}</style><path data-edge="true" style="undefined;;;undefined"/>')),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
 assert.throws(()=>normalize(wrap('<style>[|style*="undefined"]{stroke:red}</style><path data-edge="true" style="undefined;;;undefined"/>')),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
});
test('new identities never activate an existing ID selector',()=>{
 const raw=wrap('<style>#siren-emitter-1{fill:red}</style><g id="node_1" class="mindmap-node"><path id="node_1" class="node-bkg"/></g>'),out=sanitize(normalize(raw)),doc=parse(out);
 assert.notEqual(doc.getElementsByTagName('path')[0].getAttribute('id'),'siren-emitter-1');
});
test('new identities cannot resolve dangling fragment references into new visible content',()=>{
 const node='<g id="node_1" class="mindmap-node"><path id="node_1" class="node-bkg"/></g>';
 for(const extra of ['<use href="#siren-emitter-1"/>','<rect fill="url(#siren-emitter-1)"/>','<style>path{fill:url(#siren-emitter-1)}</style>'])assert.throws(()=>sanitize(normalize(wrap(node+extra))),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
});
