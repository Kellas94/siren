#!/usr/bin/env node
/* Counts REAL clicks (page.mouse, not el.click()) from a fresh load to three everyday goals,
 * and tests whether the block inspector's Shape promise holds on a class diagram.
 */
const { openApp, setSource } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9864'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/click_route.json');
const NL = String.fromCharCode(10);

const FLOW = ['flowchart TD','  A[Purchase request] --> B{Approved}','  B -->|Yes| C[Raise order]'].join(NL);
const CLASSD = ['classDiagram','  class Order','  Order : +id','  class Customer','  Customer --> Order'].join(NL);

const KILL_TOUR = `(async () => {
  for (let p = 0; p < 25; p++) {
    const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
    if (!b) { await new Promise(r=>setTimeout(r,150)); continue; }
    b.click(); await new Promise(r => setTimeout(r, 180));
  }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
  return 1;
})()`;

async function realClick(page, sel, log, why) {
  const box = await page.evaluate(`(() => { const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null;
    const r=e.getBoundingClientRect(); if(r.width<2||r.height<2) return 'zero-size';
    if(r.top<0||r.bottom>window.innerHeight) return 'offscreen:'+Math.round(r.top);
    return [r.left+r.width/2, r.top+r.height/2]; })()`);
  if (!box) { log.push({ step: why, result: 'ELEMENT ABSENT: ' + sel }); return false; }
  if (typeof box === 'string') { log.push({ step: why, result: box + ' :: ' + sel }); return false; }
  await page.mouse.click(box[0], box[1]);
  await page.waitForTimeout(650);
  log.push({ step: why, result: 'clicked at ' + Math.round(box[0]) + ',' + Math.round(box[1]) });
  return true;
}

async function findByText(page, re) {
  return page.evaluate(`(() => {
    const rx = new RegExp(${JSON.stringify(re)}, 'i');
    const els = Array.from(document.querySelectorAll('button,[role="menuitem"],summary,a'));
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if (r.width<2||r.height<2) continue;
      if (rx.test((e.textContent||'').replace(/[ ]+/g,' ').trim())) {
        return { text:(e.textContent||'').replace(/[ ]+/g,' ').trim().slice(0,60),
          x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2),
          onscreen: r.top>=0 && r.bottom<=window.innerHeight };
      }
    }
    return null;
  })()`);
}

