import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {buildDiagramStyle} from '../build/diagram-style.mjs';
import {normalizeDomainIntent} from '../src/windows/domain.mjs';
const built=await buildDiagramStyle({baselinePath:new URL('../baseline/R78.html',import.meta.url)});
const draftCode=await readFile(new URL('../src/ui/diagram/draft.js',import.meta.url),'utf8');
function adapter(config={},diagramType='flowchart-v2'){
 const calls=[],window={mermaid:{initialize:c=>calls.push(structuredClone(c)),parse:async()=>({config,diagramType}),mermaidAPI:{getDiagramFromText:async()=>({db:{getData:()=>({nodes:[]})}})}}};
 vm.runInNewContext(built.script,{window});return{style:window.SirenNativeDiagramStyle,calls};
}
test('actual common render adapter applies explicit fallback without mutating source colours or automatic defaults',async()=>{
 for(const choice of ['dagre','elk']){const f=adapter(),config={theme:'default',securityLevel:'strict',secure:['securityLevel']},before=JSON.stringify(config);const p=await f.style.prepare(config,'flowchart TD\nA-->B',{sirenNativeLayoutEngine:choice});assert.equal(f.calls.at(-1).layout,choice);assert.equal(p.layout.supported,true);assert.equal(p.layout.sourceOwned,false);assert.equal(JSON.stringify(config),before);}
 for(const choice of [undefined,'auto','future']){const f=adapter();await f.style.prepare({theme:'default'},'exact',{sirenNativeLayoutEngine:choice});assert.equal(Object.hasOwn(f.calls.at(-1),'layout'),false);}
 const f=adapter({layout:'elk',theme:'base'});const p=await f.style.prepare({theme:'default'},'exact',{sirenNativeLayoutEngine:'dagre'});assert.equal(Object.hasOwn(f.calls.at(-1),'layout'),false);assert.equal(p.layout.sourceOwned,true);
 const s=adapter({state:{defaultRenderer:'elk'}},'stateDiagram-v2');await s.style.prepare({},'exact',{sirenNativeLayoutEngine:'dagre'});assert.equal(Object.hasOwn(s.calls.at(-1),'layout'),false);
});
function draft(extra={}){
 const window={};vm.runInNewContext(draftCode,{window,crypto:webcrypto,structuredClone,TextEncoder});const diagram={id:'diagram-a',source:'flowchart TD\nA-->B\nstyle A fill:#ff3366',opaque:{private:'EXACT'},...extra};let request;
 const own=window.SirenNativeDiagramDraft.create({context:{ok:true,readonly:false,diagram,version:1,sha256:createHash('sha256').update(JSON.stringify(diagram)).digest('hex')},bridge:{applyDiagram:async r=>{request=r;const value={...own.getDiagram(),sirenNativeVersion:2};return{ok:true,domain:'diagram',entityId:'diagram-a',version:2,sha256:createHash('sha256').update(JSON.stringify(value)).digest('hex'),projectRevision:1,durability:'committed',operationId:r.operationId};}}});return{own,request:()=>request};
}
test('actual draft tracks layout in local history and saves it with exact source in one typed transaction',async()=>{
 const f=draft(),source=f.own.getDiagram().source;assert.equal(f.own.setStyle({sirenNativeLayoutEngine:'dagre'}).ok,true);assert.equal(f.own.getStatus().dirty,true);assert.equal(f.request(),undefined);
 assert.equal(f.own.undo().ok,true);assert.equal(Object.hasOwn(f.own.getDiagram(),'sirenNativeLayoutEngine'),false);assert.equal(f.own.getStatus().dirty,false);
 assert.equal(f.own.redo().ok,true);assert.equal(f.own.getDiagram().sirenNativeLayoutEngine,'dagre');assert.equal((await f.own.save()).ok,true);assert.equal(f.request().action,'replace-content');assert.deepEqual(JSON.parse(JSON.stringify(f.request().payload)),{source,sirenNativeLayoutEngine:'dagre'});assert.equal(f.own.getDiagram().opaque.private,'EXACT');
});
test('native request boundary refuses unknown layout choices and typed history removal admits only the finite field',()=>{
 const request={diagramId:'diagram-a',expectedVersion:1,operationId:'layout-op',action:'replace-content'};
 for(const value of ['auto','dagre','elk'])assert.equal(normalizeDomainIntent('diagram',{...request,payload:{source:'exact',sirenNativeLayoutEngine:value}}).payload.sirenNativeLayoutEngine,value);
 for(const value of [null,'future',{},'ELK'])assert.throws(()=>normalizeDomainIntent('diagram',{...request,payload:{source:'exact',sirenNativeLayoutEngine:value}}),/REQUEST_REFUSED/);
 assert.deepEqual(normalizeDomainIntent('diagram',{...request,payload:{source:'exact',resetStyleFields:['sirenNativeLayoutEngine']}}).payload.resetStyleFields,['sirenNativeLayoutEngine']);
 for(const prior of ['future',{private:'EXACT'},null]){const f=draft({sirenNativeLayoutEngine:prior});assert.equal(f.own.setStyle({sirenNativeLayoutEngine:'elk'}).ok,false);assert.deepEqual(f.own.getDiagram().sirenNativeLayoutEngine,prior);}
});
