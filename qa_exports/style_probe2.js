/* Probe 2: the real human path to Style. Clicks only, no JS shortcuts. */
const { openApp } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const OUT = 'C:/Claude/SIREN/qa_exports/style_shot/';

const snap = p => p.evaluate(() => {
  const vis = el => !!(el && el.offsetParent !== null && el.getBoundingClientRect().width > 0);
  const ss = document.getElementById('settingsSection');
  return {
    grouped: document.body.getAttribute('data-preview-grouped'),
    inspectVisible: vis(document.getElementById('previewInspectButton')),
    styleShortcutVisible: vis(document.getElementById('styleShortcutButton')),
    settingsOpen: ss.open,
    settingsInViewport: (() => { const r = ss.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight; })(),
    settingsTop: Math.round(ss.getBoundingClientRect().top),
    scroller: (() => { const s = ss.closest('.pane-scroll'); return s ? { scrollTop: Math.round(s.scrollTop), scrollHeight: Math.round(s.scrollHeight), clientHeight: Math.round(s.clientHeight) } : null; })(),
    editorPaneVisible: vis(document.getElementById('editorPane')),
    openMenus: Array.from(document.querySelectorAll('[role="menu"],.menu-popover,.popover,.dropdown')).filter(vis)
      .map(m => ({ cls: String(m.className).slice(0,50), id: m.id, items: Array.from(m.querySelectorAll('button,[role="menuitem"]')).map(b => b.textContent.replace(/\s+/g,' ').trim().slice(0,50)) }))
  };
});

(async () => {
  const { page, close } = await openApp(APP, 9848, { width: 1600, height: 1000 });
  console.log('S0 (fresh load) ' + JSON.stringify(await snap(page)));

  // press 1 - the Inspect grouped button
  await page.click('#previewInspectButton');
  await page.waitForTimeout(600);
  console.log('S1 (after Inspect) ' + JSON.stringify(await snap(page), null, 1));
  await page.screenshot({ path: OUT + 's2_inspect_menu.png' });

  // find the Style row in whatever opened
  const styleRow = await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll('button,[role="menuitem"],a')).filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && /^\s*(⚙\s*)?style\b/i.test(b.textContent.replace(/\s+/g,' ').trim());
    });
    return cands.map(b => ({ text: b.textContent.replace(/\s+/g,' ').trim().slice(0,60), id: b.id, cls: String(b.className).slice(0,40), rect: b.getBoundingClientRect().toJSON() }));
  });
  console.log('STYLE ROWS ' + JSON.stringify(styleRow));

  if (styleRow.length) {
    const r = styleRow[0].rect;
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    await page.waitForTimeout(1200);
  }
  console.log('S2 (after Style row) ' + JSON.stringify(await snap(page), null, 1));
  await page.screenshot({ path: OUT + 's2_after_style.png' });

  // How much scrolling to see each fold? Measure fold summary positions relative to the scroller.
  const geom = await page.evaluate(() => {
    const ss = document.getElementById('settingsSection');
    const sc = ss.closest('.pane-scroll');
    return {
      scrollTop: Math.round(sc.scrollTop), clientHeight: Math.round(sc.clientHeight), scrollHeight: Math.round(sc.scrollHeight),
      folds: Array.from(ss.querySelectorAll('details.style-fold')).map(d => {
        const s = d.querySelector('summary');
        return { name: (s.querySelector('span span') || s).textContent.trim().slice(0,30), open: d.open,
                 viewportTop: Math.round(s.getBoundingClientRect().top), inView: s.getBoundingClientRect().top < window.innerHeight && s.getBoundingClientRect().bottom > 0 };
      })
    };
  });
  console.log('GEOM ' + JSON.stringify(geom, null, 1));

  // Now: Build (visual) mode - is Style reachable at all?
  await page.evaluate(() => document.getElementById('visualModeButton').click());
  await page.waitForTimeout(900);
  console.log('BUILD MODE ' + JSON.stringify(await snap(page)));
  await page.screenshot({ path: OUT + 's2_build_mode.png' });

  await close();
})();
