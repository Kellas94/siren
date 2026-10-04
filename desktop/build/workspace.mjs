import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {transform} from 'esbuild';

/** Standalone, data-free build. Production entry/route admission is separate. */
export async function buildWorkspaceEntrypoint({outputDir}) {
  const ui=new URL('../src/ui/',import.meta.url);
  const scripts=await Promise.all(['workspace/intro.js','workspace/home.js','pin.js'].map(async name=>{
    const source=(await readFile(new URL(name,ui),'utf8')).replaceAll('\r\n','\n');
    if(/<\/script/i.test(source))throw Error('Home script boundary refused');
    return (await transform(source,{minify:true,target:'es2022',charset:'utf8',legalComments:'inline'})).code;
  }));
  const styles=await Promise.all(['desktop.css','workspace/workspace.css'].map(async name=>(await readFile(new URL(name,ui),'utf8')).replaceAll('\r\n','\n')));
  for(const script of scripts){if(/<\/script/i.test(script))throw Error('Home script boundary refused');new Script(script);}
  if(styles.some(css=>/<\/style/i.test(css)))throw Error('Home style boundary refused');
  const hashes=scripts.map(script=>"'sha256-"+createHash('sha256').update(script).digest('base64')+"'");
  const csp=`default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none';`;
  const html=`<!doctype html><html lang="en" data-desktop-locked="true"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIREN — Home</title><style>${styles.join('\n')}</style></head><body>
<div id="sirenIntroOverlay" class="home-opening" aria-label="SIREN opening"><div class="home-opening-lines" aria-hidden="true"><i></i><i></i><i></i></div><div class="home-opening-word">SIREN</div><p>Ideas. Connected.</p></div>
<div id="sirenLockVault" class="home-vault" hidden aria-label="Locking SIREN"><div class="home-vault-door"><span>S</span></div></div>
<main id="homeRoot" hidden></main><script>${scripts.join('</script><script>')}</script></body></html>`;
  const bytes=Buffer.from(html);if(bytes.length>=64*1024)throw Error('Home entry budget exceeded');
  await mkdir(outputDir,{recursive:true});await writeFile(join(outputDir,'home.html'),bytes);
  return Object.freeze({sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,scriptCount:scripts.length});
}
