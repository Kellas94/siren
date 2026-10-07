import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto,randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {createDiagramLayoutContract} from '../src/documents/diagram-layout.mjs';
import {DomainRepository,normalizeDomainIntent} from '../src/windows/domain.mjs';
import {workspaceMetadata} from '../src/windows/entities.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {diagramContext} from '../tests/fixtures/diagram-context.mjs';
import {buildDiagramStyle} from '../build/diagram-style.mjs';
import {domainHelper} from '../build/import-validation.mjs';
import {NativePresentationDecks} from '../src/windows/presentation-deck.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {EventEmitter} from 'node:events';

const contract=createDiagramLayoutContract(),digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const draftCode=await readFile(new URL('../src/ui/diagram/draft.js',import.meta.url),'utf8');
const built=await buildDiagramStyle({baselinePath:new URL('../baseline/R78.html',import.meta.url)});
function draft(extra={}){
 const window={};vm.runInNewContext(draftCode,{window,crypto:webcrypto,structuredClone,TextEncoder});let request;
 const diagram={id:'diagram-a',source:'flowchart TD\nA[Exact colour]-->B\nstyle A fill:#ff3366',opaque:{private:'RETAIN_EXACT'},...extra};
 const own=window.SirenNativeDiagramDraft.create({context:{ok:true,readonly:false,diagram,version:1,sha256:digest(diagram)},bridge:{applyDiagram:async value=>{request=structuredClone(value);return{ok:true,domain:'diagram',entityId:diagram.id,version:2,sha256:digest({...own.getDiagram(),sirenNativeVersion:2}),projectRevision:3,durability:'committed',operationId:value.operationId};}}});
 return{own,diagram,request:()=>request};
}
test('independent compound edit: all seven supported style fields survive save and undo without source rewriting',async()=>{
 const f=draft(),patch={sirenNativeLayoutEngine:'dagre',fontFamily:'Georgia',fontSize:17,fontWeight:600,diagramTitle:'Exact title',diagramTitleTouched:true,nodeStyles:{A:{fill:'#112233',text:'#ffffff'}}};
 assert.equal(f.own.setStyle(patch).ok,true);for(const [key,value]of Object.entries(patch))assert.deepEqual(f.own.getDiagram()[key],value);
 assert.equal(f.own.undo().ok,true);assert.deepEqual(f.own.getDiagram(),f.diagram);assert.equal(f.own.redo().ok,true);assert.equal((await f.own.save()).ok,true);
 assert.deepEqual(f.request().payload,{source:f.diagram.source,...patch});assert.deepEqual(f.own.getDiagram().opaque,f.diagram.opaque);
});
test('independent imported unsupported preference: unrelated source/font save preserves exact opaque value',async()=>{
 for(const prior of ['future',{private:'OPAQUE_IMPORT'},null]){const f=draft({sirenNativeLayoutEngine:prior});assert.equal(f.own.setStyle({sirenNativeLayoutEngine:'elk'}).ok,false);assert.equal(f.own.setStyle({fontWeight:500}).ok,true);assert.equal(f.own.setSource(f.diagram.source+'\n%% exact source edit').ok,true);assert.equal((await f.own.save()).ok,true);assert.deepEqual(f.own.getDiagram().sirenNativeLayoutEngine,prior);assert.equal(Object.hasOwn(f.request().payload,'sirenNativeLayoutEngine'),false);}
});
test('independent source ownership matrix: finite supported scopes, own accessors, and unrelated scopes',()=>{
 for(const [type,scope]of [['flowchart-v2','flowchart'],['flowchart','flowchart'],['classDiagram-v2','class'],['classDiagram','class'],['stateDiagram-v2','state'],['stateDiagram','state'],['er','er'],['requirement','requirement']]){
  for(const choice of ['dagre','elk']){assert.equal(contract.resolve({},type,choice).layout,choice);for(const config of [{layout:'elk'},{[scope]:{layout:'elk'}},{[scope]:{defaultRenderer:'dagre'}}]){const resolved=contract.resolve(config,type,choice);assert.equal(resolved.sourceOwned,true);assert.equal(resolved.layout,undefined);}}
  let calls=0;const config={};Object.defineProperty(config,scope,{get(){calls++;throw Error('must not run');}});assert.equal(contract.resolve(config,type,'elk').sourceOwned,true);assert.equal(calls,0);
 }
 for(const type of ['sequence','mindmap','gitGraph','C4Context','constructor','__proto__'])assert.equal(contract.resolve({},type,'elk').layout,undefined);
 assert.equal(contract.resolve({state:{layout:'elk'}},'flowchart-v2','dagre').layout,'dagre');
});
test('independent actual shared adapter: selected fallback, automatic omission and source-owned refusal use exact source',async()=>{
 const exact='---\nconfig:\n  theme: base\n---\nflowchart TD\nA-->B\nstyle A fill:#123456';
 for(const [config,type]of [[{},'flowchart-v2'],[{layout:'elk'},'flowchart-v2'],[{class:{defaultRenderer:'dagre'}},'classDiagram-v2'],[{},'sequence']])for(const choice of [undefined,'auto','dagre','elk','future']){
  const calls=[],parsed=[],window={mermaid:{initialize:value=>calls.push(structuredClone(value)),parse:async source=>{parsed.push(source);return{config,diagramType:type};},mermaidAPI:{getDiagramFromText:async()=>({db:{getData:()=>({nodes:[]})}})}}};vm.runInNewContext(built.script,{window});
  const base={theme:'default',securityLevel:'strict'},before=JSON.stringify(base),result=await window.SirenNativeDiagramStyle.prepare(base,exact,{sirenNativeLayoutEngine:choice});
  const expected=contract.resolve(config,type,choice);assert.equal(calls.at(-1).layout,expected.layout);assert.equal(result.layout.sourceOwned,expected.sourceOwned);assert.ok(parsed.length>=2);assert.ok(parsed.every(value=>value===exact));assert.equal(JSON.stringify(base),before);
 }
});
const validatorNames=['sanitizeNodeStyles','sanitizeStyleClasses','sanitizeNodeClasses','sanitizeEdgeStyles','sanitizeEdgeRoutes','sanitizeNodeMetadata','sanitizeComments','sanitizeLayout','sanitizeView','sanitizeNodeLinks','sanitizeNodeIcons','sanitizeFormatRules','sanitizeNumbering','sanitizeLegend','sanitizeGitBranchColours','sanitizePresentation','normalizeFontFamily','normalizeFontWeight'];
const window={},validatorContext={window,...Object.fromEntries(validatorNames.map(name=>[name,value=>value]))};vm.runInNewContext(domainHelper,validatorContext);
test('independent generated domain helper admits only finite scalar choices and preserves unsupported prior by refusing mutation',()=>{
 const validate=(value,before)=>window.sirenDesktopValidateDomainPatch({domain:'diagram',action:'update-style',payload:{sirenNativeLayoutEngine:value},before});
 for(const choice of ['auto','dagre','elk']){assert.equal(validate(choice,{}),true);for(const prior of ['auto','dagre','elk'])assert.equal(validate(choice,{sirenNativeLayoutEngine:prior}),true);for(const prior of ['future',null,{opaque:true}])assert.equal(validate(choice,{sirenNativeLayoutEngine:prior}),false);}
 for(const value of ['ELK','future','',null,{},[],4,true])assert.equal(validate(value,{}),false);
});
async function repository(extra={}){
 const f=await diagramContext();let current=f.selected;if(Object.keys(extra).length){const metadata=JSON.parse(current.json),workspace=workspaceMetadata(current);Object.assign(workspace.diagrams[0],extra);metadata.storage['t-industries-siren-v23-state']=JSON.stringify(workspace);assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:current.project.id,baseRevision:current.revision,sourceRefs:current.sourceRefs,metadata,operationId:randomUUID()})).ok,true);current=await f.projects.readProject(current.project.id);}
 const domain=new DomainRepository({projects:()=>f.projects,sources:()=>f.sources,validatePatch:()=>true}),scope={projectId:current.project.id,isCurrent:()=>true};return{...f,current,domain,scope};
}
test('independent actual repository: finite choice, exact replay and typed reset retain source, siblings and source references',async()=>{
 const f=await repository(),before=workspaceMetadata(f.current),request={diagramId:'diagram-a',expectedVersion:1,operationId:randomUUID(),action:'update-style',payload:{sirenNativeLayoutEngine:'dagre'}};
 const first=await f.domain.apply('diagram',request,f.scope);assert.equal(first.ok,true);assert.equal(first.version,2);const saved=await f.projects.readProject(f.current.project.id);assert.equal(saved.revision,f.current.revision+1);assert.deepEqual(saved.sourceRefs,f.current.sourceRefs);
 const after=workspaceMetadata(saved);assert.deepEqual(after,{...before,diagrams:[{...before.diagrams[0],sirenNativeLayoutEngine:'dagre',sirenNativeVersion:2},before.diagrams[1]]});assert.equal(JSON.parse(saved.json).storage.other,'PRIVATE_UNRELATED');
 assert.deepEqual(await f.domain.apply('diagram',request,f.scope),first);assert.deepEqual(await f.projects.readProject(f.current.project.id),saved);
 const reset={diagramId:'diagram-a',expectedVersion:2,operationId:randomUUID(),action:'replace-content',payload:{source:before.diagrams[0].source,resetStyleFields:['sirenNativeLayoutEngine']}};assert.equal((await f.domain.apply('diagram',reset,f.scope)).ok,true);const final=await f.projects.readProject(f.current.project.id);assert.equal(Object.hasOwn(workspaceMetadata(final).diagrams[0],'sirenNativeLayoutEngine'),false);assert.equal(workspaceMetadata(final).diagrams[0].source,before.diagrams[0].source);assert.deepEqual(final.sourceRefs,f.current.sourceRefs);
});
test('independent actual repository: unsupported import cannot be overwritten or erased, even with permissive downstream validator',async()=>{
 for(const prior of ['future',null,{private:'EXACT_OPAQUE'}]){const f=await repository({sirenNativeLayoutEngine:prior});for(const payload of [{source:f.workspace.diagrams[0].source,sirenNativeLayoutEngine:'elk'},{source:f.workspace.diagrams[0].source,resetStyleFields:['sirenNativeLayoutEngine']}]){const result=await f.domain.apply('diagram',{diagramId:'diagram-a',expectedVersion:1,operationId:randomUUID(),action:'replace-content',payload},f.scope);assert.deepEqual(result,{ok:false,code:'DOMAIN_VALIDATION_FAILED'});assert.deepEqual(await f.projects.readProject(f.current.project.id),f.current);}}
});
test('independent finite IPC boundary rejects getters, own symbol, duplicate reset and reset-plus-assignment',()=>{
 const request={diagramId:'diagram-a',expectedVersion:1,operationId:randomUUID(),action:'replace-content'};let calls=0;const getter={source:'exact'};Object.defineProperty(getter,'sirenNativeLayoutEngine',{enumerable:true,get(){calls++;return'elk';}});
 for(const payload of [getter,{source:'exact',sirenNativeLayoutEngine:'elk',[Symbol('hidden')]:true},{source:'exact',resetStyleFields:['sirenNativeLayoutEngine','sirenNativeLayoutEngine']},{source:'exact',sirenNativeLayoutEngine:'elk',resetStyleFields:['sirenNativeLayoutEngine']}])assert.throws(()=>normalizeDomainIntent('diagram',{...request,payload}),/REQUEST_REFUSED/);assert.equal(calls,0);
});
test('independent real Presenter projection retains finite engine and exact colours without copying opaque imports/private entities',async()=>{
 for(const value of [undefined,'auto','dagre','elk','future',null,{private:'PRIVATE_ENGINE'}]){
  const f=await repository(value===undefined?{}:{sirenNativeLayoutEngine:value}),windows=[];
  const registry=new WindowRegistry({authorize:()=>({projectId:f.current.project.id,mode:'normal',access:'read',entityIds:['diagram-a']}),createWindow:async options=>{const w=new EventEmitter();w.id=91;w.isDestroyed=()=>Boolean(w.destroyed);w.isMinimized=()=>false;w.focus=()=>{};w.restore=()=>{};w.close=()=>w.destroy();w.destroy=()=>{w.destroyed=true;w.webContents.emit('destroyed');w.emit('closed');};w.webContents=new EventEmitter();Object.assign(w.webContents,{id:191,mainFrame:{url:options.mainFrameUrl},getURL:()=>options.mainFrameUrl,isDestroyed:w.isDestroyed});windows.push(w);return w;}});await registry.openView({role:'presenter',entityId:'diagram-a'});
  const grant=registry.capture({sender:windows[0].webContents,senderFrame:windows[0].webContents.mainFrame}),decks=new NativePresentationDecks({registry,snapshotFor:async()=>f.current}),deck=await decks.read(grant,{isCurrent:()=>true});
  assert.equal(Object.hasOwn(deck.render,'sirenNativeLayoutEngine'),['auto','dagre','elk'].includes(value));if(['auto','dagre','elk'].includes(value))assert.equal(deck.render.sirenNativeLayoutEngine,value);assert.equal(deck.render.source,f.workspace.diagrams[0].source);assert.equal(JSON.stringify(deck.render).includes('PRIVATE_'),false);assert.deepEqual(await f.projects.readProject(f.current.project.id),f.current);
 }
});
