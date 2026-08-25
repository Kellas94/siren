#!/usr/bin/env node
/* Three questions, measured:
 *  A) What is the ROUTE to a diagram-level style control today (clicks + scroll + pixels)?
 *  B) Per diagram type, how many of the style controls are actually RELEVANT / operable?
 *  C) For each candidate "unambiguous context", how many options does it genuinely carry?
 */
const { openApp, setSource, confirmDialog } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9863'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/reach_relevance.json');
const NL = String.fromCharCode(10);

const KILL_TOUR = `(async () => {
  for (let p = 0; p < 25; p++) {
    const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
    if (!b) { await new Promise(r=>setTimeout(r,150)); continue; }
    b.click(); await new Promise(r => setTimeout(r, 180));
  }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
  return 1;
})()`;

const SOURCES = {
  flowchart:      ['flowchart TD','  A[Purchase request] --> B{Approved}','  B -->|Yes| C[Raise order]'].join(NL),
  sequenceDiagram:['sequenceDiagram','  Alice->>Bob: Send the request','  Bob-->>Alice: Approve'].join(NL),
  pie:            ['pie title Spend','  "Audit" : 40','  "Tax" : 60'].join(NL),
  classDiagram:   ['classDiagram','  class Order','  Order : +id'].join(NL),
  mindmap:        ['mindmap','  root((Audit))','    Scope','    Testing'].join(NL),
  gantt:          ['gantt','  title Plan','  dateFormat YYYY-MM-DD','  section A','  Task :a1, 2026-01-01, 30d'].join(NL),
  erDiagram:      ['erDiagram','  CUSTOMER ||--o{ ORDER : places'].join(NL),
  journey:        ['journey','  title Day','  section Work','    Log in: 5: Me'].join(NL)
};

// Every diagram-level style control, with whether it is operable AND whether it changes anything.
const STYLE_IDS = ['diagramTitle','numberingStyle','direction','curve','themePreset','layoutDensity',
  'layoutNodeSpacing','layoutRankSpacing','layoutAlignment','layoutRouting','applyLayoutButton','resetLayoutButton',
  'diagramFontFamily','diagramFontSize','diagramFontWeight','nodeStyleTarget','nodeShape','nodeFillColor',
  'nodeBorderColor','nodeTextColor','nodeFontFamily','nodeFontSize','nodeFontWeight','applyNodeStyleButton',
  'resetNodeStyleButton','clearNodeStylesButton','legendEnabled','legendTitle','legendPosition',
  'diagramPaletteColour0','diagramPaletteColour1','diagramPaletteColour2','diagramPaletteColour3',
  'resetDiagramPaletteButton','applyDiagramPaletteButton','styleClassSelect','createStyleClassButton'];

const READ_STYLE = `(() => {
  const ids = ${JSON.stringify(STYLE_IDS)};
  return ids.map(id => {
    const c = document.getElementById(id);
    if (!c) return { id, absent:true };
    const r = c.getBoundingClientRect(); const cs = getComputedStyle(c);
    let d = c.closest('details'); const chain=[]; let folded=false;
    while (d) { const s=d.querySelector('summary'); chain.push(s?s.textContent.replace(/[ ]+/g,' ').trim().slice(0,30):(d.id||'')); if(!d.open) folded=true; d=d.parentElement?d.parentElement.closest('details'):null; }
    const wrap = c.closest('div,fieldset');
    return { id, disabled: !!c.disabled || c.getAttribute('aria-disabled')==='true',
      opacity: cs.opacity, hiddenNow: r.width<2||r.height<2,
      wrapHidden: wrap ? (wrap.hasAttribute('hidden')||getComputedStyle(wrap).display==='none') : null,
      folded, foldTop: chain[chain.length-1]||null, opts: c.tagName==='SELECT'?c.options.length:null };
  });
})()`;

