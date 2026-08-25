/* JOB BJ, sideways round. Fixes the two invalid sideways tests, adds macOS, the tour-alive
 * comparison, the source-editor Tab route, and a replica of R2.ITEM3.NARROW checks 11 and 12.
 * modes: side | tour | narrow
 */
const path = require('path'), fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

const APP = process.argv[2], PORT = Number(process.argv[3]), LABEL = process.argv[4];
const MODE = process.argv[5] || 'side';
const MAC = process.argv[6] === 'mac';

const FIXTURE = 'flowchart TD\n  A[Start] --> B[Check invoice]\n  B --> C[Approve]';
const out = { label: LABEL, mode: MODE, mac: MAC, rows: [] };
const rec = o => out.rows.push(o);

const WAIT_SVG = `(async () => {
  for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  for (let i = 0; i < 60; i++) { const o = document.getElementById('sirenIntroOverlay'); if (!o || o.hidden) break; await new Promise(r => setTimeout(r, 100)); }
  return 1; })()`;

async function killTour(page) {
  for (let i = 0; i < 40; i++) {
    const gone = await page.evaluate(`(() => { const c = document.querySelector('.tour-card'); if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click(); return false; })()`);
    if (gone && i > 10) break;
    await page.waitForTimeout(200);
  }
}
const src = p => p.evaluate(`document.getElementById('source').value`);
async function reset(p, ms = 2400) {
  await p.evaluate(`(() => { const s = document.getElementById('source'); s.value = ${JSON.stringify(FIXTURE)}; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await p.waitForTimeout(ms);
}
const fstate = p => p.evaluate(`(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id || '', cls: (a.getAttribute('class')||'').slice(0,40), inVP: !!(a.closest && a.closest('#zoomViewport')), inTour: !!(a.closest && a.closest('.tour-card')), label: ((a.getAttribute && a.getAttribute('aria-label')) || (a.textContent||'').trim()).slice(0,40) } : { tag: 'none' }; })()`);

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const opts = { viewport: MODE === 'narrow' ? { width: 375, height: 812 } : { width: 1440, height: 900 } };
  if (MAC) opts.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const ctx = await browser.newContext(opts);
  if (MAC) await ctx.addInitScript(`Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });`);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
  try {
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(WAIT_SVG);
    await page.waitForTimeout(3000);
    out.platform = await page.evaluate(`navigator.platform`);

    if (MODE === 'tour') {
      /* Tour left ALIVE on purpose. Everything here is about what Tab does while it shows. */
      out.tourAlive = await page.evaluate(`!!document.querySelector('.tour-card')`);
      out.tourButtons = await page.evaluate(`Array.from(document.querySelectorAll('.tour-card button')).map(b => b.textContent.trim())`);
      await reset(page, 2600);
      // 1. Tab from body, 30 presses: where does focus go, does the source move?
      await page.evaluate(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
      const before = await src(page);
      const stops = [];
      for (let i = 1; i <= 30; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(80);
        const f = await fstate(page);
        stops.push({ n: i, tag: f.tag, id: f.id, cls: f.cls, inTour: f.inTour, inVP: f.inVP });
      }
      const after = await src(page);
      rec({ test: 'T1_tabDuringTour', mutated: before !== after, before, after: before !== after ? after : null,
        distinctStops: [...new Set(stops.map(s => s.tag + '#' + s.id + '.' + s.cls))],
        stopsInsideTour: stops.filter(s => s.inTour).length, totalStops: stops.length, tail: stops.slice(0, 8) });

      // 2. Does Tab still indent in the source editor while the tour shows?
      await reset(page, 1800);
      await page.evaluate(`(() => { const s = document.getElementById('source'); s.focus(); s.setSelectionRange(0, 0); })()`);
      await page.waitForTimeout(300);
      const sBefore = await src(page);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
      const sAfter = await src(page);
      rec({ test: 'T2_tabInSourceEditorDuringTour', changed: sBefore !== sAfter, before: sBefore, after: sAfter, focusAfter: await fstate(page) });

      // 3. Escape ends the tour? Do Next/Skip still work?
      const tourBefore = await page.evaluate(`!!document.querySelector('.tour-card')`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      const tourAfterEsc = await page.evaluate(`!!document.querySelector('.tour-card')`);
      rec({ test: 'T3_escapeEndsTour', tourBefore, tourAfterEsc });

      // 4. Reload with the same storage: is the tour gone (tourDone persisted)?
      await page.reload({ waitUntil: 'load' });
      await page.evaluate(WAIT_SVG);
      await page.waitForTimeout(3500);
      rec({ test: 'T4_tourAfterReload', alive: await page.evaluate(`!!document.querySelector('.tour-card')`) });
      out.errors = errors;
      return;
    }

    await killTour(page); await page.waitForTimeout(2500); await killTour(page);

    if (MODE === 'narrow') {
      /* Replica of R2.ITEM3.NARROW checks 11 and 12, at 375x812 like the suite. */
      await reset(page, 2600);
      const nodeBox = await page.evaluate(`(() => { const n = document.querySelector('#diagram [data-node-id], #diagram g.node'); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
      if (nodeBox) { await page.mouse.click(nodeBox.x, nodeBox.y); await page.waitForTimeout(900); }
      const inspectorOpen = await page.evaluate(`(() => { const i = document.getElementById('nodeInspector'); return !!(i && !i.hidden); })()`);
      await page.evaluate(`document.activeElement instanceof HTMLElement && document.activeElement.blur()`);
      const activeBefore = await page.evaluate(`document.activeElement ? document.activeElement.tagName : ''`);
      let b = await src(page);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(650);
      let a = await src(page);
      rec({ test: 'NARROW_11_bodyTab', activeBefore, inspectorOpen, sourceChanged: a !== b,
        suiteExpects: 'sourceChanged === false', passes: activeBefore === 'BODY' && a === b, after: a !== b ? a : null });

      await page.evaluate(`document.getElementById('zoomViewport').focus()`);
      await page.waitForTimeout(200);
      const vpFocused = await page.evaluate(`document.activeElement && document.activeElement.id === 'zoomViewport'`);
      b = await src(page);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(650);
      a = await src(page);
      rec({ test: 'NARROW_12_zoomViewportTab', vpFocused, sourceChanged: a !== b,
        suiteExpects: 'sourceChanged === true', passes: a !== b, after: a !== b ? a : null, focusAfter: await fstate(page) });
      out.errors = errors;
      return;
    }

    /* ---------- MODE side ---------- */
    // S1. Tab in the Guided rows, focus placed ON a guided token first
    await reset(page, 2400);
    const guided = await page.evaluate(`(async () => {
      document.getElementById('codeModeButton')?.click(); await new Promise(r => setTimeout(r, 600));
      document.getElementById('structureModeButton')?.click(); await new Promise(r => setTimeout(r, 1600));
      const toks = document.querySelectorAll('#structureRows .struct-token');
      const rows = document.querySelectorAll('#structureRows .struct-code').length;
      const t = toks[1] || toks[0];
      if (t && t.focus) t.focus();
      return { rows, tokens: toks.length, focused: document.activeElement ? document.activeElement.tagName + '.' + (document.activeElement.getAttribute('class')||'').split(' ')[0] : 'none' }; })()`);
    {
      const fB = await fstate(page); const b = await src(page);
      await page.keyboard.press('Tab'); await page.waitForTimeout(900);
      const a = await src(page);
      rec({ test: 'S1_tab_guidedToken', guided, focusBefore: fB, mutated: a !== b, before: b, after: a !== b ? a : null, focusAfter: await fstate(page) });
      // and Enter on a guided token
      const b2 = await src(page);
      await page.evaluate(`(() => { const t = document.querySelectorAll('#structureRows .struct-token')[1]; if (t) t.focus(); })()`);
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter'); await page.waitForTimeout(900);
      const a2 = await src(page);
      rec({ test: 'S1b_enter_guidedToken', mutated: a2 !== b2, before: b2, after: a2 !== b2 ? a2 : null, focusAfter: await fstate(page) });
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.evaluate(`document.getElementById('textModeButton')?.click()`);
    await page.waitForTimeout(700);

    // S2. Docs - CREATE a document first, then Tab inside a real paragraph
    await reset(page, 2000);
    const docs = await page.evaluate(`(async () => {
      document.getElementById('workpapersButton')?.click(); await new Promise(r => setTimeout(r, 1800));
      const empty = document.getElementById('wpEmptyNewButton');
      if (empty && empty.offsetParent) { empty.click(); await new Promise(r => setTimeout(r, 2000)); }
      const inner = document.getElementById('wpDocInner');
      const ed = document.querySelector('#wpWorkspace [contenteditable="true"]');
      return { workspaceOpen: !!(document.getElementById('wpWorkspace') && !document.getElementById('wpWorkspace').hidden),
               docInner: !!inner, editables: document.querySelectorAll('#wpWorkspace [contenteditable="true"]').length }; })()`);
    {
      let extra = {};
      const t = await page.evaluate(`(() => { const ed = document.querySelector('#wpWorkspace [contenteditable="true"]'); if (!ed) return null; const r = ed.getBoundingClientRect(); return { x: r.left + Math.min(40, r.width/2), y: r.top + Math.min(16, r.height/2), w: r.width, h: r.height }; })()`);
      if (t) {
        await page.mouse.click(t.x, t.y); await page.waitForTimeout(700);
        await page.keyboard.type('Client walkthrough note');
        await page.waitForTimeout(500);
        const typedIn = await page.evaluate(`(() => { const a = document.activeElement; return a ? (a.textContent||'').slice(0,60) : ''; })()`);
        const fB = await fstate(page); const b = await src(page);
        const docBefore = await page.evaluate(`(document.getElementById('wpDoc')||{}).innerText || ''`);
        await page.keyboard.press('Tab'); await page.waitForTimeout(900);
        const a = await src(page);
        const docAfter = await page.evaluate(`(document.getElementById('wpDoc')||{}).innerText || ''`);
        extra = { target: t, typedIn, sourceMutated: a !== b, sourceAfter: a !== b ? a : null,
          docTextChanged: docBefore !== docAfter, docBefore: docBefore.slice(0, 120), docAfter: docAfter.slice(0, 120),
          focusBefore: fB, focusAfter: await fstate(page) };
      }
      rec({ test: 'S2_tab_docsParagraph', docs, ...extra });
    }
    await page.evaluate(`(() => { const b = document.getElementById('workpapersButton'); if (b) b.click(); })()`);
    await page.waitForTimeout(1000);

    // S3. Tab inside the source editor: the documented indent route must survive
    await reset(page, 2000);
    await page.evaluate(`(() => { const s = document.getElementById('source'); s.focus(); s.setSelectionRange(0, 0); })()`);
    await page.waitForTimeout(300);
    {
      const b = await src(page);
      await page.keyboard.press('Tab'); await page.waitForTimeout(600);
      const a = await src(page);
      rec({ test: 'S3_tab_sourceEditorIndent', changed: a !== b, before: b, after: a, focusAfter: await fstate(page) });
    }

    // S4. Command palette Tab (a documented Tab route) still works
    await reset(page, 1500);
    {
      const opened = await page.evaluate(`(async () => { const p = document.getElementById('commandPalette');
        if (!p) return { present: false }; return { present: true, hidden: p.hidden }; })()`);
      rec({ test: 'S4_commandPalettePresent', opened });
    }

    out.errors = errors;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 1200);
    out.errors = errors;
  } finally {
    console.log('SIDE_JSON ' + JSON.stringify(out));
    await browser.close(); server.close();
  }
})();
