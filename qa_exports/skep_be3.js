/* SKEPTIC probe 3 for job BE: where the stolen keystrokes land, the impatient
 * double-click, waypoint mode, and the tooltip's promise.
 * Run: node skep_be3.js <appPath> <port> <tag>
 */
const fs = require('fs');
const { openApp, setSource } = require('./r7_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];
const FIX = 'flowchart TD\n  A[Alpha step] --> B[Bravo step]\n  B --> C[Charlie step]\n  D[Delta step] --> A\n';
const out = { tag: TAG, steps: [] };
function rec(id, v) { out.steps.push({ id, value: v }); console.log('[' + id + '] ' + JSON.stringify(v)); }
const S = (p, js) => p.evaluate(js);
async function killTour(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const n = await S(page, `(() => { let n=0; document.querySelectorAll('.tour-card button').forEach(b=>{ if(/skip|done|got it|close|next|finish/i.test(b.textContent)){b.click();n++;} }); return n; })()`);
    if (!n) await page.waitForTimeout(250);
  }
}
async function marker(p, id) { return S(p, `(() => { const m=document.querySelector('#diagram [data-t-workpaper-node="' + ${JSON.stringify(id)} + '"]'); if(!m) return null; const r=(m.querySelector('rect')||m).getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2}; })()`); }
async function node(p, id) { return S(p, `(() => { const g=Array.from(document.querySelectorAll('#diagram g.node')).find(n=>(n.id||'').includes('-' + ${JSON.stringify(id)} + '-')); if(!g) return null; const r=g.getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2}; })()`); }
async function closeDocs(p) { await S(p, `(() => { const b=document.getElementById('closeWpButton'); if(b && !document.getElementById('wpWorkspace').hidden) b.click(); })()`); await p.waitForTimeout(400); }
async function reset(p) {
  await closeDocs(p);
  await p.keyboard.press('Escape'); await p.waitForTimeout(180);
  await p.keyboard.press('Escape'); await p.waitForTimeout(180);
  await p.mouse.click(300, 830); await p.waitForTimeout(350);
  await closeDocs(p); await p.waitForTimeout(250);
}
async function makeDoc(p, id) {
  const n = await node(p, id);
  await p.mouse.click(n.cx, n.cy); await p.waitForTimeout(600);
  await S(p, `(() => { const l=document.getElementById('nodeDocList'); const d=l&&l.closest('details'); if(d) d.open=true; })()`);
  await p.waitForTimeout(250);
  await S(p, `(() => { const b=document.getElementById('nodeDocNewButton'); if(b) b.scrollIntoView({block:'center'}); })()`);
  await p.waitForTimeout(350);
  const r = await S(p, `(() => { const b=document.getElementById('nodeDocNewButton'); const q=b.getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2}; })()`);
  await p.mouse.click(r.x, r.y); await p.waitForTimeout(900);
  await p.keyboard.type('DOC-FOR-' + id, { delay: 20 }); await p.waitForTimeout(500);
  await closeDocs(p); await p.waitForTimeout(900);
}
const docSnapshot = p => S(p, `(() => {
  const d = document.getElementById('wpDoc');
  if (!d) return { text: '', focus: null };
  return { text: (d.innerText || '').replace(/\\s+/g, ' ').trim(), focus: document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : null };
})()`);

