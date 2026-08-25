/* JOB BH skeptic probe 6 - what the arrival does BESIDES scrolling.
   Focus, ancestor scrolling, the refusal path, and whether a refusal still eats
   uncommitted text. Same script on both builds.
   node sk_bh_p6.js <appPath> <port> <tag> [scenario] */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4], ONLY = process.argv[5];

const WIDE = [
  'flowchart TD',
  '  START[Trial balance received] --> CTRL[Reconciliation of intercompany balances between subsidiary Alpha and subsidiary Bravo for the year ended 31 December]',
  '  CTRL --> DONE[Conclusion reached]'
].join('\n');

async function zoomInTimes(page, times) {
  await L.realClick(page, '#zoomMenuButton', 'zoom menu');
  await page.waitForTimeout(450);
  for (let i = 0; i < times; i++) {
    const box = await page.evaluate(() => { const n = document.getElementById('zoomInButton'); const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
    if (!(box.w > 1)) { await L.realClick(page, '#zoomMenuButton', 'reopen zoom menu'); await page.waitForTimeout(400); continue; }
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(200);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  return page.evaluate(() => { const t = Array.from(document.querySelectorAll('button,span')).map(n => (n.textContent || '').trim()).find(x => /^\d{2,4}\s*%$/.test(x)); return t || null; });
}

async function ancestorScrolls(page) {
  return page.evaluate(() => {
    const out = { window: window.scrollY, doc: document.scrollingElement ? document.scrollingElement.scrollTop : null, nodes: [] };
    let p = document.getElementById('zoomViewport');
    while (p && p !== document.documentElement) {
      out.nodes.push({ id: p.id, cls: String(p.className || '').slice(0, 40), top: p.scrollTop, left: p.scrollLeft });
      p = p.parentElement;
    }
    return out;
  });
}

async function focusInfo(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    return { tag: a.tagName, id: a.id, cls: String(a.className && a.className.baseVal !== undefined ? a.className.baseVal : a.className || '').slice(0, 50), inSvg: !!a.closest && !!a.closest('#diagram svg'), text: (a.textContent || '').trim().slice(0, 40) };
  });
}

/* An oversized block: reproduce the reported refusal and inspect the wreckage. */
async function scenarioRefusal() {
  const { page, errors, close } = await L.openApp(APP, PORT, { width: 1024, height: 700 });
  try {
    await L.setSource(page, WIDE, 3600);
    const pct = await zoomInTimes(page, 10);
    const ref = await L.makeReference(page, 'CTRL');
    await L.armObservers(page);
    const beforeAnc = await ancestorScrolls(page);
    const before = await L.snapshot(page, 'CTRL');
    await L.clickChip(page);
    await page.waitForTimeout(1600);
    const after = await L.snapshot(page, 'CTRL');
    const afterAnc = await ancestorScrolls(page);
    const focus = await focusInfo(page);
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_refusal_' + TAG + '.png' });
    return { pct, ref: ref.chip, before, after, beforeAnc, afterAnc, focus, errors: errors.slice() };
  } finally { await close(); }
}

/* A successful arrival: where does keyboard focus end up, and did anything but the
   canvas scroll? Short window on purpose - scrollIntoView climbs ancestors. */
async function scenarioSuccessFocus() {
  const { page, errors, close } = await L.openApp(APP, PORT + 1, { width: 1024, height: 460 });
  try {
    const src = ['flowchart TD'].concat(Array.from({ length: 12 }, (_, i) => '  N' + i + '[Step ' + i + '] --> N' + (i + 1) + '[Step ' + (i + 1) + ']')).join('\n');
    await L.setSource(page, src, 3400);
    const ref = await L.makeReference(page, 'N9');
    await L.armObservers(page);
    const beforeAnc = await ancestorScrolls(page);
    await L.clickChip(page);
    await page.waitForTimeout(1600);
    const after = await L.snapshot(page, 'N9');
    const afterAnc = await ancestorScrolls(page);
    const focus = await focusInfo(page);
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_short_' + TAG + '.png' });
    return { ref: ref.chip, after, beforeAnc, afterAnc, focus, errors: errors.slice() };
  } finally { await close(); }
}

/* Does a REFUSED arrival still eat the uncommitted Block label? And can Ctrl+Z get it back? */
async function scenarioRefusalClobber() {
  const { page, errors, close } = await L.openApp(APP, PORT + 2, { width: 1024, height: 700 });
  const out = {};
  try {
    await L.setSource(page, WIDE, 3600);
    out.pct = await zoomInTimes(page, 10);
    await L.realClick(page, '#visualModeButton', 'Build mode');
    await page.waitForTimeout(800);
    const hdr = await page.evaluate(() => {
      const f = document.getElementById('visualNodeEditLabel');
      let sec = f; while (sec && !(sec.classList && sec.classList.contains('visual-section'))) sec = sec.parentElement;
      const head = sec && (sec.querySelector('button, summary, .visual-section-head, [role="button"]') || sec.firstElementChild);
      if (!head) return null; const r = head.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, txt: (head.textContent || '').trim() };
    });
    if (hdr && hdr.w > 1) { await page.mouse.click(hdr.x, hdr.y); await page.waitForTimeout(600); }
    await page.selectOption('#visualNodeSelect', 'START').catch(() => {});
    await page.waitForTimeout(500);
    const box = await page.evaluate(() => { const n = document.getElementById('visualNodeEditLabel'); const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), v: n.value }; });
    out.labelBox = box;
    if (!(box.w > 1)) throw new Error('label field hidden: ' + JSON.stringify(box));
    await page.mouse.click(box.x, box.y, { clickCount: 3 });
    await page.keyboard.press('Control+A');
    await page.keyboard.type('DRAFT WORDING NOT YET APPLIED');
    out.typed = await page.$eval('#visualNodeEditLabel', n => n.value);

    const ref = await L.makeReference(page, 'CTRL');
    out.ref = ref.chip;
    await L.armObservers(page);
    await L.clickChip(page);
    await page.waitForTimeout(1600);
    out.afterChip = await page.$eval('#visualNodeEditLabel', n => n.value);
    const snap = await L.snapshot(page, 'CTRL');
    out.toasts = snap.toasts;
    out.inspectorHidden = snap.inspectorHidden;
    out.styleTarget = snap.styleTarget;
    out.buildSelect = snap.buildSelect;
    // Try to get it back the obvious way.
    const b2 = await page.evaluate(() => { const n = document.getElementById('visualNodeEditLabel'); const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width) }; });
    if (b2.w > 1) {
      await page.mouse.click(b2.x, b2.y);
      await page.keyboard.press('Control+Z');
      await page.waitForTimeout(400);
      out.afterUndoInField = await page.$eval('#visualNodeEditLabel', n => n.value);
    }
    // And the app's own undo.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.evaluate(() => document.body.focus());
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(700);
    out.afterAppUndo = await page.$eval('#visualNodeEditLabel', n => n.value);
    out.afterAppUndoToasts = await page.evaluate(() => (window.__toasts || []).map(t => t.text));
    out.errors = errors.slice();
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_refclobber_' + TAG + '.png' });
  } catch (e) { out.ERROR = String(e.message); }
  finally { await close(); }
  return out;
}

const RUN = { refusal: scenarioRefusal, successFocus: scenarioSuccessFocus, refusalClobber: scenarioRefusalClobber };
(async () => {
  const out = { tag: TAG, app: APP, scenarios: {} };
  for (const [n, fn] of Object.entries(RUN)) {
    if (ONLY && ONLY !== n) continue;
    try { out.scenarios[n] = await fn(); } catch (e) { out.scenarios[n] = { ERROR: String(e.message) }; }
  }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p6_' + TAG + (ONLY ? '_' + ONLY : '') + '.json', JSON.stringify(out, null, 1));
  console.log('WROTE skbh_p6_' + TAG + (ONLY ? '_' + ONLY : '') + '.json');
})();
