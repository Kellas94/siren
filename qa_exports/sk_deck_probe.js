/* Reach the DECK route (Present -> Map -> "Slides" -> PowerPoint) with real clicks
 * and export a deck .pptx, so the second deckShapeTextBody call site is measured
 * rather than argued from source.
 *
 * Usage: node sk_deck_probe.js <appPath> <port> <outJson>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const lib = require('C:/Claude/SIREN/qa_exports/r7_lib.js');

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const OUT = process.argv[4];
const TMP = 'C:/Claude/SIREN/qa_exports/sk_tmp';
fs.mkdirSync(TMP, { recursive: true });

function readZip(buf) {
  const files = {};
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('no EOCD');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const cmtLen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(lho + 26);
    const lExtraLen = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(start, start + compSize);
    files[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return files;
}

const VISIBLE = `((sels) => sels.map(s => {
  const e = document.querySelector(s);
  if (!e) return s + ' MISSING';
  const r = e.getBoundingClientRect();
  return s + ' w=' + Math.round(r.width) + ' h=' + Math.round(r.height) + ' hidden=' + e.hidden + ' disp=' + getComputedStyle(e).display;
}))`;

async function realClick(page, sel) {
  const box = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);
  if (!box || box.w === 0) throw new Error('not clickable: ' + sel + ' ' + JSON.stringify(box));
  await page.mouse.click(box.x, box.y);
  return box;
}

const SRC = 'flowchart LR\n  A[(Customer master database reconciliation and general ledger posting summary prepared quarterly)] --> B{Approved?}\n  B --> C([Filed])';

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1600, height: 950 });
  const out = { app: APP, steps: [], errors: [] };
  try {
    await lib.setSource(page, SRC, 3800);
    out.sourceEcho = await page.evaluate(`document.getElementById('source').value`);
    out.sourceMatches = out.sourceEcho === SRC;

    // A single diagram with nothing authored presents SOLO and hides the Map button
    // (presentSoloTargetId). The menu beside Present is the documented way to the
    // whole workspace, which is the deck.
    try {
      await realClick(page, '#presentMenuButton');
      await page.waitForTimeout(700);
      const opts = await page.evaluate(`(() => Array.from(document.querySelectorAll('[role="option"], .structure-menu button, button')).filter(b => b.getBoundingClientRect().width > 0 && /whole workspace|present just/i.test(b.textContent)).map(b => (b.id||'(noid)') + ' :: ' + b.textContent.replace(/\\s+/g,' ').trim()))()`);
      out.presentMenuOptions = opts;
      const pick = await page.evaluate(`(() => {
        const b = Array.from(document.querySelectorAll('[role="option"], .structure-menu button, button')).find(x => /whole workspace/i.test(x.textContent) && x.getBoundingClientRect().width > 0);
        if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, label: b.textContent.trim() };
      })()`);
      out.presentMenuPick = pick;
      if (pick) await page.mouse.click(pick.x, pick.y);
    } catch (e) { out.presentMenuError = String(e.message).slice(0, 160); await realClick(page, '#presentButton'); }
    await page.waitForTimeout(2500);
    out.steps.push({ after: 'presentButton', state: await page.evaluate(`${VISIBLE}(['#presentOverlay','#presentMapButton','#mapBar','#mapExportButton','#mapBarPresent','#mapBarBuild','#presentExitButton'])`) });

    // Everything visible in the present overlay's bars, by label, so the map route
    // can be found without guessing an id.
    out.presentBarButtons = await page.evaluate(`(() => {
      const ov = document.getElementById('presentOverlay');
      if (!ov) return null;
      return Array.from(ov.querySelectorAll('button')).filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
        .map(b => (b.id || '(noid)') + ' :: ' + b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40));
    })()`);

    // Try the map button; if hidden, try any visible control whose label mentions Map.
    let entered = false;
    try { await realClick(page, '#presentMapButton'); entered = true; out.steps.push({ clicked: '#presentMapButton' }); } catch (e) { out.steps.push({ mapButtonError: String(e.message).slice(0, 120) }); }
    if (!entered) {
      const found = await page.evaluate(`(() => {
        const ov = document.getElementById('presentOverlay');
        const b = Array.from(ov.querySelectorAll('button')).find(x => /map/i.test(x.textContent) && x.getBoundingClientRect().width > 0);
        if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, label: b.textContent.trim(), id: b.id };
      })()`);
      if (found) { await page.mouse.click(found.x, found.y); entered = true; out.steps.push({ clickedByLabel: found }); }
    }
    await page.waitForTimeout(1800);
    out.steps.push({ after: 'map', state: await page.evaluate(`${VISIBLE}(['#mapBar','#mapExportButton','#mapPlane','#mapRoute','#mapBuildButton'])`) });
    out.mapBarButtons = await page.evaluate(`(() => Array.from(document.querySelectorAll('#mapBar button, #mapPanel button')).filter(b => b.getBoundingClientRect().width > 0).map(b => (b.id || '(noid)') + ' :: ' + b.textContent.replace(/\\s+/g,' ').trim().slice(0,40)))()`);

    // "⤓ Slides" opens a chooser; pick PowerPoint from it.
    let buf = null;
    try {
      const dlPromise = page.waitForEvent('download', { timeout: 180000 });
      dlPromise.catch(() => {});
      // "⤓ Slides" lives in #mapBarBuild, which is hidden until Build mode, and the
      // Build control itself is behind the map bar's ⋯ overflow.
      let opened = false;
      try { await realClick(page, '#mapExportButton'); opened = true; } catch (e) {
        await realClick(page, '#mapMoreButton');
        await page.waitForTimeout(600);
        await realClick(page, '#mapBuildButton');
        await page.waitForTimeout(1200);
        out.afterBuild = await page.evaluate(`${VISIBLE}(['#mapBarBuild','#mapExportButton','#mapAddButton','#mapDoneButton'])`);
        try { await realClick(page, '#mapExportButton'); opened = true; } catch (e2) { out.stillHidden = String(e2.message).slice(0, 140); }
        await page.waitForTimeout(800);
        out.moreMenu = await page.evaluate(`(() => Array.from(document.querySelectorAll('[role="option"], .structure-menu button, button')).filter(b => b.getBoundingClientRect().width > 0).map(b => (b.id||'(noid)') + ' :: ' + b.textContent.replace(/\\s+/g,' ').trim().slice(0,44)))()`);
        const slidesPick = await page.evaluate(`(() => {
          const b = Array.from(document.querySelectorAll('[role="option"], .structure-menu button, button')).find(x => /slides/i.test(x.textContent) && x.getBoundingClientRect().width > 0);
          if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, label: b.textContent.replace(/\\s+/g,' ').trim() };
        })()`);
        out.slidesPick = slidesPick;
        if (slidesPick) { await page.mouse.click(slidesPick.x, slidesPick.y); opened = true; }
      }
      await page.waitForTimeout(1000);
      out.chooser = await page.evaluate(`(() => Array.from(document.querySelectorAll('[role="listbox"] [role="option"], .structure-menu button, .menu-pop button, dialog[open] button')).filter(b => b.getBoundingClientRect().width > 0).map(b => (b.id || '(noid)') + ' :: ' + b.textContent.replace(/\\s+/g,' ').trim().slice(0,50)))()`);
      const pick = await page.evaluate(`(() => {
        const all = Array.from(document.querySelectorAll('[role="option"], .structure-menu button, .menu-pop button, dialog[open] button, button'));
        const b = all.find(x => /powerpoint|pptx/i.test(x.textContent) && x.getBoundingClientRect().width > 0 && x.id !== 'exportPptxButton');
        if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, label: b.textContent.replace(/\\s+/g,' ').trim().slice(0,50), id: b.id };
      })()`);
      out.picked = pick;
      if (pick) await page.mouse.click(pick.x, pick.y);
      const dl = await dlPromise;
      const target = path.join(TMP, 'deck_' + path.basename(path.dirname(APP)) + '.pptx');
      await dl.saveAs(target);
      buf = fs.readFileSync(target);
      out.deckFile = target;
    } catch (e) {
      out.deckError = String(e && e.message || e).slice(0, 300);
    }

    if (buf) {
      const zip = readZip(buf);
      const slides = Object.keys(zip).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
      out.slides = slides;
      out.perSlide = slides.map(n => {
        const xml = zip[n].toString('utf8');
        fs.writeFileSync(path.join(TMP, 'deck_' + path.basename(path.dirname(APP)) + '_' + path.basename(n)), xml);
        const wraps = {};
        (xml.match(/<a:bodyPr [^>]*\/>/g) || []).forEach(b => {
          const w = /wrap="([^"]*)"/.exec(b);
          const k = (w ? w[1] : 'none-attr') + (/vertOverflow="overflow"/.test(b) ? '+ovf' : '');
          wraps[k] = (wraps[k] || 0) + 1;
        });
        return { slide: n, bytes: xml.length, wraps: wraps, pics: (xml.match(/<p:pic>/g) || []).length, sps: (xml.match(/<p:sp>/g) || []).length,
          texts: (xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map(t => t.replace(/<[^>]*>/g, '')).slice(0, 40) };
      });
    }
    out.errors = errors.slice(0, 20);
  } finally {
    await close();
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
