import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Script } from 'node:vm';

export async function buildWindowEntrypoints(outputDir) {
  const script = (await readFile(new URL('../src/ui/windows/entry.js', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  if (/<\/script/i.test(script)) throw new Error('Window script closing tag refused');
  new Script(script);
  const hash = createHash('sha256').update(script).digest('base64');
  const csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none';`;
  const directory = join(outputDir, 'windows'); await mkdir(directory, { recursive: true });
  const identities = {};
  for (const role of ['code', 'docs']) {
    const title = role === 'code' ? '⌘ Code' : 'Docs';
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIREN — ${title}</title><style>
      :root{color-scheme:light dark;font-family:Inter,system-ui,sans-serif;background:light-dark(#f7f8fc,#171719);color:light-dark(#20283a,#e9ebf3)}
      body{margin:0;min-height:100vh;display:grid;place-items:center}main{max-width:36rem;padding:3rem}h1{font-size:2rem;font-weight:600;letter-spacing:-.04em}p{line-height:1.6;opacity:.7}button{font:inherit;padding:.65rem 1rem;border:1px solid light-dark(#d5dbea,#454958);border-radius:.65rem;background:light-dark(#fff,#26282f);color:inherit;cursor:pointer}button:focus-visible{outline:3px solid #648dff;outline-offset:3px}
    </style></head><body data-role="${role}"><main><h1 id="viewTitle">${title}</h1><p id="viewStatus" role="status">Waiting for the workspace…</p><button id="closeView" type="button">Close window</button></main><script>${script}</script></body></html>`;
    await writeFile(join(directory, `${role}.html`), html);
    identities[role] = createHash('sha256').update(html).digest('hex');
  }
  return identities;
}
