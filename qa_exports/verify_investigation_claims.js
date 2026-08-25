#!/usr/bin/env node
/* Three claims from the interface investigation, re-measured before they are presented.
 *
 *   1. At 375px the Inspect menu's Style row is a DEAD END - it opens a card on a pane the Preview
 *      tab has set to display:none, so the screen is pixel-identical and no console error warns.
 *   2. Setting a fill colour in the Style panel and then clicking the block SILENTLY DESTROYS it -
 *      the panel reverts and nothing is said.
 *   3. Reaching the diagram font costs 3 presses to see and 4 to act, and the word "Style" is
 *      painted nowhere on the resting screen.
 *
 * The investigation is other people's work. It gets the same treatment as Codex's.
 *
 * Usage: node verify_investigation_claims.js [--app <path>] [--port 9840]
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9840'));
const NL = String.fromCharCode(10);
const SRC = ['flowchart TD', '  A[Purchase request] --> B{Approved}', '  B --> C[Raise order]'].join(NL);

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card');
      if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(170);
  }
}

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  await setSource(page, SRC, 3000);
  console.log('\nMeasured on ' + APP + '\n');

  // ---------- 3. is the word "Style" anywhere at rest, and how deep is the font control ----------
  const resting = JSON.parse(await page.evaluate(`(() => {
    const seen = [];
    document.querySelectorAll('button, summary, a, label, h2, h3').forEach(e => {
      const t = (e.textContent || '').trim();
      if (!/^.{0,24}style/i.test(t)) return;
      const r = e.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) seen.push({ tag: e.tagName, id: e.id || null, text: t.slice(0, 30) });
    });
    const f = document.getElementById('diagramFontFamily');
    const fr = f ? f.getBoundingClientRect() : null;
    return JSON.stringify({
      visibleStyleWords: seen,
      fontControl: f ? { onScreen: !!(fr.width > 2 && fr.height > 2), top: Math.round(fr.top) } : 'absent',
      shortcutBtn: (() => { const b = document.getElementById('styleShortcutButton');
        if (!b) return 'absent';
        const cs = getComputedStyle(b); const r = b.getBoundingClientRect();
        return { display: cs.display, visible: r.width > 2 && r.height > 2 }; })()
    });
  })()`));
  console.log('  CLAIM 3 - "Style" is painted nowhere at rest');
  console.log('    visible controls whose text starts with/contains Style: ' + JSON.stringify(resting.visibleStyleWords));
  console.log('    #diagramFontFamily: ' + JSON.stringify(resting.fontControl));
  console.log('    #styleShortcutButton: ' + JSON.stringify(resting.shortcutBtn));

  // ---------- 2. does clicking a block destroy an unapplied fill ----------
  console.log('\n  CLAIM 2 - an unapplied fill is silently lost when you click the block');
  const fill = JSON.parse(await page.evaluate(`(async () => {
    const input = document.querySelector('#nodeFill, #blockFill, input[type="color"][id*="ill"]');
    if (!input) return JSON.stringify({ noControl: true,
      colorInputs: Array.from(document.querySelectorAll('input[type="color"]')).map(i => i.id).slice(0, 10) });
    const before = input.value;
    input.value = '#ff0000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    const set = input.value;
    const node = document.querySelector('#diagram svg g.node');
    if (!node) return JSON.stringify({ set, noNode: true });
    const r = node.getBoundingClientRect();
    return JSON.stringify({ id: input.id, before, set, nodeAt: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
  })()`));
  if (fill.noControl) {
    console.log('    could not reach a fill control from the resting screen: ' + JSON.stringify(fill.colorInputs));
  } else if (fill.nodeAt) {
    await page.mouse.click(fill.nodeAt.x, fill.nodeAt.y);
    await page.waitForTimeout(800);
    const after = JSON.parse(await page.evaluate(`(() => {
      const i = document.getElementById(${JSON.stringify(fill.id)});
      const toasts = Array.from(document.querySelectorAll('.toast, [role="status"]'))
        .filter(t => { const r = t.getBoundingClientRect(); return r.width > 2 && r.height > 2; })
        .map(t => (t.textContent || '').trim().slice(0, 70));
      return JSON.stringify({ now: i ? i.value : 'gone', toasts });
    })()`));
    console.log('    ' + fill.id + ': was ' + fill.before + ', set to ' + fill.set + ', after clicking the block: ' + after.now);
    console.log('    anything said about it? ' + JSON.stringify(after.toasts));
    console.log('    >> ' + (after.now !== fill.set ? 'THE UNAPPLIED VALUE IS GONE' : 'the value survived'));
  }

  // ---------- 1. the 375px dead end ----------
  console.log('\n  CLAIM 1 - at 375 the Style menu row is a dead end');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1200);
  const before375 = await page.screenshot();
  const nav = JSON.parse(await page.evaluate(`(async () => {
    const open = document.getElementById('headerMoreButton') || document.getElementById('mobileMoreButton');
    const trail = [];
    if (open) { open.click(); await new Promise(r => setTimeout(r, 700)); trail.push('opened ' + open.id); }
    let row = Array.from(document.querySelectorAll('.struct-menu-item, button'))
      .find(b => /style/i.test(b.textContent || '') && b.getBoundingClientRect().width > 2);
    if (!row) {
      const insp = Array.from(document.querySelectorAll('button')).find(b => /inspect/i.test(b.textContent || '') && b.getBoundingClientRect().width > 2);
      if (insp) { insp.click(); await new Promise(r => setTimeout(r, 700)); trail.push('opened Inspect');
        row = Array.from(document.querySelectorAll('.struct-menu-item')).find(b => /style/i.test(b.textContent || '')); }
    }
    if (!row) return JSON.stringify({ trail, noStyleRow: true });
    trail.push('found row: ' + (row.textContent || '').trim().slice(0, 34));
    row.click();
    await new Promise(r => setTimeout(r, 1100));
    const sec = document.getElementById('settingsSection');
    const f = document.getElementById('diagramFontFamily');
    const fr = f ? f.getBoundingClientRect() : null;
    return JSON.stringify({ trail,
      settingsOpen: sec ? sec.open : 'no #settingsSection',
      settingsDisplay: sec ? getComputedStyle(sec).display : null,
      paneDisplay: sec && sec.closest('.pane') ? getComputedStyle(sec.closest('.pane')).display : null,
      fontOnScreen: f ? !!(fr.width > 2 && fr.height > 2) : 'absent' });
  })()`));
  console.log('    ' + JSON.stringify(nav));
  const after375 = await page.screenshot();
  console.log('    screen identical before and after? ' + (Buffer.compare(before375, after375) === 0 ? 'YES - PIXEL IDENTICAL' : 'no, something changed'));
  console.log('    console errors during it: ' + (errors.length ? errors.slice(0, 2).join(' // ') : 'none'));

  await close();
})();
