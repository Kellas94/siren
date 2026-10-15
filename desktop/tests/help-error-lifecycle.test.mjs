import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {HELP_ARTICLES} from '../src/help/catalog.mjs';
import {createHelpResolver} from '../src/help/resolve.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';

const source=path=>readFile(new URL('../src/'+path,import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const sha=value=>createHash('sha256').update(value).digest('hex');

test('actual stale Diagram save keeps the draft and resolves to the conflict flow',async()=>{
 const initial={id:'diagram-a',source:'flowchart TD\nA-->B',sirenNativeVersion:1};
 const json=JSON.stringify({diagrams:[{...initial,sirenNativeVersion:2}],workpapers:[]});let writes=0;
 const snapshot={schema:1,project:{id:'help-project',label:'Help',external:false},revision:2,json,sha256:sha(json)};
 const repository=new DomainRepository({projects:()=>({readProject:async()=>snapshot,directory:async()=>'',commit(){writes++;throw Error('Conflict cannot write');}}),sources:()=>({}),validatePatch:()=>{throw Error('Conflict cannot validate a patch');}});
 const context={window:{},crypto:webcrypto,structuredClone,TextEncoder};runInNewContext(await source('ui/diagram/draft.js'),context);
 const draft=context.window.SirenNativeDiagramDraft.create({context:{ok:true,readonly:false,diagram:initial,version:1,sha256:sha(JSON.stringify(initial)),projectRevision:1},bridge:{applyDiagram:request=>repository.apply('diagram',structuredClone(request),{projectId:'help-project',isCurrent:()=>true})},operationId:()=> 'help-owner-conflict'});
 draft.setSource('flowchart TD\nA-->Retained');const result=await draft.save();
 assert.equal(result.code,'REVISION_CONFLICT');assert.equal(writes,0);assert.equal(draft.getStatus().dirty,true);assert.match(draft.getDiagram().source,/Retained/);
 const resolver=createHelpResolver(HELP_ARTICLES),article=resolver.resolve({namespace:'diagram',operation:'save',code:result.code});
 assert.equal(article.id,'diagram-change');assert.ok(resolver.flow(article.id));
 assert.equal(resolver.resolve({namespace:'docs',operation:'save',code:'DOCUMENT_CONFLICT'}).id,'document-change');
 assert.equal(resolver.resolve({namespace:'diagram',operation:'export',code:result.code}).id,'unknown-error');
});

class Node {
 constructor(tag){this.tag=tag;this.children=[];this.listeners=new Map();this.hidden=false;this.dataset={};this.style={setProperty(){}};this.classList={add(){}};this._text='';}
 set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 append(...nodes){this.children.push(...nodes);}insertBefore(node,before){const i=this.children.indexOf(before);assert.notEqual(i,-1);this.children.splice(i,0,node);}
 setAttribute(){}addEventListener(name,fn){const items=this.listeners.get(name)??[];items.push(fn);this.listeners.set(name,items);}
 dispatchEvent(event){for(const fn of this.listeners.get(event.type)??[])fn(event);}
 emit(name,extra={}){return Promise.all((this.listeners.get(name)??[]).map(fn=>fn({type:name,...extra})));}
}
async function shellFixture(){
 const nodes=[],events=new Map(),body=new Node('body'),root=new Node('html');body.dataset.role='code';
 const document={body,documentElement:root,readyState:'complete',createElement(tag){const n=new Node(tag);nodes.push(n);return n;},getElementById:id=>nodes.find(n=>n.id===id),addEventListener(name,fn){const items=events.get(name)??[];items.push(fn);events.set(name,items);},dispatchEvent(event){for(const fn of events.get(event.type)??[])fn(event);}};
 const legacy=document.createElement('select');legacy.id='codeTheme';body.append(legacy);
 let epoch=Object.freeze({}),available=true,settle,closed=false;const explanations=[],pagehide=[];
 const help={capture:()=>epoch,isCurrent:value=>available&&value===epoch,explain:(host,identity,context)=>{explanations.push({identity,context});}};
 const window={SirenHelpWorkspace:help,SirenAppearancePalette:[{id:'light',name:'Light',mode:'light',colors:{}},{id:'dark',name:'Dark',mode:'dark',colors:{}}],sirenShell:{getAppearance:async()=>({ok:true,theme:'light'}),setAppearance:()=>new Promise((resolve,reject)=>{settle={resolve,reject};}),navigate:async()=>({ok:true})},addEventListener:(type,fn)=>{if(type==='pagehide')pagehide.push(fn);}};
 const vm={window,document,console,location:{pathname:'/windows/code.html'},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval:()=>1,clearInterval(){},Event:class {constructor(type){this.type=type;}},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}};
 runInNewContext(await source('ui/shared/appearance-sync.js'),vm);runInNewContext(await source('ui/shared/shell.js'),vm);await tick();
 return {document,explanations,context:()=>epoch,cover(){available=false;epoch=Object.freeze({});},resume(){available=true;},finish(kind){assert.ok(settle);kind==='throw'?settle.reject(Error('bounded fixture failure')):settle.resolve({ok:false,code:'ACCESS_REFUSED'});},retire(){closed=true;for(const fn of pagehide)fn();},get closed(){return closed;},choose(path){if(path==='classic')return Promise.all((events.get('siren-classic-appearance')??[]).map(fn=>fn({detail:{user:true,theme:'dark'}})));const element=document.getElementById(path==='legacy'?'codeTheme':'sirenAppTheme');element.value='dark';return element.emit('change');}};
}

for(const path of ['select','legacy','classic'])for(const result of ['refusal','throw'])test(`${path}: pre-Lock theme ${result} cannot reacquire a resumed Help context`,async()=>{
 const f=await shellFixture(),old=f.context(),pending=f.choose(path);await tick();f.cover();f.resume();f.finish(result);await pending;
 assert.equal(f.explanations.length,0);assert.equal(f.document.getElementById('sirenAppNavigation').children.find(n=>n.className==='siren-navigation-status').dataset.appearanceError,undefined);
 const current=f.context(),next=f.choose(path);await tick();f.finish(result);await next;
 assert.equal(f.explanations.length,1);assert.equal(f.explanations[0].context,current);assert.notEqual(current,old);assert.equal(f.explanations[0].identity.namespace,'appearance');
 assert.equal(f.explanations[0].identity.code,result==='throw'?'OPERATION_FAILED':'ACCESS_REFUSED');
});

test('retired shell does not publish delayed theme diagnostics',async()=>{
 const f=await shellFixture(),pending=f.choose('select');await tick();f.retire();f.finish('refusal');await pending;
 assert.equal(f.closed,true);assert.equal(f.explanations.length,0);
});
