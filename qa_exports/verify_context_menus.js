#!/usr/bin/env node
/* Stage 2, the part that was skipped: re-measure the two claims Round 7 Job AH rests on.
 *
 *   1. The code-only chip promises "right-click for fit, size, export and colours", and a colour
 *      action exists on only ONE of the eight code-only types.
 *   2. Four types announce themselves as "Advanced Mermaid" in the menu heading rather than the
 *      family the app actually rendered: xychart, pie, c4, timeline.
 *
 * Nobody has re-measured either. Everything else feeding Round 7 was verified independently.
 *
 * Usage: node verify_context_menus.js --app <path> [--port 9865]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/codex/FROZEN_R6_BASE.html');
const PORT = Number(arg('port', '9865'));

const TYPES = {
  flowchart: 'flowchart TD\n A[Start] --> B{Check}\n B --> C[Done]',   // positive control
  xychart:   'xychart-beta\n title "X"\n x-axis [a, b]\n bar [10, 20]',
  pie:       'pie showData\n "A" : 40\n "B" : 60',
  sequence:  'sequenceDiagram\n participant A\n participant B\n A->>B: hello',
  c4:        'C4Context\n title C4\n Person(a, "User")',
  gantt:     'gantt\n title Plan\n dateFormat YYYY-MM-DD\n section S\n One :a1, 2026-01-01, 20d',
  timeline:  'timeline\n title T\n 2026 : one : two',
  journey:   'journey\n title A day\n section Work\n Email: 3: Me',
  gitGraph:  'gitGraph\n commit\n branch dev\n commit'
};

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(`(async () => {
    for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
    for (let p = 0; p < 12; p++) {
      const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
      if (!b) break; b.click(); await new Promise(r => setTimeout(r, 200));
    }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
    document.body.click(); await new Promise(r => setTimeout(r, 900)); return 1;
  })()`);

  console.log('type          heading                        colour?  rows');
  console.log('-'.repeat(92));
  const rows = [];

  for (const [name, src] of Object.entries(TYPES)) {
    await page.evaluate(`(async () => {
      const s = document.querySelector('#source');
      s.value = ${JSON.stringify(src)};
      s.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 4000));
      return 1;
    })()`);

    // a REAL right-click at the centre of the drawing, not a synthetic event
    const box = await page.locator('#diagram svg').first().boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await page.waitForTimeout(900);

    const got = JSON.parse(await page.evaluate(`(() => {
      const menu = document.querySelector('.struct-menu:not([hidden])') || document.querySelector('.struct-menu');
      if (!menu) return JSON.stringify({ menu: false });
      const items = Array.from(menu.querySelectorAll('button, [role="menuitem"], .struct-menu-item, li'))
        .map(e => e.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean);
      // The heading is .struct-menu-heading - a DIV. A first run looked for '.struct-menu-head'
      // and fell back to the first menu row, then reported the claim as refuted. One missing 'ing'.
      const head = (menu.querySelector('.struct-menu-heading') || {}).textContent || '';
      return JSON.stringify({
        menu: true,
        heading: head.replace(/\\s+/g, ' ').trim(),
        rows: items,
        colour: items.some(t => /colour|color/i.test(t))
      });
    })()`));

    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    rows.push({ name, ...got });
    if (!got.menu) { console.log(`${name.padEnd(13)} (no menu opened)`); continue; }
    console.log(`${name.padEnd(13)} ${(got.heading || '—').slice(0, 30).padEnd(30)} ${String(got.colour).padEnd(8)} ${got.rows.length}`);
  }

  const codeOnly = rows.filter(r => r.name !== 'flowchart' && r.menu);
  const withColour = codeOnly.filter(r => r.colour).map(r => r.name);
  const advanced = rows.filter(r => r.menu && /Advanced Mermaid/i.test(r.heading || '')).map(r => r.name);

  console.log();
  console.log(`  colour action present on ${withColour.length} of ${codeOnly.length} code-only types: ${withColour.join(', ') || 'none'}`);
  console.log(`  headings reading "Advanced Mermaid": ${advanced.length} — ${advanced.join(', ') || 'none'}`);
  console.log();
  console.log('  claim 1 — colours exist on exactly one of eight : ' +
    (codeOnly.length === 8 && withColour.length === 1 && withColour[0] === 'gitGraph' ? 'CONFIRMED' : 'DIFFERS — see above'));
  console.log('  claim 2 — xychart, pie, c4, timeline say Advanced : ' +
    (['xychart','pie','c4','timeline'].every(t => advanced.includes(t)) ? 'CONFIRMED' : 'DIFFERS — see above'));
  console.log('  page errors: ' + (errs.length ? errs.slice(0, 3).join(' | ') : 'none'));

  fs.writeFileSync(path.join(path.dirname(APP), 'context_menu_verify.json'), JSON.stringify(rows, null, 1));
  await browser.close(); server.close();
})();
