const path = require('path'), fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]), LABEL = process.argv[4];
const WAIT_SVG = `(async () => { for (let i=0;i<90;i++){ if(document.querySelector('#diagram svg')) break; await new Promise(r=>setTimeout(r,300)); }
  for (let i=0;i<60;i++){ const o=document.getElementById('sirenIntroOverlay'); if(!o||o.hidden) break; await new Promise(r=>setTimeout(r,100)); } return 1; })()`;
(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q,s)=>fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),(e,d)=>e?(s.writeHead(404),s.end()):(s.writeHead(200),s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const errs = []; const warns = [];
  page.on('pageerror', e=>errs.push('pageerror: '+String(e.message).slice(0,200)));
  page.on('console', m => { if (m.type()==='error') errs.push('console.error: '+m.text().slice(0,200)); if (m.type()==='warning') warns.push(m.text().slice(0,120)); });
  const out = { label: LABEL };
  try {
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil:'load', timeout:90000 });
    await page.evaluate(WAIT_SVG); await page.waitForTimeout(5000);
    out.symbols = await page.evaluate(`(()=>{ const r={};
      for (const n of ['handleCanvasCreationKeys','addBlockRelativeToSelection','handleCanvasBuilderKeydown','handleWelcomeTourKeydown','canvasOpenPopoverAtSelection']) {
        try { r[n] = typeof eval(n); } catch (e) { r[n] = 'not defined'; } }
      return r; })()`);
    out.boot = await page.evaluate(`({ svg: !!document.querySelector('#diagram svg'), nodes: document.querySelectorAll('#diagram g.node').length, sourceLen: (document.getElementById('source')||{}).value ? document.getElementById('source').value.length : 0 })`);
    out.errors = errs; out.warnCount = warns.length;
  } catch(e){ out.fatal = String(e&&e.stack||e).slice(0,600); out.errors = errs; }
  finally { console.log('FINAL_JSON '+JSON.stringify(out)); await browser.close(); server.close(); }
})();
