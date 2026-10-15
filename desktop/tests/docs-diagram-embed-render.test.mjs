import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {sanitizeDiagramEmbedSvg,normalizeMermaidEmbedSvg} from '../src/documents/diagram-embed-svg.mjs';
const code=await readFile(new URL('../src/ui/diagram/vector.js',import.meta.url),'utf8'),svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="50" height="30" fill="#ff2233"/><text fill="#102030">Original label</text></svg>';
function fixture({output=svg,render}={}){
 const document=new DOMParser().parseFromString('<html/>','application/xml'),host={replaceChildren(){},firstChild:null};document.getElementById=()=>host;
 const appearance={resolve:mode=>({mode}),read:v=>v,palette:v=>({canvasBg:v.mode==='dark'?'#112233':'#fafafa',text:'#102030'})};
 const window={SirenDiagramEmbedSvg:{normalizeMermaidEmbedSvg:v=>normalizeMermaidEmbedSvg(v,{DOMParser,XMLSerializer}),sanitizeDiagramEmbedSvg:v=>sanitizeDiagramEmbedSvg(v,{DOMParser,XMLSerializer})},SirenNativeDiagramStyle:{appearance,prepare:async()=>({}),apply(){}},mermaid:{render:render??(async()=>({svg:output}))}};
 runInNewContext(code,{document,window,DOMParser,XMLSerializer,TextEncoder,crypto:webcrypto});assert.equal(typeof window.sirenRenderDiagramEmbed,'function','Missing controlled embed renderer');
 return {window,input:mode=>({diagram:{source:'flowchart TD\n A-->B'},renderAppearance:{mode}})};
}
test('dedicated controlled rendering preserves explicit paint and hashes resolved theme in its identity',async()=>{
 const f=fixture(),light=await f.window.sirenRenderDiagramEmbed(f.input('light')),dark=await f.window.sirenRenderDiagramEmbed(f.input('dark'));
 assert.match(light.svg,/fill="#ff2233"/);assert.match(dark.svg,/fill="#ff2233"/);assert.match(light.svg,/#fafafa/);assert.match(dark.svg,/#112233/);assert.match(light.rendererVersion,/12\.0\.0/);assert.match(light.styleHash,/^[a-f0-9]{64}$/);assert.notEqual(light.styleHash,dark.styleHash);
});
for(const family of ['er','mindmap'])test('controlled renderer admits the actual '+family+' emitter output before validating both stages',async()=>{
 const output=await readFile(new URL('./fixtures/docs-diagram-families-native/'+family+'.svg',import.meta.url),'utf8'),f=fixture({output}),result=await f.window.sirenRenderDiagramEmbed(f.input('light'));
 assert.match(result.svg,family==='er'?/AGENT/:/Sources/);assert.match(result.styleHash,/^[a-f0-9]{64}$/);sanitizeDiagramEmbedSvg(result.svg,{DOMParser,XMLSerializer});
});
test('raw active SVG is refused before the general export sanitizer could silently remove it',async()=>{
 const f=fixture({output:svg.replace('<rect','<script>alert(1)</script><rect')});await assert.rejects(f.window.sirenRenderDiagramEmbed(f.input('light')),{code:'DIAGRAM_EMBED_SVG_REFUSED'});
});
test('one controlled render is active at a time; late failure releases the render slot',async()=>{
 let release,entered;const wait=new Promise(r=>release=r),ready=new Promise(r=>entered=r),f=fixture({render:async()=>{entered();await wait;return {svg};}}),pending=f.window.sirenRenderDiagramEmbed(f.input('light'));await ready;
 await assert.rejects(f.window.sirenRenderDiagramEmbed(f.input('dark')));release();assert.match((await pending).svg,/Original label/);assert.match((await f.window.sirenRenderDiagramEmbed(f.input('dark'))).svg,/Original label/);
});
