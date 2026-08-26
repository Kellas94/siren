/* SKEPTIC probe 3 - land the marker on a MUTATING Docs control and double-click it.
 * Usage: node sk_marker_probe3.js <appPath> <port> <tag>
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
  '  A[Alpha step of the review] --> B[Bravo step of the review]',
  '  B --> C[Charlie step of the review]',
  '  C --> E[Echo step of the review]',
  '  E --> F[Foxtrot step of the review]',
  '  D[Delta step of the review] --> A',
  '  G[Golf step of the review] --> H[Hotel step of the review]'
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
  await page.waitForTimeout(140);
  await ev(page, `
    const wp = document.getElementById('wpWorkspace');
    if (wp && !wp.hidden) { const c = document.getElementById('closeWpButton'); if (c) c.click(); }
    const insp = document.getElementById('nodeInspector');
    if (insp && !insp.hidden) { const d = document.getElementById('inspectorDoneButton'); if (d) d.click(); }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    const menu = document.querySelector('.struct-menu'); if (menu) menu.remove();
    return 1;`);
  await page.waitForTimeout(280);
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
  await page.waitForTimeout(1400);
  await reset(page);
  await page.waitForTimeout(400);
}

async function zoomIn(page, steps) {
  for (let i = 0; i < steps; i++) {
    await ev(page, `const z = document.getElementById('zoomInButton'); if (z) z.click(); return 1;`);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(700);
}

async function placeMarker(page, id, tx, ty) {
  let g = null;
  for (let i = 0; i < 18; i++) {
    g = await geom(page, id);
    if (!g.rect) return { ok: false, why: 'no marker' };
    const dx = g.rect.cx - tx, dy = g.rect.cy - ty;
    if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) return { ok: true, rect: g.rect, iters: i };
    const moved = await ev(page, `
      const z = document.getElementById('zoomViewport');
      const bl = z.scrollLeft, bt = z.scrollTop;
      z.scrollLeft = bl + ${dx}; z.scrollTop = bt + ${dy};
      return { dl: z.scrollLeft - bl, dt: z.scrollTop - bt, maxL: z.scrollWidth - z.clientWidth, maxT: z.scrollHeight - z.clientHeight };`);
    await page.waitForTimeout(110);
    if (Math.abs(moved.dl) < 0.5 && Math.abs(moved.dt) < 0.5) {
      g = await geom(page, id);
      const dx2 = g.rect.cx - tx, dy2 = g.rect.cy - ty;
      if (Math.abs(dx2) < 1.5 && Math.abs(dy2) < 1.5) return { ok: true, rect: g.rect, iters: i };
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
      chips: chips, chipCount: chips.length,
      markers: document.querySelectorAll('#diagram [data-t-workpaper-node]').length,
      wpCount: ((document.getElementById('wpCount')||{}).textContent||'').trim(),
      blocks: document.querySelectorAll('#wpBlocks .wp-block').length,
      docText: ((document.getElementById('wpBlocks')||{}).innerText||'').replace(/\\s+/g,' ').trim(),
      inplace: (function(){ const i = document.getElementById('canvasInplace'); return i ? i.value : null; })(),
      toast: Array.from(document.querySelectorAll('.toast, [class*="toast"]')).map(t=>(t.textContent||'').replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0,4),
      dialog: (function(){ const d = document.querySelector('dialog[open]'); return d ? (d.innerText||'').replace(/\\s+/g,' ').trim().slice(0,160) : null; })(),
      menu: (function(){ const m = document.querySelector('.struct-menu'); return m ? Array.from(m.querySelectorAll('.struct-menu-item,.struct-menu-heading')).map(x=>(x.textContent||'').replace(/\\s+/g,' ').trim()).slice(0,14) : null; })()
    };`);
}

async function under(page, x, y) {
  return ev(page, `
    const el = document.elementFromPoint(${x}, ${y});
    return { tag: el ? (el.tagName||'').toLowerCase() : null, id: el ? el.id : null,
             aria: el ? (el.getAttribute('aria-label')||'') : '',
             text: el ? (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,50) : '' };`);
}

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  out.errors = errors;
  try {
    await killTour(page);
    await lib.setSource(page, FIXTURE, 3400);
    out.fixtureSource = await page.evaluate("document.getElementById('source').value");
    await makeDoc(page, 'B');
    out.t.viewport0 = await ev(page, `
      const z = document.getElementById('zoomViewport'); const r = z.getBoundingClientRect();
      const f = v => +Number(v).toFixed(1);
      return { x: f(r.x), y: f(r.y), w: f(r.width), h: f(r.height), maxL: z.scrollWidth - z.clientWidth, maxT: z.scrollHeight - z.clientHeight, zoom: (document.getElementById('zoomValue')||{}).textContent };`);

    // ---- write something into the document the way a person would ----
    {
      const g = await geom(page, 'B');
      await page.mouse.click(g.rect.cx, g.rect.cy);
      await page.waitForTimeout(1000);
      const blk = await ev(page, `
        const b = Array.from(document.querySelectorAll('#wpBlocks .wp-text, #wpBlocks [role="textbox"]'))
          .map(n => ({ n, r: n.getBoundingClientRect() }))
          .find(o => o.r.width > 60 && o.r.height > 12 && o.r.top > 250 && o.r.bottom < 880);
        if (!b) return null;
        const f = v => +Number(v).toFixed(1);
        return { cx: f(b.r.x + 40), cy: f(b.r.y + b.r.height/2), aria: b.n.getAttribute('aria-label')||'', text: (b.n.innerText||'').slice(0,60) };`);
      out.t.typedInto = blk;
      if (blk) {
        await page.mouse.click(blk.cx, blk.cy);
        await page.waitForTimeout(300);
        await page.keyboard.type('SKEPTICMARK', { delay: 40 });
        await page.waitForTimeout(900);
      }
      const s = await docsState(page);
      out.t.after_typing = { hasMark: s.docText.indexOf('SKEPTICMARK') >= 0, len: s.docText.length };
      // targets, measured with Docs open
      out.t.targets = await ev(page, `
        const f = v => +Number(v).toFixed(1);
        const pick = sel => { const b = document.querySelector(sel); if (!b) return null; const r = b.getBoundingClientRect(); return { sel: sel, label: (b.getAttribute('aria-label')||b.title||b.textContent||'').replace(/\\s+/g,' ').trim().slice(0,50), cx: f(r.x + r.width/2), cy: f(r.y + r.height/2), w: f(r.width), h: f(r.height) }; };
        return { undo: pick('#wpUndoButton'), addBlock: pick('#wpAddBlockButton'), bold: pick('#wpBoldButton'),
                 chipRemove: pick('#wpLinkChips .wp-chip-remove'), docMenu: pick('#wpDocMenuButton'),
                 contents: pick('#wpContentsButton'), close: pick('#closeWpButton') };`);
      await reset(page);
      await page.waitForTimeout(500);
      await zoomIn(page, 20);
      out.t.viewport = await ev(page, `
        const z = document.getElementById('zoomViewport'); const r = z.getBoundingClientRect();
        const f = v => +Number(v).toFixed(1);
        return { x: f(r.x), y: f(r.y), w: f(r.width), h: f(r.height), maxL: z.scrollWidth - z.clientWidth, maxT: z.scrollHeight - z.clientHeight, zoom: (document.getElementById('zoomValue')||{}).textContent };`);
    }

    async function aimAndDouble(name, target) {
      await reset(page);
      if (!target) { out.t[name] = { skipped: 'no target' }; return; }
      const placed = await placeMarker(page, 'B', target.cx, target.cy);
      const beforeSrc = await page.evaluate("document.getElementById('source').value");
      const beforeUnder = await under(page, target.cx, target.cy);
      if (!placed.ok) { out.t[name] = { placed, target, beforeUnder, note: 'could not aim' }; return; }
      // read the document state before, without disturbing the aim
      const before = await docsState(page);
      await page.mouse.dblclick(target.cx, target.cy);
      await page.waitForTimeout(1200);
      const after = await docsState(page);
      const afterUnder = await under(page, target.cx, target.cy);
      await page.screenshot({ path: path.join(HERE, 'sk3_' + TAG + '_' + name + '.png') });
      out.t[name] = {
        target, placed, beforeUnder, afterUnder,
        docsOpen: after.docsOpen, blocksBefore: before.blocks, blocksAfter: after.blocks,
        markersBefore: before.markers, markersAfter: after.markers,
        chipsBefore: before.chipCount, chipsAfter: after.chipCount,
        markGone: after.docsOpen ? (after.docText.indexOf('SKEPTICMARK') < 0) : null,
        docTextLenBefore: before.docText.length, docTextLenAfter: after.docText.length,
        inplace: after.inplace, dialog: after.dialog, menu: after.menu, toast: after.toast,
        sourceChanged: beforeSrc !== (await page.evaluate("document.getElementById('source').value"))
      };
      // put the mark back if undo removed it, so later aims start from the same place
      await reset(page);
    }

    await aimAndDouble('aim_undo', out.t.targets.undo);
    // does the accidental undo survive closing and reopening the document?
    {
      await reset(page);
      const placed = await placeMarker(page, 'B', 900, 520);
      if (placed.ok) {
        await page.mouse.click(900, 520);
        await page.waitForTimeout(1100);
        const s = await docsState(page);
        out.t.undo_persisted = { docsOpen: s.docsOpen, markStillGone: s.docText.indexOf('SKEPTICMARK') < 0, len: s.docText.length };
      } else out.t.undo_persisted = { placed };
      await reset(page);
    }
    await aimAndDouble('aim_addBlock', out.t.targets.addBlock);
    await aimAndDouble('aim_docMenu', out.t.targets.docMenu);
    await aimAndDouble('aim_chipRemove', out.t.targets.chipRemove);

    out.done = true;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 900);
  }
  fs.writeFileSync(path.join(HERE, 'sk3_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('WROTE sk3_' + TAG + '.json fatal=' + (out.fatal || 'none') + ' errors=' + out.errors.length);
  await close();
  process.exit(0);
})();
