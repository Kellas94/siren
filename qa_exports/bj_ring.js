/* After Tab navigation, does what you SEE highlighted match what a create attaches to? */
const path = require('path'), fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]), LABEL = process.argv[4];
const FIXTURE = 'flowchart TD\n  A[Start] --> B[Check invoice]\n  B --> C[Approve]';
const out = { label: LABEL, steps: [] };
const WAIT_SVG = `(async () => { for (let i=0;i<90;i++){ if(document.querySelector('#diagram svg')) break; await new Promise(r=>setTimeout(r,300)); }
  for (let i=0;i<60;i++){ const o=document.getElementById('sirenIntroOverlay'); if(!o||o.hidden) break; await new Promise(r=>setTimeout(r,100)); } return 1; })()`;
async function killTour(page){ for(let i=0;i<40;i++){ const g=await page.evaluate(`(()=>{const c=document.querySelector('.tour-card'); if(!c) return true; const b=Array.from(c.querySelectorAll('button')).find(x=>/skip|done|got it|close|finish/i.test(x.textContent))||c.querySelector('button'); if(b)b.click(); return false;})()`); if(g&&i>10)break; await page.waitForTimeout(200);} }
const src = p => p.evaluate(`document.getElementById('source').value`);
const look = p => p.evaluate(`(()=>{
  const handleOwner = (()=>{ const h=document.querySelector('#diagram [data-handle-for]'); return h ? h.getAttribute('data-handle-for') : null; })();
  const a = document.activeElement;
  return {
    handleOwnerId: handleOwner,
    selectedClassNodes: Array.from(document.querySelectorAll('#diagram g.node')).filter(n=>/t-selected-node|canvas-selected|is-selected/.test(n.getAttribute('class')||'')).map(n=>(n.textContent||'').trim()),
    focusTag: a?a.tagName:'', focusLabel: a?((a.getAttribute&&a.getAttribute('aria-label'))||(a.textContent||'').trim()).slice(0,40):'',
    inspectorTitle: (()=>{const h=document.querySelector('#nodeInspector .node-inspector-title, #nodeInspector h2, #nodeInspector strong'); return h?h.textContent.replace(/\\s+/g,' ').trim().slice(0,32):'';})()
  };})()`);

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
    await page.evaluate(`(()=>{const s=document.getElementById('source'); s.value=${JSON.stringify(FIXTURE)}; s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await page.waitForTimeout(2500);
    const box = await page.evaluate(`(()=>{const n=document.querySelector('#diagram g.node'); if(!n) return null; const r=n.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,t:(n.textContent||'').trim()};})()`);
    await page.mouse.click(box.x, box.y); await page.waitForTimeout(900);
    out.clicked = box.t;
    out.steps.push({ press: 0, ...(await look(page)) });
    await page.evaluate(`document.getElementById('zoomViewport').focus()`);
    await page.waitForTimeout(250);
    const before = await src(page);
    for (let i=1;i<=6;i++){ await page.keyboard.press('Tab'); await page.waitForTimeout(420); out.steps.push({ press:i, ...(await look(page)) }); }
    out.walkMutated = (await src(page)) !== before;
    // now create and see which block it attaches to
    const b2 = await src(page);
    await page.keyboard.press('Control+Enter'); await page.waitForTimeout(900);
    const pop = await page.evaluate(`(()=>{const p=document.querySelector('.canvas-popover'); return !!(p&&!p.hidden);})()`);
    if (pop) { await page.keyboard.type('ATTACH_HERE'); await page.waitForTimeout(300); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); }
    out.popoverOpened = pop;
    out.afterCreate = await src(page);
    out.createMutated = out.afterCreate !== b2;
    out.finalLook = await look(page);
    out.errors = errors;
  } catch(e){ out.fatal = String(e&&e.stack||e).slice(0,900); out.errors = errors; }
  finally { console.log('RING_JSON '+JSON.stringify(out)); await browser.close(); server.close(); }
})();
