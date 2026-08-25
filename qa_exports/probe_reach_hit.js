/* REACH, hit-tested.
 *
 * The first census called a control "visible" if it had a box inside the viewport. That is wrong:
 * the Build panel and the Code panel are both laid out at x=40, so #cleanCodeButton reported
 * visible while the screenshot shows shape swatches at those coordinates. This version asks the
 * browser what is actually under the pixel (elementFromPoint) before believing anything, and it
 * also records how far each control's own scroll container is from showing it.
 */
const { openApp } = require('./r7_lib.js');
const fs = require('fs');

const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9862);
const W = Number(process.argv[4] || 1440), H = Number(process.argv[5] || 900);

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent))
        || card.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(180);
  }
}

const HIT = `(() => {
  const VW = window.innerWidth, VH = window.innerHeight;
  const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();

  const label = (e) => {
    let t = clean(e.textContent);
    if (e.tagName === 'SELECT' || e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') t = '';
    if (!t) t = clean(e.getAttribute('aria-label'));
    if (!t && e.id) { const lf = document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); if (lf) t = clean(lf.textContent); }
    if (!t) t = clean(e.getAttribute('title'));
    if (!t) t = clean(e.getAttribute('placeholder'));
    return t.slice(0, 70);
  };

  // Does the browser actually hand this element (or a child of it) back at its own centre?
  const hitTest = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return 'no-box';
    const pts = [[r.left + r.width/2, r.top + r.height/2],
                 [r.left + 6, r.top + r.height/2],
                 [r.right - 6, r.top + r.height/2]];
    for (const [x, y] of pts) {
      if (x < 0 || x > VW || y < 0 || y > VH) continue;
      const top = document.elementFromPoint(x, y);
      if (!top) continue;
      if (top === e || e.contains(top) || top.contains(e)) return 'hit';
    }
    const anyIn = pts.some(([x,y]) => x >= 0 && x <= VW && y >= 0 && y <= VH);
    return anyIn ? 'occluded' : 'offscreen';
  };

  // The nearest scrollable ancestor, and how far it would have to scroll to show this control.
  const scrollGap = (e) => {
    let n = e.parentElement;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 4) {
        const cr = n.getBoundingClientRect(), er = e.getBoundingClientRect();
        let need = 0;
        if (er.top < cr.top) need = Math.round(cr.top - er.top);
        else if (er.bottom > cr.bottom) need = Math.round(er.bottom - cr.bottom);
        return { host: n.id || clean(n.className).slice(0,40), need,
                 scrollTop: Math.round(n.scrollTop), scrollHeight: Math.round(n.scrollHeight), clientHeight: Math.round(n.clientHeight) };
      }
      n = n.parentElement;
    }
    return null;
  };

  const gates = (e) => {
    const g = [];
    let n = e.parentElement;
    while (n && n !== document.body) {
      if (n.tagName === 'DETAILS' && !n.open) {
        const s = n.querySelector(':scope > summary');
        g.push({ kind: 'closed-details', id: n.id || '', name: clean(s && s.textContent).slice(0, 46) });
      } else if (n.tagName === 'DIALOG' && !n.open) {
        g.push({ kind: 'closed-dialog', id: n.id || '', name: '' });
      } else if (n.classList && n.classList.contains('struct-menu')) {
        g.push({ kind: 'popup-menu', id: n.id || '', name: '' });
      } else {
        const cs = getComputedStyle(n);
        if (n.hasAttribute('hidden') || cs.display === 'none') {
          g.push({ kind: 'hidden-container', id: n.id || '', name: clean(n.className).slice(0, 44) });
        }
      }
      n = n.parentElement;
    }
    return g;
  };

  const sel = 'button, select, summary, a[href], input:not([type=hidden]), textarea, [role=menuitem], [role=tab], [role=option]';
  const rows = Array.from(document.querySelectorAll(sel)).map(e => {
    const r = e.getBoundingClientRect();
    const g = gates(e);
    return {
      tag: e.tagName.toLowerCase(), id: e.id || '', cls: clean(e.className).slice(0, 60), label: label(e),
      hit: hitTest(e), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      disabled: !!(e.disabled || e.getAttribute('aria-disabled') === 'true'),
      gates: g, gateCount: g.length, scroll: scrollGap(e)
    };
  });
  return JSON.stringify({ vw: VW, vh: VH, rows });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: W, height: H });
  await killTour(page);
  await page.waitForTimeout(600);
  const d = JSON.parse(await page.evaluate(HIT));
  fs.mkdirSync('C:/Claude/SIREN/qa_exports/reach', { recursive: true });
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/reach/hit_' + W + '.json', JSON.stringify(d, null, 1));

  const hit = d.rows.filter(r => r.hit === 'hit');
  const occ = d.rows.filter(r => r.hit === 'occluded');
  console.log('viewport ' + d.vw + 'x' + d.vh);
  console.log('controls in DOM        : ' + d.rows.length);
  console.log('actually clickable now : ' + hit.length);
  console.log('boxed but occluded     : ' + occ.length);
  console.log('no box / offscreen     : ' + d.rows.filter(r => r.hit === 'no-box' || r.hit === 'offscreen').length);
  console.log('');
  console.log('=== clickable at rest, in reading order ===');
  hit.sort((a,b) => a.y - b.y || a.x - b.x).forEach(r =>
    console.log('  (' + String(r.x).padStart(4) + ',' + String(r.y).padStart(3) + ') ' + r.tag + ' #' + (r.id || '-') + '  ' + r.label + (r.disabled ? '   [DISABLED]' : '')));
  console.log('');
  console.log('=== scroll containers that hide things ===');
  const hosts = {};
  d.rows.forEach(r => { if (r.scroll && r.scroll.scrollHeight > r.scroll.clientHeight + 4) hosts[r.scroll.host] = r.scroll; });
  Object.entries(hosts).forEach(([k, v]) => console.log('  ' + k + '  content ' + v.scrollHeight + 'px in ' + v.clientHeight + 'px viewport (' + Math.round(v.scrollHeight / Math.max(1,v.clientHeight) * 100) + '%)'));
  console.log('');
  console.log('page errors: ' + errors.length);
  await close();
})();
