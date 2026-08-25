#!/usr/bin/env node
/* What ACTUALLY triggers a read-only share link opening as editable?
 *
 * Antigravity reported 20 of 20 reproductions and named the conditions as "the browser has an
 * unsaved crash draft" - localStorage keys siren-draft and siren-clean-exit. Those key names do not
 * exist in the app: the real ones are `${STORAGE_KEY}-draft` and `${STORAGE_KEY}-clean-exit` with
 * STORAGE_KEY = 't-industries-siren-v23-state'. So the three keys they set were never read, and the
 * reported conditions cannot be the cause.
 *
 * Reading offerCrashRecovery shows why it reproduced anyway, and it matters:
 *
 *     let cleanExit = 'yes';
 *     cleanExit = localStorage.getItem(CLEAN_EXIT_KEY) || 'yes';
 *     markSessionRunning();
 *     const draft = readDraft();
 *     if (!draft) return;
 *     ...
 *     if (current === drafted) return;
 *
 * cleanExit is computed and then never used to gate anything. The prompt is offered whenever a
 * stored draft's content DIFFERS from the state being loaded - and a shared link always loads
 * something different, because that is what a shared link is for.
 *
 * If that reading is right, the trigger is not "you crashed". It is "you have used this app before",
 * which is a much larger set of people. This probe settles it WITHOUT fabricating any storage:
 * it just uses the app, the way a person would, and then opens a link.
 *
 * Usage: node verify_sharelink_trigger.js [--app <path>] [--port 9782]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const { SETTLE, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/codex/FROZEN_R8_BASE.html');
const PORT = Number(arg('port', '9782'));

const STATE = `(() => JSON.stringify({
  readOnly: document.body.classList.contains('read-only-mode'),
  dialogOpen: !!document.querySelector('dialog[open]'),
  dialogTitle: (document.getElementById('confirmDialogTitle') || {}).textContent || null,
  dialogButton: (document.getElementById('confirmActionButton') || {}).textContent || null,
  source: (document.getElementById('source') || {}).value || '',
  hash: location.hash.slice(0, 24)
}))()`;

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const url = `http://127.0.0.1:${PORT}/${file}`;

  // ---- make a real read-only link, through the app's own share code -----------------------
  const mk = await browser.newContext();
  const mp = await mk.newPage();
  await mp.route(url, async route => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace('function buildShareLink(readOnly = false)',
      'window.__share = (ro) => buildShareLink(ro); function buildShareLink(readOnly = false)');
    await route.fulfill({ response: res, body });
  });
  await mp.goto(url, { waitUntil: 'load' });
  await mp.evaluate(SETTLE);
  await mp.evaluate(`(() => { const s = document.getElementById('source');
    s.value = 'flowchart TD\\n  RO[Shared read only]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await mp.waitForTimeout(2500);
  const link = await mp.evaluate(`window.__share(true)`);
  await mk.close();
  const shared = url + '#' + link.split('#')[1];

  // ---- 1. positive control: a browser that has never seen this app -------------------------
  {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(shared, { waitUntil: 'load' });
    await p.waitForTimeout(3500);
    let st = JSON.parse(await p.evaluate(STATE));
    check('control.freshProfile.promptIsTheShare', /shared|read-only/i.test(st.dialogTitle || ''),
      'a clean browser is asked about the shared diagram',
      `title=${JSON.stringify(st.dialogTitle)} button=${JSON.stringify(st.dialogButton)}`);
    await p.evaluate(`document.getElementById('confirmActionButton').click()`);
    await p.waitForTimeout(1800);
    st = JSON.parse(await p.evaluate(STATE));
    check('control.freshProfile.opensReadOnly', st.readOnly === true,
      'and accepting it gives a read-only app',
      `read-only=${st.readOnly} source=${JSON.stringify(st.source.slice(0, 40))}`);
    await ctx.close();
  }

  // ---- 2. the real case: a person who has simply USED the app before -----------------------
  // No fabricated keys. Open the app, type a diagram, let it save, then open the link in the
  // same profile - which is exactly what happens when somebody sends you one.
  {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'load' });
    await p.evaluate(SETTLE);
    await p.evaluate(`(() => { const s = document.getElementById('source');
      s.value = 'flowchart TD\\n  MINE[My own work in progress]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await p.waitForTimeout(3000);

    await p.goto(shared, { waitUntil: 'load' });
    await p.waitForTimeout(3500);
    let st = JSON.parse(await p.evaluate(STATE));
    console.log(`\n  after opening the shared link with prior work present:`);
    console.log(`     dialog: ${JSON.stringify(st.dialogTitle)}  button: ${JSON.stringify(st.dialogButton)}`);
    console.log(`     hash now: ${JSON.stringify(st.hash)}\n`);

    check('used.promptIsStillTheShare', /shared|read-only/i.test(st.dialogTitle || ''),
      'the person is still asked about the SHARED diagram, not something else',
      `title=${JSON.stringify(st.dialogTitle)} button=${JSON.stringify(st.dialogButton)}`);

    await p.evaluate(`document.getElementById('confirmActionButton').click()`);
    await p.waitForTimeout(2000);
    st = JSON.parse(await p.evaluate(STATE));
    check('used.opensReadOnly', st.readOnly === true,
      'pressing the one button on the one dialog gives a READ-ONLY app',
      `read-only=${st.readOnly} source=${JSON.stringify(st.source.slice(0, 44))}`);

    check('used.linkNotSpent', st.hash.length > 2 || st.readOnly === true,
      'the shared payload is either honoured or still in the URL to retry',
      `read-only=${st.readOnly} hash=${JSON.stringify(st.hash)}`);

    await p.screenshot({ path: 'C:/Claude/SIREN/pending/round8/sharelink_used.png' });
    await ctx.close();
  }

  await browser.close(); server.close();
  report('share link trigger');
  process.exit(0);
})();
