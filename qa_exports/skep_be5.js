/* SKEPTIC probe 5: one step sideways - a code-only stateDiagram-v2 fixture.
 * The marker's plain click, and the impatient double-click, where in-place rename
 * is NOT available. Run: node skep_be5.js <appPath> <port> <tag>
 */
const fs = require('fs');
const { openApp, setSource } = require('./r7_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];
const STATE = 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review: Submit\n  Review --> Approved: Sign off\n  Approved --> [*]\n';
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
async function anyMarker(p) { return S(p, `(() => { const m=document.querySelector('#diagram [data-t-workpaper-node]'); if(!m) return null; const r=(m.querySelector('rect')||m).getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2, w:r.width, h:r.height, node:m.getAttribute('data-t-workpaper-node')}; })()`); }
async function closeDocs(p) { await S(p, `(() => { const b=document.getElementById('closeWpButton'); if(b && !document.getElementById('wpWorkspace').hidden) b.click(); })()`); await p.waitForTimeout(400); }
async function reset(p) {
  await closeDocs(p);
  await p.keyboard.press('Escape'); await p.waitForTimeout(180);
  await p.keyboard.press('Escape'); await p.waitForTimeout(180);
  await p.mouse.click(300, 830); await p.waitForTimeout(350);
  await closeDocs(p); await p.waitForTimeout(250);
}

(async () => {
  const app = await openApp(APP, PORT, { width: 1440, height: 900 });
  const page = app.page;
  try {
    await killTour(page, 4000);
    await setSource(page, STATE, 3500);
    await killTour(page, 1200);
    const src = await S(page, `document.getElementById('source').value`);
    rec('fixture', { isState: /stateDiagram-v2/.test(src), nodes: await S(page, `document.querySelectorAll('#diagram g.node').length`) });
    if (!/stateDiagram-v2/.test(src)) throw new Error('fixture not a state diagram');

    // node geometry for the sideways-step numbers
    rec('node_geometry', await S(page, `(() => { const g=Array.from(document.querySelectorAll('#diagram g.node')).filter(n=>n.getBoundingClientRect().width>40)[1]; const r=g.getBoundingClientRect(); return {w:+r.width.toFixed(2), h:+r.height.toFixed(2), id:g.id}; })()`));

    // make a document on the first state node through the app's own route
    const first = await S(page, `(() => { const g=Array.from(document.querySelectorAll('#diagram g.node')).filter(n=>n.getBoundingClientRect().width>40)[1]; const r=g.getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2, id:g.id, w:r.width}; })()`);
    await page.mouse.click(first.cx, first.cy); await page.waitForTimeout(800);
    await S(page, `(() => { const l=document.getElementById('nodeDocList'); const d=l&&l.closest('details'); if(d) d.open=true; })()`);
    await page.waitForTimeout(300);
    await S(page, `(() => { const b=document.getElementById('nodeDocNewButton'); if(b) b.scrollIntoView({block:'center'}); })()`);
    await page.waitForTimeout(400);
    const r = await S(page, `(() => { const b=document.getElementById('nodeDocNewButton'); const q=b.getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2,w:q.width}; })()`);
    await page.mouse.click(r.x, r.y); await page.waitForTimeout(1100);
    await closeDocs(page); await page.waitForTimeout(1300);
    await reset(page);
    const m0 = await anyMarker(page);
    rec('marker', m0);
    if (!m0) throw new Error('no marker on the state fixture');
    rec('marker_pct_of_node', await S(page, `(() => { const g=Array.from(document.querySelectorAll('#diagram g.node')).filter(n=>n.getBoundingClientRect().width>40)[1]; const r=g.getBoundingClientRect(); return { wPct: +(18/r.width*100).toFixed(1), hPct: +(18/r.height*100).toFixed(1) }; })()`));

    const srcBefore = await S(page, `document.getElementById('source').value`);

    // H1: plain click - the advertised action
    {
      await reset(page);
      const m = await anyMarker(page);
      const t0 = Date.now();
      await page.mouse.click(m.cx, m.cy);
      let ms = -1;
      for (let i = 0; i < 90; i++) { if (await S(page, `!document.getElementById('wpWorkspace').hidden`)) { ms = Date.now() - t0; break; } await page.waitForTimeout(25); }
      rec('H1_plain_click_ms', ms);
      await reset(page);
    }

    // H2: the impatient double-click on a code-only diagram
    {
      await reset(page);
      const m = await anyMarker(page);
      await page.mouse.dblclick(m.cx, m.cy);
      await page.waitForTimeout(1500);
      const st = await S(page, `(() => { const i=document.getElementById('canvasInplace'); const dlg=document.querySelector('dialog[open]');
        return { docsOpen: !document.getElementById('wpWorkspace').hidden,
                 inplaceOpen: !!(i && !i.hidden && getComputedStyle(i).display!=='none'),
                 dialogId: dlg ? (dlg.id || 'dialog') : null,
                 dialogText: dlg ? (dlg.innerText||'').replace(/\\s+/g,' ').slice(0,110) : null,
                 toast: Array.from(document.querySelectorAll('.toast, .toast-item, [role="status"]')).map(t=>(t.textContent||'').trim()).filter(Boolean).slice(0,3) }; })()`);
      rec('H2_dblclick_state_marker', st);
      // if a rename dialog is up, type into it the way an auditor would
      const typed = await S(page, `(() => { const dlg=document.querySelector('dialog[open]'); if(!dlg) return null; const i=dlg.querySelector('input[type="text"], input:not([type])'); return i ? { id:i.id, value:i.value } : 'dialog without a text field'; })()`);
      rec('H2_dialog_field', typed);
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      rec('H2_source_changed', (await S(page, `document.getElementById('source').value`)) !== srcBefore);
      await reset(page);
    }

    // H3: 9px wobble on the state fixture
    {
      await reset(page);
      const m = await anyMarker(page);
      await page.mouse.move(m.cx, m.cy);
      await page.mouse.down();
      await page.mouse.move(m.cx + 9, m.cy + 9, { steps: 4 });
      await page.mouse.move(m.cx, m.cy, { steps: 4 });
      await page.mouse.up();
      let ms = -1; const t0 = Date.now();
      for (let i = 0; i < 90; i++) { if (await S(page, `!document.getElementById('wpWorkspace').hidden`)) { ms = Date.now() - t0; break; } await page.waitForTimeout(25); }
      rec('H3_wobble9_state', { docsOpen: ms >= 0, ms });
      await reset(page);
    }
    rec('final_source_unchanged', (await S(page, `document.getElementById('source').value`)) === srcBefore);
  } catch (e) { rec('PROBE_ERROR', String(e && e.stack || e)); }
  out.pageErrors = app.errors;
  fs.writeFileSync(__dirname + '/skep_be5_' + TAG + '.json', JSON.stringify(out, null, 1));
  await app.close();
  console.log('DONE ' + TAG);
})();
