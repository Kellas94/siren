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
const fstate = p => p.evaluate(`(()=>{const a=document.activeElement; return a?{tag:a.tagName,id:a.id||'',cls:(a.getAttribute('class')||'').slice(0,40)}:{tag:'none'};})()`);

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
    await page.waitForTimeout(2400);

    // open Docs with a real click on the button
    const wpBtn = await page.evaluate(`(()=>{const b=document.getElementById('workpapersButton'); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await page.mouse.click(wpBtn.x, wpBtn.y); await page.waitForTimeout(2000);
    out.afterOpen = await page.evaluate(`({ wpText: document.querySelectorAll('.wp-text').length, emptyBtn: !!document.getElementById('wpEmptyNewButton'), docBlocks: document.querySelectorAll('#wpDoc *').length, docText: (document.getElementById('wpDoc')||{}).innerText ? (document.getElementById('wpDoc').innerText||'').slice(0,300) : '' })`);
    await page.screenshot({ path: `C:/Claude/SIREN/qa_exports/bj_docs_${LABEL}_1_open.png` });

    // real click on the empty-state create control
    const eb = await page.evaluate(`(()=>{const b=document.getElementById('wpEmptyNewButton'); if(!b||!b.offsetParent) return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    if (eb) { await page.mouse.click(eb.x, eb.y); await page.waitForTimeout(1600); }
    out.afterCreateClick = await page.evaluate(`({ wpText: document.querySelectorAll('.wp-text').length,
      menu: Array.from(document.querySelectorAll('[role="menu"] button, .struct-menu button, .wp-menu button')).map(b=>b.textContent.trim()).slice(0,12),
      docText: ((document.getElementById('wpDoc')||{}).innerText||'').slice(0,300) })`);
    await page.screenshot({ path: `C:/Claude/SIREN/qa_exports/bj_docs_${LABEL}_2_afterCreate.png` });

    // if a menu appeared, take the first entry
    if (!out.afterCreateClick.wpText && out.afterCreateClick.menu.length) {
      const mb = await page.evaluate(`(()=>{const b=document.querySelector('[role="menu"] button, .struct-menu button, .wp-menu button'); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,t:b.textContent.trim()};})()`);
      out.menuPick = mb;
      if (mb) { await page.mouse.click(mb.x, mb.y); await page.waitForTimeout(2200); }
      out.afterMenuPick = await page.evaluate(`({ wpText: document.querySelectorAll('.wp-text').length, docText: ((document.getElementById('wpDoc')||{}).innerText||'').slice(0,300) })`);
      await page.screenshot({ path: `C:/Claude/SIREN/qa_exports/bj_docs_${LABEL}_3_afterMenu.png` });
    }

    const box = await page.evaluate(`(()=>{const t=document.querySelector('.wp-text'); if(!t) return null; const r=t.getBoundingClientRect(); return {x:r.left+Math.min(40,r.width/2), y:r.top+Math.min(14,r.height/2), w:r.width};})()`);
    out.box = box;
    if (box) {
      await page.mouse.click(box.x, box.y); await page.waitForTimeout(600);
      await page.keyboard.type('Sample: FX revaluation walkthrough, PBC 14.');
      await page.waitForTimeout(800);
      const typed = await page.evaluate(`Array.from(document.querySelectorAll('.wp-text')).map(t=>t.textContent).join('|')`);
      const srcBefore = await src(page); const fB = await fstate(page);
      await page.keyboard.press('Tab'); await page.waitForTimeout(1000);
      const srcAfter = await src(page);
      const after = await page.evaluate(`Array.from(document.querySelectorAll('.wp-text')).map(t=>t.textContent).join('|')`);
      out.rows.push({ test:'DOCS_tab', typed, focusBefore:fB, focusAfter: await fstate(page),
        sourceMutated: srcAfter!==srcBefore, sourceAfter: srcAfter!==srcBefore?srcAfter:null,
        docTextChanged: typed!==after, docAfter: after });
      await page.screenshot({ path: `C:/Claude/SIREN/qa_exports/bj_docs_${LABEL}_4_afterTab.png` });
    }
    out.errors = errors;
  } catch(e){ out.fatal = String(e&&e.stack||e).slice(0,900); out.errors = errors; }
  finally { console.log('DOCS2_JSON '+JSON.stringify(out)); await browser.close(); server.close(); }
})();
