import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {transform} from 'esbuild';
import {parse} from 'parse5';
import {THEME_IDS} from '../src/appearance/contracts.mjs';
const fields=['app-bg','panel-bg','panel-alt','input-bg','text','muted','border','primary','primary-text','focus-ring'];
/** Keep the frozen Studio's theme lifecycle; the native preference owns persistence. */
export function patchClassicAppearance(html){
 const marker='      function applyTheme(themeName, shouldRender) {';
 if(html.split(marker).length!==2)throw Error('Classic theme lifecycle marker mismatch');
 const start=html.indexOf(marker),end=html.indexOf('\n      function ',start+marker.length);
 if(end<0)throw Error('Classic theme lifecycle boundary missing');
 const body=html.slice(start,end),save='        scheduleSave();',changed='        state.theme = themeName;';
 for(const token of [save,changed])if(body.split(token).length!==2)throw Error('Classic theme preference marker mismatch');
 const bridge=`      let sirenNativeAppearanceId=null;\n      window.sirenClassicAppearance=Object.freeze({current:()=>document.body.dataset.theme,apply:id=>{if(!${JSON.stringify(THEME_IDS)}.includes(id))return false;sirenNativeAppearanceId=id;if(state.theme!==id||document.body.dataset.theme!==id)applyTheme(id,true);return true;}});\n`;
 const patched=body.replace(marker,'      function applyTheme(themeName, shouldRender, desktopUser=false) {\n        if(window.sirenShell && sirenNativeAppearanceId && !desktopUser) themeName=sirenNativeAppearanceId;').replace(save,'        if(!window.sirenShell) scheduleSave();').replace(changed,changed+'\n        document.dispatchEvent(new CustomEvent("siren-classic-appearance",{detail:{theme:themeName,user:desktopUser}}));');
 return html.slice(0,start)+bridge+patched+html.slice(end);
}
export async function readAppearancePalette(){
 const tree=parse(await readFile(new URL('../baseline/R78.html',import.meta.url),'utf8')),nodes=[];
 const walk=n=>{nodes.push(n);for(const child of n.childNodes??[])walk(child);};walk(tree);
 const css=nodes.filter(n=>n.tagName==='style').map(n=>n.childNodes.map(c=>c.value??'').join('')).join('\n');
 const labels=new Map();for(const node of nodes.filter(n=>n.tagName==='option')){const id=node.attrs.find(a=>a.name==='value')?.value;if(THEME_IDS.includes(id))labels.set(id,node.childNodes.map(c=>c.value??'').join('').trim());}
 const root=css.match(/:root\s*\{([^}]+)\}/)?.[1];if(!root)throw Error('Original palette root missing');
 const declarations=block=>Object.fromEntries([...block.matchAll(/(--[a-z-]+|color-scheme)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
 const defaults=declarations(root);
 return THEME_IDS.map(id=>{
  const block=id==='dark'?root:css.match(new RegExp('\\[data-theme="'+id+'"\\]\\s*\\{([^}]+)\\}'))?.[1];if(!block||!labels.has(id))throw Error('Original named palette missing: '+id);
  const values={...defaults,...declarations(block)},colors=Object.fromEntries(fields.map(key=>[key,values['--'+key]]));
  if(Object.values(colors).some(value=>typeof value!=='string'||! /^(?:#[\da-f]{3,8}|rgba?\([\d.,%\s]+\))$/i.test(value)))throw Error('Non-colour palette field refused: '+id);
  return {id,name:labels.get(id),mode:values['color-scheme']==='light'?'light':'dark',colors};
 });
}
export async function readDesktopShell(){
 const source=(await Promise.all(['workspace/guide.js','shared/appearance-sync.js','shared/search.js','shared/shell.js'].map(path=>readFile(new URL('../src/ui/'+path,import.meta.url),'utf8')))).join('\n');
 const colors=[],index=value=>{let i=colors.indexOf(value);if(i<0){i=colors.length;colors.push(value);}return i;};
 const themes=(await readAppearancePalette()).map(t=>[t.id,t.name,t.mode,...fields.map(key=>index(t.colors[key]))]);
 return 'window.SirenAppearancePalette=(()=>{const c='+JSON.stringify(colors)+';return '+JSON.stringify(themes)+'.map(([id,name,mode,...v])=>({id,name,mode,colors:Object.fromEntries('+JSON.stringify(fields)+'.map((k,i)=>[k,c[v[i]]]))}));})();\n'+source;
}
/** Two exact local resources, with SRI and exact CSP paths; no general asset API. */
export async function addDesktopShell(html,outputDir){
 const script=(await transform(await readDesktopShell(),{minify:true,target:'es2022',charset:'utf8',legalComments:'none'})).code;
 const css=(await transform(await readFile(new URL('../src/ui/shared/shell.css',import.meta.url),'utf8'),{loader:'css',minify:true,legalComments:'none'})).code;
 if(/<\/script/i.test(script)||/<\/style|@import|url\s*\(/i.test(css))throw Error('Shared shell boundary refused');
 const assets=join(outputDir,'assets');await mkdir(assets,{recursive:true});await writeFile(join(assets,'shell.js'),script);await writeFile(join(assets,'shell.css'),css);
 const integrity=value=>'sha384-'+createHash('sha384').update(value).digest('base64');
 let output=html.replace(/script-src ([^;]+);/,"script-src $1 siren://app/assets/shell.js;").replace(/style-src ([^;]+);/,"style-src $1 siren://app/assets/shell.css;");
 const tree=parse(output,{sourceCodeLocationInfo:true}),element=tree.childNodes.find(n=>n.tagName==='html'),head=element?.childNodes.find(n=>n.tagName==='head'),body=element?.childNodes.find(n=>n.tagName==='body');
 const headEnd=head?.sourceCodeLocation?.endTag?.startOffset,bodyEnd=body?.sourceCodeLocation?.endTag?.startOffset;
 if(!Number.isSafeInteger(headEnd)||!Number.isSafeInteger(bodyEnd)||bodyEnd<=headEnd)throw Error('Shared shell document boundary missing');
 const stylesheet=`<link rel="stylesheet" href="siren://app/assets/shell.css" integrity="${integrity(css)}" crossorigin="anonymous">`;
 output=output.slice(0,headEnd)+stylesheet+output.slice(headEnd);
 const end=bodyEnd+stylesheet.length;
 return output.slice(0,end)+`<script src="siren://app/assets/shell.js" integrity="${integrity(script)}" crossorigin="anonymous"></script>`+output.slice(end);
}
