/* Probe 1: how do you reach the Style surface, and what does it contain? */
const { openApp } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';

(async () => {
  const { page, close } = await openApp(APP, 9847, { width: 1600, height: 1000 });

  const before = await page.evaluate(() => {
    const vis = el => !!(el && el.offsetParent !== null);
    const ss = document.getElementById('settingsSection');
    const btn = document.getElementById('styleShortcutButton');
    return {
      bodyAttrs: Array.from(document.body.attributes).map(a => a.name + '=' + a.value),
      styleBtnVisible: vis(btn),
      styleBtnRect: btn ? btn.getBoundingClientRect().toJSON() : null,
      settingsSectionExists: !!ss,
      settingsOpen: ss ? ss.open : null,
      settingsVisible: vis(ss),
      settingsSummaryText: ss ? ss.querySelector('summary').textContent.trim() : null,
      // what ancestors are collapsed?
      ancestors: (() => {
        const out = []; let n = ss;
        while (n && n !== document.body) {
          out.push({ tag: n.tagName, id: n.id, cls: n.className && String(n.className).slice(0, 60),
                     open: n.tagName === 'DETAILS' ? n.open : undefined, hidden: n.hidden,
                     disp: getComputedStyle(n).display });
          n = n.parentElement;
        }
        return out;
      })(),
      modeButtons: ['visualModeButton','codeModeButton','structureModeButton','previewViewButton','previewInspectButton']
        .map(id => { const e = document.getElementById(id); return { id, exists: !!e, visible: vis(e), pressed: e && e.getAttribute('aria-pressed'), text: e && e.textContent.trim().slice(0,30) }; })
    };
  });
  console.log('BEFORE ' + JSON.stringify(before, null, 1));

  // Press 1: the Style shortcut
  await page.evaluate(() => document.getElementById('styleShortcutButton').click());
  await page.waitForTimeout(900);

  const after = await page.evaluate(() => {
    const vis = el => !!(el && el.offsetParent !== null);
    const ss = document.getElementById('settingsSection');
    const folds = Array.from(ss.querySelectorAll('details.style-fold')).map(d => ({
      id: d.id || null,
      name: d.querySelector('summary span span') ? d.querySelector('summary span span').textContent.trim() : d.querySelector('summary').textContent.trim().slice(0,40),
      open: d.open, visible: vis(d),
      rectTop: Math.round(d.getBoundingClientRect().top)
    }));
    return {
      settingsOpen: ss.open, settingsVisible: vis(ss),
      settingsRectTop: Math.round(ss.getBoundingClientRect().top),
      folds,
      // Everything interactive inside the Style card
      controls: Array.from(ss.querySelectorAll('input,select,textarea,button')).map(el => {
        const lab = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
        const fold = el.closest('details.style-fold');
        return {
          id: el.id || '(no id)', tag: el.tagName.toLowerCase(), type: el.type || '',
          label: lab ? lab.textContent.trim() : (el.getAttribute('aria-label') || el.textContent.trim().slice(0,40)),
          fold: fold ? (fold.querySelector('summary span span') ? fold.querySelector('summary span span').textContent.trim() : fold.id) : '(top level)',
          visible: vis(el), disabled: el.disabled, hiddenAttr: el.hidden,
          parentHidden: !!(el.parentElement && el.parentElement.hidden),
          title: el.title || ''
        };
      })
    };
  });
  console.log('AFTER ' + JSON.stringify(after, null, 1));
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/style_shot/s1_after_style_click.png', fullPage: false });
  await close();
})();
