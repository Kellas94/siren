import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Script } from 'node:vm';
import {fileURLToPath} from 'node:url';
import {buildCodeEditor} from './code-editor.mjs';

export async function buildWindowEntrypoints(outputDir) {
  const editorBuild=await buildCodeEditor({baselinePath:fileURLToPath(new URL('../baseline/R78.html',import.meta.url)),outputDirectory:join(outputDir,'.code-build')});
  const editorScript=(await readFile(editorBuild.bundlePath,'utf8'))+'\n'+(await readFile(new URL('../src/ui/code/docs-links.js',import.meta.url),'utf8')).replaceAll('\r\n','\n')+'\n'+(await readFile(new URL('../src/ui/windows/code.js',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  if(/<\/script/i.test(editorScript))throw Error('Code script closing tag refused');
  new Script(editorScript);
  const editorHash=createHash('sha256').update(editorScript).digest('base64');
  const docsScript=(await readFile(new URL('../src/ui/windows/docs.js',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  if(/<\/script/i.test(docsScript))throw Error('Docs script closing tag refused');new Script(docsScript);
  const docsHash=createHash('sha256').update(docsScript).digest('base64');
  const script = (await readFile(new URL('../src/ui/windows/entry.js', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  if (/<\/script/i.test(script)) throw new Error('Window script closing tag refused');
  new Script(script);
  const hash = createHash('sha256').update(script).digest('base64');
  const directory = join(outputDir, 'windows'); await mkdir(directory, { recursive: true });
  const identities = {};
  for (const role of ['code', 'docs']) {
    const csp = `default-src 'none'; script-src 'sha256-${hash}' 'sha256-${role==='code'?editorHash:docsHash}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none';`;
    const title = role === 'code' ? '⌘ Code' : 'Docs';
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIREN — ${title}</title><style>
      :root{color-scheme:light dark;font-family:Inter,system-ui,sans-serif;background:light-dark(#f7f8fc,#171719);color:light-dark(#20283a,#e9ebf3)}
      body{margin:0;min-height:100vh;display:grid;place-items:center}main{max-width:36rem;padding:3rem}h1{font-size:2rem;font-weight:600;letter-spacing:-.04em}p{line-height:1.6;opacity:.7}button,select{font:inherit;padding:.65rem 1rem;border:1px solid light-dark(#d5dbea,#454958);border-radius:.65rem;background:light-dark(#fff,#26282f);color:inherit;cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #648dff;outline-offset:3px}
      [hidden]{display:none!important}body[data-role=code]{height:100vh;min-height:0;display:block}body[data-role=code] main{box-sizing:border-box;width:100%;max-width:none;height:100%;padding:18px;display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:10px}header{display:flex;align-items:center;gap:12px;flex-wrap:wrap}header h1{font-size:20px;margin:0;flex:1}header button,header select{padding:6px 10px;font-size:13px}#viewStatus{margin:0;font-size:12px;overflow-wrap:anywhere}#codeSurface{min-height:0;height:100%}
      body[data-role=docs]{height:100vh;min-height:0;display:block}body[data-role=docs] main{box-sizing:border-box;width:100%;max-width:none;height:100%;padding:18px;display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:10px}.document-layout{display:grid;grid-template-columns:180px minmax(0,1fr);min-height:0;gap:24px;border-top:1px solid #78859a33;padding-top:16px}#documentOutline{overflow:auto;display:flex;flex-direction:column;gap:4px;align-items:stretch}#documentOutline button{text-align:left;background:transparent;border:0;font-size:13px;padding:8px 10px;overflow-wrap:anywhere}#documentContent{overflow:auto;padding:0 28px 40px;scroll-behavior:smooth}#documentContent h1{font-size:30px;margin:12px 0 4px;overflow-wrap:anywhere}.document-caption{font-size:12px;margin-bottom:28px}.document-section{max-width:78ch;scroll-margin:16px;margin-bottom:20px}.document-field h3{font-size:14px;font-weight:600;margin:12px 0 8px}.document-text{font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.document-text button{display:block;margin-top:8px}.document-group{border:1px solid #78859a33;border-radius:10px;padding:12px;margin:8px 0}.document-group summary{cursor:pointer;font-size:14px;font-weight:500}.document-group>div{padding:8px 4px}.document-group button,#documentContent button{font-size:12px;padding:6px 10px}
      .code-docs-dialog{box-sizing:border-box;width:min(520px,calc(100vw - 48px));max-height:calc(100vh - 48px);padding:24px;border:1px solid light-dark(#d5dbea,#454958);border-radius:18px;background:light-dark(#fafbfe,#202127);color:inherit;box-shadow:0 24px 80px #0005}.code-docs-dialog::backdrop{background:#10172588;backdrop-filter:blur(8px)}.code-docs-dialog h2{font-size:21px;letter-spacing:-.035em;margin:0 0 8px}.code-docs-dialog p{font-size:13px;margin:0 0 16px}.code-docs-targets{max-height:40vh;overflow:auto;display:grid;gap:8px}.code-docs-target{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #78859a33;border-radius:10px;cursor:pointer}.code-docs-target:has(input:checked){border-color:#648dff;background:#648dff15}.code-docs-target input{accent-color:#648dff}.code-docs-target strong,.code-docs-target span span{display:block;font-size:13px;overflow-wrap:anywhere}.code-docs-target span span{opacity:.7;margin-top:4px}.code-docs-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px;flex-wrap:wrap}.code-docs-actions button{font-size:13px;padding:8px 12px}.code-docs-actions button:last-child{background:#3b65df;color:#fff;border-color:#3b65df}.code-docs-dialog .code-docs-message{margin:12px 0 0;font-size:12px;opacity:1}
    </style></head><body data-role="${role}"><main><header><h1 id="viewTitle">${title}</h1>${role==='code'?'<select id="codeTheme" aria-label="Code appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select><button id="openWorkingCopy" type="button" hidden>Edit working copy</button><button id="linkCodeDocs" type="button" hidden>Link to Docs</button><button id="retrySource" type="button" hidden>Retry source</button>':'<select id="documentTheme" aria-label="Document appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select><button id="retryDocument" type="button" hidden>Retry</button>'}<button id="closeView" type="button">Close window</button></header><p id="viewStatus" role="status">Waiting for the workspace…</p>${role==='code'?'<div id="codeSurface"></div>':'<div class="document-layout"><nav id="documentOutline" aria-label="Document sections"></nav><article id="documentContent" aria-label="Selected document"></article></div>'}</main><script>${role==='code'?editorScript:docsScript}</script><script>${script}</script></body></html>`;
    await writeFile(join(directory, `${role}.html`), html);
    identities[role] = createHash('sha256').update(html).digest('hex');
  }
  return identities;
}
