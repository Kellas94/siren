import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {buildDiagramEngine} from './diagram.mjs';
import {buildDiagramStyle} from './diagram-style.mjs';
import {sanitizeDiagramEmbedSvg} from '../src/documents/diagram-embed-svg.mjs';
export async function buildDiagramVector({outputDir}){
 const baselinePath=new URL('../baseline/R78.html',import.meta.url),engine=await buildDiagramEngine({baselinePath:fileURLToPath(baselinePath),outputDirectory:join(outputDir,'.diagram-vector-build')}),styling=await buildDiagramStyle({baselinePath});
 const scripts=[await readFile(engine.bundlePath,'utf8'),styling.script+'\nwindow.SirenDiagramEmbedSvg=Object.freeze({sanitizeDiagramEmbedSvg:('+sanitizeDiagramEmbedSvg.toString()+')});\n'+await readFile(new URL('../src/ui/diagram/vector.js',import.meta.url),'utf8')];
 for(const code of scripts){if(/<\/script/i.test(code))throw Error('Vector script tag refused');new Script(code);}
 const hashes=scripts.map(code=>"'sha256-"+createHash('sha256').update(code).digest('base64')+"'");
 const html='<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src '+hashes.join(' ')+'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'; object-src \'none\';"><style>body{margin:0}#renderHost{width:1200px}#renderHost svg{max-width:none!important}</style></head><body><div id="renderHost"></div>'+scripts.map(code=>'<script>'+code+'</script>').join('')+'</body></html>';
 await mkdir(outputDir,{recursive:true});const entryPath=join(outputDir,'diagram-vector.html');await writeFile(entryPath,html);return Object.freeze({entryPath,entrySha256:createHash('sha256').update(html).digest('hex'),engine,embedSupported:true});
}
