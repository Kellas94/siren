#!/usr/bin/env node
/* Which of the "cheap, when we are passing" items are still real?
 *
 * That section of the list has not been re-read in a while, and the last time a stale section was
 * handed to an engineer a third of the round would have been spent on things already fixed. So each
 * item gets driven rather than assumed:
 *
 *   1. the window title says nothing about the diagram   (claimed fixed in 1.67.0)
 *   2. the tab icon is the wrong mark
 *   3. the zoom button says one thing and does another   (claimed fixed in 1.67.0)
 *   4. the welcome tour follows you into Docs and points at nothing
 *
 * Usage: node probe_cheap_items.js [--app <path>] [--port 9930]
 */
const { openApp, setSource, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/slot/app.html');
const PORT = Number(arg('port', '9930'));

const NL = String.fromCharCode(10);

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1500, height: 950 });

  // ---- 1 & 2: what the window and the tab say -------------------------------------------
  await setSource(page, ['flowchart TD', '  A[Purchase request] --> B[Approve]'].join(NL), 3800);
  const before = await page.title();
  await page.evaluate(`(() => { const t = document.getElementById('diagramTitle');
    t.value = 'Q3 approvals walk'; t.dispatchEvent(new Event('input', { bubbles: true }));
    t.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await page.waitForTimeout(1400);
  const after = await page.title();

  check('title.namesTheDiagram', after.indexOf('Q3 approvals walk') >= 0,
    'the window title carries the diagram name',
    `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);

  const icon = await page.evaluate(`(() => {
    const l = document.querySelector('link[rel*="icon"]');
    return JSON.stringify({ present: !!l, href: l ? String(l.href).slice(0, 46) : null,
      type: l ? l.type : null });
  })()`);
  const ic = JSON.parse(icon);
  check('icon.present', ic.present, 'the page declares a favicon', JSON.stringify(ic));

  // ---- 3: the zoom control ---------------------------------------------------------------
  const zoom = JSON.parse(await page.evaluate(`(() => {
    const chip = document.getElementById('zoomChipButton');
    return JSON.stringify({ label: chip ? chip.textContent.replace(/\\s+/g, ' ').trim() : null,
      title: chip ? chip.title : null });
  })()`));
  console.log(`\n  zoom chip: ${JSON.stringify(zoom.label)}  title=${JSON.stringify(zoom.title)}`);
  // Does it actually fit the whole diagram, or only its width? Compare the rendered box after.
  const fit = JSON.parse(await page.evaluate(`(async () => {
    const svg = document.querySelector('#diagram svg');
    const port = document.getElementById('zoomViewport');
    const before = svg.getBoundingClientRect();
    document.getElementById('zoomChipButton').click();
    await new Promise(r => setTimeout(r, 1200));
    const after = svg.getBoundingClientRect();
    const pr = port ? port.getBoundingClientRect() : null;
    return JSON.stringify({
      fitsWidth: !!(pr && after.width <= pr.width + 4),
      fitsHeight: !!(pr && after.height <= pr.height + 4),
      before: [Math.round(before.width), Math.round(before.height)],
      after: [Math.round(after.width), Math.round(after.height)],
      port: pr ? [Math.round(pr.width), Math.round(pr.height)] : null
    });
  })()`));
  check('zoom.fitsTheWholeDiagram', fit.fitsWidth && fit.fitsHeight,
    'pressing it fits the whole diagram, not only its width',
    `svg ${fit.after.join('x')} into viewport ${(fit.port || []).join('x')} — width ok ${fit.fitsWidth}, height ok ${fit.fitsHeight}`);

  // ---- 4: does the tour follow you into Docs? --------------------------------------------
  const tour = JSON.parse(await page.evaluate(`(async () => {
    const start = document.getElementById('startTourButton');
    if (!start) return JSON.stringify({ noTour: true });
    start.click();
    await new Promise(r => setTimeout(r, 1200));
    const card1 = document.querySelector('.tour-card');
    const step1 = card1 ? card1.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40) : null;
    // now walk into Docs while the tour is open
    document.getElementById('workpapersButton').click();
    await new Promise(r => setTimeout(r, 1400));
    const card2 = document.querySelector('.tour-card');
    const r = card2 ? card2.getBoundingClientRect() : null;
    const docsOpen = !document.getElementById('wpWorkspace').hidden;
    // is whatever it points at actually on screen?
    const target = document.querySelector('.tour-highlight, [data-tour-active]');
    const tr = target ? target.getBoundingClientRect() : null;
    return JSON.stringify({
      step1, docsOpen,
      cardStillUp: !!(r && r.width > 20 && r.height > 20),
      cardText: card2 ? card2.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60) : null,
      pointsAtSomethingVisible: !!(tr && tr.width > 4 && tr.height > 4)
    });
  })()`));
  console.log(`  tour: ${JSON.stringify(tour)}\n`);

  if (!tour.noTour) {
    check('tour.doesNotFollowIntoDocs', !(tour.docsOpen && tour.cardStillUp && !tour.pointsAtSomethingVisible),
      'the tour does not stay up in Docs pointing at nothing',
      `docs open=${tour.docsOpen}, card up=${tour.cardStillUp}, points at something visible=${tour.pointsAtSomethingVisible}`);
  }

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await page.screenshot({ path: 'C:/Claude/SIREN/pending/slot/cheap_items.png' });
  await close();
  report('cheap items');
  process.exit(0);
})();
