#!/usr/bin/env node
/* The standing rule, made checkable: hiding a control must not remove it from the command palette.
 *
 * The absorbed toolbar controls are display:none. If the palette's harvest filtered by visibility
 * they would quietly disappear from the one surface meant to reach everything - the exact shape of
 * "nothing is silently lost" worth catching before shipping rather than after.
 *
 * The first version of this check read the palette's list with an empty query and found nothing for
 * six of the seven - on the BASE as well, because an empty palette renders only its top slice. Two
 * empties comparing equal is not a pass, it is a vacuum. So this types the word a person would type
 * and reports "nothing to lose" out loud whenever the base could not reach the control either.
 *
 * Usage: node verify_palette_reach.js [--base <path>] [--patched <path>]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('base', 'C:/Claude/SIREN/codex/FROZEN_R6_BASE.html');
const PATCHED = arg('patched', 'C:/Claude/SIREN/pending/toolbar/app.html');

/* id, what its palette entry should look like, and the word a person would type to find it. */
const ABSORBED = [
  ['zoomChipButton', /fit|100%|zoom/i, 'zoom'],
  ['zoomMenuButton', /zoom/i, 'zoom'],
  ['verticalLayoutButton', /vertical|top-to-bottom/i, 'vertical'],
  ['horizontalLayoutButton', /horizontal|left-to-right/i, 'horizontal'],
  ['styleShortcutButton', /style/i, 'style'],
  ['commentsButton', /comment/i, 'comment'],
  ['reviewButton', /review/i, 'review'],
];

const SETTLE = `(async () => {
  for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  for (let p = 0; p < 12; p++) {
    const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
    if (!b) break; b.click(); await new Promise(r => setTimeout(r, 220));
  }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
  const intro = document.getElementById('sirenIntroOverlay');
  for (let i = 0; i < 60 && intro && !intro.hidden; i++) await new Promise(r => setTimeout(r, 100));
  document.body.click(); await new Promise(r => setTimeout(r, 900)); return 1;
})()`;

const READ_LIST = `(() => {
  const palette = document.getElementById('commandPalette');
  const list = document.getElementById('commandPaletteList');
  if (!list || !palette || palette.hidden) return '[]';
  return JSON.stringify(Array.from(list.querySelectorAll('[role="option"], li, button'))
    .map(e => e.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean));
})()`;

async function paletteSearch(page, query) {
  const open = await page.evaluate(`!document.getElementById('commandPalette').hidden`);
  if (!open) { await page.keyboard.press('Control+k'); await page.waitForTimeout(700); }
  await page.evaluate(`(() => {
    const input = document.getElementById('commandPaletteInput');
    input.value = ${JSON.stringify(query)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.waitForTimeout(400);
  return JSON.parse(await page.evaluate(READ_LIST));
}

async function run(app, port) {
  const root = path.dirname(app), file = path.basename(app);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(port);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(`http://127.0.0.1:${port}/${file}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(SETTLE);
  const out = { all: await paletteSearch(page, '') };
  for (const [id, , query] of ABSORBED) out[id] = await paletteSearch(page, query);
  await browser.close(); server.close();
  return out;
}

(async () => {
  const base = await run(BASE, 9873);
  const patched = await run(PATCHED, 9874);
  console.log(`palette top slice: base ${base.all.length}, patched ${patched.all.length}\n`);

  let fail = 0, vacuous = 0;
  for (const [id, re, query] of ABSORBED) {
    const inBase = base[id].filter(t => re.test(t));
    const inPatched = patched[id].filter(t => re.test(t));
    if (!inBase.length) {
      vacuous++;
      console.log(`[ -- ] ${id.padEnd(22)} '${query}' finds nothing in the BASE either - nothing to lose`);
      continue;
    }
    const lost = inBase.filter(t => !patched[id].includes(t));
    const ok = lost.length === 0;
    if (!ok) fail++;
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id.padEnd(22)} '${query}' -> base ${inBase.length}, patched ${inPatched.length}` +
                (ok ? `   e.g. "${inPatched[0] || inBase[0]}"` : `   LOST: ${lost.join(' | ')}`));
  }

  const gone = base.all.filter(t => !patched.all.includes(t));
  const added = patched.all.filter(t => !base.all.includes(t));
  if (gone.length) fail++;
  console.log(`\n[${gone.length ? 'FAIL' : 'PASS'}] nothing left the palette's top slice` +
              (gone.length ? `   LOST ${gone.length}: ${gone.slice(0, 8).join(' | ')}` : ''));
  if (added.length) console.log(`       new entries (${added.length}): ${added.slice(0, 8).join(' | ')}`);

  console.log(`\n${fail ? 'FAILED' : 'ALL PASS'} — ${fail} failing assertion(s)` +
              (vacuous ? `, ${vacuous} control(s) the base could not reach either` : ''));
  process.exit(fail ? 1 : 0);
})();
