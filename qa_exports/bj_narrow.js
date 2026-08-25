/* Faithful replica of R2.ITEM3.NARROW checks 11 and 12, at 375x812, doing what the suite does:
 * switch to the mobile PREVIEW tab first, then click a node, then the two Tab assertions. */
const path = require('path'), fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]), LABEL = process.argv[4];
const out = { label: LABEL, rows: [] };
const WAIT_SVG = `(async () => { for (let i=0;i<90;i++){ if(document.querySelector('#diagram svg')) break; await new Promise(r=>setTimeout(r,300)); }
  for (let i=0;i<60;i++){ const o=document.getElementById('sirenIntroOverlay'); if(!o||o.hidden) break; await new Promise(r=>setTimeout(r,100)); } return 1; })()`;
async function killTour(page){ for(let i=0;i<40;i++){ const g=await page.evaluate(`(()=>{const c=document.querySelector('.tour-card'); if(!c) return true; const b=Array.from(c.querySelectorAll('button')).find(x=>/skip|done|got it|close|finish/i.test(x.textContent))||c.querySelector('button'); if(b)b.click(); return false;})()`); if(g&&i>10)break; await page.waitForTimeout(200);} }
const src = p => p.evaluate(`document.getElementById('source').value`);

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q,s)=>fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),(e,d)=>e?(s.writeHead(404),s.end()):(s.writeHead(200),s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e=>errors.push(String(e.message).slice(0,160)));
  try {
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil:'load', timeout:90000 });
    await page.evaluate(WAIT_SVG); await page.waitForTimeout(3000);
    await killTour(page); await page.waitForTimeout(2500); await killTour(page);

    await page.locator('#mobilePreviewTab').click();
    await page.locator('#previewPane.is-mobile-active').waitFor({ timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(900);
    out.previewActive = true;
    out.startSource = await src(page);

    const node = page.locator('#diagram [data-node-id], #diagram g.node[role="button"]').first();
    await node.waitFor({ state: 'visible', timeout: 15000 });
    await node.click();
    await page.locator('#nodeInspector:not([hidden])').waitFor({ timeout: 15000 });
    out.inspectorOpened = true;

    // check 11: BODY + Tab must NOT change the source
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    const activeBefore = await page.evaluate(() => document.activeElement?.tagName || '');
    let b = await src(page);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(650);
    let a = await src(page);
    out.rows.push({ check: 'R2.ITEM3.NARROW.11', assertion: 'BODY+Tab must NOT change #source',
      activeBefore, sourceChanged: a !== b, passes: activeBefore === 'BODY' && a === b, after: a !== b ? a : null });

    // check 12: #zoomViewport + Tab MUST change the source (the now-obsolete assertion)
    await page.locator('#zoomViewport').focus();
    await page.waitForTimeout(250);
    const vpFocused = await page.evaluate(() => document.activeElement?.id === 'zoomViewport');
    b = await src(page);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(650);
    a = await src(page);
    out.rows.push({ check: 'R2.ITEM3.NARROW.12', assertion: '#zoomViewport+Tab MUST change #source',
      vpFocused, sourceChanged: a !== b, passes: a !== b, before: b, after: a !== b ? a : null,
      focusAfter: await page.evaluate(() => { const x = document.activeElement; return x ? x.tagName + '.' + (x.getAttribute('class')||'').split(' ')[0] + ' | ' + ((x.getAttribute('aria-label')||'').slice(0,40)) : 'none'; }) });
    await page.screenshot({ path: `C:/Claude/SIREN/qa_exports/bj_narrow_${LABEL}.png`, fullPage: false });
    out.errors = errors;
  } catch(e){ out.fatal = String(e&&e.stack||e).slice(0,900); out.errors = errors; }
  finally { console.log('NARROW_JSON '+JSON.stringify(out)); await browser.close(); server.close(); }
})();
