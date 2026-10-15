// Actual Help/catalog/resolver/workspace in the SAME VM realm as actual Docs UI.
// Only DOM, subscriber transport and document API are inert finite fixtures.
import {readFile} from 'node:fs/promises';
import {runInContext} from 'node:vm';
import {fixture,block,tick} from './terminal-docs-contextual-docs.mjs';
const root=new URL('../../../',import.meta.url),paths=['desktop/src/help/catalog.mjs','desktop/src/help/resolve.mjs','desktop/src/ui/shared/help.js','desktop/src/ui/shared/help-workspace.js'];
const [catalog,resolver,help,workspace]=await Promise.all(paths.map(p=>readFile(new URL(p,root),'utf8')));
export function docsHelp(){
 const f=fixture(),calls=[],events=new Map();
 f.document.body.dataset.role='docs';f.document.body.inert=false;
 f.document.documentElement=new f.Node('html');f.document.documentElement.dataset.desktopLocked='false';
 f.document.getElementById=id=>f.nodes.find(n=>n.id===id&&n.isConnected);
 const navigation=new f.Node('nav');navigation.id='sirenAppNavigation';navigation.hidden=false;f.document.body.append(navigation);
 f.window.sirenShell={onHelp:()=>()=>{}};f.window.addEventListener=(name,callback)=>events.set(name,callback);
 runInContext(catalog.replace(/^export /gm,'')+'\nwindow.SirenHelpCatalog=HELP_ARTICLES;',f.realm,{timeout:1000});
 runInContext(resolver.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')+'\nwindow.SirenHelpResolver=createHelpResolver(window.SirenHelpCatalog);',f.realm,{timeout:1000});
 runInContext(help+'\n'+workspace,f.realm,{timeout:1000});
 const actual=f.window.SirenHelpWorkspace;
 f.window.SirenHelpWorkspace=Object.freeze({...actual,explain(host,identity,context){calls.push({host,identity:identity?JSON.parse(JSON.stringify(identity)):null,context});return actual.explain(host,identity,context);}});
 const render=()=>{const card=f.view.render(block());f.document.body.append(card);return card;};
 const offers=()=>f.nodes.filter(n=>n.className==='siren-help-error'&&n.isConnected);
 const diagnostic=()=>calls.filter(c=>c.identity);
 const finish=async()=>{f.view.dispose();actual.dispose();await f.view.drain();};
 return {...f,callsHelp:calls,diagnostic,offers,render,actual,finish};
}
export {block,tick};
