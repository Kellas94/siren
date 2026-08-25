/* Tour ALIVE. Does Tab still do its normal job in the Mermaid code editor, and does the
 * tour's own Skip/Next stay reachable? Code mode entered FIRST so #source is really focusable. */
const path = require('path'), fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]), LABEL = process.argv[4];
const FIXTURE = 'flowchart TD\n  A[Start] --> B[Check invoice]\n  B --> C[Approve]';
const out = { label: LABEL, rows: [] };
const WAIT_SVG = `(async () => { for (let i=0;i<90;i++){ if(document.querySelector('#diagram svg')) break; await new Promise(r=>setTimeout(r,300)); }
  for (let i=0;i<60;i++){ const o=document.getElementById('sirenIntroOverlay'); if(!o||o.hidden) break; await new Promise(r=>setTimeout(r,100)); } return 1; })()`;
const src = p => p.evaluate(`document.getElementById('source').value`);
const fstate = p => p.evaluate(`(()=>{const a=document.activeElement; return a?{tag:a.tagName,id:a.id||'',cls:(a.getAttribute('class')||'').slice(0,36),inTour:!!(a.closest&&a.closest('.tour-card')),label:((a.getAttribute&&a.getAttribute('aria-label'))||(a.textContent||'').trim()).slice(0,36)}:{tag:'none'};})()`);

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q,s)=>fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),(e,d)=>e?(s.writeHead(404),s.end()):(s.writeHead(200),s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e=>errors.push(String(e.message).slice(0,160)));
  try {
    await page.goto(`http://${'127.0.0.1'}:${PORT}/${file}`, { waitUntil:'load', timeout:90000 });
    await page.evaluate(WAIT_SVG); await page.waitForTimeout(3500);
    out.tourAlive = await page.evaluate(`!!document.querySelector('.tour-card')`);

    // enter Code mode + Text view so #source really is the editor on screen
    await page.evaluate(`(async()=>{ document.getElementById('codeModeButton')?.click(); await new Promise(r=>setTimeout(r,600)); document.getElementById('textModeButton')?.click(); await new Promise(r=>setTimeout(r,600)); })()`);
    await page.waitForTimeout(1200);
    out.tourAliveAfterModeSwitch = await page.evaluate(`!!document.querySelector('.tour-card')`);
    await page.evaluate(`(()=>{const s=document.getElementById('source'); s.value=${JSON.stringify(FIXTURE)}; s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await page.waitForTimeout(2400);

    // real click into the code editor, caret at the very start
    const sb = await page.evaluate(`(()=>{const s=document.getElementById('source'); const r=s.getBoundingClientRect(); return {x:r.left+30,y:r.top+14,vis:r.width>10&&r.height>10};})()`);
    out.sourceBox = sb;
    await page.mouse.click(sb.x, sb.y); await page.waitForTimeout(400);
    await page.evaluate(`document.getElementById('source').setSelectionRange(0,0)`);
    const focusIsSource = await page.evaluate(`document.activeElement && document.activeElement.id === 'source'`);
    const b = await src(page);
    await page.keyboard.press('Tab'); await page.waitForTimeout(700);
    const a = await src(page);
    out.rows.push({ test:'TOUR_tabInCodeEditor', tourAlive: await page.evaluate(`!!document.querySelector('.tour-card')`),
      focusIsSource, indented: a !== b, before: b, after: a, focusAfter: await fstate(page) });

    // can the keyboard reach the tour's own Skip / Next?
    await page.evaluate(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
    const reach = [];
    for (let i=1;i<=8;i++){ await page.keyboard.press('Tab'); await page.waitForTimeout(90); reach.push(await fstate(page)); }
    out.rows.push({ test:'TOUR_reachSkipNext', reachedTourButton: reach.some(r=>r.inTour), stops: reach });

    // does Next still advance the tour by keyboard?
    const step1 = await page.evaluate(`(document.querySelector('.tour-card h3, .tour-card [class*=title], .tour-card')||{}).textContent||''`);
    const onNext = reach.findIndex(r=>r.inTour && /next|done/i.test(r.label));
    if (onNext >= 0) {
      await page.evaluate(`(()=>{const b=Array.from(document.querySelectorAll('.tour-card button')).find(x=>/next|done/i.test(x.textContent)); if(b) b.focus();})()`);
      await page.keyboard.press('Enter'); await page.waitForTimeout(800);
    }
    const step2 = await page.evaluate(`(document.querySelector('.tour-card')||{}).textContent||''`);
    out.rows.push({ test:'TOUR_nextByKeyboard', advanced: step1.slice(0,40) !== step2.slice(0,40), step1: step1.slice(0,80), step2: step2.slice(0,80) });
    out.errors = errors;
  } catch(e){ out.fatal = String(e&&e.stack||e).slice(0,900); out.errors = errors; }
  finally { console.log('TOUR2_JSON '+JSON.stringify(out)); await browser.close(); server.close(); }
})();
