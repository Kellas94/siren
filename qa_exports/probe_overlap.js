#!/usr/bin/env node
/* Honest visibility (offsetParent + rect) for the Style tree at rest, and how much of the
 * preview the in-place block inspector covers at three window widths.
 */
const { openApp, setSource } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n,d)=>{const i=argv.indexOf('--'+n);return i>=0&&argv[i+1]?argv[i+1]:d;};
const APP = arg('app','C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port','9867'));
const NL = String.fromCharCode(10);
const FLOW = ['flowchart TD','  A[Purchase request] --> B{Approved}','  B -->|Yes| C[Raise order]','  B -->|No| D[Reject]'].join(NL);
const KILL_TOUR = `(async()=>{for(let p=0;p<22;p++){const b=Array.from(document.querySelectorAll('.tour-card button')).find(x=>/skip|done|got it|close|next|finish/i.test(x.textContent));if(!b){await new Promise(r=>setTimeout(r,140));continue;}b.click();await new Promise(r=>setTimeout(r,170));}return 1;})()`;

const REAL_VIS = `(id) => {}`;
function vis(id){ return `(() => { const e=document.getElementById(${JSON.stringify(id)});
  if(!e) return {absent:true};
  const r=e.getBoundingClientRect();
  return { offsetParent: !!e.offsetParent, w:Math.round(r.width), h:Math.round(r.height),
    top:Math.round(r.top), inViewport: r.top>=0 && r.bottom<=window.innerHeight && r.width>2 }; })()`; }

(async () => {
  const out = {};
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await page.evaluate(KILL_TOUR);
  await setSource(page, FLOW, 3200);
  await page.evaluate(KILL_TOUR);
  await page.waitForTimeout(600);
  out.fixture = await page.evaluate(`document.getElementById('source').value.split(String.fromCharCode(10))[0]`);

  out.styleTreeAtRest = await page.evaluate(`(() => {
    const parent = Array.from(document.querySelectorAll('details')).find(d => {
      const s=d.querySelector('summary'); return s && /Style .* how this diagram looks/i.test(s.textContent); });
    const subs = Array.from(document.querySelectorAll('details.style-fold')).map(d => {
      const s=d.querySelector('summary');
      const body=d.querySelector('.style-fold-body');
      const br = body ? body.getBoundingClientRect() : null;
      return { name: s ? s.textContent.replace(/[ ]+/g,' ').trim().split(/(?=[A-Z][a-z]+ )/)[0].slice(0,26) : '',
        openAttr: d.open, bodyVisible: body ? (!!body.offsetParent && br.height>2) : null,
        bodyH: br?Math.round(br.height):null, ctrls: d.querySelectorAll('input,select,textarea,button').length };
    });
    return { parentOpen: parent ? parent.open : null,
      parentCtrls: parent ? parent.querySelectorAll('input,select,textarea,button').length : null, subs };
  })()`);
  out.fontAtRest = await page.evaluate(vis('diagramFontFamily'));
  out.spacingAtRest = await page.evaluate(vis('layoutNodeSpacing'));
  out.themeAtRest = await page.evaluate(vis('themeMenuButton'));

  // overlap of the block inspector over the preview, at three widths
  out.overlap = {};
  for (const w of [1440, 1280, 1100]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(900);
    await page.evaluate(KILL_TOUR);
    const r = await page.evaluate(`(async () => {
      document.getElementById('closeNodeInspectorButton')?.click();
      await new Promise(x=>setTimeout(x,300));
      const n=document.querySelector('#diagram svg g.node'); if(!n) return {err:'no node'};
      const nr=n.getBoundingClientRect();
      ['mousedown','mouseup','click'].forEach(t=>n.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:nr.left+nr.width/2,clientY:nr.top+nr.height/2})));
      await new Promise(x=>setTimeout(x,800));
      const i=document.getElementById('nodeInspector'); const d=document.getElementById('diagram');
      if(!i||i.hasAttribute('hidden')||!d) return {err:'inspector not open'};
      const ir=i.getBoundingClientRect(), dr=d.getBoundingClientRect();
      const ox=Math.max(0, Math.min(ir.right,dr.right)-Math.max(ir.left,dr.left));
      const oy=Math.max(0, Math.min(ir.bottom,dr.bottom)-Math.max(ir.top,dr.top));
      const svg=document.querySelector('#diagram svg'); const sr=svg?svg.getBoundingClientRect():null;
      let covered=0, total=0;
      document.querySelectorAll('#diagram svg g.node').forEach(g=>{ total++;
        const gr=g.getBoundingClientRect();
        if (gr.right>ir.left && gr.left<ir.right && gr.bottom>ir.top && gr.top<ir.bottom) covered++; });
      return { inspector:[Math.round(ir.left),Math.round(ir.top),Math.round(ir.width),Math.round(ir.height)],
        preview:[Math.round(dr.left),Math.round(dr.top),Math.round(dr.width),Math.round(dr.height)],
        overlapPct: Math.round(100*(ox*oy)/(dr.width*dr.height)),
        nodesTotal: total, nodesCovered: covered,
        inspectorOffscreenRight: Math.round(Math.max(0, ir.right - window.innerWidth)) };
    })()`);
    out.overlap[w] = r;
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/shot_overlap_' + w + '.png' });
    console.log(w, JSON.stringify(r));
  }

  out.errors = errors.slice(0,10);
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/overlap.json', JSON.stringify(out,null,1));
  console.log('style tree:', JSON.stringify(out.styleTreeAtRest,null,1));
  console.log('font at rest:', JSON.stringify(out.fontAtRest), 'spacing:', JSON.stringify(out.spacingAtRest));
  await close();
})().catch(e=>{console.error('PROBE ERROR',e);process.exit(1);});
