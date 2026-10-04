import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {buildDiagramEngine} from './diagram.mjs';
export async function buildDiagramWindow({outputDir}){
 const engine=await buildDiagramEngine({baselinePath:fileURLToPath(new URL('../baseline/R78.html',import.meta.url)),outputDirectory:join(outputDir,'.diagram-build')});
 const scripts=[await readFile(engine.bundlePath,'utf8'),(await readFile(new URL('../src/ui/diagram/session.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../src/ui/diagram/draft.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../src/ui/windows/diagram.js',import.meta.url),'utf8'))];
 for(const code of scripts){if(/<\/script/i.test(code))throw Error('Diagram script tag refused');new Script(code);}
 const hashes=scripts.map(code=>"'sha256-"+createHash('sha256').update(code).digest('base64')+"'");
 const template=await readFile(new URL('../src/ui/diagram/window.html',import.meta.url),'utf8');
 const html=template.replace('__DIAGRAM_CSP__',"default-src 'none'; script-src "+hashes.join(' ')+"; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none';").replace('__DIAGRAM_SCRIPTS__',()=>scripts.map(code=>'<script>'+code+'</script>').join(''));
 await mkdir(join(outputDir,'windows'),{recursive:true});await writeFile(join(outputDir,'windows','diagram.html'),html);
 return Object.freeze({sha256:createHash('sha256').update(html).digest('hex'),engine});
}
