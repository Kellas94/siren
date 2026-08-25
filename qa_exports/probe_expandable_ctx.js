#!/usr/bin/env node
/* Measures the CONTEXTS in SIREN where an in-place expandable control could be correct:
 *   - how many options each context genuinely has
 *   - how far / how many clicks the same options cost today
 *   - whether the context is unambiguous (app knows exactly what is selected)
 * Also records the Style panel's real option count and which controls are inert per diagram type.
 */
const { openApp, setSource, confirmDialog } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9861'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/expandable_ctx.json');
const NL = String.fromCharCode(10);

const FLOW = ['flowchart TD',
  '  A[Purchase request] --> B{Approved}',
  '  B -->|Yes| C[Raise order]',
  '  B -->|No| D[Reject]'].join(NL);

// Count every operable control inside a container, with its label, and whether it is reachable now.
const CENSUS = `(root) => {
  const el = document.querySelector(root);
  if (!el) return { missing: true };
  const ctrls = Array.from(el.querySelectorAll('input,select,textarea,button'));
  const rows = ctrls.map(c => {
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    let lab = '';
    if (c.id) { const l = document.querySelector('label[for="' + c.id + '"]'); if (l) lab = l.textContent.trim(); }
    if (!lab) lab = (c.getAttribute('aria-label') || c.textContent || c.placeholder || c.id || '').trim();
    // is it inside a collapsed <details>?
    let d = c.closest('details'); let folded = false; const chain = [];
    while (d) { chain.push((d.querySelector('summary')||{}).textContent ? d.querySelector('summary').textContent.trim() : (d.id||'')); if (!d.open) folded = true; d = d.parentElement ? d.parentElement.closest('details') : null; }
    return {
      id: c.id || null, tag: c.tagName.toLowerCase(), label: lab.slice(0, 48),
      opts: c.tagName === 'SELECT' ? c.options.length : null,
      disabled: !!c.disabled || c.getAttribute('aria-disabled') === 'true',
      hiddenNow: r.width === 0 && r.height === 0,
      folded, foldChain: chain,
      box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]
    };
  });
  const rr = el.getBoundingClientRect();
  return { count: rows.length, hidden: el.hasAttribute('hidden'), box: [Math.round(rr.left), Math.round(rr.top), Math.round(rr.width), Math.round(rr.height)], rows };
}`;

