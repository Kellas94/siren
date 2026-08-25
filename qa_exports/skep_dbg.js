const { openApp, setSource } = require('./r7_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]);
const FIX = 'flowchart TD\n  A[Alpha step] --> B[Bravo step]\n  B --> C[Charlie step]\n  D[Delta step] --> A\n';
async function killTour(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const n = await page.evaluate(`(() => { let n=0; document.querySelectorAll('.tour-card button').forEach(b=>{ if(/skip|done|got it|close|next|finish/i.test(b.textContent)){b.click();n++;} }); return n; })()`);
    if (!n) await page.waitForTimeout(250);
  }
}
(async () => {
  const app = await openApp(APP, PORT, { width: 1440, height: 900 });
  const page = app.page;
  await killTour(page, 4000);
  await setSource(page, FIX, 3200);
  const nB = await page.evaluate(`(() => { const g = Array.from(document.querySelectorAll('#diagram g.node')).find(n => (n.id||'').includes('-B-')); const r = g.getBoundingClientRect(); return {cx:r.x+r.width/2, cy:r.y+r.height/2}; })()`);
  await page.mouse.click(nB.cx, nB.cy);
  await page.waitForTimeout(700);
  console.log('inspector', await page.evaluate(`(() => { const l=document.getElementById('nodeDocList'); const d=l&&l.closest('details'); return {list:!!l, det:!!d, open:d&&d.open, btnVis: (()=>{const b=document.getElementById('nodeDocNewButton'); if(!b) return null; const r=b.getBoundingClientRect(); return r.width;})()}; })()`));
  await page.evaluate(`(() => { const l=document.getElementById('nodeDocList'); const d=l&&l.closest('details'); if(d) d.open=true; })()`);
  await page.waitForTimeout(300);
  const btn = await page.evaluate(`(() => { const b=document.getElementById('nodeDocNewButton'); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width}; })()`);
  console.log('btn', btn);
  await page.mouse.click(btn.x, btn.y);
  await page.waitForTimeout(1500);
  console.log('after new', await page.evaluate(`(() => ({ docsOpen: !document.getElementById('wpWorkspace').hidden, wpCount: (window.state&&state.workpapers)?state.workpapers.length:-1, title: (document.getElementById('wpTitle')||{}).value }))()`));
  await page.evaluate(`document.getElementById('closeWpButton').click()`);
  await page.waitForTimeout(1500);
  console.log('markers now', await page.evaluate(`document.querySelectorAll('#diagram [data-t-workpaper-node]').length`));
  console.log('wp links', await page.evaluate(`(() => { try { return JSON.stringify(state.workpapers.map(w=>({ref:w.ref,diagramId:w.diagramId,nodeId:w.nodeId}))) + ' | active=' + state.activeDiagramId; } catch(e){ return 'ERR '+e.message; } })()`));
  await page.waitForTimeout(1500);
  console.log('markers after wait', await page.evaluate(`document.querySelectorAll('#diagram [data-t-workpaper-node]').length`));
  await page.evaluate(`(() => { try { scheduleRender('probe'); } catch(e){} })()`);
  await page.waitForTimeout(2500);
  console.log('markers after render', await page.evaluate(`document.querySelectorAll('#diagram [data-t-workpaper-node]').length`));
  console.log('errors', app.errors.slice(0,5));
  await app.close();
})();
