import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {inspectDiagramSelection} from '../src/documents/diagram-selection.mjs';
const baselineHash='5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4';
const names=['mermaidFrontmatterEnd','mermaidSourceLinesForScan','mermaidSourceDeclaration','parseStructureRows','structureDecodeLabel','structureEncodeLabel','structureBlockLine','structureLinkLine','parseStructureChain','normaliseInlineEdgeLabel','makeShapeToken','parseSubgraphHeader','parseNodeShape','decodeLabel','cleanVisualText','encodeVisualMermaidText'];
/** Freeze only the existing, selected-line Guided grammar helpers. No startup,
 * app state, project storage, shared window chrome or rendering engine code. */
export async function buildDiagramGuided({baselinePath}={}){
 const bytes=await readFile(baselinePath);if(bytes.length>32*1024*1024||createHash('sha256').update(bytes).digest('hex')!==baselineHash)throw Error('GUIDED_BASELINE_REFUSED');
 const source=bytes.toString('utf8').replaceAll('\r\n','\n');
 const functions=names.map(name=>{const token='      function '+name+'(';const start=source.indexOf(token);if(start<0||source.indexOf(token,start+1)>=0)throw Error('GUIDED_HELPER_REFUSED');const stop=source.indexOf('\n      }',start);if(stop<0)throw Error('GUIDED_HELPER_REFUSED');return source.slice(start,stop+8);});
 const start=source.indexOf('      const STRUCT_SHAPE_PATTERN ='),stop=source.indexOf('      let structureCommitTimer',start);if(start<0||stop<start)throw Error('GUIDED_CONSTANTS_REFUSED');
 const adapter=await readFile(new URL('../src/ui/diagram/guided-model.js',import.meta.url),'utf8');
 const buildAdapter=await readFile(new URL('../src/ui/diagram/build-model.js',import.meta.url),'utf8');
 const script='(() => {\n"use strict";\n'+inspectDiagramSelection.toString()+'\n'+source.slice(start,stop)+'\n'+functions.join('\n')+'\n'+adapter+'\n'+buildAdapter+'\n})();';
 if(/<\/script/i.test(script))throw Error('GUIDED_SCRIPT_REFUSED');new Script(script);
 return Object.freeze({script,sha256:createHash('sha256').update(script).digest('hex'),baselineSha256:baselineHash});
}
