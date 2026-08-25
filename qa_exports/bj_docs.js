/* JOB BJ - Tab inside a REAL Docs paragraph, with real typed text in it.
 * The point: nothing the auditor wrote may be lost, and Tab must not rewrite the Mermaid source
 * from inside Docs either. Same script both builds.
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
const fstate = p => p.evaluate(`(()=>{const a=document.activeElement; return a?{tag:a.tagName,id:a.id||'',cls:(a.getAttribute('class')||'').slice(0,40),text:(a.textContent||'').slice(0,50)}:{tag:'none'};})()`);

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q,s)=>fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),(e,d)=>e?(s.writeHead(404),s.end()):(s.writeHead(200),s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e=>errors.push(String(e.message).slice(0,160)));
  page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text().slice(0,140)); });
  try {
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil:'load', timeout:90000 });
    await page.evaluate(WAIT_SVG); await page.waitForTimeout(3000);
    await killTour(page); await page.waitForTimeout(2500); await killTour(page);
    await page.evaluate(`(()=>{const s=document.getElementById('source'); s.value=${JSON.stringify(FIXTURE)}; s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await page.waitForTimeout(2400);

    const open = await page.evaluate(`(async()=>{ document.getElementById('workpapersButton')?.click(); await new Promise(r=>setTimeout(r,1800));
      const e=document.getElementById('wpEmptyNewButton'); if(e&&e.offsetParent){ e.click(); await new Promise(r=>setTimeout(r,2200)); }
      return { workspace: !!(document.getElementById('wpWorkspace')&&!document.getElementById('wpWorkspace').hidden),
               wpText: document.querySelectorAll('.wp-text').length,
               headings: document.querySelectorAll('#wpDoc input').length,
               ce: document.querySelectorAll('#wpWorkspace [contenteditable]').length }; })()`);
    out.open = open;

    // click into the first paragraph, type real text
    const box = await page.evaluate(`(()=>{const t=document.querySelector('.wp-text'); if(!t) return null; const r=t.getBoundingClientRect(); return {x:r.left+Math.min(40,r.width/2), y:r.top+Math.min(14,r.height/2), w:r.width, h:r.height};})()`);
    out.box = box;
    if (!box) { out.rows.push({ test:'DOCS', why:'no .wp-text paragraph' }); }
    else {
      await page.mouse.click(box.x, box.y); await page.waitForTimeout(600);
      await page.keyboard.type('Sample: FX revaluation walkthrough, PBC 14.');
      await page.waitForTimeout(700);
      const typed = await page.evaluate(`(()=>{const t=document.querySelector('.wp-text'); return t?(t.textContent||''):'';})()`);
      const srcBefore = await src(page);
      const docBefore = await page.evaluate(`Array.from(document.querySelectorAll('.wp-text')).map(t=>t.textContent).join('|')`);
      const fB = await fstate(page);
      await page.keyboard.press('Tab'); await page.waitForTimeout(900);
      const srcAfter = await src(page);
      const docAfter = await page.evaluate(`Array.from(document.querySelectorAll('.wp-text')).map(t=>t.textContent).join('|')`);
      out.rows.push({ test:'DOCS_tab', typed, focusBefore:fB, focusAfter: await fstate(page),
        sourceMutated: srcAfter!==srcBefore, sourceAfter: srcAfter!==srcBefore?srcAfter:null,
        docTextLost: docBefore!==docAfter, docBefore, docAfter });

      // Enter inside the paragraph must still make a new paragraph, not eat the text
      await page.mouse.click(box.x + Math.min(200, box.w-10), box.y); await page.waitForTimeout(400);
      await page.keyboard.press('End'); await page.waitForTimeout(200);
      const beforeEnter = await page.evaluate(`document.querySelectorAll('.wp-text').length`);
      const srcB2 = await src(page);
      await page.keyboard.press('Enter'); await page.waitForTimeout(700);
      await page.keyboard.type('second line'); await page.waitForTimeout(600);
      const afterEnter = await page.evaluate(`document.querySelectorAll('.wp-text').length`);
      const allText = await page.evaluate(`Array.from(document.querySelectorAll('.wp-text')).map(t=>t.textContent).join('|')`);
      out.rows.push({ test:'DOCS_enter', paragraphsBefore:beforeEnter, paragraphsAfter:afterEnter, allText,
        sourceMutated: (await src(page))!==srcB2, firstTextStillThere: allText.includes('FX revaluation walkthrough') });
    }
    out.errors = errors;
  } catch(e){ out.fatal = String(e&&e.stack||e).slice(0,900); out.errors = errors; }
  finally { console.log('DOCS_JSON '+JSON.stringify(out)); await browser.close(); server.close(); }
})();
