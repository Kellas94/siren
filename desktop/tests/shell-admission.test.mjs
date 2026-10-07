import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('private navigation is never shown before native admission or on its refusal',async()=>{
 const nodes=[];
 class Node {constructor(){this.hidden=false;this.dataset={};this.style={setProperty(){}};this.classList={add(){}};nodes.push(this)}append(...children){this.children??=[];this.children.push(...children)}insertBefore(child){this.append(child)}setAttribute(){}addEventListener(){}}
 const body=new Node(),root=new Node();body.dataset.role='home';
 const document={body,documentElement:root,readyState:'complete',createElement:()=>new Node(),addEventListener(){},dispatchEvent(){},getElementById:id=>nodes.find(n=>n.id===id)};
 let release;const window={sirenShell:{getAppearance:()=>new Promise(r=>release=r),setAppearance:async()=>({ok:false}),navigate:async()=>({ok:false})},SirenAppearancePalette:[{id:'dark',name:'Dark',mode:'dark',colors:{}}],addEventListener(){}};
 const context={window,document,location:{pathname:'/home.html'},matchMedia:()=>({matches:true,addEventListener(){}}),setInterval:()=>1,clearInterval(){},CustomEvent:class{constructor(type,options){this.detail=options.detail}}};
 runInNewContext(await readFile(new URL('../src/ui/shared/appearance-sync.js',import.meta.url),'utf8'),context);
 runInNewContext(await readFile(new URL('../src/ui/shared/shell.js',import.meta.url),'utf8'),context);
 const navigation=document.getElementById('sirenAppNavigation');assert.ok(navigation);assert.equal(navigation.hidden,true);
 release({ok:false,code:'ACCESS_REFUSED'});await new Promise(resolve=>setImmediate(resolve));assert.equal(navigation.hidden,true);
});
test('a genuine Studio theme choice before the shared bar mounts still persists and wins startup',async()=>{
 const nodes=[],listeners={};let saved='system';
 class Node {constructor(){this.hidden=false;this.dataset={};this.style={setProperty(){}};this.classList={add(){}};nodes.push(this)}append(...children){this.children??=[];this.children.push(...children)}insertBefore(child){this.append(child)}setAttribute(){}addEventListener(){}}
 const body=new Node(),root=new Node();body.dataset.role='diagrams';
 const document={body,documentElement:root,readyState:'loading',createElement:()=>new Node(),addEventListener:(name,callback)=>listeners[name]=callback,dispatchEvent(){},getElementById:id=>nodes.find(n=>n.id===id)};
 const window={sirenShell:{getAppearance:async()=>({ok:true,theme:saved}),setAppearance:async value=>{saved=value.theme;return {ok:true,theme:saved}},navigate:async()=>({ok:false})},SirenAppearancePalette:[{id:'dark',name:'Dark',mode:'dark',colors:{}},{id:'light',name:'Light',mode:'light',colors:{}}],addEventListener(){}};
 const context={window,document,location:{pathname:'/app.html'},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval:()=>1,clearInterval(){},CustomEvent:class{constructor(type,options){this.detail=options.detail}}};
 runInNewContext(await readFile(new URL('../src/ui/shared/appearance-sync.js',import.meta.url),'utf8'),context);
 runInNewContext(await readFile(new URL('../src/ui/shared/shell.js',import.meta.url),'utf8'),context);
 await listeners['siren-classic-appearance']({detail:{user:true,theme:'dark'}});assert.equal(saved,'dark');
 listeners.DOMContentLoaded();await new Promise(resolve=>setImmediate(resolve));assert.equal(document.getElementById('sirenAppTheme').value,'dark');assert.equal(body.dataset.theme,'dark');
});
