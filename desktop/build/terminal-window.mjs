import {mkdir,readFile,writeFile,cp,lstat,realpath} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,dirname,parse,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {build} from 'esbuild';
import {readHelpBrowser} from './help.mjs';
import {readDesktopChrome} from './chrome.mjs';
import {buildTerminalNativeSourceLayout} from './terminal-native-layout.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const pins=Object.freeze({'@xterm/xterm':'6.0.0','@xterm/addon-fit':'0.11.0','@xterm/addon-search':'0.16.0'});
// Explicit opt-in only. Normal renderer/package builds do not call this.
export async function buildTerminalWindow(outputDir,{dependenciesRoot=null}={}){
 const desktop=fileURLToPath(new URL('../',import.meta.url)),inventory=[],aliases={},notices=[];let css='';
 if(dependenciesRoot){
  for(const [name,version]of Object.entries(pins)){
   const root=join(resolve(dependenciesRoot),'node_modules',name),bytes=await readFile(join(root,'package.json')),p=JSON.parse(bytes);
   if(p.name!==name||p.version!==version||p.license!=='MIT'||Object.keys(p.dependencies??{}).length||Object.keys(p.optionalDependencies??{}).length)throw Error('Exact isolated xterm package required');
   const entry=join(root,name==='@xterm/xterm'?'lib/xterm.js':name==='@xterm/addon-fit'?'lib/addon-fit.js':'lib/addon-search.js'),source=await readFile(entry),license=await readFile(join(root,'LICENSE'));
   notices.push(name+' '+version+'\n'+license.toString('utf8'));aliases[name]=entry;inventory.push({name,version,license:'MIT',packageSha256:hash(bytes),sourceSha256:hash(source),licenseSha256:hash(license)});
  }
  css=await readFile(join(resolve(dependenciesRoot),'node_modules/@xterm/xterm/css/xterm.css'),'utf8');if(/<\/style/i.test(css))throw Error('Terminal CSS closing tag refused');
 }
 const source=fileURLToPath(new URL(dependenciesRoot?'../src/ui/terminal/entry.js':'../src/ui/terminal/satellite.js',import.meta.url));
 const contents=dependenciesRoot?`import ${JSON.stringify(source)};`:`import {createTerminalSatellite} from ${JSON.stringify(source)};const satellite=createTerminalSatellite({container:document.getElementById('terminalWorkspace'),bridge:window.sirenTerminal,windowId:new URL(location.href).searchParams.get('windowId')});window.addEventListener('pagehide',()=>{satellite.dispose();void satellite.drain();},{once:true});void satellite.refresh();`;
 const result=await build({stdin:{contents,resolveDir:desktop,sourcefile:'terminal-candidate-entry.js'},alias:aliases,bundle:true,write:false,format:'iife',platform:'browser',target:'chrome146',legalComments:'inline',metafile:true});
 const help=dependenciesRoot?(await readHelpBrowser())+'\n'+await readFile(new URL('../src/ui/shared/help.js',import.meta.url),'utf8'):'';
 if(dependenciesRoot)css+='\n'+await readDesktopChrome();
 const script=(help+'\n'+result.outputFiles[0].text).replace(/\r\n?/g,'\n');if(/<\/script/i.test(script))throw Error('Terminal script closing tag refused');new Script(script);
 const scriptHash=createHash('sha256').update(script).digest('base64');
 const notice=notices.join('\n\n');if(notice.includes('-->'))throw Error('Terminal license comment closing tag refused');
 const html=`<!doctype html><html lang="en">${notice?`<!--\n${notice}\n-->`:""}<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none';"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIREN — Terminal</title><style>${css}\n:root{font:14px/1.5 system-ui,sans-serif;color-scheme:dark;--terminal-fg:#e9ebf3;--terminal-bg:#171719;--terminal-accent:#90aaff;background:var(--terminal-bg);color:var(--terminal-fg)}body{margin:0}main{box-sizing:border-box;padding:18px;height:100vh;display:flex;flex-direction:column;gap:12px}header{display:flex;justify-content:space-between;align-items:center}h1{font-size:20px;margin:0;letter-spacing:-.03em}header small{opacity:.65}#terminalWorkspace{display:flex;flex:1;min-height:0}.terminal-controls{display:flex;flex:1;flex-direction:column;min-height:0;gap:10px}.terminal-toolbar{display:flex;gap:6px;flex-wrap:wrap}.terminal-display{flex:1;min-height:0;overflow:hidden}.terminal-session-tabs{display:flex;gap:6px;overflow:auto}button,select,input{font:inherit;border:1px solid color-mix(in srgb,var(--terminal-fg) 20%,transparent);border-radius:8px;background:color-mix(in srgb,var(--terminal-fg) 6%,var(--terminal-bg));color:var(--terminal-fg);padding:7px 10px}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--terminal-accent);outline-offset:3px}button[aria-selected=true]{border-color:var(--terminal-accent)}button:disabled{opacity:.4}[hidden]{display:none!important}</style></head><body data-role="terminal"><main><header><div><h1>Terminal</h1><small>Project shell · Your commands, your control</small></div><div><button type="button" id="terminalHelp">Help · F1</button><button type="button" id="terminalPlacement">Attach to workspace</button></div></header><div id="terminalWorkspace"></div></main><script>${script}</script></body></html>`;
 const directory=join(outputDir,'windows');await mkdir(directory,{recursive:true});await writeFile(join(directory,'terminal.html'),html,'utf8');if(dependenciesRoot)await writeFile(join(directory,'terminal-licenses.txt'),notice,'utf8');
 return Object.freeze({scope:dependenciesRoot?'SOURCE_ONLY_DESKTOP_CANDIDATE':'SOURCE_ONLY_UNAVAILABLE_CANDIDATE',entrySha256:hash(html),scriptSha256:scriptHash,constructorsBundled:!!dependenciesRoot,nativeAdmission:false,noticePath:dependenciesRoot?'windows/terminal-licenses.txt':null,noticeSha256:dependenciesRoot?hash(notice):null,inventory:Object.freeze(inventory),cssSha256:hash(css),inputs:Object.freeze(Object.keys(result.metafile.inputs))});
}

