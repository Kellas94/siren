import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
// Same pure typed contract in main and its isolated document validator. This
// exposes validation only, never the private publication factory or asset I/O.
export async function buildDiagramEmbedContract(){
 const source=(await readFile(new URL('../src/documents/diagram-embeds.mjs',import.meta.url),'utf8')).replace(/^export /gm,'');
 const script='(() => {\n'+source+'\nwindow.SirenDiagramEmbedContract=Object.freeze({normalizeDiagramEmbed,validateDiagramEmbedDocument,validateDiagramEmbedWorkspace});\n})();';
 if(/<\/script/i.test(script))throw Error('Diagram embed contract closing tag refused');new Script(script);return script;
}
