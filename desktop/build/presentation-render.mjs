import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {buildDiagramEngine} from './diagram.mjs';
import {buildDiagramStyle} from './diagram-style.mjs';
export async function buildPresentationRender({outputDir}){
 const engine=await buildDiagramEngine({baselinePath:fileURLToPath(new URL('../baseline/R78.html',import.meta.url)),outputDirectory:join(outputDir,'.presentation-build')});
 const styling=await buildDiagramStyle({baselinePath:new URL('../baseline/R78.html',import.meta.url)});
 const scripts=[await readFile(engine.bundlePath,'utf8'),styling.script+'\n'+await readFile(new URL('../src/ui/diagram/vector.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('../src/ui/presentation/cards.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('../src/ui/presentation/render.js',import.meta.url),'utf8')];
 for(const code of scripts){if(/<\/script/i.test(code))throw Error('Presentation script tag refused');new Script(code);}
 const hashes=scripts.map(code=>"'sha256-"+createHash('sha256').update(code).digest('base64')+"'");
 const html='<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src '+hashes.join(' ')+'; style-src \'unsafe-inline\'; img-src blob: data:; base-uri \'none\'; form-action \'none\'; object-src \'none\';"><style>body{margin:0}#renderHost{width:1600px;height:900px}#renderHost svg{max-width:none!important}</style></head><body><div id="renderHost"></div>'+scripts.map(code=>'<script>'+code+'</script>').join('')+'</body></html>';
 await mkdir(outputDir,{recursive:true});const entryPath=join(outputDir,'presentation-render.html');await writeFile(entryPath,html);
 return Object.freeze({entryPath,entrySha256:createHash('sha256').update(html).digest('hex'),engine});
}
