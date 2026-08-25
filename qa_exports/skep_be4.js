/* SKEPTIC probe 4: high-DPI glyph shot, waypoint mode done properly, the fate of the
 * truncated source fragment, and the stateDiagram sideways step.
 * Run: node skep_be4.js <appPath> <port> <tag>
 */
const fs = require('fs');
const { openApp, setSource, confirmDialog } = require('./r7_lib.js');
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
async function marker(p, id) { return S(p, `(() => { const m=document.querySelector('#diagram [data-t-workpaper-node="' + ${JSON.stringify(id)} + '"]'); if(!m) return null; const r=(m.querySelector('rect')||m).getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2, x:r.x, y:r.y}; })()`); }
async function anyMarker(p) { return S(p, `(() => { const m=document.querySelector('#diagram [data-t-workpaper-node]'); if(!m) return null; const r=(m.querySelector('rect')||m).getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2, x:r.x, y:r.y, node:m.getAttribute('data-t-workpaper-node')}; })()`); }
async function node(p, id) { return S(p, `(() => { const g=Array.from(document.querySelectorAll('#diagram g.node')).find(n=>(n.id||'').includes('-' + ${JSON.stringify(id)} + '-')); if(!g) return null; const r=g.getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2}; })()`); }
async function closeDocs(p) { await S(p, `(() => { const b=document.getElementById('closeWpButton'); if(b && !document.getElementById('wpWorkspace').hidden) b.click(); })()`); await p.waitForTimeout(400); }
async function reset(p) {
  await closeDocs(p);
  await p.keyboard.press('Escape'); await p.waitForTimeout(180);
  await p.keyboard.press('Escape'); await p.waitForTimeout(180);
  await p.mouse.click(300, 830); await p.waitForTimeout(350);
  await closeDocs(p); await p.waitForTimeout(250);
}
async function makeDocFor(p, id) {
  const n = await node(p, id);
  await p.mouse.click(n.cx, n.cy); await p.waitForTimeout(700);
  await S(p, `(() => { const l=document.getElementById('nodeDocList'); const d=l&&l.closest('details'); if(d) d.open=true; })()`);
  await p.waitForTimeout(250);
  await S(p, `(() => { const b=document.getElementById('nodeDocNewButton'); if(b) b.scrollIntoView({block:'center'}); })()`);
  await p.waitForTimeout(350);
  const r = await S(p, `(() => { const b=document.getElementById('nodeDocNewButton'); const q=b.getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2}; })()`);
  await p.mouse.click(r.x, r.y); await p.waitForTimeout(1000);
  await closeDocs(p); await p.waitForTimeout(1000);
}

