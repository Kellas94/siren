/* JOB BJ - per-key matrix at the EXACT focus point the defect fires from (DIV#zoomViewport),
 * plus the creation route that must survive, plus four sideways contexts.
 * Same script, both builds.
 */
const path = require('path'), fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

const APP = process.argv[2], PORT = Number(process.argv[3]), LABEL = process.argv[4];
const MAC = process.argv[5] === 'mac';

const FIXTURE = 'flowchart TD\n  A[Start] --> B[Check invoice]\n  B --> C[Approve]';
const out = { label: LABEL, mac: MAC, rows: [] };
function rec(o) { out.rows.push(o); }

const WAIT_SVG = `(async () => {
  for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  for (let i = 0; i < 60; i++) { const o = document.getElementById('sirenIntroOverlay'); if (!o || o.hidden) break; await new Promise(r => setTimeout(r, 100)); }
  return 1;
})()`;

async function killTour(page) {
  for (let i = 0; i < 40; i++) {
    const gone = await page.evaluate(`(() => { const c = document.querySelector('.tour-card'); if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click(); return false; })()`);
    if (gone && i > 10) break;
    await page.waitForTimeout(200);
  }
}
async function src(p) { return p.evaluate(`document.getElementById('source').value`); }
async function reset(p) {
  await p.evaluate(`(() => { const s = document.getElementById('source'); s.value = ${JSON.stringify(FIXTURE)}; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await p.waitForTimeout(2400);
}
async function clickFirstNode(p) {
  const box = await p.evaluate(`(() => { const n = document.querySelector('#diagram g.node'); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
  if (box) { await p.mouse.click(box.x, box.y); await p.waitForTimeout(900); }
  return box;
}
async function focusViewportDiv(p) {
  return p.evaluate(`(() => { const v = document.getElementById('zoomViewport'); if (!v) return { ok: false }; v.focus(); return { ok: document.activeElement === v, tabindex: v.getAttribute('tabindex') }; })()`);
}
async function fstate(p) {
  return p.evaluate(`(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id || '', cls: (a.getAttribute('class')||'').slice(0,44), inVP: !!(a.closest && a.closest('#zoomViewport')), label: ((a.getAttribute && a.getAttribute('aria-label')) || (a.textContent||'').trim()).slice(0,44) } : { tag: 'none' }; })()`);
}
async function pstate(p) {
  return p.evaluate(`(() => { const pop = document.querySelector('.canvas-popover');
    return { popover: !!(pop && !pop.hidden), popRole: pop ? (pop.getAttribute('data-role')||'') : null,
      popInputs: pop ? pop.querySelectorAll('input').length : 0,
      inplace: !!document.querySelector('.canvas-inplace'),
      dialog: !!document.querySelector('dialog[open]'),
      handles: document.querySelectorAll('#diagram [data-handle-for]').length,
      toast: (document.querySelector('.toast, #toast') || {}).textContent || '' }; })()`);
}
async function clearPopover(p) {
  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(350);
  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(350);
}

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctxOpts = { viewport: { width: 1440, height: 900 } };
  if (MAC) ctxOpts.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const ctx = await browser.newContext(ctxOpts);
  if (MAC) await ctx.addInitScript(`Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });`);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
  try {
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(WAIT_SVG);
    await page.waitForTimeout(3000);
    await killTour(page); await page.waitForTimeout(2500); await killTour(page);
    out.platform = await page.evaluate(`navigator.platform`);
    out.isMacInApp = await page.evaluate(`/Mac|iPhone|iPad|iPod/.test(navigator.platform || '')`);

    // ---------- A. bare keys at DIV#zoomViewport, node selected ----------
    const KEYS = ['Tab', 'Shift+Tab', 'Enter', 'ArrowDown', 'Space', 'Home', 'End', 'PageDown'];
    for (const k of KEYS) {
      await reset(page);
      const clicked = await clickFirstNode(page);
      const vp = await focusViewportDiv(page);
      const before = await src(page);
      const fB = await fstate(page);
      await page.keyboard.press(k);
      await page.waitForTimeout(1100);
      const after = await src(page);
      rec({ test: 'A_bareKey_viewportDiv', key: k, clicked: !!clicked, vpFocused: vp,
        mutated: before !== after, before, after: before !== after ? after : null,
        focusBefore: fB, focusAfter: await fstate(page), post: await pstate(page) });
      await clearPopover(page);
    }

    // ---------- B. the creation route that must survive ----------
    const MOD = MAC ? 'Meta' : 'Control';
    for (const combo of [MOD + '+Enter', MOD + '+Shift+Enter']) {
      await reset(page);
      const clicked = await clickFirstNode(page);
      const before = await src(page);
      await page.keyboard.press(combo);
      await page.waitForTimeout(900);
      const popped = await pstate(page);
      let created = null, typed = null;
      if (popped.popover) {
        await page.keyboard.type('Recon step');
        await page.waitForTimeout(350);
        typed = await page.evaluate(`(() => { const i = document.querySelector('.canvas-popover input'); return i ? i.value : null; })()`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1600);
        const after = await src(page);
        created = { mutated: after !== before, after, popStillOpen: (await pstate(page)).popover };
      }
      rec({ test: 'B_creationRoute', combo, clicked: !!clicked, before, popped, typed, created });
      await clearPopover(page);
    }

    // ---------- C1. Tab with NOTHING selected (click empty canvas) ----------
    await reset(page);
    const vpRect = await page.evaluate(`(() => { const r = document.getElementById('zoomViewport').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
    await page.mouse.click(vpRect.x + 20, vpRect.y + vpRect.h - 20);
    await page.waitForTimeout(700);
    {
      const selNow = await pstate(page);
      await focusViewportDiv(page);
      const before = await src(page);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(1000);
      const after = await src(page);
      rec({ test: 'C1_tab_nothingSelected', handlesAfterEmptyClick: selNow.handles, mutated: before !== after, before, after: before !== after ? after : null, focusAfter: await fstate(page) });
    }
    // and Enter with nothing selected
    {
      await reset(page);
      await page.mouse.click(vpRect.x + 20, vpRect.y + vpRect.h - 20);
      await page.waitForTimeout(600);
      await focusViewportDiv(page);
      const before = await src(page);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      const after = await src(page);
      rec({ test: 'C1b_enter_nothingSelected', mutated: before !== after, before, after: before !== after ? after : null, focusAfter: await fstate(page) });
    }

    // ---------- C2. Tab in the Guided rows ----------
    await reset(page);
    const guided = await page.evaluate(`(async () => {
      document.getElementById('codeModeButton')?.click(); await new Promise(r => setTimeout(r, 500));
      document.getElementById('structureModeButton')?.click(); await new Promise(r => setTimeout(r, 1400));
      return document.querySelectorAll('#structureRows .struct-code').length; })()`);
    {
      const rowBox = await page.evaluate(`(() => { const r = document.querySelector('#structureRows .struct-code'); if (!r) return null; const b = r.getBoundingClientRect(); return { x: b.left + Math.min(24, b.width/2), y: b.top + b.height/2 }; })()`);
      let extra = {};
      if (rowBox) {
        await page.mouse.click(rowBox.x, rowBox.y); await page.waitForTimeout(700);
        const before = await src(page); const fB = await fstate(page);
        await page.keyboard.press('Tab'); await page.waitForTimeout(900);
        const after = await src(page);
        extra = { mutated: before !== after, before, after: before !== after ? after : null, focusBefore: fB, focusAfter: await fstate(page) };
      }
      rec({ test: 'C2_tab_guided', rows: guided, rowBox, ...extra });
    }
    await page.evaluate(`(() => { document.getElementById('textModeButton')?.click(); })()`);
    await page.waitForTimeout(600);

    // ---------- C3. Tab with the inspector open (focus inside the inspector) ----------
    await reset(page);
    await clickFirstNode(page);
    {
      const insp = await page.evaluate(`(() => { const i = document.getElementById('nodeInspector'); if (!i) return { present: false };
        const f = i.querySelector('input, select, textarea, button'); if (f) f.focus();
        return { present: true, hidden: !!i.hidden, focused: document.activeElement ? document.activeElement.tagName + '#' + (document.activeElement.id||'') : 'none' }; })()`);
      const before = await src(page); const fB = await fstate(page);
      await page.keyboard.press('Tab'); await page.waitForTimeout(900);
      const after = await src(page);
      rec({ test: 'C3_tab_inspectorOpen', insp, mutated: before !== after, before, after: before !== after ? after : null, focusBefore: fB, focusAfter: await fstate(page) });
    }

    // ---------- C4. Tab inside Docs ----------
    await reset(page);
    const docs = await page.evaluate(`(async () => { const b = document.getElementById('workpapersButton'); if (!b) return { opened: false, why: 'no button' };
      b.click(); await new Promise(r => setTimeout(r, 1800));
      const w = document.getElementById('wpWorkspace'); return { opened: !!(w && !w.hidden) }; })()`);
    {
      let extra = {};
      if (docs.opened) {
        const t = await page.evaluate(`(() => { const ed = document.querySelector('#wpWorkspace [contenteditable="true"]'); if (!ed) return null; const r = ed.getBoundingClientRect(); return { x: r.left + Math.min(40, r.width/2), y: r.top + Math.min(16, r.height/2) }; })()`);
        if (t) { await page.mouse.click(t.x, t.y); await page.waitForTimeout(700); }
        const before = await src(page); const fB = await fstate(page);
        await page.keyboard.press('Tab'); await page.waitForTimeout(900);
        const after = await src(page);
        extra = { target: t, mutated: before !== after, before, after: before !== after ? after : null, focusBefore: fB, focusAfter: await fstate(page) };
      }
      rec({ test: 'C4_tab_docs', docs, ...extra });
    }

    out.errors = errors;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 1200);
    out.errors = errors;
  } finally {
    console.log('KEYS_JSON ' + JSON.stringify(out));
    await browser.close(); server.close();
  }
})();