(async () => {
  const out = {};
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await page.evaluate(KILL_TOUR);
  await setSource(page, FLOW, 3200);
  await page.evaluate(KILL_TOUR);
  await page.waitForTimeout(500);
  out.fixture = await page.evaluate(`document.getElementById('source').value.split(String.fromCharCode(10))[0]`);
  if (!/flowchart/.test(out.fixture)) { console.log('ABORT'); await close(); process.exit(2); }

  // ===== GOAL 1: change the fill colour of one block =====
  {
    const log = [];
    const svgNode = await page.evaluate(`(() => { const n=document.querySelector('#diagram svg g.node'); if(!n) return null;
      const r=n.getBoundingClientRect(); return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)]; })()`);
    if (svgNode) { await page.mouse.click(svgNode[0], svgNode[1]); await page.waitForTimeout(800);
      log.push({ step:'click the block in the preview', result:'at '+svgNode.join(',') }); }
    const st = await page.evaluate(`(() => { const i=document.getElementById('nodeInspector');
      const f=document.getElementById('inspectorFillColor'); const fr=f?f.getBoundingClientRect():null;
      return { inspectorOpen: i && !i.hasAttribute('hidden'),
        fillOnScreen: fr ? (fr.width>2 && fr.top>=0 && fr.bottom<=window.innerHeight) : false,
        fillBox: fr?[Math.round(fr.left),Math.round(fr.top)]:null }; })()`);
    out.goalFill = { clicks: log.length, log, state: st,
      note: st.fillOnScreen ? 'fill control reachable after 1 click' : 'fill control NOT reachable after 1 click' };
  }

  // ===== GOAL 2: change the diagram font =====
  {
    await page.evaluate(`document.getElementById('closeNodeInspectorButton')?.click()`);
    await page.waitForTimeout(400);
    await page.evaluate(`(() => { const s=document.getElementById('pane-scroll'); if(s) s.scrollTop=0; window.scrollTo(0,0); })()`);
    await page.waitForTimeout(300);
    const log = [];
    const before = await page.evaluate(`(() => { const f=document.getElementById('diagramFontFamily'); const r=f.getBoundingClientRect();
      return { top: Math.round(r.top), onscreen: r.top>=0 && r.bottom<=window.innerHeight }; })()`);
    log.push({ step:'at rest', result:'diagramFontFamily top='+before.top+' onscreen='+before.onscreen });

    await realClick(page, '#previewInspectButton', log, 'click ⚙ Inspect');
    const styleItem = await findByText(page, 'Style .*fonts');
    if (styleItem) { await page.mouse.click(styleItem.x, styleItem.y); await page.waitForTimeout(1200);
      log.push({ step:'click "'+styleItem.text+'"', result:'clicked' }); }
    else log.push({ step:'find Style menu row', result:'NOT FOUND' });

    const mid = await page.evaluate(`(() => { const f=document.getElementById('diagramFontFamily'); const r=f.getBoundingClientRect();
      let d=f.closest('details'); const open=[]; while(d){open.push(d.open); d=d.parentElement?d.parentElement.closest('details'):null;}
      return { top:Math.round(r.top), onscreen: r.top>=0&&r.bottom<=window.innerHeight, foldsOpen: open }; })()`);
    log.push({ step:'after Style', result:'diagramFontFamily top='+mid.top+' onscreen='+mid.onscreen+' foldsOpen='+JSON.stringify(mid.foldsOpen) });

    if (!mid.onscreen) {
      const fontFold = await findByText(page, '^Fonts');
      if (fontFold && fontFold.onscreen) { await page.mouse.click(fontFold.x, fontFold.y); await page.waitForTimeout(800);
        log.push({ step:'click the "Fonts" fold', result:'clicked' }); }
      else if (fontFold) { log.push({ step:'"Fonts" fold', result:'exists but OFFSCREEN - needs a scroll first' });
        await page.evaluate(`document.getElementById('diagramFontFamily').scrollIntoView({block:'center'})`);
        await page.waitForTimeout(500);
        const ff2 = await findByText(page, '^Fonts');
        if (ff2 && ff2.onscreen) { await page.mouse.click(ff2.x, ff2.y); await page.waitForTimeout(700); log.push({ step:'scroll, then click "Fonts"', result:'clicked' }); }
      } else log.push({ step:'"Fonts" fold', result:'NOT FOUND' });
    }
    const after = await page.evaluate(`(() => { const f=document.getElementById('diagramFontFamily'); const r=f.getBoundingClientRect();
      return { top:Math.round(r.top), onscreen: r.top>=0&&r.bottom<=window.innerHeight, opts:f.options.length }; })()`);
    log.push({ step:'final', result:'diagramFontFamily top='+after.top+' onscreen='+after.onscreen+' opts='+after.opts });
    const scrolls = log.filter(l=>/scroll/i.test(l.step)).length;
    out.goalFont = { clicks: log.filter(l=>/^click/i.test(l.step)).length, scrolls, log, reachable: after.onscreen };
    await page.screenshot({ path:'C:/Claude/SIREN/qa_exports/shot_font_route_end.png' });
  }

  // ===== GOAL 3: the class-diagram Shape promise =====
  {
    await setSource(page, CLASSD, 3200);
    await page.evaluate(KILL_TOUR);
    const first = await page.evaluate(`document.getElementById('source').value.split(String.fromCharCode(10))[0]`);
    const rec = { fixture: first };
    if (/classDiagram/.test(first)) {
      rec.opened = await page.evaluate(`(async () => {
        const n=document.querySelector('#diagram svg g.node')||document.querySelector('#diagram svg .node');
        if(!n) return 'no node';
        const r=n.getBoundingClientRect();
        ['mousedown','mouseup','click'].forEach(t=>n.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2})));
        await new Promise(x=>setTimeout(x,700));
        const i=document.getElementById('nodeInspector');
        return i&&!i.hasAttribute('hidden') ? 'open' : 'hidden';
      })()`);
      rec.shapeOptions = await page.evaluate(`(() => { const s=document.getElementById('inspectorShape');
        return s ? Array.from(s.options).map(o=>o.value) : null; })()`);
      const srcBefore = await page.evaluate(`document.getElementById('source').value`);
      rec.applied = await page.evaluate(`(async () => {
        const s=document.getElementById('inspectorShape'); if(!s) return 'no select';
        s.value='cylinder'; s.dispatchEvent(new Event('change',{bubbles:true}));
        await new Promise(x=>setTimeout(x,1600));
        return 'set to cylinder';
      })()`);
      const srcAfter = await page.evaluate(`document.getElementById('source').value`);
      rec.sourceChanged = srcBefore !== srcAfter;
      rec.srcAfterFirst2 = srcAfter.split(NL).slice(0,4);
      rec.renderError = await page.evaluate(`(() => { const e=document.querySelector('#diagram .error, #diagram .mermaid-error, .render-error');
        return e ? e.textContent.replace(/[ ]+/g,' ').trim().slice(0,140) : null; })()`);
      rec.stillRenders = await page.evaluate(`!!document.querySelector('#diagram svg')`);
    }
    out.classShapePromise = rec;
  }

  out.errors = errors.slice(0,12);
  fs.writeFileSync(OUT, JSON.stringify(out,null,1));
  console.log('WROTE', OUT);
  console.log('GOAL fill  clicks=', out.goalFill.clicks, out.goalFill.note);
  console.log('GOAL font  clicks=', out.goalFont.clicks, 'reachable=', out.goalFont.reachable);
  out.goalFont.log.forEach(l=>console.log('   -', l.step, '=>', l.result));
  console.log('CLASS shape promise:', JSON.stringify(out.classShapePromise).slice(0,600));
  await close();
})().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });
