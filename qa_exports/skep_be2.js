/* SKEPTIC probe 2 for job BE. Each test re-reads the marker rect fresh.
 * Run: node skep_be2.js <appPath> <port> <tag>
 */
const fs = require('fs');
const { openApp, setSource } = require('./r7_lib.js');

const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];
const FIX = 'flowchart TD\n  A[Alpha step] --> B[Bravo step]\n  B --> C[Charlie step]\n  D[Delta step] --> A\n';
const out = { tag: TAG, steps: [] };
function rec(id, v) { out.steps.push({ id, value: v }); console.log('[' + id + '] ' + JSON.stringify(v)); }

async function killTour(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const n = await page.evaluate(`(() => { let n=0; document.querySelectorAll('.tour-card button').forEach(b=>{ if(/skip|done|got it|close|next|finish/i.test(b.textContent)){b.click();n++;} }); return n; })()`);
    if (!n) await page.waitForTimeout(250);
  }
}
const S = (page, js) => page.evaluate(js);
async function marker(page, id) {
  return page.evaluate(`(() => { const m=document.querySelector('#diagram [data-t-workpaper-node="' + ${JSON.stringify(id)} + '"]'); if(!m) return null; const r=(m.querySelector('rect')||m).getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2, x:r.x, y:r.y, w:r.width}; })()`);
}
async function node(page, id) {
  return page.evaluate(`(() => { const g=Array.from(document.querySelectorAll('#diagram g.node')).find(n=>(n.id||'').includes('-' + ${JSON.stringify(id)} + '-')); if(!g) return null; const r=g.getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2, x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
}
async function docsOpen(page) { return S(page, `!document.getElementById('wpWorkspace').hidden`); }
async function closeDocs(page) {
  await S(page, `(() => { const b=document.getElementById('closeWpButton'); if(b && !document.getElementById('wpWorkspace').hidden) b.click(); })()`);
  await page.waitForTimeout(400);
}
async function reset(page) {
  await closeDocs(page);
  await page.keyboard.press('Escape'); await page.waitForTimeout(180);
  await page.keyboard.press('Escape'); await page.waitForTimeout(180);
  await page.mouse.click(300, 830); await page.waitForTimeout(350);
  await closeDocs(page); await page.waitForTimeout(250);
}
async function makeDoc(page, id) {
  const n = await node(page, id);
  await page.mouse.click(n.cx, n.cy); await page.waitForTimeout(600);
  await S(page, `(() => { const l=document.getElementById('nodeDocList'); const d=l&&l.closest('details'); if(d) d.open=true; })()`);
  await page.waitForTimeout(250);
  await S(page, `(() => { const b=document.getElementById('nodeDocNewButton'); if(b) b.scrollIntoView({block:'center'}); })()`);
  await page.waitForTimeout(350);
  const r = await S(page, `(() => { const b=document.getElementById('nodeDocNewButton'); const q=b.getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2}; })()`);
  await page.mouse.click(r.x, r.y); await page.waitForTimeout(900);
  await page.keyboard.type('DOC-FOR-' + id, { delay: 20 }); await page.waitForTimeout(500);
  await closeDocs(page); await page.waitForTimeout(900);
}
/* Click the marker and poll for the document, reporting ms or -1. */
async function clickMarkerTimed(page, m, budget = 2500) {
  const t0 = Date.now();
  await page.mouse.click(m.cx, m.cy);
  for (let i = 0; i < budget / 25; i++) {
    if (await docsOpen(page)) return Date.now() - t0;
    await page.waitForTimeout(25);
  }
  return -1;
}

(async () => {
  const app = await openApp(APP, PORT, { width: 1440, height: 900 });
  const page = app.page;
  try {
    await killTour(page, 4000);
    await setSource(page, FIX, 3200);
    await killTour(page, 1200);
    await makeDoc(page, 'B');
    await reset(page);
    rec('markers', await S(page, `document.querySelectorAll('#diagram [data-t-workpaper-node]').length`));

    // ---------- E1: Escape inside the wait (isolated, fresh rect) ----------
    for (const delay of [100, 300]) {
      await reset(page);
      const m = await marker(page, 'B');
      await page.mouse.click(m.cx, m.cy);
      await page.waitForTimeout(delay);
      await page.keyboard.press('Escape');
      let opened = -1;
      const t0 = Date.now();
      for (let i = 0; i < 80; i++) { if (await docsOpen(page)) { opened = Date.now() - t0; break; } await page.waitForTimeout(25); }
      rec('E1_escape_at_' + delay + 'ms', { docsOpenedAfterEscape: opened >= 0, ms: opened, markerAt: m });
      await reset(page);
    }
    // control: no Escape
    {
      await reset(page);
      const m = await marker(page, 'B');
      rec('E1c_no_escape_ms', await clickMarkerTimed(page, m));
      await reset(page);
    }

    // ---------- E2: micro-drag threshold, out and back ----------
    for (const d of [5, 9, 14, 25]) {
      await reset(page);
      const m = await marker(page, 'B');
      await page.mouse.move(m.cx, m.cy);
      await page.mouse.down();
      await page.mouse.move(m.cx + d, m.cy + d, { steps: 4 });
      await page.mouse.move(m.cx, m.cy, { steps: 4 });
      await page.mouse.up();
      let opened = -1; const t0 = Date.now();
      for (let i = 0; i < 80; i++) { if (await docsOpen(page)) { opened = Date.now() - t0; break; } await page.waitForTimeout(25); }
      rec('E2_wobble_' + d + 'px', { docsOpen: opened >= 0, ms: opened });
      await reset(page);
    }

    // ---------- E3: block drag first, then marker click (dead window) ----------
    {
      await reset(page);
      const nC = await node(page, 'C');
      await page.mouse.move(nC.cx, nC.cy);
      await page.mouse.down();
      await page.mouse.move(nC.cx + 45, nC.cy + 25, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(100);
      const m1 = await marker(page, 'B');
      const fast = await clickMarkerTimed(page, m1, 1500);
      rec('E3_marker_100ms_after_drag', { ms: fast, markerAt: m1 });
      await reset(page);
      // same again but wait 700ms after the drag
      const nC2 = await node(page, 'C');
      await page.mouse.move(nC2.cx, nC2.cy);
      await page.mouse.down();
      await page.mouse.move(nC2.cx + 45, nC2.cy + 25, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(700);
      const m2 = await marker(page, 'B');
      rec('E3b_marker_700ms_after_drag', { ms: await clickMarkerTimed(page, m2, 1500), markerAt: m2 });
      await reset(page);
    }

    // ---------- E4: Ctrl+K palette then typing - where do the letters land? ----------
    {
      await reset(page);
      const m = await marker(page, 'B');
      const docBodyBefore = await S(page, `(document.getElementById('wpDoc')||{}).innerText || ''`);
      await page.mouse.click(m.cx, m.cy);
      await page.waitForTimeout(140);
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(120);
      await page.keyboard.type('export png', { delay: 70 });
      await page.waitForTimeout(900);
      const after = await S(page, `(() => {
        const p = document.getElementById('commandPaletteInput');
        const wp = document.getElementById('wpWorkspace');
        return {
          paletteValue: p ? p.value : null,
          docsOpen: !!(wp && !wp.hidden),
          focus: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null,
          docText: (document.getElementById('wpDoc')||{}).innerText || ''
        };
      })()`);
      rec('E4_palette_then_type', {
        paletteValue: after.paletteValue, docsOpen: after.docsOpen, focus: after.focus,
        docTextGrew: after.docText.length - docBodyBefore.length,
        docTextTail: after.docText.slice(-70).replace(/\n/g, ' / ')
      });
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      await reset(page);
    }

    // ---------- E5: Code mode - click marker, click into #source, type ----------
    {
      await reset(page);
      await S(page, `(() => { const b=document.getElementById('codeModeButton'); if(b) b.click(); })()`);
      await page.waitForTimeout(900);
      const m = await marker(page, 'B');
      const srcBox = await S(page, `(() => { const s=document.getElementById('source'); const r=s.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height-30, vis: r.width>0 && r.height>0}; })()`);
      const before = await S(page, `document.getElementById('source').value`);
      if (m && srcBox.vis) {
        await page.mouse.click(m.cx, m.cy);
        await page.waitForTimeout(120);
        await page.mouse.click(srcBox.x, srcBox.y);
        await page.keyboard.press('Control+End');
        const focus0 = await S(page, `document.activeElement ? (document.activeElement.id||document.activeElement.tagName) : null`);
        await page.keyboard.type('  E[Typed while waiting] --> A', { delay: 55 });
        await page.waitForTimeout(900);
        const after = await S(page, `document.getElementById('source').value`);
        const st = await S(page, `(() => ({ focus: document.activeElement ? (document.activeElement.id||document.activeElement.tagName) : null, docsOpen: !document.getElementById('wpWorkspace').hidden, docText: (document.getElementById('wpDoc')||{}).innerText||'' }))()`);
        rec('E5_code_mode_type', {
          markerAt: m, focusAtStart: focus0, charsGained: after.length - before.length,
          intended: 29, sourceTail: after.slice(-45).replace(/\n/g, ' / '),
          focusAtEnd: st.focus, docsOpen: st.docsOpen, docTextTail: st.docText.slice(-60).replace(/\n/g, ' / ')
        });
      } else {
        rec('E5_code_mode_type', { skipped: true, marker: m, srcBox });
      }
      await reset(page);
      await S(page, `(() => { const b=document.getElementById('visualModeButton')||document.getElementById('buildModeButton'); if(b) b.click(); })()`);
      await page.waitForTimeout(900);
    }
  } catch (e) {
    rec('PROBE_ERROR', String(e && e.stack || e));
  }
  out.pageErrors = app.errors;
  fs.writeFileSync(__dirname + '/skep_be2_' + TAG + '.json', JSON.stringify(out, null, 1));
  await app.close();
  console.log('DONE ' + TAG);
})();