(async () => {
  const app = await openApp(APP, PORT, { width: 1440, height: 900 });
  const page = app.page;
  try {
    await killTour(page, 4000);
    await setSource(page, FIX, 3200);
    await killTour(page, 1200);
    await makeDoc(page, 'B');
    await reset(page);

    // ---------- F1: the tooltip's promise, verbatim ----------
    rec('F1_marker_title', await S(page, `(() => { const m=document.querySelector('#diagram [data-t-workpaper-node]'); const t=m&&m.querySelector('title'); return t?t.textContent:null; })()`));

    // ---------- F2: impatient DOUBLE-CLICK, then the user types ----------
    {
      await reset(page);
      const srcBefore = await S(page, `document.getElementById('source').value`);
      const m = await marker(page, 'B');
      await page.mouse.dblclick(m.cx, m.cy);
      await page.waitForTimeout(900);
      const mid = await S(page, `(() => { const i=document.getElementById('canvasInplace'); const wp=document.getElementById('wpWorkspace'); const dlg=document.querySelector('dialog[open]');
        return { docsOpen: !!(wp && !wp.hidden), inplaceOpen: !!(i && !i.hidden && getComputedStyle(i).display!=='none'), inplaceValue: i?i.value:null, dialog: dlg?(dlg.id||'dialog'):null, focus: document.activeElement?(document.activeElement.id||document.activeElement.tagName):null }; })()`);
      // Now the user types, believing they are in a document.
      await page.keyboard.type('Reviewed by TS', { delay: 45 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(900);
      const srcAfter = await S(page, `document.getElementById('source').value`);
      rec('F2_dblclick_then_type', {
        afterDblClick: mid,
        sourceChanged: srcAfter !== srcBefore,
        sourceTail: srcAfter.split('\n').slice(0, 3).join(' / '),
        docsOpenAtEnd: await S(page, `!document.getElementById('wpWorkspace').hidden`)
      });
      // put the label back
      await setSource(page, FIX, 2500);
      await reset(page);
    }

    // ---------- F3: Ctrl+K then type - exactly where the letters land ----------
    {
      await reset(page);
      const m = await marker(page, 'B');
      await page.mouse.click(m.cx, m.cy);
      await page.waitForTimeout(140);
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(120);
      await page.keyboard.type('QQQQWWWWEEEE', { delay: 70 });
      await page.waitForTimeout(1000);
      const res = await S(page, `(() => {
        const p = document.getElementById('commandPaletteInput');
        const d = document.getElementById('wpDoc');
        const body = d ? (d.innerText || '') : '';
        return {
          paletteValue: p ? p.value : null,
          focus: document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : null,
          docsOpen: !document.getElementById('wpWorkspace').hidden,
          qCountInDoc: (body.match(/[QWE]/g) || []).length,
          docHit: (body.match(/[QWE]{2,}/g) || []).slice(0, 4),
          titleValue: (document.getElementById('wpTitle')||{}).value
        };
      })()`);
      rec('F3_ctrlk_then_type', Object.assign({ intended: 12 }, res));
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      await reset(page);
    }

    // ---------- F4: edge waypoint mode armed, marker clicked ----------
    {
      await reset(page);
      // open the edge inspector by clicking the B-->C connector's hit area
      const hit = await S(page, `(() => {
        const paths = Array.from(document.querySelectorAll('#diagram path.t-edge-hitarea, #diagram path.flowchart-link'));
        const p = paths.find(x => /B.*C/.test(x.getAttribute('id')||'') || /B.*C/.test(x.getAttribute('data-edge-key')||''));
        const t = p || paths[0];
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2, id: t.getAttribute('id'), n: paths.length };
      })()`);
      let armed = null, inspOpen = false;
      if (hit) {
        await page.mouse.click(hit.x, hit.y);
        await page.waitForTimeout(600);
        inspOpen = await S(page, `(() => { const e=document.getElementById('edgeInspector'); return !!(e && !e.hidden); })()`);
        if (inspOpen) {
          await S(page, `document.getElementById('edgeWaypointAdd').scrollIntoView({block:'center'})`);
          await page.waitForTimeout(300);
          const r = await S(page, `(() => { const q=document.getElementById('edgeWaypointAdd').getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2}; })()`);
          await page.mouse.click(r.x, r.y);
          await page.waitForTimeout(400);
          armed = await S(page, `document.body.classList.contains('waypoint-mode')`);
        }
      }
      const before = await S(page, `document.getElementById('source').value`);
      const m = await marker(page, 'B');
      let opened = -1; const t0 = Date.now();
      if (m) {
        await page.mouse.click(m.cx, m.cy);
        for (let i = 0; i < 80; i++) { if (await S(page, `!document.getElementById('wpWorkspace').hidden`)) { opened = Date.now() - t0; break; } await page.waitForTimeout(25); }
      }
      const after = await S(page, `document.getElementById('source').value`);
      rec('F4_waypoint_mode', {
        edgeHit: hit, inspectorOpen: inspOpen, waypointArmed: armed,
        docsOpened: opened >= 0, ms: opened, sourceChanged: after !== before,
        waypointRows: await S(page, `document.querySelectorAll('#edgeWaypointList > *').length`)
      });
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      await reset(page);
    }

    // ---------- F5: glyph + hit rect geometry, and a zoomed screenshot ----------
    {
      await reset(page);
      const geo = await S(page, `(() => {
        const m = document.querySelector('#diagram [data-t-workpaper-node]');
        if (!m) return null;
        const rect = m.querySelector('rect'), text = m.querySelector('text');
        const rr = rect.getBoundingClientRect(), tr = text.getBoundingClientRect();
        return {
          rectAttr: { x: rect.getAttribute('x'), y: rect.getAttribute('y'), w: rect.getAttribute('width'), h: rect.getAttribute('height') },
          textAttr: { x: text.getAttribute('x'), y: text.getAttribute('y'), anchor: text.getAttribute('text-anchor') },
          rectClient: { x: +rr.x.toFixed(3), y: +rr.y.toFixed(3), w: +rr.width.toFixed(3), h: +rr.height.toFixed(3), cx: +(rr.x+rr.width/2).toFixed(3), cy: +(rr.y+rr.height/2).toFixed(3) },
          inkClient: { cx: +(tr.x+tr.width/2).toFixed(3), cy: +(tr.y+tr.height/2).toFixed(3), w: +tr.width.toFixed(3), h: +tr.height.toFixed(3) }
        };
      })()`);
      if (geo) {
        geo.offsetX = +(geo.inkClient.cx - geo.rectClient.cx).toFixed(3);
        geo.offsetY = +(geo.inkClient.cy - geo.rectClient.cy).toFixed(3);
      }
      rec('F5_glyph_geometry', geo);
      if (geo) {
        const c = geo.rectClient;
        await page.screenshot({ path: __dirname + '/skep_glyph_' + TAG + '.png', clip: { x: c.x - 14, y: c.y - 14, width: 46, height: 46 }, scale: 'css' });
      }
    }
  } catch (e) { rec('PROBE_ERROR', String(e && e.stack || e)); }
  out.pageErrors = app.errors;
  fs.writeFileSync(__dirname + '/skep_be3_' + TAG + '.json', JSON.stringify(out, null, 1));
  await app.close();
  console.log('DONE ' + TAG);
})();
