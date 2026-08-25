#!/usr/bin/env node
/* Two claims my first pass measured badly. Redone.
 *
 * The first pass asked whether #diagramFontFamily has a non-zero box - which it does, at 1925px
 * down a scrolling column. That is layout, not visibility. "On screen" means inside the viewport,
 * and a control 1,000px below the fold is not on screen however real its rectangle is.
 *
 * The second pass at 375 found a button whose text merely CONTAINS "style" ("Reset all block
 * styles") instead of walking the Inspect route the claim is about. That measured nothing.
 *
 * Usage: node verify_reach_precisely.js [--app <path>] [--port 9845]
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9845'));
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

/* In the viewport, not merely laid out. */
const INVIEW = `(sel => {
  const e = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!e) return null;
  const r = e.getBoundingClientRect();
  const onScreen = r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight
    && r.right > 0 && r.left < innerWidth;
  return { top: Math.round(r.top), height: Math.round(r.height), inViewport: onScreen };
})`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  await setSource(page, SRC, 3000);
  console.log('\nMeasured on ' + APP + ', 1440x900\n');

  const rest = JSON.parse(await page.evaluate(`(() => {
    const inView = ${INVIEW};
    const styleWords = [];
    document.querySelectorAll('button, summary, a, label, h2, h3').forEach(e => {
      const t = (e.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!/style/i.test(t)) return;
      const v = inView(e);
      if (v) styleWords.push({ tag: e.tagName, text: t.slice(0, 34), top: v.top, inViewport: v.inViewport });
    });
    const pane = document.getElementById('editorPane') || document.querySelector('.pane');
    return JSON.stringify({
      styleWords,
      fontControl: inView('#diagramFontFamily'),
      viewportHeight: innerHeight,
      paneScrollHeight: pane ? pane.scrollHeight : null,
      paneClientHeight: pane ? pane.clientHeight : null
    });
  })()`));

  console.log('  Every control whose text mentions "Style", and whether it is IN THE VIEWPORT at rest:');
  rest.styleWords.forEach(w => console.log('    ' + (w.inViewport ? 'VISIBLE ' : 'below   ')
    + ('top ' + w.top).padEnd(12) + w.tag.padEnd(9) + JSON.stringify(w.text)));
  console.log('  #diagramFontFamily: ' + JSON.stringify(rest.fontControl));
  console.log('  editor column: ' + rest.paneScrollHeight + 'px of content in a ' + rest.paneClientHeight + 'px pane'
    + '  (' + (rest.paneScrollHeight / Math.max(1, rest.paneClientHeight)).toFixed(1) + ' screens)');
  const anyVisible = rest.styleWords.some(w => w.inViewport);
  console.log('  >> the word "Style" visible without scrolling: ' + (anyVisible ? 'YES' : 'NO'));

  // ---- the 375 route, walked properly through Inspect ----
  console.log('\n  At 375 wide, through the Inspect route the claim is about:');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1300);
  const shotA = await page.screenshot();
  const walk = JSON.parse(await page.evaluate(`(async () => {
    const inView = ${INVIEW};
    const trail = [];
    const press = e => { if (!e) return false; e.click(); trail.push('pressed ' + (e.id || (e.textContent||'').trim().slice(0,26))); return true; };
    const findVisible = re => Array.from(document.querySelectorAll('button, .struct-menu-item'))
      .find(b => re.test((b.textContent || '').replace(/\\s+/g,' ').trim()) && (inView(b) || {}).inViewport);

    // Inspect may itself be inside the header overflow at this width.
    let inspect = findVisible(/inspect/i);
    if (!inspect) { press(document.getElementById('headerMoreButton')); await new Promise(r => setTimeout(r, 700));
      inspect = findVisible(/inspect/i); }
    if (!inspect) return JSON.stringify({ trail, noInspect: true,
      visibleButtons: Array.from(document.querySelectorAll('button')).filter(b => (inView(b)||{}).inViewport)
        .map(b => (b.textContent||'').trim().slice(0,18)).slice(0, 14) });
    press(inspect); await new Promise(r => setTimeout(r, 800));

    // The row is the one that names fonts/colours/legend, not anything containing the word style.
    const row = Array.from(document.querySelectorAll('.struct-menu-item'))
      .find(b => /fonts|colours|colors|legend/i.test(b.textContent || ''));
    if (!row) return JSON.stringify({ trail, noRow: true,
      rows: Array.from(document.querySelectorAll('.struct-menu-item')).map(b => (b.textContent||'').trim().slice(0,30)) });
    press(row); await new Promise(r => setTimeout(r, 1200));

    const sec = document.getElementById('settingsSection');
    return JSON.stringify({ trail,
      settingsOpen: sec ? sec.open : 'absent',
      settingsInViewport: (inView(sec) || {}).inViewport,
      paneDisplay: sec && sec.closest('.pane') ? getComputedStyle(sec.closest('.pane')).display : null,
      fontControl: inView('#diagramFontFamily') });
  })()`));
  console.log('    ' + JSON.stringify(walk));
  const shotB = await page.screenshot();
  console.log('    screen pixel-identical before and after the whole walk? '
    + (Buffer.compare(shotA, shotB) === 0 ? 'YES' : 'no'));
  console.log('    console errors: ' + (errors.length ? errors.slice(0, 2).join(' // ') : 'none'));
  await close();
})();
