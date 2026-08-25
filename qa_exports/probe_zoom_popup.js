#!/usr/bin/env node
/* How does the zoom popup actually behave?
 *
 * The owner reports two things about it: it is now hard to reach, and it "disappears after you click
 * something else, it is not dismissable". The first is my doing - the zoom chip was absorbed into a
 * View menu. The second needs measuring before it is fixed, because "disappears when you click away"
 * and "cannot be dismissed" are opposite complaints and the fix differs.
 *
 * So: what closes it? Escape, a close button, clicking outside, pressing the button again? And is
 * the current zoom level readable anywhere without opening anything?
 *
 * Usage: node probe_zoom_popup.js [--app <path>] [--port 9736]
 */
const { openApp, setSource, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9736'));

const OPEN_ZOOM = `(async () => {
  document.querySelector('.struct-menu')?.remove();
  document.getElementById('zoomMenuButton').click();
  await new Promise(r => setTimeout(r, 700));
  // It is #zoomPopover, not a .struct-menu. Looking for the wrong element reported "did not open"
  // on a build where it opens perfectly - the instrument, not the app.
  const zp = document.getElementById('zoomPopover');
  const pop = (zp && !zp.hidden) ? zp : null;
  if (!pop) return JSON.stringify({ open: false });
  const r = pop.getBoundingClientRect();
  return JSON.stringify({
    open: true,
    cls: String(pop.className || ''),
    role: pop.getAttribute('role'),
    rows: Array.from(pop.querySelectorAll('button, [role="menuitem"], [role="option"]')).map(b => b.textContent.replace(/\\s+/g, ' ').trim()),
    hasCloseButton: !!pop.querySelector('[aria-label*="close" i], [aria-label*="dismiss" i]'),
    box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]
  });
})()`;

const IS_OPEN = `(() => { const z = document.getElementById('zoomPopover'); return !!(z && !z.hidden); })()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT);
  await setSource(page, 'flowchart TD\n  A[One] --> B[Two]\n  B --> C[Three]', 3500);

  // is the zoom level readable at all without opening anything?
  const readout = JSON.parse(await page.evaluate(`(() => {
    const chip = document.getElementById('zoomChipButton');
    const r = chip ? chip.getBoundingClientRect() : null;
    return JSON.stringify({
      exists: !!chip,
      text: chip ? chip.textContent.replace(/\\s+/g, ' ').trim() : null,
      visible: !!(r && r.width > 2 && r.height > 2),
      title: chip ? chip.title : null
    });
  })()`));
  check('zoom.levelVisibleAtRest', readout.visible,
    'the current zoom level is readable without opening a menu',
    `chip exists=${readout.exists} visible=${readout.visible} text=${JSON.stringify(readout.text)}`);

  // how many presses to change zoom now?
  const reach = JSON.parse(await page.evaluate(`(() => {
    const v = document.getElementById('previewViewButton');
    const z = document.getElementById('zoomMenuButton');
    const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
    return JSON.stringify({ viewVisible: vis(v), zoomVisible: vis(z) });
  })()`));
  check('zoom.reach', reach.zoomVisible,
    'the zoom control is reachable in one press',
    `zoom button visible=${reach.zoomVisible}, only via View menu=${reach.viewVisible && !reach.zoomVisible}`);

  // now the popup's own behaviour
  let r = JSON.parse(await page.evaluate(OPEN_ZOOM));
  check('zoom.popupOpens', r.open, 'the zoom popup opens', r.open ? `${r.cls} ${r.box.join(',')} rows: ${r.rows.join(' | ')}` : 'did not open');

  if (r.open) {
    check('zoom.hasCloseAffordance', r.hasCloseButton,
      'the popup offers a way to dismiss it',
      r.hasCloseButton ? 'a close control exists' : 'no close or dismiss control in the popup');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const afterEsc = await page.evaluate(IS_OPEN);
    check('zoom.escapeCloses', !afterEsc, 'Escape closes it', afterEsc ? 'still open after Escape' : 'closed');

    if (afterEsc) { await page.evaluate(`document.body.click()`); await page.waitForTimeout(400); }

    // re-open, then click the diagram: does it close, and does the click also do something else?
    await page.evaluate(OPEN_ZOOM);
    await page.waitForTimeout(300);
    await page.mouse.click(1100, 600);
    await page.waitForTimeout(400);
    const afterOutside = await page.evaluate(IS_OPEN);
    check('zoom.outsideClickCloses', !afterOutside,
      'clicking outside closes it',
      afterOutside ? 'still open after an outside click' : 'closed');

    // and re-pressing its own button
    await page.evaluate(OPEN_ZOOM);
    await page.waitForTimeout(300);
    await page.evaluate(`document.getElementById('zoomMenuButton').click()`);
    await page.waitForTimeout(400);
    const afterToggle = await page.evaluate(IS_OPEN);
    check('zoom.buttonToggles', !afterToggle,
      'pressing the button again closes it',
      afterToggle ? 'still open - the button does not toggle' : 'closed');
  }

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await close();
  process.exit(report('zoom popup') ? 1 : 0);
})();
