#!/usr/bin/env node
/* A picture of the two tabs immediately after pressing Guided, on both builds, side by side.
 * The owner reported this from a screenshot; it should be answered with one.
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

async function shoot(appPath, port, out) {
  const { page, close } = await openApp(appPath, port, { width: 1440, height: 900 });
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card');
      if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 6) break;
    await page.waitForTimeout(170);
  }
  const first = await page.evaluate(`(async () => {
    const sel = document.getElementById('diagramTypeSelect');
    sel.value = 'pie'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 900));
    const st = document.getElementById('newStarterButton')
      || Array.from(document.querySelectorAll('button')).find(b => /new starter/i.test(b.textContent || ''));
    if (st && !st.disabled) { st.click(); await new Promise(r => setTimeout(r, 900)); }
    const dlg = document.querySelector('dialog[open]');
    if (dlg) { const go = Array.from(dlg.querySelectorAll('button')).find(b => /continue|replace|start|yes|ok/i.test(b.textContent||'')); if (go) { go.click(); await new Promise(r => setTimeout(r, 1400)); } }
    document.getElementById('codeModeButton')?.click(); await new Promise(r => setTimeout(r, 300));
    document.getElementById('textModeButton')?.click(); await new Promise(r => setTimeout(r, 400));
    return (document.getElementById('source').value || '').split(String.fromCharCode(10))[0].slice(0, 20);
  })()`);
  if (!/^pie/i.test(first)) { console.log('  ABORT ' + out + ' - fixture is ' + JSON.stringify(first)); await close(); return; }

  await page.locator('#visualModeButton').click();
  await page.waitForTimeout(900);
  const box = await page.evaluate(`(() => {
    const a = document.getElementById('visualModeButton').getBoundingClientRect();
    const b = document.getElementById('codeModeButton').getBoundingClientRect();
    const left = Math.min(a.left, b.left), right = Math.max(a.right, b.right);
    const top = Math.min(a.top, b.top), bottom = Math.max(a.bottom, b.bottom);
    return JSON.stringify({ x: Math.max(0, left - 18), y: Math.max(0, top - 14),
      width: right - left + 36, height: bottom - top + 28 });
  })()`);
  await page.screenshot({ path: out, clip: JSON.parse(box) });
  console.log('  wrote ' + out);
  await close();
}

(async () => {
  await shoot('C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html', 9797, 'C:/Claude/SIREN/pending/ui/tabs_before.png');
  await shoot('C:/Claude/SIREN/pending/uifix/app.html', 9798, 'C:/Claude/SIREN/pending/ui/tabs_fixed.png');
})();
