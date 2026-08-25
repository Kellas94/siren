/* The word test, and the column in Code mode.
 *
 * "Hidden" has a plainer meaning than reach: can the person SEE the word they are looking for.
 * This reads only the text that is actually painted at rest - elements with a box, on screen,
 * not covered - and asks whether the vocabulary of the Style card appears anywhere in it.
 * Tooltips do not count: they need a hover, and a hover is not available on a touch screen.
 */
const { openApp } = require('./r7_lib.js');
const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9890);

const VISIBLE_TEXT = `(() => {
  const VW = innerWidth, VH = innerHeight;
  const out = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const t = String(n.nodeValue || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
    if (!t) continue;
    const p = n.parentElement;
    if (!p || !p.getClientRects().length) continue;
    const cs = getComputedStyle(p);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    if (p.closest('.sr-only')) continue;
    const r = p.getBoundingClientRect();
    if (r.bottom < 0 || r.top > VH || r.right < 0 || r.left > VW) continue;
    const top = document.elementFromPoint(Math.min(VW - 2, Math.max(2, r.left + Math.min(r.width/2, 20))), Math.min(VH - 2, Math.max(2, r.top + r.height/2)));
    if (!top || !(top === p || p.contains(top) || top.contains(p))) continue;
    out.push(t);
  }
  return JSON.stringify(out);
})()`;

const COLUMN = `(() => {
  const pane = document.querySelector('.pane-scroll');
  const card = document.getElementById('settingsSection');
  if (!pane || !card) return JSON.stringify(null);
  const r = card.getBoundingClientRect(), pr = pane.getBoundingClientRect();
  return JSON.stringify({ scrollHeight: Math.round(pane.scrollHeight), clientHeight: Math.round(pane.clientHeight),
    styleTop: Math.round(r.top - pr.top + pane.scrollTop) });
})()`;

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

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  await page.waitForTimeout(600);

  const words = ['Style', 'Font', 'Colour', 'Color', 'Legend', 'Spacing', 'Theme', 'Title', 'Export', 'Undo', 'Present', 'Filter', 'Zoom'];
  for (const mode of ['visual', 'code']) {
    if (mode === 'code') {
      await page.evaluate(`document.getElementById('codeModeButton').click()`);
      await page.waitForTimeout(900);
    }
    const text = JSON.parse(await page.evaluate(VISIBLE_TEXT));
    const blob = text.join(' | ');
    const col = JSON.parse(await page.evaluate(COLUMN));
    console.log('== ' + (mode === 'visual' ? 'Build (visual) mode' : 'Code mode') + ', 1440x900 ==');
    console.log('   left column: ' + col.scrollHeight + 'px of content in ' + col.clientHeight + 'px; Style card summary at ' + col.styleTop + 'px' +
      (col.styleTop > col.clientHeight ? '  (below the fold)' : '  (visible at rest)'));
    console.log('   words painted on screen at rest:');
    words.forEach(w => {
      const hits = text.filter(t => new RegExp('\\\\b' + w, 'i').test(t));
      console.log('      ' + w.padEnd(9) + (hits.length ? 'YES  e.g. "' + hits[0].slice(0, 44) + '"' : 'not on screen'));
    });
    console.log('');
  }
  console.log('page errors: ' + errors.length);
  await close();
})();
