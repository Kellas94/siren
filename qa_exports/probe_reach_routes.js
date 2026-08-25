/* REACH, walked. One route per verb, executed in the running app.
 *
 * A route is a list of pointer presses. The runner presses each one for real (mouse at the
 * element's own centre, so anything occluded fails rather than passing on a technicality),
 * counts the presses, counts how many of them open something that must then be READ - a menu,
 * a fold, a dialog - and counts how many required SCROLLING the panel first, which is not a
 * press but is still distance.
 *
 * Every route ends with an assertion that the target control is now genuinely clickable. A route
 * that "succeeds" without its target being reachable is a measurement of nothing.
 */
const { openApp } = require('./r7_lib.js');
const fs = require('fs');

const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9866);
const W = Number(process.argv[4] || 1440), H = Number(process.argv[5] || 900);
const DIR = 'C:/Claude/SIREN/qa_exports/reach';

// ---------------------------------------------------------------- helpers in the page
const FIND = `(spec) => {
  const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
  let e = null;
  if (spec.id) e = document.getElementById(spec.id);
  else {
    const scope = spec.scope ? document.querySelector(spec.scope) : document;
    if (!scope) return null;
    const cands = Array.from(scope.querySelectorAll(spec.sel || 'button, summary, [role=button], [role=menuitem], .struct-menu-item, select, input, label'));
    const rx = new RegExp(spec.text, 'i');
    e = cands.find(c => rx.test(clean(c.textContent)) || rx.test(clean(c.getAttribute('aria-label')))) || null;
  }
  if (!e) return null;
  const VW = innerWidth, VH = innerHeight;
  const r = e.getBoundingClientRect();
  const pts = [[r.left + r.width/2, r.top + r.height/2], [r.left + 6, r.top + r.height/2]];
  let hit = false;
  for (const [x, y] of pts) {
    if (x < 0 || x > VW || y < 0 || y > VH) continue;
    const top = document.elementFromPoint(x, y);
    if (top && (top === e || e.contains(top) || top.contains(e))) { hit = true; break; }
  }
  return { hit, x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height,
           label: clean(e.textContent).slice(0,50), disabled: !!(e.disabled || e.getAttribute('aria-disabled') === 'true'),
           inView: r.top >= 0 && r.bottom <= VH && r.left >= 0 && r.right <= VW };
}`;

const SCROLL_TO = `(spec) => {
  let e = spec.id ? document.getElementById(spec.id) : null;
  if (!e && spec.text) {
    const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
    const scope = spec.scope ? document.querySelector(spec.scope) : document;
    const rx = new RegExp(spec.text, 'i');
    e = Array.from((scope||document).querySelectorAll(spec.sel || 'button, summary, [role=button], [role=menuitem], .struct-menu-item, select, input, label'))
      .find(c => rx.test(clean(c.textContent)) || rx.test(clean(c.getAttribute('aria-label')))) || null;
  }
  if (!e) return false;
  e.scrollIntoView({ block: 'center' });
  return true;
}`;

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card'); if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click(); return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(170);
  }
}

// ---------------------------------------------------------------- the routes
// `read:true` marks a press that opens a surface whose contents must be scanned before the next
// press can be chosen. `freq` is the owner's stated working pattern, kept explicit so the
// frequency x reach crossing can be recomputed if he disagrees with any single label.
const R = (verb, freq, steps, target, note) => ({ verb, freq, steps, target, note: note || '' });

