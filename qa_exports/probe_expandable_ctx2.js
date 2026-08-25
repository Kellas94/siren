#!/usr/bin/env node
/* v2: fixed census (string interpolation, not evaluate-with-args), harder tour sweep,
 * measures state AT REST before any click, then per-context.
 */
const { openApp, setSource } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9862'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/expandable_ctx2.json');
const NL = String.fromCharCode(10);

const FLOW = ['flowchart TD',
  '  A[Purchase request] --> B{Approved}',
  '  B -->|Yes| C[Raise order]',
  '  B -->|No| D[Reject]'].join(NL);

const KILL_TOUR = `(async () => {
  for (let p = 0; p < 25; p++) {
    const b = Array.from(document.querySelectorAll('.tour-card button, .tour button, [class*="tour"] button'))
      .find(x => /skip|done|got it|close|next|finish|×/i.test(x.textContent));
    if (!b) { await new Promise(r=>setTimeout(r,200)); continue; }
    b.click(); await new Promise(r => setTimeout(r, 200));
  }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
  return document.querySelectorAll('.tour-card').length;
})()`;

function census(sel) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return { missing: true };
    const ctrls = Array.from(el.querySelectorAll('input,select,textarea,button'));
    const rows = ctrls.map(c => {
      const r = c.getBoundingClientRect(); const cs = getComputedStyle(c);
      let lab = '';
      if (c.id) { const l = document.querySelector('label[for="' + CSS.escape(c.id) + '"]'); if (l) lab = l.textContent.trim(); }
      if (!lab) lab = (c.getAttribute('aria-label') || c.textContent || c.placeholder || c.id || '').trim();
      let d = c.closest('details'); let folded = false; const chain = [];
      while (d) { const s = d.querySelector('summary'); chain.push(s ? s.textContent.trim().slice(0,34) : (d.id||'')); if (!d.open) folded = true; d = d.parentElement ? d.parentElement.closest('details') : null; }
      return { id: c.id||null, tag: c.tagName.toLowerCase(), label: lab.replace(/[ ]+/g,' ').slice(0,44),
        opts: c.tagName==='SELECT' ? c.options.length : null,
        disabled: !!c.disabled || c.getAttribute('aria-disabled')==='true',
        vis: r.width>2 && r.height>2 && cs.visibility!=='hidden' && Number(cs.opacity)>0.05,
        folded, foldChain: chain, box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)] };
    });
    const rr = el.getBoundingClientRect();
    return { count: rows.length, hiddenAttr: el.hasAttribute('hidden'),
      box:[Math.round(rr.left),Math.round(rr.top),Math.round(rr.width),Math.round(rr.height)], rows };
  })()`;
}

const FOLDS = `(() => Array.from(document.querySelectorAll('details.style-fold, #styleFoldBlocks, #styleFoldLegend, #styleFoldFonts')).map(d => {
  const r = d.getBoundingClientRect(); const s = d.querySelector('summary');
  const body = Array.from(d.querySelectorAll('input,select,textarea,button'));
  const shown = body.filter(c => { const b=c.getBoundingClientRect(); return b.width>2&&b.height>2; }).length;
  return { id: d.id||null, summary: s?s.textContent.replace(/[ ]+/g,' ').trim().slice(0,72):'',
    open: d.open, h: Math.round(r.height), top: Math.round(r.top+window.scrollY),
    ctrls: body.length, ctrlsShown: shown };
}))()`;

(async () => {
  const out = {};
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await page.evaluate(KILL_TOUR);
  await setSource(page, FLOW, 3200);
  await page.evaluate(KILL_TOUR);
  await page.waitForTimeout(600);

  out.fixture = await page.evaluate(`document.getElementById('source').value.split(String.fromCharCode(10))[0]`);
  if (!/flowchart/.test(out.fixture)) { console.log('ABORT fixture', out.fixture); await close(); process.exit(2); }

  // ---- AT REST ----
  out.atRest = {};
  out.atRest.styleBtn = await page.evaluate(`(() => {
    const b = document.getElementById('styleShortcutButton');
    if (!b) return { absent:true };
    const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
    let p = b.parentElement, hiddenBy = null;
    while (p && p !== document.body) { const pc = getComputedStyle(p);
      if (pc.display==='none' || pc.visibility==='hidden' || p.hasAttribute('hidden')) { hiddenBy = p.id||p.className.toString().slice(0,60); break; } p = p.parentElement; }
    return { box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity, hiddenBy,
      parentId: b.parentElement ? (b.parentElement.id || b.parentElement.className.toString().slice(0,60)) : null };
  })()`);
  out.atRest.folds = await page.evaluate(FOLDS);
  out.atRest.previewBox = await page.evaluate(`(() => { const d=document.getElementById('diagram'); if(!d) return null; const r=d.getBoundingClientRect(); return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]; })()`);
  out.atRest.sidebar = await page.evaluate(`(() => {
    const cands = ['#sidebar','.sidebar','aside.controls','.controls','#controls'];
    for (const s of cands) { const e=document.querySelector(s); if (e) { const r=e.getBoundingClientRect(); if (r.width>50) return { sel:s, box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], scrollH: e.scrollHeight, clientH: e.clientHeight }; } }
    return null;
  })()`);
  // What is genuinely on screen and operable at rest
  out.atRest.chrome = await page.evaluate(`(() => {
    const seen=[]; document.querySelectorAll('button,select,input,textarea').forEach(c=>{
      const r=c.getBoundingClientRect(); if(r.width<4||r.height<4) return;
      if(r.bottom<0||r.top>window.innerHeight||r.right<0||r.left>window.innerWidth) return;
      const cs=getComputedStyle(c); if(cs.visibility==='hidden'||Number(cs.opacity)<0.05) return;
      if(c.closest('[hidden]')) return;
      seen.push({id:c.id||null,text:(c.textContent||c.getAttribute('aria-label')||c.id||'').replace(/[ ]+/g,' ').trim().slice(0,32),top:Math.round(r.top),left:Math.round(r.left)});
    }); return seen;
  })()`);

  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/shot_at_rest.png' });

  // ---- NODE CONTEXT ----
  out.nodeOpen = await page.evaluate(`(async () => {
    const svg = document.querySelector('#diagram svg'); if(!svg) return 'no svg';
    const n = svg.querySelector('g.node'); if(!n) return 'no node';
    const r=n.getBoundingClientRect();
    ['mousedown','mouseup','click'].forEach(t=>n.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2})));
    await new Promise(x=>setTimeout(x,700));
    const i=document.getElementById('nodeInspector');
    return i ? (i.hasAttribute('hidden')?'hidden':'open') : 'absent';
  })()`);
  await page.waitForTimeout(500);
  out.nodeInspector = await page.evaluate(census('#nodeInspector'));
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/shot_node_inspector.png' });

  // ---- EDGE CONTEXT ----
  out.edgeOpen = await page.evaluate(`(async () => {
    document.getElementById('closeNodeInspectorButton')?.click();
    await new Promise(x=>setTimeout(x,400));
    const svg=document.querySelector('#diagram svg');
    const e=svg&&(svg.querySelector('path.flowchart-link')||svg.querySelector('g.edgePaths path')||svg.querySelector('.edgePath path'));
    if(!e) return 'no edge';
    const r=e.getBoundingClientRect();
    ['mousedown','mouseup','click'].forEach(t=>e.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2})));
    await new Promise(x=>setTimeout(x,700));
    const i=document.getElementById('edgeInspector');
    return i ? (i.hasAttribute('hidden')?'hidden':'open') : 'absent';
  })()`);
  await page.waitForTimeout(500);
  out.edgeInspector = await page.evaluate(census('#edgeInspector'));

  // ---- STYLE CLICK ----
  await page.evaluate(`document.getElementById('closeEdgeInspectorButton')?.click()`);
  await page.waitForTimeout(400);
  out.styleClickResult = await page.evaluate(`(async () => {
    const b=document.getElementById('styleShortcutButton'); if(!b) return 'absent';
    const before = Math.round(window.scrollY);
    b.click(); await new Promise(x=>setTimeout(x,1200));
    return { clicked:true, scrollBefore:before, scrollAfter:Math.round(window.scrollY) };
  })()`);
  out.afterStyle = { folds: await page.evaluate(FOLDS) };
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/shot_after_style.png' });

  out.errors = errors.slice(0,10);
  fs.writeFileSync(OUT, JSON.stringify(out,null,1));
  console.log('WROTE', OUT);
  console.log('styleBtn at rest:', JSON.stringify(out.atRest.styleBtn));
  console.log('node inspector:', out.nodeOpen, 'ctrls', out.nodeInspector.count);
  console.log('edge inspector:', out.edgeOpen, 'ctrls', out.edgeInspector.count);
  console.log('chrome at rest:', out.atRest.chrome.length);
  await close();
})().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });
