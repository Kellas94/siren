/* Probe 2 - the Escape half. Same script on both builds.
 * (1) reproduce the headline label defect, (2) stacked Escape layers,
 * (3) whether anything typed is silently lost on the surfaces Escape now reaches.
 */
const L = require('C:/Claude/SIREN/qa_exports/sk14_lib.js');

const BUILD = process.argv[2];
const PORT = Number(process.argv[3]);
const FILE = process.argv[4];

const NODE_BOX = `(() => {
  const g = Array.from(document.querySelectorAll('#diagram svg g.node'));
  const out = g.map(n => {
    const r = n.getBoundingClientRect();
    return { id: n.id || '', label: (n.textContent||'').trim().slice(0,24), x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height };
  }).filter(n => n.w > 4 && n.h > 4);
  return JSON.stringify(out);
})()`;

const STATE = `(() => {
  const q = id => document.getElementById(id);
  const vis = e => { if (!e || e.hidden) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  return JSON.stringify({
    tour: !!document.querySelector('.tour-card'),
    palette: vis(q('commandPalette')),
    nodeInspector: vis(q('nodeInspector')),
    themeMenu: vis(q('themeMenu')),
    findPanel: vis(q('findReplacePanel')),
    zoomPopover: vis(q('zoomPopover')),
    dialogOpen: !!document.querySelector('dialog[open]'),
    src: q('source') ? q('source').value.length : -1,
    label: q('inspectorBlockLabel') ? q('inspectorBlockLabel').value : null,
    comment: q('nodeCommentText') ? q('nodeCommentText').value : null,
    commentCount: q('nodeCommentList') ? q('nodeCommentList').children.length : -1,
    owner: q('metadataOwner') ? q('metadataOwner').value : null,
    active: document.activeElement ? document.activeElement.tagName + '#' + (document.activeElement.id||'') : 'none'
  });
})()`;

const OPEN_DETAILS = `(() => {
  document.querySelectorAll('#nodeInspector details').forEach(d => { d.open = true; });
  return document.querySelectorAll('#nodeInspector details').length;
})()`;

async function readState(page) { return JSON.parse(await page.evaluate(STATE)); }

async function clickById(page, id) {
  const box = JSON.parse(await page.evaluate(`(() => {
    const e = document.getElementById(${JSON.stringify(id)});
    if (!e) return JSON.stringify(null);
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return JSON.stringify(null);
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2 });
  })()`));
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(200);
  return true;
}

async function openInspectorOn(page, wanted) {
  const nodes = JSON.parse(await page.evaluate(NODE_BOX));
  const n = wanted ? nodes.find(x => x.label.includes(wanted)) : nodes[0];
  if (!n) return null;
  await page.mouse.click(n.x, n.y);
  await page.waitForTimeout(500);
  return n;
}

const out = { build: BUILD, s: {} };
async function step(name, browser, port, file, fn) {
  const { page, ctx, errors } = await L.freshPage(browser, port, file);
  try {
    await L.waitTour(page);
    out.s[name] = await fn(page);
    out.s[name].errors = errors.slice();
  } catch (e) {
    out.s[name] = { crashed: String(e.message).slice(0, 200), errors: errors.slice() };
  }
  await ctx.close();
}

(async () => {
  const server = L.serve(BUILD, PORT);
  const browser = await L.launch();

  // ===== E1: headline. Type over the block label, press Escape, then click block B. =====
  await step('E1_labelEscape', browser, PORT, FILE, async (page) => {
    const nodes = JSON.parse(await page.evaluate(NODE_BOX));
    const a = nodes.find(n => /State/.test(n.label)) || nodes[0];
    const b = nodes.find(n => /Ministry of Finance/.test(n.label)) || nodes[1];
    await page.mouse.click(a.x, a.y);
    await page.waitForTimeout(600);
    const opened = await readState(page);
    const before = await L.readSource(page);
    await clickById(page, 'inspectorBlockLabel');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('ZZZTEST', { delay: 30 });
    const typed = await readState(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const afterEsc = await readState(page);
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(700);
    const afterClick = await readState(page);
    const after = await L.readSource(page);
    return {
      inspectorOpened: opened.nodeInspector, srcBefore: before.len, srcAfter: after.len,
      containsZZZ: after.value ? after.value.includes('ZZZTEST') : null,
      typedLabel: typed.label, typedFocus: typed.active,
      escLabel: afterEsc.label, escFocus: afterEsc.active, escTour: afterEsc.tour, escInspector: afterEsc.nodeInspector,
      clickLabel: afterClick.label
    };
  });

  // ===== E2: SIDEWAYS. A comment typed in the inspector, then Escape. =====
  await step('E2_commentEscape', browser, PORT, FILE, async (page) => {
    const n = await openInspectorOn(page, 'State');
    const opened = await readState(page);
    await page.evaluate(OPEN_DETAILS);
    await page.waitForTimeout(250);
    const clicked = await clickById(page, 'nodeCommentText');
    if (!clicked) return { opened: opened.nodeInspector, note: 'comment field not clickable' };
    await page.keyboard.type('REVIEW THIS BLOCK PLEASE', { delay: 12 });
    const typed = await readState(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    const afterEsc = await readState(page);
    await page.mouse.click(n.x, n.y);
    await page.waitForTimeout(600);
    await page.evaluate(OPEN_DETAILS);
    const reopened = await readState(page);
    return {
      opened: opened.nodeInspector, typedComment: typed.comment, typedFocus: typed.active,
      escComment: afterEsc.comment, escInspector: afterEsc.nodeInspector, escTour: afterEsc.tour, escFocus: afterEsc.active,
      reopenedComment: reopened.comment, reopenedCount: reopened.commentCount
    };
  });

  // ===== E3: SIDEWAYS. Metadata Owner typed, then Escape. =====
  await step('E3_metadataEscape', browser, PORT, FILE, async (page) => {
    const n = await openInspectorOn(page, 'State');
    await page.evaluate(OPEN_DETAILS);
    await page.waitForTimeout(250);
    const clicked = await clickById(page, 'metadataOwner');
    if (!clicked) return { note: 'owner field not clickable' };
    await page.keyboard.type('T. Sincariuc', { delay: 15 });
    const typed = await readState(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    const afterEsc = await readState(page);
    await page.mouse.click(n.x, n.y);
    await page.waitForTimeout(600);
    await page.evaluate(OPEN_DETAILS);
    const reopened = await readState(page);
    return {
      typedOwner: typed.owner, escOwner: afterEsc.owner, escInspector: afterEsc.nodeInspector,
      escTour: afterEsc.tour, reopenedOwner: reopened.owner
    };
  });

  // ===== E4: the ladder. How many Escapes until the tour dies, per surface stack. =====
  const LADDERS = [
    { name: 'nothing', setup: async () => {} },
    { name: 'nodeInspector', setup: async (page) => { await openInspectorOn(page, 'State'); } },
    { name: 'palette', setup: async (page) => { await page.keyboard.press('Control+k'); await page.waitForTimeout(400); } },
    { name: 'inspector+palette', setup: async (page) => { await openInspectorOn(page, 'State'); await page.keyboard.press('Control+k'); await page.waitForTimeout(450); } },
    { name: 'inspector+themeMenu', setup: async (page) => { await openInspectorOn(page, 'State'); await clickById(page, 'themeMenuButton'); await page.waitForTimeout(450); } },
    { name: 'inspector+findPanel', setup: async (page) => { await openInspectorOn(page, 'State'); await page.keyboard.press('Control+f'); await page.waitForTimeout(450); } },
    { name: 'insp+find+theme', setup: async (page) => { await openInspectorOn(page, 'State'); await page.keyboard.press('Control+f'); await page.waitForTimeout(350); await clickById(page, 'themeMenuButton'); await page.waitForTimeout(450); } },
    { name: 'insp+find+theme+palette', setup: async (page) => { await openInspectorOn(page, 'State'); await page.keyboard.press('Control+f'); await page.waitForTimeout(300); await clickById(page, 'themeMenuButton'); await page.waitForTimeout(300); await page.keyboard.press('Control+k'); await page.waitForTimeout(450); } },
    { name: 'zoomPopover', setup: async (page) => { await clickById(page, 'zoomMenuButton'); await page.waitForTimeout(450); } }
  ];
  out.s.E4_ladders = {};
  for (const lad of LADDERS) {
    const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE);
    let setupErr = null;
    try {
      await L.waitTour(page);
      await lad.setup(page);
    } catch (e) { setupErr = String(e.message).slice(0, 140); }
    const before = await readState(page);
    const trail = [];
    let died = -1;
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const st = await readState(page);
      trail.push({ p: i, tour: st.tour, pal: st.palette, insp: st.nodeInspector, thm: st.themeMenu, fnd: st.findPanel, zm: st.zoomPopover, act: st.active });
      if (!st.tour) { died = i; break; }
    }
    out.s.E4_ladders[lad.name] = {
      setupErr,
      before: { pal: before.palette, insp: before.nodeInspector, thm: before.themeMenu, fnd: before.findPanel, zm: before.zoomPopover, act: before.active },
      diedOnPress: died, trail, errors: errors.slice()
    };
    await ctx.close();
  }

  console.log('SK14_P2 ' + JSON.stringify(out));
  await browser.close();
  server.close();
})().catch(e => { console.error('FATAL', e); console.log('SK14_P2 ' + JSON.stringify(out)); process.exit(0); });
