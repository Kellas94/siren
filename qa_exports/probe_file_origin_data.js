#!/usr/bin/env node
/* If the offline edition downloads a new version, does the person's work still open?
 *
 * A single-file HTML cannot rewrite itself on disk, so "check for updates" can only ever hand
 * somebody a NEW FILE. They then open it - at a different path, or at least a different name. The
 * question that decides whether that is safe is whether IndexedDB follows.
 *
 * SIREN keeps state, diagrams, drafts and Docs in IndexedDB (t-industries-siren-db). For file://
 * URLs browsers do not agree on what the origin is: some treat every file as a unique opaque origin,
 * some share one origin across all local files. If it is the former, a person who updates opens an
 * empty workspace and believes they have lost everything.
 *
 * This measures it three ways, on the real thing:
 *   1. same file, opened twice          - the control; data must persist at all
 *   2. a copy under a different NAME    - what an update actually produces
 *   3. a copy in a different FOLDER     - what a tidy person does with it
 *
 * Usage: node probe_file_origin_data.js
 */
const fs = require('fs'), path = require('path'), os = require('os');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const { SETTLE, check, report } = require('./r7_lib');

const LIVE = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const DIR = path.join(os.tmpdir(), 'siren_origin_test');
const SUB = path.join(DIR, 'moved');

const MARK = 'flowchart TD\n  KEEP[Work that must survive an update]';

const WRITE = `(async () => {
  const s = document.getElementById('source');
  s.value = ${JSON.stringify(MARK)};
  s.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 3000));
  return (document.getElementById('source') || {}).value;
})()`;

const READ = `(() => JSON.stringify({
  source: (document.getElementById('source') || {}).value || '',
  diagrams: (function () { try { return document.querySelectorAll('.diagram-tab, [data-diagram-id]').length; } catch (e) { return -1; } })()
}))()`;

/* What the browser thinks this page's storage identity is - the fact the whole design turns on. */
const ORIGIN = `(async () => {
  let dbs = 'unavailable';
  try { dbs = (await indexedDB.databases()).map(d => d.name).join(', ') || '(none)'; } catch (e) { dbs = 'error: ' + e.message; }
  return JSON.stringify({ origin: String(location.origin), href: location.href.slice(0, 70), dbs });
})()`;

(async () => {
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(SUB, { recursive: true });
  const a = path.join(DIR, 'SIREN_v1.html');
  const b = path.join(DIR, 'SIREN_v2.html');          // an update, renamed
  const c = path.join(SUB, 'SIREN_v1.html');          // same name, moved
  fs.copyFileSync(LIVE, a); fs.copyFileSync(LIVE, b); fs.copyFileSync(LIVE, c);

  const browser = await chromium.launch();
  // ONE persistent context, as a person's browser profile is - the whole point is that the storage
  // is the same browser, only the file differs.
  const ctx = await browser.newContext();

  const open = async file => {
    const p = await ctx.newPage();
    await p.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 90000 });
    await p.evaluate(SETTLE);
    return p;
  };

  // ---- write the work in the original file -------------------------------------------------
  const p1 = await open(a);
  const o1 = JSON.parse(await p1.evaluate(ORIGIN));
  await p1.evaluate(WRITE);
  await p1.waitForTimeout(2500);
  console.log(`\n  wrote in : ${o1.href}`);
  console.log(`  origin   : ${JSON.stringify(o1.origin)}   databases: ${o1.dbs}\n`);
  await p1.close();

  // ---- 1. control: the SAME file again -----------------------------------------------------
  const p2 = await open(a);
  const r2 = JSON.parse(await p2.evaluate(READ));
  const o2 = JSON.parse(await p2.evaluate(ORIGIN));
  check('control.sameFileKeepsWork', r2.source.indexOf('KEEP[') >= 0,
    'reopening the same file shows the work',
    `source=${JSON.stringify(r2.source.slice(0, 46))} dbs=${o2.dbs}`);
  await p2.close();

  // ---- 2. an update: same folder, new name -------------------------------------------------
  const p3 = await open(b);
  const r3 = JSON.parse(await p3.evaluate(READ));
  const o3 = JSON.parse(await p3.evaluate(ORIGIN));
  check('update.renamedFileKeepsWork', r3.source.indexOf('KEEP[') >= 0,
    'a downloaded update under a new name still shows the work',
    `source=${JSON.stringify(r3.source.slice(0, 46))} origin=${JSON.stringify(o3.origin)} dbs=${o3.dbs}`);
  await p3.close();

  // ---- 3. moved to another folder ----------------------------------------------------------
  const p4 = await open(c);
  const r4 = JSON.parse(await p4.evaluate(READ));
  const o4 = JSON.parse(await p4.evaluate(ORIGIN));
  check('update.movedFileKeepsWork', r4.source.indexOf('KEEP[') >= 0,
    'the same file moved to another folder still shows the work',
    `source=${JSON.stringify(r4.source.slice(0, 46))} origin=${JSON.stringify(o4.origin)} dbs=${o4.dbs}`);
  await p4.close();

  await browser.close();
  fs.rmSync(DIR, { recursive: true, force: true });
  process.exit(report('file origin and data') ? 1 : 0);
})();
