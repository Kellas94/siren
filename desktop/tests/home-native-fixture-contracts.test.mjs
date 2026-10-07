import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext,createContext,runInContext} from 'node:vm';
import {waitForDesktopStartup} from './native/drive.mjs';
import {waitForNativeCondition} from './native/condition.mjs';

class Element{
 constructor(tag,document){this.tagName=tag.toUpperCase();this.document=document;this.children=[];this.listeners=new Map();this.dataset={};this.attributes={};this._text='';this.className='';}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 setAttribute(name,value){this.attributes[name]=String(value);}
 addEventListener(type,fn){const rows=this.listeners.get(type)||[];rows.push(fn);this.listeners.set(type,rows);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(f=>f!==fn));}
 replaceChildren(){this.children=[];}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 showModal(){this.open=true;}close(){this.open=false;for(const fn of this.listeners.get('close')||[])fn();}
}
function descendants(root){return root?[root,...root.children.flatMap(descendants)]:[];}
async function actualSettings(){
 const document={readyState:'complete',createElement(tag){return new Element(tag,this);},getElementById(id){return descendants(this.body).find(n=>n.id===id);},querySelectorAll(selector){assert.equal(selector,'#homeSettingsPanel .home-project-row');return descendants(this.getElementById('homeSettingsPanel')).filter(n=>n.className.split(' ').includes('home-project-row'));}};
 document.body=new Element('body',document);const container=new Element('section',document);document.body.append(container);
 const window={sirenDesktopBootstrap:{mode:'locked'}};runInNewContext(await readFile('src/ui/workspace/home.js','utf8'),{window,document});
 let command;window.renderSirenHome({container,bootstrap:{mode:'normal'},bridge:{},desktop:{onCommand(fn){command=fn;return()=>{};}}});command('desktopPinSettings');
 return document;
}
async function nativeSettingsOracle(path,document){
 const source=await readFile(path,'utf8'),statement=source.split('\n').find(line=>line.includes('assert.')&&line.includes('#homeSettingsPanel .home-project-row'));
 assert.ok(statement,'Native Settings assertion must exist');
 const context=createContext({assert,document});context.driver={evaluate:async expression=>runInContext(expression,context)};
 await runInContext('(async()=>{'+statement+'})()',context);
}
const expectedRows=[{id:'homePinSettings',label:'Change PIN'},{id:'homeSettingsUpdates',label:'Check for updates'},{id:'homeQuickGuide',label:'Quick guide'},{id:'homeHelpDiagnostics',label:'Help & diagnostics'}];
for(const path of ['tests/native/home-library.mjs','tests/native/home-library-search.mjs']){
 test(path+' accepts actual Settings with all four named actions in order',async()=>{
  const document=await actualSettings();assert.deepEqual(document.querySelectorAll('#homeSettingsPanel .home-project-row').map(n=>({id:n.id,label:n.textContent})),expectedRows);
  await nativeSettingsOracle(path,document);
 });
 test(path+' refuses missing, renamed, reordered and unexpected Settings actions',async()=>{
  for(const mutation of ['missing','rename','reorder','extra']){
   const document=await actualSettings(),panel=document.getElementById('homeSettingsPanel'),rows=document.querySelectorAll('#homeSettingsPanel .home-project-row');
   if(mutation==='missing')rows[3].remove();else if(mutation==='rename')rows[3].textContent='Quick guide';else if(mutation==='reorder'){const a=panel.children.indexOf(rows[2]),b=panel.children.indexOf(rows[3]);[panel.children[a],panel.children[b]]=[panel.children[b],panel.children[a]];}else{const duplicate=new Element('button',document);duplicate.id='unexpected';duplicate.className='home-project-row';duplicate.textContent='Other action';panel.append(duplicate);}
   await assert.rejects(nativeSettingsOracle(path,document),{name:'AssertionError'},mutation);
  }
 });
}
async function recoveryStartup({bodyText='',neverBody=false}={}){
 let time=0,reads=0,invokes=0;const document={readyState:'loading',body:null},window={},location={href:'siren://app/home.html',pathname:'/home.html',search:''};
 const electron={contextBridge:{exposeInMainWorld(name,value){window[name]=value;}},ipcRenderer:{sendSync(){return {mode:'locked',readonly:true,snapshot:null,pin:{configured:false,unlocked:false}};},on(){},once(){},removeListener(){},send(){},invoke(){invokes++;throw Error('Startup privacy must not invoke privileged operation');}}};
 runInNewContext(await readFile('src/preload.cjs','utf8'),{require:()=>electron,window,location,URLSearchParams,console});
 const driver={evaluate:async expression=>{reads++;return runInNewContext(expression,{window,location,document});},waitFor:expression=>waitForNativeCondition(driver.evaluate,expression,{clock:()=>time,delay:async ms=>{time+=ms;if(!neverBody){document.readyState='interactive';document.body={innerText:bodyText};}}})};
 const source=await readFile('tests/native/home-recovery.mjs','utf8'),start=source.indexOf('result.startup=await waitForDesktopStartup('),end=source.indexOf('await unlockDesktop(driver',start);assert.ok(start>=0&&end>start);
 const result={};try{await runInNewContext('(async()=>{'+source.slice(start,end)+'})()',{result,waitForDesktopStartup,driver,assert});}catch(error){error.fixtureTime=time;throw error;}
 return {result,time,reads,invokes,body:document.body};
}
test('recovery privacy waits for actual DOM after real locked preload admission',async()=>{
 const observed=await recoveryStartup();assert.equal(observed.result.startup.readyState,'interactive');assert.equal(observed.result.startup.bootstrap.mode,'locked');assert.equal(observed.result.startup.bootstrap.snapshotPresent,false);assert.ok(observed.body);assert.equal(observed.time,100);assert.equal(observed.invokes,0);
});
test('recovery admission still fails if the admitted body exposes the private project label',async()=>{
 await assert.rejects(recoveryStartup({bodyText:'OWNED_RECOVERY_PRIVATE_LABEL'}),/true !== false/);
});
test('recovery never treats absent body as privacy success or extends the existing deadline',async()=>{
 await assert.rejects(recoveryStartup({neverBody:true}),error=>{assert.match(error.message,/Native PIN startup receipt unavailable/);assert.match(error.cause.message,/UI condition not met/);assert.equal(error.fixtureTime,30000);return true;});
});
