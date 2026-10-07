import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {readHelpBrowser} from '../build/help.mjs';
class Element{
 constructor(tag,document){this.tagName=tag;this.document=document;this.children=[];this.listeners=new Map();this.attributes={};this.dataset={};this.open=false;this.value='';this.isConnected=false;this._text='';}
 set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set innerHTML(_){throw Error('HTML must not be used');}
 get isConnected(){return this.parent?this.parent.isConnected:this._connected===true;}set isConnected(value){this._connected=value;}
 append(...nodes){for(const n of nodes){n.parent=this;n.isConnected=this.isConnected;this.children.push(n);}}
 replaceChildren(...nodes){for(const n of this.children)n.remove();this.children=[];this._text='';this.append(...nodes);}
 remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
 setAttribute(name,value){this.attributes[name]=String(value);}getAttribute(name){return this.attributes[name];}
 addEventListener(type,callback){const list=this.listeners.get(type)||[];list.push(callback);this.listeners.set(type,list);}
 removeEventListener(type,callback){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x!==callback));}
 dispatch(type,extra={}){const event={preventDefault(){this.prevented=true;},...extra};for(const cb of this.listeners.get(type)||[])cb(event);return event;}
 focus(){this.document.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;this.dispatch('close');}
}
async function fixture(){
 const document={createElement(tag){return new Element(tag,this);},getElementById(id){let found;const walk=n=>{if(n.id===id)found=n;for(const child of n.children)walk(child);};walk(this.body);return found;}};document.body=new Element('body',document);document.body.isConnected=true;
 const context={window:{},document,console};runInNewContext(await readHelpBrowser(),context);runInNewContext(await readFile('src/ui/shared/help.js','utf8'),context);
 let available=true;const view=context.window.SirenHelp.create({document,isAvailable:()=>available});return {document,view,deny:()=>available=false,context};
}
test('manual uses real catalog search, scoped diagnosis and local category filtering',async()=>{
 const {document,view}=await fixture();assert.equal(view.open(),true);const search=document.getElementById('sirenHelpQuery');search.value='SOURCE_BUDGET';search.dispatch('input');
 assert.match(document.getElementById('sirenHelpResults').textContent,/Source import/);assert.doesNotMatch(document.getElementById('sirenHelpResults').textContent,/PIN access/);
 document.getElementById('sirenHelpResults').children[0].dispatch('click');assert.match(document.getElementById('sirenHelpArticle').textContent,/32 MiB/);
 const category=document.getElementById('sirenHelpCategory');category.value='pin';category.dispatch('change');assert.match(document.getElementById('sirenHelpResults').textContent,/No matching/);
});
test('flow has finite interactive decisions, a text alternative and reset',async()=>{
 const {document,view}=await fixture();view.open({articleId:'project-save'});assert.match(document.getElementById('sirenHelpFlowText').textContent,/Keep this draft/);
 const current=()=>document.getElementById('sirenHelpFlowCurrent'),choices=()=>document.getElementById('sirenHelpFlowChoices');assert.match(current().textContent,/Keep this draft/);
 choices().children[0].dispatch('click');assert.match(current().textContent,/latest saved version/);
 choices().children.find(c=>c.textContent==='Not yet').dispatch('click');assert.match(current().textContent,/Keep both/);
 document.getElementById('sirenHelpFlowReset').dispatch('click');assert.match(current().textContent,/Keep this draft/);
});
test('Escape closes, clears diagnosis and restores initiator focus; dispose cannot reopen',async()=>{
 const {document,view}=await fixture(),initiator=document.createElement('button');document.body.append(initiator);initiator.focus();view.open({articleId:'source-import',initiator});
 document.getElementById('sirenHelpDiagnostics').dispatch('keydown',{key:'Escape'});assert.equal(document.getElementById('sirenHelpDiagnostics'),undefined);assert.equal(document.activeElement,initiator);
 assert.equal(view.open(),true);assert.doesNotMatch(document.getElementById('sirenHelpContext').textContent,/sources|SOURCE_BUDGET/);view.dispose();assert.equal(view.open(),false);
});
test('unavailable or retired context cannot reveal a panel or accept arbitrary metadata',async()=>{
 const {document,view,deny,context}=await fixture();const identity=runInNewContext('({namespace:"appearance",operation:"choose",code:"ACCESS_REFUSED"})',context);
 view.open({errorIdentity:identity,source:'<img onerror=run()>',path:'C:/private'});
 assert.match(document.getElementById('sirenHelpContext').textContent,/reported general operation/);
 assert.doesNotMatch(document.body.textContent,/C:\/private|onerror=run/);deny();view.close();assert.equal(view.open(),false);assert.equal(document.getElementById('sirenHelpDiagnostics'),undefined);
});
test('callbacks retained from a retired dialog cannot change a newly opened article',async()=>{
 const {document,view}=await fixture();view.open();const expected=document.getElementById('sirenHelpArticle').textContent,retired=document.getElementById('sirenHelpResults').children.find(b=>b.textContent==='Source import limits and encoding');
 view.close();view.open();retired.dispatch('click');assert.equal(document.getElementById('sirenHelpArticle').textContent,expected);
});
test('opening the manual without an error welcomes browsing instead of diagnosing an unknown failure',async()=>{
 const {document,view}=await fixture();view.open();assert.match(document.getElementById('sirenHelpArticle').textContent,/choose a topic/i);assert.doesNotMatch(document.getElementById('sirenHelpArticle').textContent,/cannot identify the exact cause/);
});
test('Escape is consumed so a containing Presenter does not also leave fullscreen',async()=>{
 const {document,view}=await fixture();view.open();let stopped=false;document.getElementById('sirenHelpDiagnostics').dispatch('keydown',{key:'Escape',stopPropagation(){stopped=true;}});assert.equal(stopped,true);
});
async function workspaceFixture(){
 const f=await fixture();f.document.documentElement={style:{},dataset:{}};const bar=f.document.createElement('nav');bar.id='sirenAppNavigation';bar.hidden=false;f.document.body.append(bar);
 let nativeHelp,resume,pagehide;f.context.window.sirenShell={onHelp:cb=>{nativeHelp=cb;return()=>nativeHelp=null;}};f.context.window.sirenViewControl={onResume:cb=>{resume=cb;return()=>resume=null;}};
 f.context.window.addEventListener=(type,cb)=>{if(type==='pagehide')pagehide=cb;};
 runInNewContext(await readFile('src/ui/shared/help-workspace.js','utf8'),f.context);
 return {...f,api:f.context.window.SirenHelpWorkspace,bar,help:()=>nativeHelp?.(),resume:()=>resume?.(),retire:()=>pagehide?.()};
}
test('shared manual closes synchronously on cover and cannot reopen before native resume',async()=>{
 const f=await workspaceFixture();f.help();assert.equal(f.document.getElementById('sirenHelpDiagnostics').open,true);f.api.cover();assert.equal(f.document.getElementById('sirenHelpDiagnostics'),undefined);assert.equal(f.api.open(),false);
 f.resume();assert.equal(f.api.open(),true);f.api.close();f.bar.hidden=true;assert.equal(f.api.open(),false);f.retire();f.bar.hidden=false;assert.equal(f.api.open(),false);
});
test('contextual error and static render help are finite, inert and retired on Lock',async()=>{
 const f=await workspaceFixture(),host=f.document.createElement('p');f.document.body.append(host);const identity=runInNewContext('({namespace:"sources",operation:"import",code:"SOURCE_BUDGET"})',f.context);
 f.api.explain(host,identity);host.children[0].dispatch('click');assert.match(f.document.getElementById('sirenHelpArticle').textContent,/32 MiB/);f.api.close();
 f.api.article(host,'diagram-render');const old=host.children[0];old.dispatch('click');assert.match(f.document.getElementById('sirenHelpArticle').textContent,/preview did not render/);f.api.cover();old.dispatch('click');assert.equal(f.document.getElementById('sirenHelpDiagnostics'),undefined);
 f.resume();f.api.article(host,'missing');assert.equal(host.children.length,0);
});
test('cover and resume retire earlier error controls and refuse results captured before the transition',async()=>{
 const f=await workspaceFixture(),host=f.document.createElement('p');f.document.body.append(host);
 const identity=runInNewContext('({namespace:"sources",operation:"import",code:"SOURCE_BUDGET"})',f.context);
 f.api.explain(host,identity);const old=host.children[0],captured=f.api.capture?.();f.api.cover();f.resume();
 assert.equal(old.isConnected,false);old.dispatch('click');assert.equal(f.document.getElementById('sirenHelpDiagnostics'),undefined);
 f.api.explain(host,identity,captured);assert.equal(host.children.length,0);
 f.api.explain(host,identity,f.api.capture());assert.equal(host.children.length,1);f.api.dispose();assert.equal(host.children.length,0);
});
test('delayed events from a closed dialog cannot close its replacement',async()=>{
 const f=await fixture();f.view.open();const old=f.document.getElementById('sirenHelpDiagnostics'),queued=[];old.close=()=>{old.open=false;queued.push(()=>old.dispatch('close'));};
 f.view.close();f.view.open({articleId:'source-import'});const replacement=f.document.getElementById('sirenHelpDiagnostics');
 for(const event of ['cancel','keydown']){old.dispatch(event,{key:'Escape'});assert.equal(replacement.open,true);assert.equal(f.document.getElementById('sirenHelpDiagnostics'),replacement);}
 queued.forEach(cb=>cb());assert.equal(replacement.open,true);assert.equal(f.document.getElementById('sirenHelpDiagnostics'),replacement);
});
test('unknown structured error keeps only its bounded code visible without guessing a cause',async()=>{
 const f=await workspaceFixture(),host=f.document.createElement('p');f.document.body.append(host);
 f.api.explain(host,runInNewContext('({namespace:"sources",operation:"import",code:"FUTURE_IMPORT_CODE"})',f.context));host.children[0].dispatch('click');
 assert.match(f.document.getElementById('sirenHelpContext').textContent,/FUTURE_IMPORT_CODE/);assert.match(f.document.getElementById('sirenHelpArticle').textContent,/cannot identify the exact cause/);
 f.api.close();f.api.explain(host,runInNewContext('({namespace:"sources",operation:"import",code:"<script>"})',f.context));host.children[0].dispatch('click');assert.doesNotMatch(f.document.body.textContent,/<script>/);
});
test('the actual Docs save callback cannot offer a diagnosis after native cover and resume',async()=>{
 const f=await workspaceFixture();f.context.status=f.document.createElement('p');f.document.body.append(f.context.status);
 const line=(await readFile('src/ui/windows/docs.js','utf8')).split('\n').find(l=>l.trim().startsWith('const saveCurrent=async()=>'));
 assert.ok(line);runInNewContext('var paused=false,disposed=false,readonly=false;var release;var saved=new Promise(resolve=>release=resolve);var draft={save:()=>saved};function refreshActivitySaved(){}function updateState(){};'+line+';window.fixtureSave=saveCurrent;',f.context);
 const pending=f.context.window.fixtureSave();f.api.cover();f.resume();runInNewContext('release({ok:false,code:"DOCUMENT_CONFLICT"})',f.context);await pending;
 assert.equal(f.context.status.children.length,0);assert.equal(f.document.body.dataset.documentSaveError,undefined);assert.equal(f.document.getElementById('sirenHelpDiagnostics'),undefined);
});

