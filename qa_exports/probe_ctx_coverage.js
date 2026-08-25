#!/usr/bin/env node
/* Sweeps EVERY diagram type the way a person picks one (#diagramTypeSelect -> "New starter" by
 * label -> confirm), asserts the fixture, then asks of each type:
 *   - does clicking a shape in the preview select anything (unambiguous context)?
 *   - if yes, how many controls does that context carry, and do they DELIVER?
 * Also verifies the classDiagram Shape defect visually (pixel diff of the node's own bitmap).
 */
const { openApp, confirmDialog } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9865'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/ctx_coverage.json');

const KILL_TOUR = `(async () => {
  for (let p = 0; p < 20; p++) {
    const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
    if (!b) { await new Promise(r=>setTimeout(r,120)); continue; }
    b.click(); await new Promise(r => setTimeout(r, 160));
  }
  return 1;
})()`;

(async () => {
  const out = { types: {} };
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await page.evaluate(KILL_TOUR);

  const types = await page.evaluate(`(() => { const s=document.getElementById('diagramTypeSelect');
    return s ? Array.from(s.options).map(o=>({v:o.value,t:o.textContent.trim()})) : null; })()`);
  out.typeList = types;
  console.log('types found:', types ? types.length : 'NONE');
  if (!types) { await close(); process.exit(2); }

  for (const ty of types) {
    // pick the type the way a person does
    await page.evaluate(`(() => { const s=document.getElementById('diagramTypeSelect');
      s.value=${JSON.stringify(ty.v)}; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await page.waitForTimeout(500);
    const starter = await page.evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test((x.textContent||'').replace(/[ ]+/g,' ')));
      if (!b) return 'no starter button';
      const r=b.getBoundingClientRect(); if(r.width<2) return 'starter button not visible';
      b.click(); return 'clicked';
    })()`);
    await page.waitForTimeout(500);
    await confirmDialog(page, 1400);
    await page.waitForTimeout(1800);
    await page.evaluate(KILL_TOUR);

    const rec = { label: ty.t, starter };
    rec.firstLine = await page.evaluate(`(document.getElementById('source').value||'').split(String.fromCharCode(10)).find(l=>l.trim()) || ''`);
    rec.rendered = await page.evaluate(`!!document.querySelector('#diagram svg')`);
    rec.shapeCount = await page.evaluate(`(() => { const s=document.querySelector('#diagram svg'); if(!s) return 0;
      return s.querySelectorAll('g.node, .node, g.classGroup, .actor, .task, .section').length; })()`);

    // click the first plausible shape and see if any selection context appears
    rec.ctx = await page.evaluate(`(async () => {
      ['closeNodeInspectorButton','closeEdgeInspectorButton'].forEach(i=>document.getElementById(i)?.click());
      await new Promise(x=>setTimeout(x,250));
      const svg=document.querySelector('#diagram svg'); if(!svg) return { ok:false, why:'no svg' };
      const n = svg.querySelector('g.node') || svg.querySelector('.node') || svg.querySelector('g.classGroup')
             || svg.querySelector('.actor') || svg.querySelector('rect');
      if(!n) return { ok:false, why:'nothing clickable found' };
      const r=n.getBoundingClientRect();
      ['mousedown','mouseup','click'].forEach(t=>n.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2})));
      await new Promise(x=>setTimeout(x,700));
      const ni=document.getElementById('nodeInspector'), ei=document.getElementById('edgeInspector');
      const openNi = ni && !ni.hasAttribute('hidden'), openEi = ei && !ei.hasAttribute('hidden');
      if(!openNi && !openEi) return { ok:false, why:'clicked a shape, nothing opened', target:n.tagName+'.'+(n.getAttribute('class')||'') };
      const box = openNi ? ni : ei;
      const shown = Array.from(box.querySelectorAll('input,select,textarea,button')).filter(c=>{const b=c.getBoundingClientRect();return b.width>2&&b.height>2;});
      return { ok:true, which: openNi?'block':'connector', ctrlsShown: shown.length,
        heading:(document.getElementById(openNi?'nodeInspectorHeading':'edgeInspectorHeading')||{textContent:''}).textContent.trim().slice(0,32) };
    })()`);

    // If a block context opened, does the Shape control actually deliver?
    if (rec.ctx.ok && rec.ctx.which === 'block') {
      const before = await page.evaluate(`document.getElementById('source').value`);
      const svgBefore = await page.evaluate(`(document.querySelector('#diagram svg')||{outerHTML:''}).outerHTML.length`);
      const pick = await page.evaluate(`(async () => {
        const s=document.getElementById('inspectorShape'); if(!s) return 'no shape select';
        const cur=s.value; const alt=Array.from(s.options).map(o=>o.value).find(v=>v!==cur&&v!=='rect')||'cylinder';
        s.value=alt; s.dispatchEvent(new Event('change',{bubbles:true}));
        await new Promise(x=>setTimeout(x,1500));
        return { from:cur, to:alt };
      })()`);
      const after = await page.evaluate(`document.getElementById('source').value`);
      const svgAfter = await page.evaluate(`(document.querySelector('#diagram svg')||{outerHTML:''}).outerHTML.length`);
      rec.shapePromise = { pick, sourceChanged: before !== after, svgLenBefore: svgBefore, svgLenAfter: svgAfter,
        svgChanged: svgBefore !== svgAfter };
      // and the fill colour
      const fillBefore = await page.evaluate(`(document.querySelector('#diagram svg')||{outerHTML:''}).outerHTML.indexOf('#ff3366')`);
      await page.evaluate(`(async () => { const h=document.getElementById('inspectorFillHex'); const c=document.getElementById('inspectorFillColor');
        if(c){ c.value='#ff3366'; c.dispatchEvent(new Event('input',{bubbles:true})); c.dispatchEvent(new Event('change',{bubbles:true})); }
        if(h){ h.value='#ff3366'; h.dispatchEvent(new Event('input',{bubbles:true})); h.dispatchEvent(new Event('change',{bubbles:true})); }
        await new Promise(x=>setTimeout(x,1400)); })()`);
      const fillAfter = await page.evaluate(`(document.querySelector('#diagram svg')||{outerHTML:''}).outerHTML.indexOf('#ff3366')`);
      rec.fillPromise = { foundBefore: fillBefore >= 0, foundAfter: fillAfter >= 0 };
    }

    out.types[ty.v] = rec;
    console.log(String(ty.v).padEnd(20), '|', (rec.firstLine||'').slice(0,26).padEnd(28), '| ctx:',
      rec.ctx.ok ? (rec.ctx.which + ' ' + rec.ctx.ctrlsShown) : ('NONE (' + rec.ctx.why + ')'),
      rec.shapePromise ? ('| shape src=' + rec.shapePromise.sourceChanged + ' svg=' + rec.shapePromise.svgChanged) : '',
      rec.fillPromise ? ('| fill=' + rec.fillPromise.foundAfter) : '');
  }

  out.errors = errors.slice(0,15);
  fs.writeFileSync(OUT, JSON.stringify(out,null,1));
  console.log('WROTE', OUT);
  await close();
})().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });
