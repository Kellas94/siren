/* SKEPTIC probe for the "marker" group of round 14 (deletions 1, 2, 3).
 * Usage: node sk_marker_probe.js <appPath> <port> <tag>
 * Writes qa_exports/sk_<tag>.json and sk_<tag>_*.png
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

async function snap(page) {
  return ev(page, `
    const wp = document.getElementById('wpWorkspace');
    const insp = document.getElementById('nodeInspector');
    const menu = document.querySelector('.struct-menu');
    const dlg = document.querySelector('dialog[open]');
    const inp = document.querySelector('.canvas-inplace, input.canvas-inplace, .canvas-inplace input, [class*="canvas-inplace"]');
    return {
      source: (document.getElementById('source')||{}).value || '',
      docsOpen: !!(wp && !wp.hidden),
      inspectorOpen: !!(insp && !insp.hidden),
      docRows: document.querySelectorAll('#nodeDocList .node-doc-row').length,
      wpCount: ((document.getElementById('wpCount')||{}).textContent||'').trim(),
      wpTitle: (document.getElementById('wpTitle')||{}).value || ((document.getElementById('wpTitle')||{}).textContent||''),
      wpListRows: document.querySelectorAll('#wpList .wp-row, #wpList li, #wpList button').length,
      docInner: ((document.getElementById('wpDocInner')||{}).innerText||'').replace(/\\s+/g,' ').trim().slice(0,220),
      dialogOpen: dlg ? (dlg.id || 'dialog') : null,
      dialogText: dlg ? (dlg.innerText||'').replace(/\\s+/g,' ').trim().slice(0,200) : null,
      inplace: inp ? { tag: inp.tagName, value: inp.value === undefined ? (inp.textContent||'') : inp.value } : null,
      menuRows: menu ? Array.from(menu.querySelectorAll('.struct-menu-heading, .struct-menu-item')).map(x=>(x.textContent||'').replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0,20) : null,
      toast: Array.from(document.querySelectorAll('.toast, [class*="toast"]')).map(t=>(t.textContent||'').replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0,4),
      markers: document.querySelectorAll('#diagram [data-t-workpaper-node]').length,
      connectArmed: document.body.classList.contains('connect-mode'),
      multiSel: document.querySelectorAll('#diagram .t-multi-selected').length,
      styleTarget: (document.getElementById('nodeStyleTarget')||{}).value || ''
    };`);
}

async function reset(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  await ev(page, `
    if (document.body.classList.contains('connect-mode')) { const cm = document.getElementById('connectModeButton'); if (cm) cm.click(); }
    const wp = document.getElementById('wpWorkspace');
    if (wp && !wp.hidden) { const c = document.getElementById('closeWpButton'); if (c) c.click(); }
    const insp = document.getElementById('nodeInspector');
    if (insp && !insp.hidden) { const d = document.getElementById('inspectorDoneButton'); if (d) d.click(); }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    const menu = document.querySelector('.struct-menu'); if (menu) menu.remove();
    const z = document.getElementById('zoomViewport'); if (z) { z.scrollLeft = 0; z.scrollTop = 0; }
    return 1;`);
  await page.waitForTimeout(220);
  const src = await page.evaluate("document.getElementById('source').value");
  if (src.trim() !== FIXTURE.trim()) await lib.setSource(page, FIXTURE, 2400);
  await page.waitForTimeout(350);
}

async function geom(page, id) {
  return ev(page, `
    const m = document.querySelector('#diagram [data-t-workpaper-node="${id}"]');
    const rect = m ? m.querySelector('rect') : null;
    const groups = Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]'));
    let nodeBox = null;
    for (const grp of groups) {
      const gid = grp.getAttribute('data-node-id') || grp.getAttribute('id') || '';
      if (gid === '${id}' || gid.indexOf('-${id}-') >= 0 || gid.slice(-2) === '-${id}') { nodeBox = grp.getBoundingClientRect(); break; }
    }
    const f = v => v === null ? null : +v.toFixed(2);
    const box = b => b ? { x: f(b.x), y: f(b.y), w: f(b.width), h: f(b.height), cx: f(b.x + b.width/2), cy: f(b.y + b.height/2) } : null;
    const title = m ? (m.querySelector('title') ? m.querySelector('title').textContent : null) : null;
    return { rect: box(rect ? rect.getBoundingClientRect() : null), node: box(nodeBox), title: title };`);
}

async function makeDoc(page, id, n) {
  for (let k = 0; k < n; k++) {
    await reset(page);
    const g = await geom(page, id);
    const c = g.node;
    await page.mouse.click(c.cx, c.cy);
    await page.waitForTimeout(700);
    await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({block:'center'}); } return 1;`);
    await page.waitForTimeout(350);
    const b = await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width };`);
    if (b && b.w > 2) await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(1300);
  }
  await reset(page);
  await page.waitForTimeout(400);
}

/* what is under a screen point right now, deepest first */
async function under(page, x, y) {
  return ev(page, `
    const el = document.elementFromPoint(${x}, ${y});
    const chain = [];
    let n = el;
    for (let i = 0; n && i < 7; i++) {
      chain.push((n.tagName||'').toLowerCase() + (n.id ? '#'+n.id : '') + (n.className && typeof n.className === 'string' ? '.'+n.className.trim().split(/\\s+/).slice(0,2).join('.') : ''));
      n = n.parentElement;
    }
    return { top: el ? ((el.tagName||'').toLowerCase() + (el.id ? '#'+el.id : '')) : null,
             text: el ? (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,60) : null,
             aria: el ? (el.getAttribute('aria-label')||'') : null,
             chain: chain };`);
}