const ROUTES = [
  // ---- the complaint: style ----
  R('Style: change the diagram font', 'often',
    [{ by: { id: 'previewInspectButton' }, read: true },
     { by: { text: '^Style', scope: '.struct-menu', sel: '.struct-menu-item' }, read: true },
     { by: { text: '^Fonts', scope: '#styleFoldFonts', sel: 'summary' }, read: true }],
    { id: 'diagramFontFamily' }),

  R('Style: change spacing / connector curve', 'often',
    [{ by: { id: 'previewInspectButton' }, read: true },
     { by: { text: '^Style', scope: '.struct-menu', sel: '.struct-menu-item' }, read: true },
     { by: { text: 'Spacing & connectors', scope: '#settingsSection', sel: 'summary' }, read: true }],
    { id: 'curve' }),

  R('Style: turn the legend on', 'occasional',
    [{ by: { id: 'previewInspectButton' }, read: true },
     { by: { text: '^Style', scope: '.struct-menu', sel: '.struct-menu-item' }, read: true },
     { by: { text: '^Legend', scope: '#styleFoldLegend', sel: 'summary' }, read: true }],
    { id: 'legendEnabled' }),

  R('Style: create a reusable style class', 'often',
    [{ by: { id: 'previewInspectButton' }, read: true },
     { by: { text: '^Style', scope: '.struct-menu', sel: '.struct-menu-item' }, read: true },
     { by: { text: 'Reusable block styles', scope: '#styleFoldBlocks', sel: 'summary' }, read: true }],
    { id: 'styleClassSelect' }),

  R('Style: chart colours (pie / mindmap / git)', 'occasional',
    [{ by: { id: 'previewInspectButton' }, read: true },
     { by: { text: '^Style', scope: '.struct-menu', sel: '.struct-menu-item' }, read: true },
     { by: { text: 'Chart colours', scope: '#settingsSection', sel: 'summary' }, read: true }],
    { id: 'applyDiagramPaletteButton' }),

  R('Style: rename the diagram title in the Style card', 'occasional',
    [{ by: { id: 'previewInspectButton' }, read: true },
     { by: { text: '^Style', scope: '.struct-menu', sel: '.struct-menu-item' }, read: true }],
    { id: 'diagramTitle' }),

  R('Style: one block fill colour, via the preview', 'every session',
    [{ by: { id: 'nodeclick' }, read: true }],
    { id: 'inspectorFillColor' }, 'the block is clicked in the preview; id is resolved at run time'),

  R('Style: brand preset (house style) apply', 'occasional',
    [{ by: { id: 'previewInspectButton' }, read: true },
     { by: { text: '^Style', scope: '.struct-menu', sel: '.struct-menu-item' }, read: true },
     { by: { text: 'Reusable block styles', scope: '#styleFoldBlocks', sel: 'summary' }, read: true }],
    { id: 'brandPresetSelect' }),

  // ---- everyday verbs ----
  R('Change diagram type (new starter)', 'often',
    [{ by: { text: 'Diagram type, templates & tools', sel: 'summary' }, read: true }],
    { id: 'diagramTypeSelect' }),

  R('Apply a template', 'often',
    [{ by: { text: 'Diagram type, templates & tools', sel: 'summary' }, read: true }],
    { id: 'templateSelect' }),

  R('Find & replace', 'often',
    [{ by: { text: 'Diagram type, templates & tools', sel: 'summary' }, read: true }],
    { id: 'findReplaceButton' }),

  R('Analyse the diagram', 'often', [{ by: { text: 'Diagram type, templates & tools', sel: 'summary' }, read: true }],
    { id: 'analysisButton' }),

  R('Copy as Markdown', 'occasional', [{ by: { text: 'Diagram type, templates & tools', sel: 'summary' }, read: true }],
    { id: 'copyMarkdownButton' }),

  R('Switch to Mermaid code', 'every session', [], { id: 'codeModeButton' }),
  R('Switch to the visual builder', 'every session', [], { id: 'visualModeButton' }),

  R('Guided (structure) editor', 'often',
    [{ by: { id: 'codeModeButton' }, read: true }], { id: 'structureModeButton' }),

  R('Export…', 'every session', [], { id: 'exportButton' }),
  R('Export as PNG (reach the button)', 'every session',
    [{ by: { id: 'exportButton' }, read: true }], { id: 'exportPngButton' }),
  R('Export to PowerPoint', 'often', [{ by: { id: 'exportButton' }, read: true }], { id: 'exportPptxButton' }),
  R('Export a Word document', 'often', [{ by: { id: 'exportButton' }, read: true },
     { by: { text: '^Data', scope: '#exportDataGroup', sel: 'summary' }, read: true }], { id: 'exportDocsWordButton' }),

  R('Copy share link', 'occasional',
    [{ by: { id: 'exportButton' }, read: true },
     { by: { text: 'Workspace', scope: '#exportDialog', sel: '.export-group > summary' }, read: true }], { id: 'copyShareLinkButton' }),

  R('Save the project file (.siren)', 'every session',
    [{ by: { id: 'exportButton' }, read: true },
     { by: { text: 'Workspace', scope: '#exportDialog', sel: '.export-group > summary' }, read: true }], { id: 'exportProjectButton' }),

  R('Import a project', 'occasional',
    [{ by: { id: 'headerMoreButton' }, read: true }], { id: 'importButton' }),

  R('Open the guide', 'rare', [{ by: { id: 'headerMoreButton' }, read: true }], { id: 'guideButton' }),

  R('Restore points', 'occasional', [{ by: { id: 'headerMoreButton' }, read: true }], { id: 'versionsButton' }),

  R('Change the theme', 'often', [{ by: { id: 'themeMenuButton' }, read: true }], { id: 'themeMenuMoreButton' }),

  R('Filters and lanes', 'often', [], { id: 'filterButton' }),
  R('Zoom: fit page', 'every session', [{ by: { id: 'zoomMenuButton' }, read: true }], { id: 'fitPageButton' }),
  R('Present', 'often', [], { id: 'presentButton' }),
  R('Add a diagram', 'often', [], { id: 'addDiagramButton' }),
  R('Rename this diagram', 'often', [{ by: { id: 'diagramMoreButton' }, read: true }], { text: 'Rename', scope: '.struct-menu', sel: '.struct-menu-item' }),
  R('Duplicate this diagram', 'occasional', [{ by: { id: 'diagramMoreButton' }, read: true }], { text: 'Duplicate', scope: '.struct-menu', sel: '.struct-menu-item' }),
  R('Compare diagrams', 'occasional',
    [{ by: { id: 'diagramMoreButton' }, read: true },
     { by: { text: 'Compare with another', scope: '.struct-menu', sel: '.struct-menu-item' }, read: true }], { id: 'compareDialog' }),

  // The other way in to Style: no menu, just scroll the left column until the card appears.
  R('Style card, by scrolling the panel instead', 'often', [], { id: 'settingsSection' }),
  R('Documents / workpapers', 'often', [], { id: 'workpapersButton' }),
  R('Review status / sign-off', 'often',
    [{ by: { id: 'previewInspectButton' }, read: true },
     { by: { text: 'Review status', scope: '.struct-menu', sel: '.struct-menu-item' }, read: true }], { id: 'reviewDialog' }),
  R('Comments on the diagram', 'often',
    [{ by: { id: 'previewInspectButton' }, read: true },
     { by: { text: '^Comments', scope: '.struct-menu', sel: '.struct-menu-item' }, read: true }], { id: 'commentsDialog' }),
  R('Flow direction: vertical / horizontal', 'often',
    [{ by: { id: 'previewViewButton' }, read: true }], { id: 'previewViewButton' }),
  R('Undo', 'every session', [], { id: 'undoButton' }),
  R('Undo history', 'occasional', [], { id: 'undoHistoryButton' }),
  R('Add a block (visual builder)', 'every session', [], { id: 'addVisualNodeButton' }),
  R('Edit a block in the builder', 'every session',
    [{ by: { text: '^Edit a block', scope: '.visual-builder', sel: '.visual-section-title' }, read: true }], { id: 'visualNodeSelect' }),
  R('Add a connector in the builder', 'every session',
    [{ by: { text: '^Add a connector', scope: '.visual-builder', sel: '.visual-section-title' }, read: true }], { id: 'visualEdgeFrom' }),
  R('Layout / flow direction in the builder', 'often',
    [{ by: { text: '^Layout', scope: '.visual-builder', sel: '.visual-section-title' }, read: true }], { id: 'visualDirection' }),
  R('Group blocks (lanes)', 'occasional',
    [{ by: { text: '^Group blocks', scope: '.visual-builder', sel: '.visual-section-title' }, read: true }], { id: 'visualGroupName' }),
];

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  let ctx = await openApp(APP, PORT, { width: W, height: H });
  let page = ctx.page;
  await killTour(page);
  await page.waitForTimeout(500);


  const out = [];
  for (const route of ROUTES) {
    // Fresh app for every route. Slower, but a route measured on top of another route's leftovers
    // is a fiction.
    await ctx.close();
    ctx = await openApp(APP, PORT, { width: W, height: H });
    page = ctx.page;
    await killTour(page);
    await page.waitForTimeout(450);

    // Regenerated per session, so it has to be read AFTER this route's reload, not before.
    const nodeId = await page.evaluate(`(() => {
      const n = document.querySelector('#diagram svg .node, #diagram svg g.node');
      return n ? (n.id || '') : '';
    })()`);

    let presses = 0, reads = 0, scrolls = 0, failed = null;
    const trail = [];
    for (const step of route.steps) {
      const spec = (step.by.id === 'nodeclick') ? { id: nodeId } : step.by;
      let info = await page.evaluate('(' + FIND + ')(' + JSON.stringify(spec) + ')');
      if (!info) { failed = 'step target not in DOM: ' + JSON.stringify(spec); break; }
      if (!info.hit) {
        await page.evaluate('(' + SCROLL_TO + ')(' + JSON.stringify(spec) + ')');
        await page.waitForTimeout(320);
        scrolls++;
        info = await page.evaluate('(' + FIND + ')(' + JSON.stringify(spec) + ')');
        if (!info || !info.hit) { failed = 'step still not clickable after scrolling: ' + JSON.stringify(spec); break; }
      }
      await page.mouse.click(info.x, info.y);
      presses++;
      if (step.read) reads++;
      trail.push(info.label || JSON.stringify(spec));
      await page.waitForTimeout(600);
    }

    let end = null;
    if (!failed) {
      end = await page.evaluate('(' + FIND + ')(' + JSON.stringify(route.target) + ')');
      if (!end) failed = 'target not in DOM';
      else if (!end.hit) {
        await page.evaluate('(' + SCROLL_TO + ')(' + JSON.stringify(route.target) + ')');
        await page.waitForTimeout(320);
        const again = await page.evaluate('(' + FIND + ')(' + JSON.stringify(route.target) + ')');
        if (again && again.hit) { scrolls++; end = again; }
        else failed = 'target never became clickable';
      }
    }
    // The final press on the target itself is the act the person came to do.
    const reach = presses + 1;
    out.push({ verb: route.verb, freq: route.freq, presses: route.steps.length, reach, reads, scrolls,
               ok: !failed, failed, trail, targetDisabled: end ? end.disabled : null, note: route.note });
    console.log(
      (failed ? 'XX ' : 'ok ') +
      'reach=' + reach + ' reads=' + reads + ' scroll=' + scrolls +
      ' | ' + route.freq.padEnd(13) + ' | ' + route.verb +
      (failed ? '   << ' + failed : '') +
      (end && end.disabled ? '   [target DISABLED]' : ''));
  }

  fs.writeFileSync(DIR + '/routes_' + W + '.json', JSON.stringify({ w: W, h: H, out }, null, 1));
  console.log('');
  const ok = out.filter(r => r.ok);
  const every = ok.filter(r => r.freq === 'every session');
  const often = ok.filter(r => r.freq === 'often');
  console.log('routes measured: ' + out.length + '  (walked to a clickable target: ' + ok.length + ')');
  console.log('every-session verbs at reach >= 3: ' + every.filter(r => r.reach >= 3).length + ' of ' + every.length);
  console.log('often verbs at reach >= 3        : ' + often.filter(r => r.reach >= 3).length + ' of ' + often.length);
  console.log('median reach, every-session: ' + (every.map(r => r.reach).sort((a,b)=>a-b)[Math.floor(every.length/2)]));
  await ctx.close();
})();
