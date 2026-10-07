import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {transform} from 'esbuild';

/** Exact owned local resources, matching the shared shell's SRI/CSP policy.
 * Home contains no catalogue literals, render engine or general asset loader. */
export async function addHomeCatalogue(html,outputDir){
 const source=(await Promise.all(['diagram/catalogue-view.js','workspace/home.js'].map(name=>readFile(new URL('../src/ui/'+name,import.meta.url),'utf8')))).join('\n');
 const style=(await Promise.all(['diagram/catalogue.css','diagram/catalogue-integration.css'].map(name=>readFile(new URL('../src/ui/'+name,import.meta.url),'utf8')))).join('\n');
 const script=(await transform(source,{minify:true,target:'es2022',charset:'utf8',legalComments:'none'})).code;
 const css=(await transform(style,{loader:'css',minify:true,target:'es2022',legalComments:'none'})).code;
 if(/<\/script/i.test(script)||/<\/style|@import|url\s*\(/i.test(css)||Buffer.byteLength(script)>64*1024||Buffer.byteLength(css)>16*1024)throw Error('Home catalogue asset refused');
 new Script(script);
 if(html.split('</head>').length!==2||[...html.matchAll(/script-src [^;]+;/g)].length!==1||[...html.matchAll(/style-src [^;]+;/g)].length!==1)throw Error('Home catalogue boundary refused');
 const assets=join(outputDir,'assets');await mkdir(assets,{recursive:true});await writeFile(join(assets,'home-workspace.js'),script);await writeFile(join(assets,'diagram-catalogue.css'),css);
 const integrity=value=>'sha384-'+createHash('sha384').update(value).digest('base64');
 return html.replace(/script-src ([^;]+);/,'script-src $1 siren://app/assets/home-workspace.js;').replace(/style-src ([^;]+);/,'style-src $1 siren://app/assets/diagram-catalogue.css;')
  .replace('</head>',`<link rel="stylesheet" href="siren://app/assets/diagram-catalogue.css" integrity="${integrity(css)}" crossorigin="anonymous"><script src="siren://app/assets/home-workspace.js" integrity="${integrity(script)}" crossorigin="anonymous"></script></head>`);
}