test('actual Home backup cancellation stays neutral with shared Help installed; real failures still explain',async()=>{
 const f=await workspaceFixture(),window=f.context.window;window.sirenDesktopBootstrap={mode:'locked'};f.document.readyState='complete';
 runInNewContext(await readFile('src/ui/workspace/guide.js','utf8')+'\n'+await readFile('src/ui/workspace/home.js','utf8'),f.context);
 const note=f.document.createElement('p');f.document.body.append(note);let command,result,busy;
 const container={querySelector:()=>note,querySelectorAll:()=>note.children,setAttribute:(name,value)=>{if(name==='aria-busy')busy=value;},replaceChildren(){}};
 const view=window.renderSirenHome({container,bootstrap:{mode:'normal'},desktop:{onCommand:callback=>{command=callback;return()=>{};}},bridge:{exportSavedBackup:async()=>result}});
 const exportResult=async value=>{result=value;command('desktopExportProject');await new Promise(resolve=>setImmediate(resolve));assert.equal(busy,'false');};
 await exportResult({ok:false,code:'BACKUP_BUDGET'});assert.equal(note.children.length,1);assert.equal(note.children[0].textContent,'Explain error');
 note.children[0].dispatch('click');assert.match(f.document.getElementById('sirenHelpArticle').textContent,/64 MiB/);f.api.close();
 await exportResult({ok:false,code:'CANCELLED'});assert.equal(note.textContent,'Backup export cancelled.');assert.equal(note.children.length,0);
 await exportResult({ok:false,code:'BACKUP_WRITE_FAILED'});assert.equal(note.children.length,1);note.children[0].dispatch('click');assert.match(f.document.getElementById('sirenHelpArticle').textContent,/inspect the selected destination/);f.api.close();
 await exportResult({ok:true,revision:17});assert.equal(note.children.length,0);assert.equal(note.textContent,'Saved backup exported · revision 17. Unsaved working copies remain in their windows.');view.dispose();
});
test('repeated open is a single dialog with an unknown-identity explanation',async()=>{
 const {document,view}=await fixture();for(let i=0;i<5;i++)view.open({errorIdentity:{code:'<script>'}});
 assert.equal(document.body.children.filter(c=>c.id==='sirenHelpDiagnostics').length,1);assert.match(document.getElementById('sirenHelpArticle').textContent,/cannot identify the exact cause/);
 view.close();view.close();assert.equal(document.body.children.length,0);
});
