/* SKEPTIC probe 2 - the second click of a marker double-click lands on whatever Docs
 * renders at that pixel. Aim the marker at a DESTRUCTIVE control and see what happens.
 * Usage: node sk_marker_probe2.js <appPath> <port> <tag>
 */
const path = require('path');
const fs = require('fs');
const lib = require('./r7_lib.js');

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const TAG = process.argv[4] || 'x';
const HERE = __dirname;

const FIXTURE = [
  'flowchart TD',
  '  A[Alpha step] --> B[Bravo step]',
  '  B --> C[Charlie step]',
  '  D[Delta step] --> A'
].join('\n');

const out = { app: APP, tag: TAG, t: {}, errors: [] };

async function ev(page, expr) {
  return JSON.parse(await page.evaluate('JSON.stringify((() => { ' + expr + ' })())'));
}

async function killTour(page) {
  for (let i = 0; i < 20; i++) {
    const gone = await ev(page, `
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || card.querySelector('button');
      if (b) b.click();
      return false;`);
    if (gone && i > 4) return;
    await page.waitForTimeout(150);
  }
}

async function reset(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  await ev(page, `
    const wp = document.getElementById('wpWorkspace');
    if (wp && !wp.hidden) { const c = document.getElementById('closeWpButton'); if (c) c.click(); }
    const insp = document.getElementById('nodeInspector');
    if (insp && !insp.hidden) { const d = document.getElementById('inspectorDoneButton'); if (d) d.click(); }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    const menu = document.querySelector('.struct-menu'); if (menu) menu.remove();
    return 1;`);
  await page.waitForTimeout(250);
}

async function geom(page, id) {
  return ev(page, `
    const m = document.querySelector('#diagram [data-t-workpaper-node="${id}"]');
    const rect = m ? m.querySelector('rect') : null;
    const f = v => v === null ? null : +Number(v).toFixed(2);
    const box = b => b ? { x: f(b.x), y: f(b.y), w: f(b.width), h: f(b.height), cx: f(b.x + b.width/2), cy: f(b.y + b.height/2) } : null;
    return { rect: box(rect ? rect.getBoundingClientRect() : null) };`);
}

async function makeDoc(page, id) {
  await reset(page);
  const c = await ev(page, `
    const groups = Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]'));
    for (const grp of groups) {
      const gid = grp.getAttribute('data-node-id') || grp.getAttribute('id') || '';
      if (gid === '${id}' || gid.indexOf('-${id}-') >= 0 || gid.slice(-2) === '-${id}') { const b = grp.getBoundingClientRect(); return { x: b.x + b.width/2, y: b.y + b.height/2 }; }
    }
    return null;`);
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(700);
  await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({block:'center'}); } return 1;`);
  await page.waitForTimeout(350);
  const b = await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width };`);
  if (b && b.w > 2) await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1300);
  await reset(page);
  await page.waitForTimeout(400);
}

async function zoomIn(page, steps) {
  for (let i = 0; i < steps; i++) {
    await ev(page, `const z = document.getElementById('zoomInButton'); if (z) z.click(); return 1;`);
    await page.waitForTimeout(180);
  }
  await page.waitForTimeout(700);
}

/* Scroll the canvas until block id's marker centre sits on (tx, ty). */
async function placeMarker(page, id, tx, ty) {
  let g = null;
  for (let i = 0; i < 14; i++) {
    g = await geom(page, id);
    if (!g.rect) return { ok: false, why: 'no marker' };
    const dx = g.rect.cx - tx, dy = g.rect.cy - ty;
    if (Math.abs(dx) < 1.2 && Math.abs(dy) < 1.2) return { ok: true, rect: g.rect, iters: i };
    const moved = await ev(page, `
      const z = document.getElementById('zoomViewport');
      const bl = z.scrollLeft, bt = z.scrollTop;
      z.scrollLeft = bl + ${dx}; z.scrollTop = bt + ${dy};
      return { dl: z.scrollLeft - bl, dt: z.scrollTop - bt, l: z.scrollLeft, t: z.scrollTop,
               maxL: z.scrollWidth - z.clientWidth, maxT: z.scrollHeight - z.clientHeight };`);
    await page.waitForTimeout(120);
    if (Math.abs(moved.dl) < 0.5 && Math.abs(moved.dt) < 0.5) {
      g = await geom(page, id);
      return { ok: false, why: 'scroll exhausted', rect: g.rect, scroll: moved, want: { tx, ty } };
    }
  }
  return { ok: false, why: 'no converge', rect: g && g.rect };
}