(async () => {
  const app = await openApp(APP, PORT, { width: 1440, height: 900 });
  const page = app.page;
  try {
    await killTour(page, 4000);
    await setSource(page, FIX, 3200);
    await killTour(page, 1200);
    await makeDocFor(page, 'B');
    await reset(page);

    // ---------- G1: does the truncated fragment leave a rendering diagram? ----------
    {
      await setSource(page, FIX + '  E[Typ', 3000);
      const st = await S(page, `(() => ({
        nodes: document.querySelectorAll('#diagram g.node').length,
        errorVisible: !!document.querySelector('#diagram .error-icon, #diagram .error-text, .preview-error:not([hidden])'),
        diagramText: (document.getElementById('diagram').innerText||'').slice(0,120).replace(/\\s+/g,' ')
      }))()`);
      rec('G1_truncated_fragment_render', st);
      await setSource(page, FIX, 3000);
      await reset(page);
    }

    // ---------- G2: waypoint mode, with the marker actually reachable ----------
    {
      await reset(page);
      const hit = await S(page, `(() => {
        const paths = Array.from(document.querySelectorAll('#diagram path.t-edge-hitarea, #diagram path.flowchart-link'));
        const t = paths.find(x => /L_B_C/.test(x.getAttribute('id')||'')) || paths[0];
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2 };
      })()`);
      await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(700);
      const inspOpen = await S(page, `(() => { const e=document.getElementById('edgeInspector'); return !!(e && !e.hidden); })()`);
      await S(page, `document.getElementById('edgeWaypointAdd').scrollIntoView({block:'center'})`);
      await page.waitForTimeout(350);
      const btn = await S(page, `(() => { const q=document.getElementById('edgeWaypointAdd').getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2,w:q.width,y0:q.y}; })()`);
      await page.mouse.click(btn.x, btn.y); await page.waitForTimeout(500);
      const armed = await S(page, `document.body.classList.contains('waypoint-mode')`);
      const m = await marker(page, 'B');
      const overMarker = m ? await S(page, `(() => { const e = document.elementFromPoint(${m.cx}, ${m.cy}); return e ? (e.getAttribute('data-t-workpaper-node') ? 'MARKER' : (e.id||e.className||e.tagName)) : null; })()`) : null;
      const before = await S(page, `document.getElementById('source').value`);
      let opened = -1; const t0 = Date.now();
      if (m) {
        await page.mouse.click(m.cx, m.cy);
        for (let i = 0; i < 80; i++) { if (await S(page, `!document.getElementById('wpWorkspace').hidden`)) { opened = Date.now() - t0; break; } await page.waitForTimeout(25); }
      }
      const after = await S(page, `document.getElementById('source').value`);
      rec('G2_waypoint_armed', {
        inspectorOpen: inspOpen, btnRect: btn, waypointArmed: armed, elementAtMarker: overMarker,
        docsOpened: opened >= 0, ms: opened, sourceChanged: after !== before,
        waypointsNow: await S(page, `document.querySelectorAll('#edgeWaypointList button[data-waypoint-index]').length`)
      });
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      await reset(page);
    }

    // ---------- G3: high-DPI glyph shot ----------
    {
      await reset(page);
      const m = await S(page, `(() => { const g=document.querySelector('#diagram [data-t-workpaper-node]'); const r=g.querySelector('rect').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
      // outline the hit rect so the eye can judge centring
      await S(page, `(() => { const r=document.querySelector('#diagram [data-t-workpaper-node] rect'); r.setAttribute('stroke','#ff0044'); r.setAttribute('stroke-width','0.6'); })()`);
      await page.waitForTimeout(200);
      await page.screenshot({ path: __dirname + '/skep_glyphbig_' + TAG + '.png', clip: { x: m.x - 6, y: m.y - 6, width: m.w + 12, height: m.h + 12 } });
      await S(page, `(() => { const r=document.querySelector('#diagram [data-t-workpaper-node] rect'); r.removeAttribute('stroke'); r.removeAttribute('stroke-width'); })()`);
    }

    // ---------- G4: sideways - stateDiagram-v2, double-click the marker ----------
    {
      await reset(page);
      await S(page, `(() => { const s=document.getElementById('diagramTypeSelect'); if(!s) return; s.value='state'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
      await page.waitForTimeout(600);
      const starter = await S(page, `(() => {
        const b = Array.from(document.querySelectorAll('button')).find(x => /new starter|starter/i.test(x.textContent) && x.offsetParent);
        if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x+r.width/2, y: r.y+r.height/2, label: b.textContent.trim().slice(0,40) };
      })()`);
      if (starter) { await page.mouse.click(starter.x, starter.y); await page.waitForTimeout(500); await confirmDialog(page, 1500); }
      await page.waitForTimeout(2500);
      const src = await S(page, `document.getElementById('source').value`);
      rec('G4_fixture', { starter, isState: /stateDiagram/.test(src), head: src.split('\n').slice(0,2).join(' / ') });
      if (/stateDiagram/.test(src)) {
        // put a document on the first state node
        const first = await S(page, `(() => { const g=document.querySelector('#diagram g.node'); if(!g) return null; const r=g.getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2, id:g.id}; })()`);
        await page.mouse.click(first.cx, first.cy); await page.waitForTimeout(700);

        await S(page, `(() => { const l=document.getElementById('nodeDocList'); const d=l&&l.closest('details'); if(d) d.open=true; })()`);
        await page.waitForTimeout(250);
        await S(page, `(() => { const b=document.getElementById('nodeDocNewButton'); if(b) b.scrollIntoView({block:'center'}); })()`);
        await page.waitForTimeout(350);
        const r = await S(page, `(() => { const b=document.getElementById('nodeDocNewButton'); const q=b.getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2}; })()`);
        await page.mouse.click(r.x, r.y); await page.waitForTimeout(1100);
        await closeDocs(page); await page.waitForTimeout(1200);
        await reset(page);
        const mm = await anyMarker(page);
        rec('G4_marker', mm);
        if (mm) {
          const srcBefore = await S(page, `document.getElementById('source').value`);
          // plain click first (capability control)
          let opened = -1; const t0 = Date.now();
          await page.mouse.click(mm.cx, mm.cy);
          for (let i = 0; i < 80; i++) { if (await S(page, `!document.getElementById('wpWorkspace').hidden`)) { opened = Date.now() - t0; break; } await page.waitForTimeout(25); }
          rec('G4_plain_click_ms', opened);
          await reset(page);
          // now the impatient double-click
          const mm2 = await anyMarker(page);
          await page.mouse.dblclick(mm2.cx, mm2.cy);
          await page.waitForTimeout(1400);
          const st = await S(page, `(() => { const i=document.getElementById('canvasInplace'); const dlg=document.querySelector('dialog[open]');
            return { docsOpen: !document.getElementById('wpWorkspace').hidden,
                     inplaceOpen: !!(i && !i.hidden && getComputedStyle(i).display!=='none'),
                     dialog: dlg ? (dlg.id || dlg.getAttribute('aria-label') || 'dialog') : null,
                     dialogText: dlg ? (dlg.innerText||'').replace(/\\s+/g,' ').slice(0,90) : null,
                     toast: (document.querySelector('.toast, #toast')||{}).textContent || null }; })()`);
          rec('G4_dblclick_marker_state', st);
          const srcAfter = await S(page, `document.getElementById('source').value`);
          rec('G4_dblclick_source_changed', srcAfter !== srcBefore);
        }
      }
    }
  } catch (e) { rec('PROBE_ERROR', String(e && e.stack || e)); }
  out.pageErrors = app.errors;
  fs.writeFileSync(__dirname + '/skep_be4_' + TAG + '.json', JSON.stringify(out, null, 1));
  await app.close();
  console.log('DONE ' + TAG);
})();