(async () => {
  const out = {};
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });

  // ---------- FIXTURE ASSERT ----------
  await setSource(page, FLOW, 3200);
  out.fixture = await page.evaluate(`document.getElementById('source').value.split(String.fromCharCode(10))[0]`);
  console.log('FIXTURE first line:', out.fixture);
  if (!/flowchart/.test(out.fixture)) { console.log('ABORT: fixture not a flowchart'); await close(); process.exit(2); }

  // ---------- 1. Where does Style live and what does it cost? ----------
  out.styleShortcut = await page.evaluate(`(() => {
    const b = document.getElementById('styleShortcutButton');
    if (!b) return { absent: true };
    const r = b.getBoundingClientRect();
    return { label:(b.textContent||'').trim(), title:b.title||null,
      visible: r.width>0 && r.height>0, box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)] };
  })()`);

  // Census of the whole style/settings sidebar BEFORE opening anything
  out.styleSidebarClosed = await page.evaluate(CENSUS, '#sidebar, .sidebar, aside');

  // Click Style and re-census
  const styleClick = await page.evaluate(`(() => {
    const b = document.getElementById('styleShortcutButton');
    if (!b) return 'absent';
    b.click(); return 'clicked';
  })()`);
  await page.waitForTimeout(900);
  out.styleClick = styleClick;

  // What is now on screen, and what remains folded
  out.afterStyleClick = await page.evaluate(`(() => {
    const folds = Array.from(document.querySelectorAll('details.style-fold')).map(d => ({
      id: d.id||null, summary: (d.querySelector('summary')||{textContent:''}).textContent.trim().slice(0,60),
      open: d.open, visible: d.getBoundingClientRect().height > 0,
      ctrls: d.querySelectorAll('input,select,textarea,button').length
    }));
    const scrolled = (() => {
      const b = document.getElementById('styleShortcutButton'); return b ? Math.round(b.getBoundingClientRect().top) : null;
    })();
    return { folds, styleBtnTop: scrolled, scrollY: Math.round(window.scrollY) };
  })()`);

  // Full census of every style control in the app (the panel that Style scrolls to)
  out.styleControls = await page.evaluate(`(() => {
    const ids = ['diagramTitle','direction','curve','themePreset','autoRender','layoutDensity','layoutNodeSpacing',
      'layoutRankSpacing','layoutAlignment','layoutRouting','applyLayoutButton','resetLayoutButton','diagramFontFamily',
      'diagramFontSize','diagramFontWeight','nodeStyleTarget','nodeFillColor','nodeBorderColor','nodeTextColor',
      'nodeShape','nodeFontFamily','nodeFontSize','nodeFontWeight','applyNodeStyleButton','resetNodeStyleButton',
      'clearNodeStylesButton','legendEnabled','legendTitle','legendPosition','legendItems'];
    return ids.map(id => {
      const c = document.getElementById(id);
      if (!c) return { id, absent: true };
      const r = c.getBoundingClientRect(); const cs = getComputedStyle(c);
      let d = c.closest('details'); let folded=false; const chain=[];
      while (d) { const s=d.querySelector('summary'); chain.push(s?s.textContent.trim().slice(0,30):(d.id||'')); if(!d.open) folded=true; d=d.parentElement?d.parentElement.closest('details'):null; }
      return { id, tag:c.tagName.toLowerCase(), opts: c.tagName==='SELECT'?c.options.length:null,
        disabled: !!c.disabled, hiddenNow: r.width===0&&r.height===0, opacity: cs.opacity,
        folded, foldChain: chain, top: Math.round(r.top+window.scrollY) };
    });
  })()`);

  // ---------- 2. NODE inspector: unambiguous context, count the options ----------
  // Click a real node in the SVG
  const nodeClick = await page.evaluate(`(async () => {
    const svg = document.querySelector('#diagram svg');
    if (!svg) return 'no svg';
    const n = svg.querySelector('g.node') || svg.querySelector('.node');
    if (!n) return 'no node';
    const r = n.getBoundingClientRect();
    const ev = (t) => n.dispatchEvent(new MouseEvent(t, { bubbles:true, clientX:r.left+r.width/2, clientY:r.top+r.height/2 }));
    ev('mousedown'); ev('mouseup'); ev('click');
    await new Promise(r2=>setTimeout(r2,600));
    const insp = document.getElementById('nodeInspector');
    return insp ? (insp.hasAttribute('hidden') ? 'inspector still hidden' : 'inspector open') : 'no inspector';
  })()`);
  await page.waitForTimeout(600);
  out.nodeClick = nodeClick;
  out.nodeInspector = await page.evaluate(CENSUS, '#nodeInspector');

  // ---------- 3. EDGE inspector ----------
  const edgeClick = await page.evaluate(`(async () => {
    document.getElementById('closeNodeInspectorButton')?.click();
    await new Promise(r=>setTimeout(r,300));
    const svg = document.querySelector('#diagram svg');
    const e = svg && (svg.querySelector('path.flowchart-link') || svg.querySelector('g.edgePaths path') || svg.querySelector('.edgePath path'));
    if (!e) return 'no edge found';
    const r = e.getBoundingClientRect();
    const ev = (t) => e.dispatchEvent(new MouseEvent(t, { bubbles:true, clientX:r.left+r.width/2, clientY:r.top+r.height/2 }));
    ev('mousedown'); ev('mouseup'); ev('click');
    await new Promise(r2=>setTimeout(r2,600));
    const insp = document.getElementById('edgeInspector');
    return insp ? (insp.hasAttribute('hidden') ? 'edge inspector still hidden' : 'edge inspector open') : 'no edge inspector';
  })()`);
  await page.waitForTimeout(600);
  out.edgeClick = edgeClick;
  out.edgeInspector = await page.evaluate(CENSUS, '#edgeInspector');

  // ---------- 4. Toolbar census: what IS visible at rest ----------
  out.visibleChrome = await page.evaluate(`(() => {
    const seen = [];
    document.querySelectorAll('button,select,input').forEach(c => {
      const r = c.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      if (r.top < 0 || r.top > window.innerHeight) return;
      const cs = getComputedStyle(c);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) return;
      if (c.closest('[hidden]')) return;
      seen.push({ id: c.id||null, tag:c.tagName.toLowerCase(),
        text:(c.textContent||c.getAttribute('aria-label')||c.id||'').replace(/[\\s]+/g,' ').trim().slice(0,34),
        top: Math.round(r.top), left: Math.round(r.left) });
    });
    return { count: seen.length, items: seen };
  })()`);

  out.errors = errors.slice(0, 10);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('WROTE', OUT);
  console.log('style shortcut:', JSON.stringify(out.styleShortcut));
  console.log('node inspector ctrls:', out.nodeInspector.count, 'hidden=', out.nodeInspector.hidden);
  console.log('edge inspector ctrls:', out.edgeInspector.count, 'hidden=', out.edgeInspector.hidden);
  console.log('visible chrome controls in viewport:', out.visibleChrome.count);
  await close();
})().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });
