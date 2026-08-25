#!/usr/bin/env node
/* SIREN already ships an in-place expandable pattern: the numbered "Build without code" steps.
 * This measures what each step holds, whether it duplicates the Style panel, and how many
 * options each expandable carries at rest and when open.
 */
const { openApp, setSource } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9866'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/accordion_vs_style.json');
const NL = String.fromCharCode(10);
const FLOW = ['flowchart TD','  A[Purchase request] --> B{Approved}','  B -->|Yes| C[Raise order]','  B -->|No| D[Reject]'].join(NL);

const KILL_TOUR = `(async () => { for (let p=0;p<22;p++){ const b=Array.from(document.querySelectorAll('.tour-card button')).find(x=>/skip|done|got it|close|next|finish/i.test(x.textContent)); if(!b){await new Promise(r=>setTimeout(r,140));continue;} b.click(); await new Promise(r=>setTimeout(r,170)); } return 1; })()`;

(async () => {
  const out = {};
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await page.evaluate(KILL_TOUR);
  await setSource(page, FLOW, 3200);
  await page.evaluate(KILL_TOUR);
  await page.waitForTimeout(600);
  out.fixture = await page.evaluate(`document.getElementById('source').value.split(String.fromCharCode(10))[0]`);
  if (!/flowchart/.test(out.fixture)) { console.log('ABORT'); await close(); process.exit(2); }

  // Every <details>/accordion in the left pane, with contents
  out.accordions = await page.evaluate(`(() => {
    const all = Array.from(document.querySelectorAll('details'));
    return all.map(d => {
      const s = d.querySelector('summary');
      const r = d.getBoundingClientRect();
      const ctrls = Array.from(d.querySelectorAll(':scope input, :scope select, :scope textarea, :scope button'))
        .filter(c => !c.closest('details') || c.closest('details') === d);
      const nested = d.querySelectorAll(':scope details').length;
      return {
        id: d.id || null,
        summary: s ? s.textContent.replace(/[ ]+/g,' ').trim().slice(0,90) : '(no summary)',
        open: d.open,
        top: Math.round(r.top + (document.getElementById('pane-scroll')||{scrollTop:0}).scrollTop),
        rectTop: Math.round(r.top),
        ownCtrls: ctrls.length,
        allCtrls: d.querySelectorAll('input,select,textarea,button').length,
        nestedDetails: nested,
        ctrlIds: ctrls.map(c => c.id).filter(Boolean).slice(0, 40),
        cls: d.className.toString().slice(0,50)
      };
    });
  })()`);

  // Open every accordion in the build panel and see what appears
  out.opened = await page.evaluate(`(async () => {
    const res = [];
    const sums = Array.from(document.querySelectorAll('details summary'));
    for (const s of sums) {
      const d = s.parentElement;
      const before = d.open;
      if (!d.open) { s.click(); await new Promise(x=>setTimeout(x,260)); }
      const ctrls = Array.from(d.querySelectorAll('input,select,textarea,button'));
      const shown = ctrls.filter(c=>{const b=c.getBoundingClientRect();return b.width>2&&b.height>2;});
      res.push({ summary: s.textContent.replace(/[ ]+/g,' ').trim().slice(0,64),
        wasOpen: before, ctrlsTotal: ctrls.length, ctrlsShown: shown.length,
        ids: shown.map(c=>c.id).filter(Boolean).slice(0,40) });
    }
    return res;
  })()`);

  // Full height of the left pane once everything is open (the "fold tax")
  out.paneWhenAllOpen = await page.evaluate(`(() => { const p=document.getElementById('pane-scroll');
    return p ? { scrollH:p.scrollHeight, clientH:p.clientHeight } : null; })()`);

  out.errors = errors.slice(0,10);
  fs.writeFileSync(OUT, JSON.stringify(out,null,1));
  console.log('WROTE', OUT);
  out.accordions.forEach(a => console.log(String(a.open).padEnd(6), String(a.allCtrls).padStart(3), 'ctrls |', a.summary));
  console.log('pane when all open:', JSON.stringify(out.paneWhenAllOpen));
  await close();
})().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });
