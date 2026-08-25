#!/usr/bin/env node
/* Does the welcome tour take the keyboard away from a first-time user mid-word?
 *
 * Reported: about 2.3 seconds after a first visit, focus jumps out of whatever box you are typing
 * into and onto the tour card's Next button. Typing "Review request" leaves "Re".
 *
 * This is the one class of defect this project treats as unarguable, and it has been invisible all
 * session for a specific reason: the shared harness DISMISSES tour cards during settle, precisely so
 * that probes are not blocked by them. Every measurement taken through it has been blind to this.
 * So this probe deliberately does NOT settle - it opens a clean context and starts typing.
 *
 * Usage: node verify_tour_focus.js [--app <path>] [--port 9770]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const { check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round10/merged.html');
const PORT = Number(arg('port', '9770'));

const WORD = 'Review request';   // 14 characters, typed across the reported window

const STATE = `(() => {
  const a = document.activeElement;
  const card = document.querySelector('.tour-card');
  const step = card ? (card.querySelector('strong') || {}).textContent : null;
  return JSON.stringify({
    active: a ? (a.id || a.tagName + (a.className ? '.' + String(a.className).split(' ')[0] : '')) : null,
    label: (document.getElementById('visualNodeLabel') || {}).value,
    source: (document.getElementById('source') || {}).value || '',
    tourUp: !!card,
    step: step ? String(step).trim() : null
  });
})()`;

async function run(browser, url, target) {
  // A FRESH context every time: the tour is first-run only, gated on state.tourDone, so a reload
  // measures a path where it never appears - a check that passes on the unfixed build.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(1200);

  if (target === 'source') {
    await page.evaluate(`document.getElementById('codeModeButton')?.click()`);
    await page.waitForTimeout(400);
  }
  const sel = target === 'source' ? '#source' : '#visualNodeLabel';
  const ok = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return false; e.focus(); return true; })()`);
  if (!ok) { await ctx.close(); return { skipped: sel }; }

  // Type slowly enough to straddle the reported ~2.35s moment.
  await page.keyboard.type(WORD, { delay: 170 });
  await page.waitForTimeout(900);
  const st = JSON.parse(await page.evaluate(STATE));
  await page.screenshot({ path: `C:/Claude/SIREN/pending/round10/tour_${target}.png` });
  await ctx.close();
  return st;
}

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const url = `http://127.0.0.1:${PORT}/${file}`;

  const lab = await run(browser, url, 'label');
  console.log(`\n  Build mode  : typed ${JSON.stringify(WORD)} into #visualNodeLabel`);
  console.log(`     field holds : ${JSON.stringify(lab.label)}`);
  console.log(`     focus ended : ${lab.active}    tour up: ${lab.tourUp}   step: ${JSON.stringify(lab.step)}\n`);

  check('build.keepsWhatYouTyped', lab.label === WORD,
    `#visualNodeLabel holds all ${WORD.length} characters`,
    `${JSON.stringify(lab.label)} (${(lab.label || '').length} of ${WORD.length})`);
  check('build.focusStayed', lab.active === 'visualNodeLabel',
    'focus never left the field somebody was typing into',
    `ended on ${lab.active}`);

  const src = await run(browser, url, 'source');
  const typedIn = String(src.source || '');
  console.log(`  Code mode   : typed ${JSON.stringify(WORD)} into #source`);
  console.log(`     source gained: ${JSON.stringify(typedIn.slice(-20))}`);
  console.log(`     focus ended  : ${src.active}    step: ${JSON.stringify(src.step)}\n`);

  check('code.keepsWhatYouTyped', typedIn.indexOf(WORD) >= 0,
    `#source contains the whole word`,
    `tail = ${JSON.stringify(typedIn.slice(-24))}`);
  check('code.focusStayed', src.active === 'source',
    'focus never left the code editor',
    `ended on ${src.active}`);

  // And the step must not have advanced on its own - a stray space on a focused Next button
  check('tour.didNotAdvanceItself', !lab.step || lab.step.indexOf('1/') === 0,
    'the tour is still on its first step, not driven by somebody typing',
    `step reads ${JSON.stringify(lab.step)}`);

  await browser.close(); server.close();
  process.exit(report('tour focus') ? 1 : 0);
})();
