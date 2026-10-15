import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext,Script} from 'node:vm';
import {parse} from 'parse5';

// Execute the real HTML producer with explicitly inert bundler/output adapters.
// No esbuild, native executable, BrowserWindow or installed application is run.
async function produceDocs(ending){
  const builderUrl=new URL('../build/windows.mjs',import.meta.url),outputs=new Map();
  const source=(await readFile(builderUrl,'utf8')).replace(/^import .*;\r?\n/gm,'').replace('export async function','async function').replaceAll('import.meta.url',JSON.stringify(builderUrl.href));
  const context={join,fileURLToPath,createHash,Script,URL,
    readFile:async(path,encoding)=>{
      if(path==='inert-code-bundle')return 'window.inertCodeBundle=true;';
      const text=await readFile(path,encoding);
      return String(path).endsWith('/docs/diagram-embeds.js')?text.replace(/\r\n?|\n/g,ending):text;
    },
    mkdir:async()=>{},writeFile:async(path,text)=>outputs.set(path,text),
    buildCodeEditor:async()=>({bundlePath:'inert-code-bundle'}),
    readDesktopChrome:async()=>'',addDesktopShell:async html=>html,
    buildDocumentActivity:()=> 'window.inertActivity=true;',
    buildDocumentContext:async()=> 'window.inertContext=true;',
    buildDiagramWindow:async()=>({sha256:'inert-diagram'}),
    buildPresentationWindows:async()=>({})};
  const build=runInNewContext(source+'\nbuildWindowEntrypoints;',context);
  await build('inert-output');
  return outputs.get(join('inert-output','windows','docs.html'));
}

for(const [name,ending] of [['LF','\n'],['CRLF','\r\n'],['CR','\r']]){
  test(`Docs CSP admits browser-parsed scripts with ${name} source lines`,async()=>{
    const html=await produceDocs(ending),scripts=[];let policy='';
    const walk=node=>{
      if(node.tagName==='meta'&&node.attrs.some(a=>a.name==='http-equiv'&&a.value==='Content-Security-Policy'))policy=node.attrs.find(a=>a.name==='content').value;
      if(node.tagName==='script')scripts.push(node.childNodes.map(n=>n.value??'').join(''));
      for(const child of node.childNodes??[])walk(child);
    };walk(parse(html));
    assert.equal(scripts.length,2);assert.ok(scripts[0].includes('document-diagram-identity'));
    const scriptPolicy=policy.split(';').find(s=>s.trim().startsWith('script-src'));
    assert.ok(!scriptPolicy.includes('unsafe-inline'));assert.match(policy,/default-src 'none'/);
    for(const script of scripts){new Script(script);assert.ok(scriptPolicy.includes("'sha256-"+createHash('sha256').update(script).digest('base64')+"'"),`${name}: browser-normalized script must match its declared CSP hash`);}
  });
}