(async () => {
  const out = { perType: {} };
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await page.evaluate(KILL_TOUR);
  await page.waitForTimeout(500);

  // ---------- A) ROUTE TO STYLE ----------
  await setSource(page, SOURCES.flowchart, 3000);
  await page.evaluate(KILL_TOUR);

  out.route = {};
  out.route.groupedAttr = await page.evaluate(`document.body.getAttribute('data-preview-grouped')`);
  out.route.inspectButton = await page.evaluate(`(() => {
    const b=document.getElementById('previewInspectButton'); if(!b) return {absent:true};
    const r=b.getBoundingClientRect();
    return { text:(b.textContent||'').replace(/[ ]+/g,' ').trim(), title:b.title||null,
      box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)] };
  })()`);
  // Open it and read the menu
  out.route.inspectMenu = await page.evaluate(`(async () => {
    const b=document.getElementById('previewInspectButton'); if(!b) return {absent:true};
    b.click(); await new Promise(x=>setTimeout(x,600));
    const menus = Array.from(document.querySelectorAll('[role="menu"],.menu,.popover,.dropdown'))
      .filter(m => m.getBoundingClientRect().height > 10);
    const m = menus[menus.length-1];
    if (!m) return { opened:false, note:'no visible menu after click' };
    const r = m.getBoundingClientRect();
    return { opened:true, box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
      items: Array.from(m.querySelectorAll('button,[role="menuitem"],a')).map(i => ({
        text:(i.textContent||'').replace(/[ ]+/g,' ').trim().slice(0,52),
        disabled: !!i.disabled || i.getAttribute('aria-disabled')==='true' })) };
  })()`);
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/shot_inspect_menu.png' });

  // Close menu, then find where diagramFontFamily lives and what it costs to reach
  await page.evaluate(`document.body.click()`); await page.waitForTimeout(400);
  out.route.fontReach = await page.evaluate(`(() => {
    const f = document.getElementById('diagramFontFamily');
    if (!f) return { absent:true };
    const r = f.getBoundingClientRect();
    const dia = document.getElementById('diagram');
    const dr = dia ? dia.getBoundingClientRect() : null;
    let sc = f.parentElement, scroller = null;
    while (sc && sc !== document.body) { if (sc.scrollHeight > sc.clientHeight + 20) { scroller = sc; break; } sc = sc.parentElement; }
    let d = f.closest('details'); const chain=[];
    while (d) { const s=d.querySelector('summary'); chain.push(s?s.textContent.replace(/[ ]+/g,' ').trim().slice(0,30):(d.id||'')); d=d.parentElement?d.parentElement.closest('details'):null; }
    return { box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
      inViewport: r.top>=0 && r.bottom<=window.innerHeight,
      diagramCentre: dr ? [Math.round(dr.left+dr.width/2),Math.round(dr.top+dr.height/2)] : null,
      folds: chain,
      scroller: scroller ? { id:scroller.id||scroller.className.toString().slice(0,40), scrollTop:Math.round(scroller.scrollTop), scrollH:scroller.scrollHeight, clientH:scroller.clientHeight } : null };
  })()`);

  // ---------- B) PER TYPE RELEVANCE ----------
  for (const [type, src] of Object.entries(SOURCES)) {
    await setSource(page, src, 2600);
    await page.evaluate(KILL_TOUR);
    const first = await page.evaluate(`document.getElementById('source').value.split(String.fromCharCode(10))[0]`);
    const rec = { firstLine: first };
    rec.style = await page.evaluate(READ_STYLE);
    rec.foldSummaries = await page.evaluate(`Array.from(document.querySelectorAll('details.style-fold')).map(d=>{
      const s=d.querySelector('summary'); const r=d.getBoundingClientRect();
      return { open:d.open, h:Math.round(r.height), text: s?s.textContent.replace(/[ ]+/g,' ').trim().slice(0,110):'' };
    })`);
    // the mode switch buttons (owner's Guided complaint)
    rec.modeButtons = await page.evaluate(`['visualModeButton','structureModeButton','codeModeButton','textModeButton'].map(id=>{
      const b=document.getElementById(id); if(!b) return {id,absent:true};
      const r=b.getBoundingClientRect(); const cs=getComputedStyle(b);
      return { id, text:(b.textContent||'').replace(/[ ]+/g,' ').trim(), slot:b.dataset.slot||null,
        ariaDisabled:b.getAttribute('aria-disabled'), disabled:!!b.disabled,
        unavailable:b.classList.contains('is-unavailable'), opacity:cs.opacity, pointerEvents:cs.pointerEvents,
        vis: r.width>2&&r.height>2, title:b.title||null };
    })`);
    // does a node click give an unambiguous context on this type?
    rec.nodeCtx = await page.evaluate(`(async () => {
      document.getElementById('closeNodeInspectorButton')?.click();
      document.getElementById('closeEdgeInspectorButton')?.click();
      await new Promise(x=>setTimeout(x,250));
      const svg=document.querySelector('#diagram svg'); if(!svg) return 'no svg';
      const n=svg.querySelector('g.node')||svg.querySelector('.node')||svg.querySelector('rect');
      if(!n) return 'no node element';
      const r=n.getBoundingClientRect();
      ['mousedown','mouseup','click'].forEach(t=>n.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2})));
      await new Promise(x=>setTimeout(x,600));
      const i=document.getElementById('nodeInspector');
      if(!i||i.hasAttribute('hidden')) return 'no inspector';
      const shown = Array.from(i.querySelectorAll('input,select,textarea,button')).filter(c=>{const b=c.getBoundingClientRect();return b.width>2&&b.height>2;}).length;
      const shapeOpts = document.getElementById('inspectorShape') ? document.getElementById('inspectorShape').options.length : null;
      return 'open ctrlsShown=' + shown + ' shapeOpts=' + shapeOpts + ' heading=' + (document.getElementById('nodeInspectorHeading')||{textContent:''}).textContent.trim().slice(0,30);
    })()`);
    out.perType[type] = rec;
    console.log(type, '|', first, '| node:', rec.nodeCtx);
  }

  out.errors = errors.slice(0,12);
  fs.writeFileSync(OUT, JSON.stringify(out,null,1));
  console.log('WROTE', OUT);
  await close();
})().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });
