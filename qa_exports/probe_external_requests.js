#!/usr/bin/env node
/* Does the file actually reach outside, and when?
 *
 * The CSP permits cdn.jsdelivr.net and unpkg.com for script-src and connect-src. Whether that
 * permission is ever exercised is a different question from whether it is granted, and both matter:
 * an auditor opening client material wants to know what the document CAN do, not only what it did.
 *
 * This logs every request that leaves the local server, through boot and through ordinary use.
 *
 * Usage: node probe_external_requests.js [--app <path>] [--port 9895]
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9895'));
const NL = String.fromCharCode(10);

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  const external = [];
  const local = new RegExp('^http://127[.]0[.]0[.]1:' + PORT + '/');
  page.on('request', r => {
    const u = r.url();
    if (local.test(u) || u.startsWith('data:') || u.startsWith('blob:')) return;
    external.push(r.method() + ' ' + u.slice(0, 110));
  });

  console.log('\nMeasured on ' + APP + '\n');
  console.log('  after boot and settle: ' + (external.length ? JSON.stringify(external) : 'no external request'));

  // Ordinary use: type a diagram, switch theme, open Docs, open the export dialog.
  const mark = () => external.length;
  let n = mark();
  await setSource(page, ['flowchart TD', '  A[Purchase request] --> B{Approved}', '  B --> C[Raise order]'].join(NL), 3000);
  console.log('  after typing a diagram: ' + (external.length > n ? JSON.stringify(external.slice(n)) : 'no external request'));

  n = mark();
  await page.evaluate(`(async () => {
    const sel = document.getElementById('themePreset');
    if (sel) { sel.value = 'kintsugi'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    await new Promise(r => setTimeout(r, 1200));
    document.getElementById('workpapersButton')?.click();
    await new Promise(r => setTimeout(r, 1200));
    document.getElementById('exportButton')?.click();
    await new Promise(r => setTimeout(r, 1000));
  })()`);
  await page.waitForTimeout(800);
  console.log('  after theme, Docs, export: ' + (external.length > n ? JSON.stringify(external.slice(n)) : 'no external request'));

  // The one thing that is designed to fetch: the ELK layout engine.
  n = mark();
  const elk = await page.evaluate(`(async () => {
    const sel = document.getElementById('layoutEngine') || document.getElementById('layoutEngineSelect');
    if (!sel) {
      const btn = Array.from(document.querySelectorAll('button, option')).find(b => /elk/i.test(b.textContent || ''));
      return btn ? 'found a control named ELK: ' + (btn.id || btn.tagName) : 'no ELK control located';
    }
    const opt = Array.from(sel.options).find(o => /elk/i.test(o.textContent + o.value));
    if (!opt) return 'no ELK option in ' + sel.id;
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 2500));
    return 'chose ' + opt.value + ' in ' + sel.id;
  })()`);
  await page.waitForTimeout(1500);
  console.log('\n  ELK: ' + elk);
  console.log('  requests it caused: ' + (external.length > n ? JSON.stringify(external.slice(n)) : 'none'));

  console.log('\n  TOTAL external requests across the whole session: ' + external.length);
  console.log('  errors: ' + (errors.length ? errors.slice(0, 3).join(' // ') : 'none'));
  await close();
})();