async function activeInfo(page) {
  return ev(page, `
    const a = document.activeElement;
    if (!a) return null;
    return {
      tag: (a.tagName||'').toLowerCase(), id: a.id || '', cls: (typeof a.className === 'string' ? a.className : '').slice(0,60),
      aria: a.getAttribute('aria-label') || '', role: a.getAttribute('role') || '',
      value: a.value !== undefined ? String(a.value).slice(0,80) : (a.isContentEditable ? (a.textContent||'').slice(0,80) : null),
      sel: (a.selectionStart !== undefined && a.selectionStart !== null) ? [a.selectionStart, a.selectionEnd] : null,
      inDoc: !!(a.closest && a.closest('#wpWorkspace')),
      tabIndex: a.tabIndex
    };`);
}

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  out.errors = errors;
  try {
    await killTour(page);
    await lib.setSource(page, FIXTURE, 3200);
    out.fixtureSource = await page.evaluate("document.getElementById('source').value");

    await makeDoc(page, 'B', 1);
    await makeDoc(page, 'C', 2);
    const gB = await geom(page, 'B'), gC = await geom(page, 'C');
    out.geomB = gB; out.geomC = gC;
    out.t.setup_markers = (await snap(page)).markers;
    out.markerTitleB = gB.title; out.markerTitleC = gC.title;
    out.markerAreaShare = gB.rect && gB.node ? +((gB.rect.w * gB.rect.h) / (gB.node.w * gB.node.h) * 100).toFixed(1) : null;

    // ---------- T1: single click on B's marker -> time to Docs ----------
    async function timeOpen(pt) {
      await reset(page);
      const g = await geom(page, 'B');
      const p = pt ? pt(g) : { x: g.rect.cx, y: g.rect.cy };
      const t0 = Date.now();
      await page.mouse.click(p.x, p.y);
      let ms = -1;
      for (let i = 0; i < 300; i++) {
        const open = await page.evaluate("(() => { const w = document.getElementById('wpWorkspace'); return !!(w && !w.hidden); })()");
        if (open) { ms = Date.now() - t0; break; }
        await page.waitForTimeout(5);
      }
      return ms;
    }
    out.t.click_open_ms = [await timeOpen(), await timeOpen()];

    // ---------- T2: recon - what Docs renders, with rects ----------
    await reset(page);
    {
      const g = await geom(page, 'B');
      await page.mouse.click(g.rect.cx, g.rect.cy);
      await page.waitForTimeout(900);
      out.t.docs_layout = await ev(page, `
        const wp = document.getElementById('wpWorkspace');
        const r = wp ? wp.getBoundingClientRect() : null;
        const f = v => +Number(v).toFixed(1);
        const ctrls = Array.from(document.querySelectorAll('#wpWorkspace button, #wpWorkspace input, #wpWorkspace select'))
          .map(b => { const bb = b.getBoundingClientRect(); return { id: b.id||'', label: (b.getAttribute('aria-label')||b.title||b.textContent||'').replace(/\\s+/g,' ').trim().slice(0,42), x: f(bb.x), y: f(bb.y), w: f(bb.width), h: f(bb.height) }; })
          .filter(b => b.w > 4 && b.h > 4);
        return { panel: r ? { x: f(r.x), y: f(r.y), w: f(r.width), h: f(r.height) } : null, ctrls: ctrls };`);
      await page.screenshot({ path: path.join(HERE, 'sk_' + TAG + '_docsopen.png') });
      await reset(page);
    }

    // ---------- T3: real double-click on the 1-doc marker ----------
    await reset(page);
    {
      const g = await geom(page, 'B');
      const p = { x: g.rect.cx, y: g.rect.cy };
      const before = await snap(page);
      await page.mouse.dblclick(p.x, p.y);
      await page.waitForTimeout(900);
      const after = await snap(page);
      const act = await activeInfo(page);
      const u = await under(page, p.x, p.y);
      await page.screenshot({ path: path.join(HERE, 'sk_' + TAG + '_dbl1doc.png') });
      // one keystroke, then check whether the document text changed and whether it persists
      const docBefore = after.docInner;
      await page.keyboard.press('KeyZ');
      await page.waitForTimeout(600);
      const afterKey = await snap(page);
      // close and reopen through the register to test persistence in the store
      await ev(page, `const c = document.getElementById('closeWpButton'); if (c) c.click(); return 1;`);
      await page.waitForTimeout(500);
      const g2 = await geom(page, 'B');
      await page.mouse.click(g2.rect.cx, g2.rect.cy);
      await page.waitForTimeout(900);
      const reopened = await snap(page);
      out.t.dbl_1doc = {
        point: p, markerRect: g.rect,
        docsOpen: after.docsOpen, inplace: after.inplace, dialog: after.dialogOpen,
        active: act, under: u,
        docBefore: docBefore, docAfterKey: afterKey.docInner, docReopened: reopened.docInner,
        changedByKey: docBefore !== afterKey.docInner,
        persisted: docBefore !== reopened.docInner,
        sourceUnchanged: before.source === reopened.source,
        wpPanels: await page.evaluate("document.querySelectorAll('#wpDocInner').length"),
        toast: afterKey.toast
      };
      await reset(page);
    }

    // ---------- T4: real double-click on the 2-doc marker (inspector route) ----------
    await reset(page);
    {
      const g = await geom(page, 'C');
      const p = { x: g.rect.cx, y: g.rect.cy };
      const before = await snap(page);
      const docsBefore = await page.evaluate("(window.state && state.workpapers ? state.workpapers.length : -1)");
      await page.mouse.dblclick(p.x, p.y);
      await page.waitForTimeout(900);
      const after = await snap(page);
      const act = await activeInfo(page);
      const u = await under(page, p.x, p.y);
      await page.screenshot({ path: path.join(HERE, 'sk_' + TAG + '_dbl2doc.png') });
      out.t.dbl_2doc = {
        point: p, inspectorOpen: after.inspectorOpen, docRows: after.docRows, docsOpen: after.docsOpen,
        inplace: after.inplace, dialog: after.dialogOpen, active: act, under: u,
        docsCountBefore: docsBefore,
        docsCountAfter: await page.evaluate("(window.state && state.workpapers ? state.workpapers.length : -1)"),
        sourceSame: before.source === after.source, toast: after.toast
      };
      await reset(page);
    }

    out.done = true;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 900);
  }
  fs.writeFileSync(path.join(HERE, 'sk_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('WROTE sk_' + TAG + '.json  fatal=' + (out.fatal || 'none') + ' errors=' + out.errors.length);
  await close();
  process.exit(0);
})();
