/* JOB BJ - runtime sweep: for every major pane/container, focus it and press each bare
 * navigation key; #source must be byte-identical afterwards. Plus a LOOK: screenshot the
 * preview after four Tab presses from the viewport. Same script both builds. */
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
async function reset(p){ await p.evaluate(`(()=>{const s=document.getElementById('source'); s.value=${JSON.stringify(FIXTURE)}; s.dispatchEvent(new Event('input',{bubbles:true}));})()`); await p.waitForTimeout(2300); }

const TARGETS = ['#zoomViewport', '#previewPane', '#diagram', 'body', '.workspace', '#editorPane'];
const KEYS = ['Tab', 'Shift+Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Space'];

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

    for (const sel of TARGETS) {
      for (const k of KEYS) {
        await reset(page);
        // select a block first, so the guard the old handler used is satisfied
        const box = await page.evaluate(`(()=>{const n=document.querySelector('#diagram g.node'); if(!n) return null; const r=n.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
        if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(700); }
        const focused = await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return { found: false };
          if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
          el.focus(); return { found: true, ok: document.activeElement === el, tag: el.tagName }; })()`);
        const b = await src(page);
        await page.keyboard.press(k);
        await page.waitForTimeout(750);
        const a = await src(page);
        if (a !== b || !focused.found) out.rows.push({ target: sel, key: k, focused, mutated: a !== b, before: b, after: a !== b ? a : null });
      }
    }
    out.sweepTargets = TARGETS.length; out.sweepKeys = KEYS.length; out.combinations = TARGETS.length * KEYS.length;
    out.mutatingCombos = out.rows.filter(r => r.mutated).length;

    // ---- the LOOK: four Tab presses from the viewport, then screenshot the preview
    await reset(page);
    const box = await page.evaluate(`(()=>{const n=document.querySelector('#diagram g.node'); if(!n) return null; const r=n.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await page.mouse.click(box.x, box.y); await page.waitForTimeout(800);
    await page.evaluate(`document.getElementById('zoomViewport').focus()`);
    await page.waitForTimeout(250);
    const beforeShot = await src(page);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(500); }
    await page.waitForTimeout(1200);
    out.afterFourTabs = await src(page);
    out.fourTabsMutated = out.afterFourTabs !== beforeShot;
    out.nodeCount = await page.evaluate(`document.querySelectorAll('#diagram g.node').length`);
    const pv = await page.evaluate(`(()=>{const p=document.getElementById('previewPane')||document.getElementById('zoomViewport'); const r=p.getBoundingClientRect(); return {x:Math.max(0,r.left),y:Math.max(0,r.top),width:Math.min(r.width,1440-r.left),height:Math.min(r.height,900-r.top)};})()`);
    await page.screenshot({ path: `C:/Claude/SIREN/qa_exports/bj_look_${LABEL}.png`, clip: pv });
    out.errors = errors;
  } catch(e){ out.fatal = String(e&&e.stack||e).slice(0,900); out.errors = errors; }
  finally { console.log('SWEEP_JSON '+JSON.stringify(out)); await browser.close(); server.close(); }
})();
