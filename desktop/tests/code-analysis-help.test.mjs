// Actual Code controller + Help catalog, resolver, view and workspace. Inert DOM only.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {readHelpBrowser} from '../build/help.mjs';
const analysis=await readFile(process.env.SIREN_ANALYSIS_HELP_SOURCE??new URL('../src/ui/code/analysis.js',import.meta.url),'utf8');
const help=await readHelpBrowser(),view=await readFile(new URL('../src/ui/shared/help.js',import.meta.url),'utf8'),workspace=await readFile(new URL('../src/ui/shared/help-workspace.js',import.meta.url),'utf8');
class Element{
 constructor(tag,document){this.tagName=tag.toUpperCase();this.document=document;this.children=[];this.listeners=new Map();this.dataset={};this.style={};this.value='';this.hidden=false;this._text='';this.classList={toggle(){}};}
 set textContent(v){this._text=String(v);this.replaceChildren();}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 get isConnected(){return this.parent?this.parent.isConnected:this===this.document.body;}
 append(...nodes){for(const n of nodes){n.remove();n.parent=this;this.children.push(n);if(this.tagName==='SELECT'&&!this.value)this.value=n.value;}}
 replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.children=[];this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
 setAttribute(k,v){this[k]=v;}addEventListener(k,f){const a=this.listeners.get(k)??[];a.push(f);this.listeners.set(k,a);}removeEventListener(k,f){this.listeners.set(k,(this.listeners.get(k)??[]).filter(n=>n!==f));}
 emit(k,e={}){for(const f of this.listeners.get(k)??[])f({preventDefault(){},...e});}click(){this.emit('click');}focus(){this.document.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;this.emit('close');}
}
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture({withHelp=true}={}){
 const document={createElement(tag){return new Element(tag,this);},getElementById(id){let found;const walk=n=>{if(n.id===id)found=n;for(const child of n.children)walk(child);};walk(this.body);return found;},addEventListener(){},removeEventListener(){}};
 document.body=document.createElement('body');document.documentElement=document.createElement('html');
 const make=(tag,id)=>{const e=document.createElement(tag);e.id=id;document.body.append(e);return e;};make('nav','sirenAppNavigation').hidden=false;
 const button=make('button','toggleAnalysis'),panel=make('section','codeAnalysis'),context={document,window:{sirenShell:{},addEventListener(){}},crypto:{randomUUID:()=> 'job-'+jobs.length}};
 const jobs=[];let status={ready:true,sourceRef:{sourceId:'source-a',version:1,sha256:'a'.repeat(64)}};
 if(withHelp){for(const code of [help,view,workspace])runInNewContext(code,context);}
 runInNewContext(analysis,context);
 const editor={getStatus:()=>status,getState:()=>({doc:{length:100},selection:{main:{from:1,to:40}}})};
 const api=context.window.SirenNativeAnalysis.create({button,panel,editorFor:()=>editor,bridge:{submit:request=>new Promise((resolve,reject)=>jobs.push({request,resolve,reject})),cancel:async()=>({ok:true}),listComparisons:async()=>({ok:true,items:[{windowId:'window-b',sourceRef:{sourceId:'source-b',version:2,sha256:'b'.repeat(64)}}]})}});
 const node=id=>document.getElementById(id),offer=()=>node('analysisStatus').children.find(n=>n.className==='siren-help-error');
 const settle=async(answer,index=jobs.length-1)=>{jobs[index].resolve(answer);await tick();};
 return{api,node,offer,jobs,document,help:context.window.SirenHelpWorkspace,run:()=>node('analyzeSource').click(),settle,changeSource(){status={...status,sourceRef:{...status.sourceRef,version:2}};api.reconcile();},async scope(value){node('analysisScope').value=value;node('analysisScope').emit('change');await tick();}};
}
for(const code of ['ANALYSIS_BUSY','LANGUAGE_NOT_SUPPORTED'])test(code+' opens the real scoped manual without resubmitting code',async()=>{
 const f=fixture();f.run();await f.settle({ok:false,code});assert.ok(f.offer(),'Code must offer the actual Help action');f.offer().click();
 assert.match(f.node('sirenHelpArticle').textContent,/Python analysis and coverage/);assert.match(f.node('sirenHelpContext').textContent,new RegExp(code));assert.match(f.node('sirenHelpArticle').textContent,/does not execute Python/);assert.equal(f.jobs.length,1);
});
test('unknown valid error gets the unknown explanation, not a diagnosis inferred from its code',async()=>{
 const f=fixture();f.run();await f.settle({ok:false,code:'SOMETHING_NEW'});assert.ok(f.offer());f.offer().click();assert.match(f.node('sirenHelpContext').textContent,/Unknown error identity/);assert.doesNotMatch(f.node('sirenHelpArticle').textContent,/Python analysis and coverage/);
});
test('budget result offers coverage help and retains operation-specific recovery',async()=>{
 const f=fixture();await f.scope('compare');f.run();await f.settle({ok:true,status:'budget-exceeded',reason:'DIFF_LINE_BUDGET'});assert.match(f.node('analysisStatus').textContent,/line limit/);assert.ok(f.offer());f.offer().click();assert.match(f.node('sirenHelpArticle').textContent,/Python analysis and coverage/);assert.equal(f.jobs.length,1);
});
for(const action of ['retry','scope','source','clear','pause','dispose'])test(action+' removes the old Help offer and fences its retained click',async()=>{
 const f=fixture();f.run();await f.settle({ok:false,code:'ANALYSIS_BUSY'});const old=f.offer();assert.ok(old);
 if(action==='retry')f.run();else if(action==='scope')await f.scope('selection');else if(action==='source')f.changeSource();else if(action==='clear'){assert.equal(f.node('cancelAnalysis').disabled,false,'Clear must be usable with a diagnostic');f.node('cancelAnalysis').click();}else f.api[action]();
 assert.equal(f.offer(),undefined);old.click();assert.equal(f.node('sirenHelpDiagnostics'),undefined);
});
for(const boundary of ['pause','dispose','source','scope','help-cover'])test('late error after '+boundary+' cannot offer or reopen Help',async()=>{
 const f=fixture();f.run();if(boundary==='source')f.changeSource();else if(boundary==='scope')await f.scope('selection');else if(boundary==='help-cover'){f.help.cover();f.help.resume();}else{f.api[boundary]();if(boundary==='pause')f.api.resume();}
 await f.settle({ok:false,code:'ANALYSIS_BUSY'});assert.equal(f.offer(),undefined);assert.equal(f.node('sirenHelpDiagnostics'),undefined);
});
for(const answer of [{ok:false},{ok:false,code:'<bad>'},{ok:true,status:'cancelled'},{ok:false,status:'cancelled',code:'LANGUAGE_NOT_SUPPORTED'}])test('no invented diagnosis for '+JSON.stringify(answer),async()=>{
 const f=fixture();f.run();await f.settle(answer);assert.equal(f.offer(),undefined);assert.equal(f.node('sirenHelpDiagnostics'),undefined);
});
test('Help is optional and a retry can still complete',async()=>{
 const f=fixture({withHelp:false});f.run();await f.settle({ok:false,code:'ANALYSIS_BUSY'});assert.match(f.node('analysisStatus').textContent,/unavailable/);f.run();const r=f.jobs[1].request;await f.settle({ok:true,status:'complete',sourceId:r.sourceId,version:r.version,jobId:r.jobId,coverage:{from:0,to:100,totalUnits:100},result:{definitions:[]}});assert.equal(f.node('codeAnalysis').dataset.analysisState,'complete');assert.equal(f.offer(),undefined);
});
