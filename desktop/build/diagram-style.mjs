import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
const baselineHash='5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4';
/** Freeze the existing Mermaid-owned colour provenance and font/style rules.
 * No application startup, project storage or full SVG inspector closure. */
export async function buildDiagramStyle({baselinePath}={}){
 const bytes=await readFile(baselinePath);if(bytes.length>32*1024*1024||createHash('sha256').update(bytes).digest('hex')!==baselineHash)throw Error('DIAGRAM_STYLE_BASELINE_REFUSED');
 const source=bytes.toString('utf8').replaceAll('\r\n','\n');
 const names=['configureMermaidSource','normalizeFontFamily','normalizeFontWeight','fontStack','normalizeHexColor','sanitizeNodeStyles'];
 const functions=names.map(name=>{const token='      '+(name==='configureMermaidSource'?'async ':'')+'function '+name+'(';const start=source.indexOf(token);if(start<0||source.indexOf(token,start+1)>=0)throw Error('DIAGRAM_STYLE_HELPER_REFUSED');const stop=source.indexOf('\n      }',start);if(stop<0)throw Error('DIAGRAM_STYLE_HELPER_REFUSED');return source.slice(start,stop+8);});
 const constants=['ALLOWED_FONTS','ALLOWED_WEIGHTS'].map(name=>{const token='      const '+name+' =';const start=source.indexOf(token),stop=source.indexOf('\n',start);if(start<0||stop<0||source.indexOf(token,start+1)>=0)throw Error('DIAGRAM_STYLE_CONSTANT_REFUSED');return source.slice(start,stop);});
 // Carry Mermaid's real semantic DOM identity alongside its colour flags.
 // Strict rendering prefixes these IDs with the root render ID; never infer
 // a block from a substring that could alias another user's node name.
 const marker='nodes.set(String(id), flags(styles));';if(functions[0].split(marker).length!==2)throw Error('DIAGRAM_STYLE_IDENTITY_REFUSED');functions[0]=functions[0].replace(marker,String.raw`nodes.set(String(id), {...flags(styles),font:styles.some(style=>/(?:^|[;,])\s*font(?:-family|-size|-weight)?\s*:/i.test(style)),domId:typeof node.domId==="string"?node.domId:null});`);
 const adapter=await readFile(new URL('../src/ui/diagram/style.js',import.meta.url),'utf8');
 const script='(() => {\n"use strict";\nconst sourceAppearance=new Map(),clamp=(value,min,max)=>Math.max(min,Math.min(max,value));\n'+constants.join('\n')+'\n'+functions.join('\n')+'\n'+adapter+'\n})();';
 if(/<\/script/i.test(script))throw Error('DIAGRAM_STYLE_SCRIPT_REFUSED');new Script(script);return Object.freeze({script,sha256:createHash('sha256').update(script).digest('hex'),baselineSha256:baselineHash});
}