// Fixed reviewed initializer import, no user/renderer/env/CLI module path. This
// candidate remains unavailable until its private native factory is qualified.
export async function buildTerminalDesktopCandidate({outputDir,dependenciesRoot,baselinePath,expectedSha256,nativeSourceLayout=false}={}){
 if(typeof nativeSourceLayout!=='boolean')throw Error('Explicit native source layout choice required');
 const desktop=fileURLToPath(new URL('../',import.meta.url)),out=resolve(outputDir);
 const contains=(parent,child)=>{const location=relative(parent,child);return !location||(!location.startsWith('..'+sep)&&location!=='..'&&!isAbsolute(location));};
 if(out===parse(out).root||contains(desktop,out)||contains(out,desktop)||!dependenciesRoot)throw Error('Separate explicit candidate output required');
 const packagePath=join(out,'package.json'),packageBytes=JSON.stringify({name:'siren-terminal-candidate',version:'0.1.0-dev.1',private:true,type:'module',main:'candidate-main.mjs'},null,2)+'\n';
 // Bounded package admission before legacy build effects. This does not make
 // the remaining builder outputs an atomic transaction or close namespace races.
 async function checkAncestors(){
  const ancestors=[];for(let current=out;;current=dirname(current)){ancestors.unshift(current);if(current===parse(current).root)break;}
  for(const current of ancestors){
   let info;try{info=await lstat(current);}catch(error){if(error.code==='ENOENT')break;throw error;}
   if(info.isSymbolicLink()||!info.isDirectory())throw Error('Candidate output ancestry refused');
   const actual=await realpath(current),same=process.platform==='win32'?actual.toLowerCase()===current.toLowerCase():actual===current;
   if(!same)throw Error('Candidate output ancestry refused');
  }
 }
 await checkAncestors();
 try{await lstat(packagePath);throw Error('Candidate package already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(out,{recursive:true});await checkAncestors();
 await writeFile(packagePath,packageBytes,{encoding:'utf8',flag:'wx'});
 const {buildRenderer}=await import('./renderer.mjs');
 await buildRenderer({baselinePath,expectedSha256,outputDir:join(out,'generated')});
 await cp(join(desktop,'src'),join(out,'src'),{recursive:true});
 const preload=await readFile(join(desktop,'src/preload.cjs'),'utf8');
 await writeFile(join(out,'generated/terminal-launch-preload.cjs'),preload+"\ncontextBridge.exposeInMainWorld('sirenTerminalLauncher',Object.freeze({getCapability:()=>ipcRenderer.invoke('siren:terminal-capability'),open:()=>ipcRenderer.invoke('siren:terminal-launch')}));\n");
 const receipt=await buildTerminalWindow(join(out,'generated'),{dependenciesRoot});
 const candidateMain="if(process.argv.some(arg=>arg.startsWith('--siren-pin-worker'))){\n await import('./src/start.mjs');\n}else{\n const {configureDesktopLaunch}=await import('./src/desktop-launch.mjs');\n const {createDesktopTerminalCandidate}=await import('./src/terminal/candidate-initializer.mjs');\n configureDesktopLaunch(createDesktopTerminalCandidate());\n await import('./src/start.mjs');\n}\n";
 await writeFile(join(out,'candidate-main.mjs'),candidateMain);
 const nativeLayout=nativeSourceLayout?await buildTerminalNativeSourceLayout({outputDir:join(out,'native-runtime')}):null;
 const actualPackage=await readFile(packagePath),actualMain=await readFile(join(out,'candidate-main.mjs'));
 if(!actualPackage.equals(Buffer.from(packageBytes))||!actualMain.equals(Buffer.from(candidateMain)))throw Error('Candidate package/main readback mismatch');
 await writeFile(join(out,'terminal-candidate-receipt.json'),JSON.stringify({...receipt,nativeFactoryConfigured:false,normalPackageChanged:false,...(nativeLayout?{nativeSourceLayout:nativeLayout}:{}),candidatePackageSha256:hash(actualPackage),candidateMainSha256:hash(actualMain)},null,2)+'\n');return receipt;
}
