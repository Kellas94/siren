/* JOB BJ - the capability the repair must not break, driven ENTIRELY from the keyboard,
 * exactly as the app's own help line promises:
 *   "Tab to a block in the preview, then: arrows walk the flow, Ctrl+Enter adds the next step,
 *    Ctrl+Shift+Enter inserts one before"
 * arg5 = 'mac' emulates macOS and uses Meta instead of Control.
 */
const path = require('path'), fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]), LABEL = process.argv[4], MAC = process.argv[5] === 'mac';
const FIXTURE = 'flowchart TD\n  A[Start] --> B[Check invoice]\n  B --> C[Approve]';
const out = { label: LABEL, mac: MAC, rows: [] };
const WAIT_SVG = `(async () => { for (let i=0;i<90;i++){ if(document.querySelector('#diagram svg')) break; await new Promise(r=>setTimeout(r,300)); }
  for (let i=0;i<60;i++){ const o=document.getElementById('sirenIntroOverlay'); if(!o||o.hidden) break; await new Promise(r=>setTimeout(r,100)); } return 1; })()`;
async function killTour(page){ for(let i=0;i<40;i++){ const g=await page.evaluate(`(()=>{const c=document.querySelector('.tour-card'); if(!c) return true; const b=Array.from(c.querySelectorAll('button')).find(x=>/skip|done|got it|close|finish/i.test(x.textContent))||c.querySelector('button'); if(b)b.click(); return false;})()`); if(g&&i>10)break; await page.waitForTimeout(200);} }
const src = p => p.evaluate(`document.getElementById('source').value`);
const fstate = p => p.evaluate(`(()=>{const a=document.activeElement; return a?{tag:a.tagName,cls:(a.getAttribute('class')||'').slice(0,30),label:((a.getAttribute&&a.getAttribute('aria-label'))||'').slice(0,40),isNode:!!(a.classList&&a.classList.contains('node'))}:{tag:'none'};})()`);
async function reset(p){ await p.evaluate(`(()=>{const s=document.getElementById('source'); s.value=${JSON.stringify(FIXTURE)}; s.dispatchEvent(new Event('input',{bubbles:true}));})()`); await p.waitForTimeout(2400); }

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q,s)=>fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),(e,d)=>e?(s.writeHead(404),s.end()):(s.writeHead(200),s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const opts = { viewport: { width: 1440, height: 900 } };
  if (MAC) opts.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const ctx = await browser.newContext(opts);
  if (MAC) await ctx.addInitScript(`Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });`);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e=>errors.push(String(e.message).slice(0,160)));
  page.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text().slice(0,140)); });
  try {
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil:'load', timeout:90000 });
    await page.evaluate(WAIT_SVG); await page.waitForTimeout(3000);
    await killTour(page); await page.waitForTimeout(2500); await killTour(page);
    out.platform = await page.evaluate(`navigator.platform`);
    const MOD = MAC ? 'Meta' : 'Control';

    // ---- keyboard-only chain: focus the viewport, Tab until a BLOCK is focused, then create
    await reset(page);
    await page.evaluate(`document.getElementById('zoomViewport').focus()`);
    await page.waitForTimeout(250);
    const before = await src(page);
    const trail = [];
    let pressesToBlock = null;
    for (let i = 1; i <= 14; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(140);
      const f = await fstate(page);
      const now = await src(page);
      trail.push({ n: i, tag: f.tag, cls: f.cls, label: f.label, mutated: now !== before });
      if (f.isNode && pressesToBlock === null) pressesToBlock = i;
      if (pressesToBlock !== null) break;
    }
    const afterWalk = await src(page);
    out.rows.push({ test: 'CHAIN_tabToBlock', pressesToBlock, mutatedWhileWalking: afterWalk !== before,
      afterWalk: afterWalk !== before ? afterWalk : null, trail });

    // from that focused block, the documented creation combo
    let chain = { reached: pressesToBlock !== null };
    if (pressesToBlock !== null) {
      const b2 = await src(page);
      await page.keyboard.press(MOD + '+Enter');
      await page.waitForTimeout(900);
      const pop = await page.evaluate(`(()=>{const p=document.querySelector('.canvas-popover'); return p ? { open: !p.hidden, inputs: p.querySelectorAll('input').length } : { open: false };})()`);
      chain.popover = pop;
      if (pop.open) {
        await page.keyboard.type('Tie to GL');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);
        const a2 = await src(page);
        chain.created = a2 !== b2;
        chain.after = a2;
        chain.labelLanded = /Tie to GL/.test(a2);
      }
    }
    out.rows.push({ test: 'CHAIN_createFromFocusedBlock', mod: MOD, ...chain });

    // ---- and the mouse-selected variant, both combos, on this platform
    for (const combo of [MOD + '+Enter', MOD + '+Shift+Enter']) {
      await reset(page);
      const box = await page.evaluate(`(()=>{const n=document.querySelector('#diagram g.node'); if(!n) return null; const r=n.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
      await page.mouse.click(box.x, box.y); await page.waitForTimeout(900);
      const b3 = await src(page);
      await page.keyboard.press(combo);
      await page.waitForTimeout(900);
      const pop = await page.evaluate(`(()=>{const p=document.querySelector('.canvas-popover'); return p ? { open: !p.hidden } : { open: false };})()`);
      let created = null;
      if (pop.open) {
        await page.keyboard.type('Vouch to invoice');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);
        const a3 = await src(page);
        created = { mutated: a3 !== b3, labelLanded: /Vouch to invoice/.test(a3), after: a3 };
      }
      out.rows.push({ test: 'CHAIN_mouseSelectThenCombo', combo, popoverOpened: pop.open, created });
      await page.keyboard.press('Escape').catch(()=>{}); await page.waitForTimeout(400);
    }
    out.errors = errors;
  } catch(e){ out.fatal = String(e&&e.stack||e).slice(0,900); out.errors = errors; }
  finally { console.log('CHAIN_JSON '+JSON.stringify(out)); await browser.close(); server.close(); }
})();
