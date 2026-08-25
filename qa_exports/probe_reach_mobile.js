/* The 375-wide routes, measured on their own terms.
 *
 * The desktop route table fails at 375 because the whole preview toolbar lives behind the
 * mobile Preview tab. That failure is not the measurement - it is the reason to measure again
 * with the mobile chrome in the route. Everything here is screenshotted so the claim can be
 * checked against the picture rather than against my description of it.
 */
const { openApp } = require('./r7_lib.js');
const fs = require('fs');

const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9877);
const DIR = 'C:/Claude/SIREN/qa_exports/reach';

const FIND = `(spec) => {
  const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
  let e = spec.id ? document.getElementById(spec.id) : null;
  if (!e && spec.text) {
    const scope = spec.scope ? document.querySelector(spec.scope) : document;
    if (!scope) return null;
    const rx = new RegExp(spec.text, 'i');
    e = Array.from(scope.querySelectorAll(spec.sel || 'button, summary, [role=button], .struct-menu-item'))
      .find(c => rx.test(clean(c.textContent)) || rx.test(clean(c.getAttribute('aria-label')))) || null;
  }
  if (!e) return null;
  const r = e.getBoundingClientRect(), VW = innerWidth, VH = innerHeight;
  let hit = false, blocker = '';
  for (const [x, y] of [[r.left + r.width/2, r.top + r.height/2], [r.left + 6, r.top + r.height/2]]) {
    if (x < 0 || x > VW || y < 0 || y > VH) continue;
    const top = document.elementFromPoint(x, y);
    if (top && (top === e || e.contains(top) || top.contains(e))) { hit = true; break; }
    if (top && !blocker) blocker = top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + '.' + clean(top.className).split(' ')[0];
  }
  return { hit, blocker, x: r.left + r.width/2, y: r.top + r.height/2,
           top: Math.round(r.top), bottom: Math.round(r.bottom), vh: VH,
           label: clean(e.textContent).slice(0, 40), disabled: !!(e.disabled || e.getAttribute('aria-disabled') === 'true') };
}`;

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card'); if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click(); return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(170);
  }
}
const find = (page, spec) => page.evaluate('(' + FIND + ')(' + JSON.stringify(spec) + ')');

const ROUTES = [
  { verb: 'Style: change the diagram font (mobile)', freq: 'often', shot: 'm_style',
    steps: [{ id: 'mobilePreviewTab' }, { id: 'previewInspectButton' },
            { text: '^Style', scope: '.struct-menu', sel: '.struct-menu-item' },
            { text: '^Fonts', scope: '#styleFoldFonts', sel: 'summary' }],
    target: { id: 'diagramFontFamily' } },
  { verb: 'Style: one block fill colour (mobile)', freq: 'every session', shot: 'm_block',
    steps: [{ id: 'mobilePreviewTab' }, { id: 'NODE' }], target: { id: 'inspectorFillColor' } },
  { verb: 'Export as PNG (mobile)', freq: 'every session', shot: 'm_png',
    steps: [{ id: 'mobileExportButton' }], target: { id: 'exportPngButton' } },
  { verb: 'Zoom: fit page (mobile)', freq: 'every session', shot: 'm_zoom',
    steps: [{ id: 'mobilePreviewTab' }, { id: 'zoomMenuButton' }], target: { id: 'fitPageButton' } },
  { verb: 'Filters (mobile)', freq: 'often', shot: 'm_filter',
    steps: [{ id: 'mobilePreviewTab' }], target: { id: 'filterButton' } },
  { verb: 'Present (mobile)', freq: 'often', shot: 'm_present',
    steps: [{ id: 'mobilePreviewTab' }], target: { id: 'presentButton' } },
  { verb: 'Change the theme (mobile)', freq: 'often', shot: 'm_theme',
    steps: [{ id: 'mobileMoreButton' }], target: { id: 'themeMenuButton' } },
];

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  for (const route of ROUTES) {
    const ctx = await openApp(APP, PORT, { width: 375, height: 812 });
    const page = ctx.page;
    await killTour(page);
    await page.waitForTimeout(450);

    let presses = 0, scrolls = 0, failed = null;
    for (let i = 0; i < route.steps.length; i++) {
      let spec = route.steps[i];
      if (spec.id === 'NODE') {
        const nid = await page.evaluate(`(() => { const n = document.querySelector('#diagram svg .node, #diagram svg g.node'); return n ? n.id : ''; })()`);
        spec = { id: nid };
      }
      let info = await find(page, spec);
      if (!info) { failed = 'not in DOM: ' + JSON.stringify(spec); break; }
      if (!info.hit) {
        await page.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(spec.id || '')}); if (e) e.scrollIntoView({block:'center'}); })()`);
        await page.waitForTimeout(300); scrolls++;
        info = await find(page, spec);
        if (!info || !info.hit) { failed = 'blocked by ' + (info ? info.blocker : '?') + ' at step ' + (i + 1); break; }
      }
      await page.mouse.click(info.x, info.y);
      presses++;
      await page.waitForTimeout(750);
    }

    let end = await find(page, route.target);
    let note = '';
    if (end && !end.hit) {
      note = 'target box top=' + end.top + ' bottom=' + end.bottom + ' of vh=' + end.vh + ', covered by ' + end.blocker;
      await page.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(route.target.id)}); if (e) e.scrollIntoView({block:'center'}); })()`);
      await page.waitForTimeout(320);
      const again = await find(page, route.target);
      if (again && again.hit) { scrolls++; end = again; note += '  (reached after scrolling)'; }
      else note += '  STILL UNREACHABLE';
    }
    await page.screenshot({ path: DIR + '/' + route.shot + '.png' });
    console.log((failed ? 'XX ' : (end && end.hit ? 'ok ' : '?? ')) +
      'reach=' + (presses + 1) + ' scroll=' + scrolls + ' | ' + route.freq.padEnd(13) + ' | ' + route.verb +
      (failed ? '   << ' + failed : '') + (note ? '   ' + note : '') + (end && end.disabled ? '  [DISABLED]' : ''));
    await ctx.close();
  }
})();
