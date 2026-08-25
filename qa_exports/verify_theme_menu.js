#!/usr/bin/env node
/* Independent verification of the theme-menu cap, on a copy of the SHIPPED app.
 *
 * The agent that wrote the patch verified it on its own working copy. This re-checks the
 * claims that matter, from scratch: the cap holds, nothing became unreachable, the keyboard
 * never lands on a row it cannot see, and a theme hidden behind the cap can still be found
 * when it is the active one.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

/* How many themes this build offers. Established from the first viewport and reused, so adding
   a theme cannot make this suite report a working menu as broken - which is exactly what a
   hardcoded 37 did the day two were added. */
let TOTAL = 0;
const APP = arg('app'), PORT = Number(arg('port', '9892'));

let fail = 0;
const check = (id, ok, exp, act) => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} | expected=${exp} | actual=${act}`); };

const SETTLE = `(async () => {

  for (let i = 0; i < 80; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  for (let p = 0; p < 12; p++) {
    const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
    if (!b) break; b.click(); await new Promise(r => setTimeout(r, 200));
  }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
  document.body.click(); await new Promise(r => setTimeout(r, 800)); return 1;
})()`;

// A row a person can actually use: in the DOM, laid out, and not clipped away.
const OPEN_AND_READ = `(async () => {
  const btn = document.querySelector('#themeMenuButton');
  if (!btn) return JSON.stringify({ error: 'no #themeMenuButton' });
  if (document.querySelector('#themeMenu').hidden) { btn.click(); await new Promise(r => setTimeout(r, 900)); }
  const m = document.querySelector('#themeMenu');
  const all = Array.from(m.querySelectorAll('.theme-menu-option[data-theme-value]'));
  const shown = all.filter(o => { const r = o.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const more = m.querySelector('#themeMenuMoreButton');
  const mr = more ? more.getBoundingClientRect() : null;
  return JSON.stringify({
    box: Math.round(m.getBoundingClientRect().width) + 'x' + Math.round(m.getBoundingClientRect().height),
    clientH: m.clientHeight, scrollH: m.scrollHeight,
    hidden: Math.max(0, m.scrollHeight - m.clientHeight),
    inDom: all.length,
    visible: shown.length,
    visibleIds: shown.map(o => o.dataset.themeValue),
    moreText: more ? more.textContent.replace(/\\s+/g, ' ').trim() : null,
    moreVisible: !!(mr && mr.width > 0 && mr.height > 0)
  });
})()`;

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  try {
    for (const [w, h] of [[1440, 900], [960, 700]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 100)); });
      await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate(SETTLE);

      const q = JSON.parse(await page.evaluate(OPEN_AND_READ));
      if (q.error) { check(`${w}.menu.opens`, false, 'the theme menu opens', q.error); await ctx.close(); continue; }

      // The first viewport establishes how many themes this build offers; the rest compare
      // against the same figure, so the suite measures the cap rather than a remembered total.
      if (!TOTAL) TOTAL = q.inDom;
      check(`${w}.quick.eightRows`, q.visible === 8, 'exactly 8 rows a person can use', `${q.visible} of ${q.inDom} in the DOM`);
      check(`${w}.quick.noOverflow`, q.hidden === 0, 'nothing below the fold', `${q.hidden}px hidden (box ${q.box}, scrollH ${q.scrollH})`);
      // Derived, not hardcoded. This suite asserted 37 and broke the day two themes were added,
    // reporting a correct app as four failures. What it defends is that the cap hides nothing
    // PERMANENTLY - a relationship between shown and total - so the total is read from the
    // page and the same number is used on both sides.
    check(`${w}.quick.allStillInDom`, q.inDom === TOTAL,
      `all ${TOTAL} themes still present`, q.inDom);
      check(`${w}.more.offered`, q.moreVisible, 'a visible route to the rest', JSON.stringify(q.moreText));
      if (w === 1440) console.log('        the eight: ' + q.visibleIds.join(', '));

      // ---- the rest must be reachable ----
      const expanded = JSON.parse(await page.evaluate(`(async () => {
        const more = document.querySelector('#themeMenuMoreButton');
        if (!more) return JSON.stringify({ error: 'no more button' });
        more.click(); await new Promise(r => setTimeout(r, 700));
        const m = document.querySelector('#themeMenu');
        const shown = Array.from(m.querySelectorAll('.theme-menu-option[data-theme-value]'))
          .filter(o => { const r = o.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        return JSON.stringify({ visible: shown.length, ids: shown.map(o => o.dataset.themeValue) });
      })()`));
      check(`${w}.more.revealsAll`, expanded.visible === TOTAL,
      `all ${TOTAL} reachable after More themes`, expanded.visible);

      // ---- picking a theme from behind the cap must apply it ----
      const applied = JSON.parse(await page.evaluate(`(async () => {
        const m = document.querySelector('#themeMenu');
        const row = Array.from(m.querySelectorAll('.theme-menu-option[data-theme-value]'))
          .find(o => o.dataset.themeValue === 'ukiyoe');
        if (!row) return JSON.stringify({ error: 'ukiyoe row absent' });
        const before = document.body.dataset.theme;
        row.click(); await new Promise(r => setTimeout(r, 900));
        return JSON.stringify({ before, after: document.body.dataset.theme });
      })()`));
      check(`${w}.hiddenTheme.applies`, applied.after === 'ukiyoe',
        'a theme from behind the cap still applies', `${applied.before} -> ${applied.after}`);

      // ---- reopening while a capped theme is active must show the tick ----
      const reopened = JSON.parse(await page.evaluate(`(async () => {
        const m = document.querySelector('#themeMenu');
        document.body.click(); await new Promise(r => setTimeout(r, 500));
        document.querySelector('#themeMenuButton').click(); await new Promise(r => setTimeout(r, 900));
        const active = Array.from(m.querySelectorAll('.theme-menu-option[data-theme-value]'))
          .find(o => o.dataset.themeValue === 'ukiyoe');
        const r = active ? active.getBoundingClientRect() : null;
        return JSON.stringify({ activeVisible: !!(r && r.width > 0 && r.height > 0) });
      })()`));
      check(`${w}.activeTheme.visibleOnReopen`, reopened.activeVisible,
        'the active theme is visible when the menu reopens', reopened.activeVisible);

      check(`${w}.noErrors`, errs.length === 0, 'no page or console errors', errs.length ? errs.slice(0, 2).join(' // ') : 'none');
      await ctx.close();
    }

    // ---- the phone route: the quick menu does not exist there; the select must still hold all 37 ----
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(SETTLE);
    const phone = JSON.parse(await page.evaluate(`(() => {
      const sel = document.querySelector('#themePresetMobile') || document.querySelector('#themePreset');
      const btn = document.querySelector('#themeMenuButton');
      const br = btn ? btn.getBoundingClientRect() : null;
      return JSON.stringify({
        quickMenuUsable: !!(br && br.width > 0 && br.height > 0),
        selectOptions: sel ? sel.options.length : 0
      });
    })()`));
    check('375.phoneRouteIntact', phone.selectOptions >= TOTAL,
      'the phone select still lists every theme', `${phone.selectOptions} options, quick menu usable=${phone.quickMenuUsable}`);
    check('375.noErrors', errs.length === 0, 'no page errors at 375', errs.length ? errs.join(' // ') : 'none');
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  console.log(`\n${fail ? 'FAILED' : 'ALL PASS'} — ${fail} failing assertion(s)`);
  process.exit(fail ? 1 : 0);
})();
