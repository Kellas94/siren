/* Does the block inspector follow keyboard focus? If it does not, an auditor who navigates to a
 * block and then types in the open inspector renames a DIFFERENT block than the highlighted one.
 * Reached two ways so we can tell new-in-r13 from pre-existing:
 *   route ARROW - ArrowDown moves canvas focus on BOTH builds
 *   route TAB   - Tab moves canvas focus on MERGED only (it mutates on BASE)
 */
const path = require('path'), fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]), LABEL = process.argv[4];
const FIXTURE = 'flowchart TD\n  A[Start] --> B[Check invoice]\n  B --> C[Approve]';
const out = { label: LABEL, rows: [] };
const WAIT_SVG = `(async () => { for (let i=0;i<90;i++){ if(document.querySelector('#diagram svg')) break; await new Promise(r=>setTimeout(r,300)); }
  for (let i=0;i<60;i++){ const o=document.getElementById('sirenIntroOverlay'); if(!o||o.hidden) break; await new Promise(r=>setTimeout(r,100)); } return 1; })()`;
async function killTour(page){ for(let i=0;i<40;i++){ const g=await page.evaluate(`(()=>{const c=document.querySelector('.tour-card'); if(!c) return true; const b=Array.from(c.querySelectorAll('button')).find(x=>/skip|done|got it|close|finish/i.test(x.textContent))||c.querySelector('button'); if(b)b.click(); return false;})()`); if(g&&i>10)break; await page.waitForTimeout(200);} }
const src = p => p.evaluate(`document.getElementById('source').value`);
async function reset(p){ await p.evaluate(`(()=>{const s=document.getElementById('source'); s.value=${JSON.stringify(FIXTURE)}; s.dispatchEvent(new Event('input',{bubbles:true}));})()`); await p.waitForTimeout(2400); }
const readState = p => p.evaluate(`(()=>{
  const h = document.querySelector('#nodeInspector .node-inspector-title, #nodeInspector h2, #nodeInspector strong');
  const lab = document.getElementById('inspectorBlockLabel');
  const a = document.activeElement;
  return { inspectorTitle: (h?h.textContent:'').trim().slice(0,40),
           inspectorLabelValue: lab ? lab.value : null,
           focusedNodeId: a && a.getAttribute ? (a.getAttribute('data-node-id') || a.id || '') : '',
           focusedNodeText: a ? (a.textContent||'').trim().slice(0,30) : '',
           selectedText: Array.from(document.querySelectorAll('#diagram g.node')).filter(n=>/t-selected-node|canvas-selected/.test(n.getAttribute('class')||'')).map(n=>(n.textContent||'').trim()).join(',') };})()`);

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q,s)=>fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),(e,d)=>e?(s.writeHead(404),s.end()):(s.writeHead(200),s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e=>errors.push(String(e.message).slice(0,160)));
  try {
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil:'load', timeout:90000 });
    await page.evaluate(WAIT_SVG); await page.waitForTimeout(3000);
    await killTour(page); await page.waitForTimeout(2500); await killTour(page);

    for (const route of ['ARROW', 'TAB']) {
      await reset(page);
      const box = await page.evaluate(`(()=>{const n=document.querySelector('#diagram g.node'); if(!n) return null; const r=n.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,t:(n.textContent||'').trim()};})()`);
      await page.mouse.click(box.x, box.y); await page.waitForTimeout(900);
      const afterClick = await readState(page);
      await page.evaluate(`document.getElementById('zoomViewport').focus()`);
      await page.waitForTimeout(250);
      const beforeNav = await src(page);
      // move keyboard focus onto a DIFFERENT block
      let moved = false;
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press(route === 'ARROW' ? 'ArrowDown' : 'Tab');
        await page.waitForTimeout(400);
        const st = await readState(page);
        if (st.selectedText && st.selectedText !== afterClick.selectedText) { moved = true; break; }
      }
      const afterNav = await readState(page);
      const navMutated = (await src(page)) !== beforeNav;

      // now type into the still-open inspector and commit
      let renamed = null;
      const lab = await page.evaluate(`(()=>{const l=document.getElementById('inspectorBlockLabel'); if(!l||l.offsetParent===null) return null; const r=l.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
      if (lab) {
        await page.mouse.click(lab.x, lab.y); await page.waitForTimeout(300);
        await page.keyboard.press('Control+a'); await page.waitForTimeout(150);
        await page.keyboard.type('RENAMED_BY_INSPECTOR');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);
        const after = await src(page);
        renamed = { after,
          renamedA: /A\[RENAMED_BY_INSPECTOR\]/.test(after),
          renamedB: /B\[RENAMED_BY_INSPECTOR\]/.test(after),
          renamedC: /C\[RENAMED_BY_INSPECTOR\]/.test(after) };
      }
      out.rows.push({ route, clickedBlock: box.t, afterClick, moved, afterNav, navMutated, renamed, inspectorFieldPresent: !!lab });
    }
    out.errors = errors;
  } catch(e){ out.fatal = String(e&&e.stack||e).slice(0,900); out.errors = errors; }
  finally { console.log('MIS_JSON '+JSON.stringify(out)); await browser.close(); server.close(); }
})();
