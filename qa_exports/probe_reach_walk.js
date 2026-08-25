/* REACH WALK — breadth-first over the pointer-reachable surface.
 *
 * Level 1 is whatever the browser will actually hand back at rest (hit-tested, not merely boxed).
 * Then every level-1 control that could plausibly REVEAL something is pressed once, and the probe
 * records what became clickable that was not clickable before. That difference is the level-2
 * surface, and the press that produced it is the first act of reading the person has to pay for.
 *
 * Between presses the app is returned to the resting set and the return is CHECKED. If the set
 * does not come back, the page is reloaded rather than measured in a dirty state - otherwise
 * "what this menu revealed" quietly becomes "what the previous menu left open".
 */
const { openApp } = require('./r7_lib.js');
const fs = require('fs');

const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9863);
const W = Number(process.argv[4] || 1440), H = Number(process.argv[5] || 900);
const DIR = 'C:/Claude/SIREN/qa_exports/reach';

const CLICKABLE = `(() => {
  const VW = window.innerWidth, VH = window.innerHeight;
  const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
  const label = (e) => {
    let t = clean(e.textContent);
    if (e.tagName === 'SELECT' || e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') t = '';
    if (!t) t = clean(e.getAttribute('aria-label'));
    if (!t && e.id) { const lf = document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); if (lf) t = clean(lf.textContent); }
    if (!t) t = clean(e.getAttribute('title'));
    if (!t) t = clean(e.getAttribute('placeholder'));
    return t.slice(0, 60);
  };
  const hit = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const pts = [[r.left + r.width/2, r.top + r.height/2], [r.left + 6, r.top + r.height/2], [r.right - 6, r.top + r.height/2]];
    for (const [x, y] of pts) {
      if (x < 0 || x > VW || y < 0 || y > VH) continue;
      const top = document.elementFromPoint(x, y);
      if (top && (top === e || e.contains(top) || top.contains(e))) return true;
    }
    return false;
  };
  const host = (e) => {
    let n = e.parentElement;
    while (n && n !== document.body) {
      if (n.classList && n.classList.contains('struct-menu')) return 'menu:' + (n.id || clean(n.className).slice(0,30));
      if (n.tagName === 'DIALOG') return 'dialog:' + (n.id || '?');
      if (n.tagName === 'DETAILS') return 'fold:' + (n.id || clean(n.querySelector(':scope > summary') && n.querySelector(':scope > summary').textContent).slice(0,26));
      n = n.parentElement;
    }
    return 'page';
  };
  const sel = 'button, select, summary, a[href], input:not([type=hidden]), textarea, [role=menuitem], [role=tab], [role=option], [role=button]';
  const out = [];
  Array.from(document.querySelectorAll(sel)).forEach(e => {
    if (!hit(e)) return;
    const r = e.getBoundingClientRect();
    out.push({ key: (e.id ? '#' + e.id : e.tagName.toLowerCase() + '|' + label(e)),
      id: e.id || '', tag: e.tagName.toLowerCase(), label: label(e), host: host(e),
      x: Math.round(r.left), y: Math.round(r.top),
      disabled: !!(e.disabled || e.getAttribute('aria-disabled') === 'true') });
  });
  return JSON.stringify(out);
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

async function snap(page) { return JSON.parse(await page.evaluate(CLICKABLE)); }

async function settleBack(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.evaluate(`(() => {
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    document.querySelectorAll('.struct-menu').forEach(m => m.remove());
  })()`);
  await page.mouse.click(700, 700);
  await page.waitForTimeout(350);
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  let ctx = await openApp(APP, PORT, { width: W, height: H });
  let page = ctx.page;
  await killTour(page);
  await page.waitForTimeout(600);

  const base = await snap(page);
  const baseKeys = new Set(base.map(r => r.key));
  console.log('LEVEL 1 (resting, hit-tested): ' + base.length + ' controls');

  // Everything at rest that might reveal rather than commit. Chosen from the level-1 set itself:
  // carets, ellipses, mode switches, folds and the preview-toolbar group buttons. Committing
  // controls (New blank, Add block, Use <shape>, Delete, Apply) are deliberately not pressed.
  const SKIP = /^(#newVisualFlowchartButton|#addVisualNodeButton|#addDiagramButton|#multiPreviewButton|#undoButton|#redoButton)$/;
  const SKIP_LABEL = /^(Use |＋|1Diagram)/;
  const openers = base.filter(r => !r.disabled && !SKIP.test(r.key) && !SKIP_LABEL.test(r.label) && r.tag !== 'input');

  const results = [];
  for (const op of openers) {
    // Fresh state every time, verified.
    await settleBack(page);
    let now = await snap(page);
    if (now.length !== base.length) {
      await ctx.close();
      ctx = await openApp(APP, PORT, { width: W, height: H });
      page = ctx.page;
      await killTour(page);
      await page.waitForTimeout(500);
      now = await snap(page);
      console.log('   (reloaded to restore the resting set)');
    }

    let clicked = true;
    try {
      await page.mouse.click(op.x + 8, op.y + 8);
    } catch (e) { clicked = false; }
    await page.waitForTimeout(650);

    const after = await snap(page);
    const fresh = after.filter(r => !baseKeys.has(r.key));
    const lost = base.filter(r => !after.some(a => a.key === r.key));
    const byHost = {};
    fresh.forEach(f => { (byHost[f.host] = byHost[f.host] || []).push(f.label || f.id); });

    results.push({ opener: op.key, label: op.label, clicked, revealed: fresh.length, lost: lost.length,
      hosts: Object.keys(byHost), items: fresh.map(f => ({ k: f.key, l: f.label, h: f.host, d: f.disabled })) });

    console.log('');
    console.log('PRESS ' + op.key + '  "' + op.label + '"  ->  +' + fresh.length + ' newly clickable, -' + lost.length);
    Object.entries(byHost).forEach(([h, arr]) => {
      console.log('    in ' + h + ':  ' + arr.slice(0, 24).join(' | ') + (arr.length > 24 ? ' …(+' + (arr.length - 24) + ')' : ''));
    });
    if (fresh.length) {
      const f = fresh[0];
      await page.screenshot({ path: DIR + '/open_' + (op.id || op.label.replace(/[^a-z0-9]/gi, '')).slice(0, 28) + '.png' });
    }
  }

  fs.writeFileSync(DIR + '/walk_' + W + '.json', JSON.stringify({ w: W, h: H, base, results }, null, 1));
  console.log('');
  console.log('page errors: ' + ctx.errors.length);
  ctx.errors.slice(0, 8).forEach(e => console.log('  ! ' + e));
  await ctx.close();
})();