async function docsState(page) {
  return ev(page, `
    const wp = document.getElementById('wpWorkspace');
    const chips = Array.from(document.querySelectorAll('#wpLinkChips .wp-link-chip')).map(c => (c.textContent||'').replace(/\\s+/g,' ').trim().slice(0,60));
    return {
      docsOpen: !!(wp && !wp.hidden),
      chips: chips,
      chipCount: chips.length,
      markers: document.querySelectorAll('#diagram [data-t-workpaper-node]').length,
      wpCount: ((document.getElementById('wpCount')||{}).textContent||'').trim(),
      title: (document.getElementById('wpTitle')||{}).value || '',
      blocks: document.querySelectorAll('#wpBlocks .wp-block').length,
      toast: Array.from(document.querySelectorAll('.toast, [class*="toast"]')).map(t=>(t.textContent||'').replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0,4),
      dialog: (function(){ const d = document.querySelector('dialog[open]'); return d ? (d.innerText||'').replace(/\\s+/g,' ').trim().slice(0,140) : null; })()
    };`);
}

async function under(page, x, y) {
  return ev(page, `
    const el = document.elementFromPoint(${x}, ${y});
    return { tag: el ? (el.tagName||'').toLowerCase() : null, id: el ? el.id : null,
             aria: el ? (el.getAttribute('aria-label')||'') : '',
             text: el ? (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,50) : '',
             cls: el && typeof el.className === 'string' ? el.className.slice(0,50) : '' };`);
}

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  out.errors = errors;
  try {
    await killTour(page);
    await lib.setSource(page, FIXTURE, 3200);
    await makeDoc(page, 'B');
    await zoomIn(page, 8);
    out.t.viewport = await ev(page, `
      const z = document.getElementById('zoomViewport'); const r = z.getBoundingClientRect();
      const f = v => +Number(v).toFixed(1);
      return { x: f(r.x), y: f(r.y), w: f(r.width), h: f(r.height), maxL: z.scrollWidth - z.clientWidth, maxT: z.scrollHeight - z.clientHeight };`);

    // Learn the exact rect of the destructive controls with Docs open.
    {
      const g = await geom(page, 'B');
      await page.mouse.click(g.rect.cx, g.rect.cy);
      await page.waitForTimeout(900);
      out.t.targets = await ev(page, `
        const f = v => +Number(v).toFixed(1);
        const pick = sel => { const b = document.querySelector(sel); if (!b) return null; const r = b.getBoundingClientRect(); return { sel: sel, label: (b.getAttribute('aria-label')||b.title||b.textContent||'').replace(/\\s+/g,' ').trim().slice(0,50), cx: f(r.x + r.width/2), cy: f(r.y + r.height/2), w: f(r.width), h: f(r.height) }; };
        return { chipRemove: pick('#wpLinkChips .wp-chip-remove'), undo: pick('#wpUndoButton'),
                 docMenu: pick('#wpDocMenuButton'), addBlock: pick('#wpAddBlockButton'),
                 registerRow: pick('#wpList button'), close: pick('#closeWpButton') };`);
      await reset(page);
      await page.waitForTimeout(400);
    }

    async function aimAndDouble(name, target, prep) {
      await reset(page);
      if (!target) { out.t[name] = { skipped: 'no target' }; return; }
      if (prep) await prep();
      const placed = await placeMarker(page, 'B', target.cx, target.cy);
      const beforeDocs = await docsState(page);
      const beforeSrc = await page.evaluate("document.getElementById('source').value");
      if (!placed.ok) { out.t[name] = { placed: placed, target: target, note: 'could not aim' }; return; }
      const whatIsThereClosed = await under(page, target.cx, target.cy);
      await page.mouse.dblclick(target.cx, target.cy);
      await page.waitForTimeout(1000);
      const after = await docsState(page);
      const whatIsThereOpen = await under(page, target.cx, target.cy);
      await page.screenshot({ path: path.join(HERE, 'sk_' + TAG + '_' + name + '.png') });
      out.t[name] = {
        target: target, placed: placed, underBeforeClosedDocs: whatIsThereClosed, underAfter: whatIsThereOpen,
        before: beforeDocs, after: after,
        chipsLost: beforeDocs.chipCount - after.chipCount,
        markersLost: beforeDocs.markers - after.markers,
        sourceChanged: beforeSrc !== (await page.evaluate("document.getElementById('source').value"))
      };
      await reset(page);
    }

    await aimAndDouble('aim_chipRemove', out.t.targets.chipRemove);
    await aimAndDouble('aim_undo', out.t.targets.undo);
    await aimAndDouble('aim_docMenu', out.t.targets.docMenu);
    await aimAndDouble('aim_addBlock', out.t.targets.addBlock);

    out.done = true;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 900);
  }
  fs.writeFileSync(path.join(HERE, 'sk2_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('WROTE sk2_' + TAG + '.json fatal=' + (out.fatal || 'none') + ' errors=' + out.errors.length);
  await close();
  process.exit(0);
})();
