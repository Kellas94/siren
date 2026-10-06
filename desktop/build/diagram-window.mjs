import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {buildDiagramEngine} from './diagram.mjs';
import {buildDiagramGuided} from './diagram-guided.mjs';
import {buildDiagramStyle} from './diagram-style.mjs';
import {readDesktopChrome} from './chrome.mjs';
import {addDesktopShell} from './appearance.mjs';
import {buildPresentationEdits} from './document-context.mjs';
export async function buildDiagramWindow({outputDir}){
 const engine=await buildDiagramEngine({baselinePath:fileURLToPath(new URL('../baseline/R78.html',import.meta.url)),outputDirectory:join(outputDir,'.diagram-build')});
 const guided=await buildDiagramGuided({baselinePath:new URL('../baseline/R78.html',import.meta.url)});
 const styling=await buildDiagramStyle({baselinePath:new URL('../baseline/R78.html',import.meta.url)});
 const presentationScript=await buildPresentationEdits()+'\n'+await readFile(new URL('../src/ui/diagram/presentation-view.js',import.meta.url),'utf8');
 const scripts=[await readFile(engine.bundlePath,'utf8'),(await readFile(new URL('../src/ui/windows/identity.js',import.meta.url),'utf8'))+'\n'+guided.script+'\n'+styling.script+'\n'+(await readFile(new URL('../src/ui/diagram/guided-view.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../src/ui/diagram/session.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../src/ui/diagram/draft.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../src/ui/diagram/style-view.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../src/ui/diagram/build-view.js',import.meta.url),'utf8'))+'\n'+presentationScript+'\n'+(await readFile(new URL('../src/ui/windows/diagram.js',import.meta.url),'utf8'))];
 // Own placement must be available before the controller starts its source read.
 scripts.splice(1,0,await readFile(new URL('../src/ui/windows/diagram-transfer.js',import.meta.url),'utf8'));
 for(const code of scripts){if(/<\/script/i.test(code))throw Error('Diagram script tag refused');new Script(code);}
 const hashes=scripts.map(code=>"'sha256-"+createHash('sha256').update(code).digest('base64')+"'");
 let template=await readFile(new URL('../src/ui/diagram/window.html',import.meta.url),'utf8');
 const label='<label id="diagramSourceLabel"',textarea='</textarea></section>',style='</style>';
 for(const marker of [label,textarea,style])if(template.split(marker).length!==2)throw Error('GUIDED_WINDOW_MARKER_REFUSED');
 template=template.replace(label,'<div class="diagram-editor-modes" aria-label="Mermaid editor"><button id="diagramTextMode" aria-pressed="true">Text</button><button id="diagramGuidedMode" aria-pressed="false">Guided</button></div>'+label).replace(textarea,'</textarea><div id="diagramGuided" hidden aria-label="Guided Mermaid lines"></div></section>').replace(style,(await readFile(new URL('../src/ui/diagram/guided.css',import.meta.url),'utf8'))+style);
 template=template.replace('</style>',(await readDesktopChrome())+'</style>');
 const html=template.replace('__DIAGRAM_CSP__',"default-src 'none'; script-src "+hashes.join(' ')+"; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none';").replace('__DIAGRAM_SCRIPTS__',()=>scripts.map(code=>'<script>'+code+'</script>').join(''));
 const output=await addDesktopShell(html,outputDir);
 await mkdir(join(outputDir,'windows'),{recursive:true});await writeFile(join(outputDir,'windows','diagram.html'),output);
 return Object.freeze({sha256:createHash('sha256').update(output).digest('hex'),engine});
}
