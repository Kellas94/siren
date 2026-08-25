/* JOB BF probe 3 - (a) multi-line labels on NON-rect presets must keep wrap="none",
 *                  (b) the DECK route (Present -> Map -> Slides -> PowerPoint),
 *                      which is the other call site of deckShapeTextBody.
 * Usage: node bf_probe3.js <appPath> <port> <outJson>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const lib = require('C:/Claude/SIREN/qa_exports/r7_lib.js');

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const OUT = process.argv[4];
const TAG = path.basename(path.dirname(APP));
const TMP = 'C:/Claude/SIREN/qa_exports/bf_tmp';

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
function attr(s, k) { const m = new RegExp(k + '="([^"]*)"').exec(s); return m ? m[1] : null; }
function parseSlideShapes(xml) {
  const out = [];
  const spRe = /<p:sp>[\s\S]*?<\/p:sp>/g;
  let m;
  while ((m = spRe.exec(xml))) {
    const sp = m[0];
    const nv = /<p:cNvPr [^>]*\/>/.exec(sp);
    const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(sp);
    const body = /<a:bodyPr [^>]*\/>/.exec(sp);
    if (!body) continue;
    const paras = [];
    const pRe = /<a:p>[\s\S]*?<\/a:p>/g;
    let pm;
    while ((pm = pRe.exec(sp))) {
      const runs = [];
      const rRe = /<a:r>[\s\S]*?<\/a:r>/g;
      let rm;
      while ((rm = rRe.exec(pm[0]))) {
        const t = /<a:t>([\s\S]*?)<\/a:t>/.exec(rm[0]);
        runs.push({ sz: Number(attr(rm[0], 'sz')), text: t ? t[1] : '' });
      }
      paras.push({ runs });
    }
    out.push({
      name: nv ? attr(nv[0], 'name') : null,
      cx: ext ? Number(ext[1]) : null, cy: ext ? Number(ext[2]) : null,
      prst: attr(sp, 'prst'), txBox: /txBox="1"/.test(sp),
      wrap: attr(body[0], 'wrap'), paras
    });
  }
  return out;
}

const FIXTURES = [
  { key: 'ml_diamond', src: 'flowchart LR\n  A{"Approved by<br/>the finance manager?"} --> B[End]' },
  { key: 'ml_pill', src: 'flowchart LR\n  A(["Pill line one<br/>pill line two"]) --> B[End]' },
  { key: 'ml_cyl_plain', src: 'flowchart LR\n  A[(Ledger one<br/>ledger two)] --> B[End]' }
];

async function realClick(page, sel) {
  const box = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; })()`);
  if (!box || !box.w) throw new Error('not clickable: ' + sel);
  await page.mouse.click(box.x, box.y);
}
async function clickByText(page, re) {
  const box = await page.evaluate(`(() => {
    const rx = new RegExp(${JSON.stringify(re)});
    const nodes = Array.from(document.querySelectorAll('button, [role="option"], li, .structure-menu-item, [class*="menu"] *'));
    const hit = nodes.filter(n => rx.test((n.textContent || '').trim()) && n.getBoundingClientRect().width > 0)
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, label: (hit.textContent || '').trim().slice(0, 60) };
  })()`);
  if (!box) return null;
  await page.mouse.click(box.x, box.y);
  return box.label;
}

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  const result = { app: APP, fixtures: {}, deck: null, errors: [] };
  try {
    for (const fx of FIXTURES) {
      const rec = { key: fx.key };
      await lib.setSource(page, fx.src, 3500);
      rec.svgText = await page.evaluate(`(() => {
        const svg = document.querySelector('#diagram svg');
        return svg ? Array.from(svg.querySelectorAll('g.node')).map(g => (g.textContent||'').trim().slice(0,50)) : null;
      })()`);
      await realClick(page, '#exportButton');
      await page.waitForTimeout(500);
      let dlErr = null;
      const p = page.waitForEvent('download', { timeout: 40000 }).catch(e => { dlErr = 'timeout'; return null; });
      await realClick(page, '#exportPptxButton');
      const dl = await p;
      rec.exportStatus = await page.evaluate(`document.getElementById('exportStatus')?.textContent.slice(0,200)`);
      if (dl) {
        const t = path.join(TMP, TAG + '_' + fx.key + '.pptx');
        await dl.saveAs(t);
        const slide = readZip(fs.readFileSync(t))['ppt/slides/slide1.xml'].toString('utf8');
        rec.shapes = parseSlideShapes(slide);
      } else rec.downloadFailed = dlErr;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      result.fixtures[fx.key] = rec;
    }

    /* ---- DECK ROUTE ---- */
    const deck = { steps: [] };
    await lib.setSource(page, 'flowchart LR\n  A[(Customer master database)] -->|posted nightly| B{Approved by finance?}', 3500);
    try {
      await realClick(page, '#presentButton');
      await page.waitForTimeout(4000);
      deck.steps.push('present clicked; overlayHidden=' + await page.evaluate(`document.getElementById('presentOverlay')?.hidden`));
      deck.routeLen = await page.evaluate(`(() => { try { return (window.state && state.map && state.map.route || []).length; } catch (e) { return 'no-access'; } })()`);
      deck.mapExportVisible = await page.evaluate(`(() => { const e = document.getElementById('mapExportButton'); return e ? { w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height } : null; })()`);
      await realClick(page, '#mapExportButton');
      await page.waitForTimeout(900);
      deck.menuText = await page.evaluate(`Array.from(document.querySelectorAll('[role="listbox"], .structure-menu, [class*="structure-menu"]')).map(n => n.textContent.trim().slice(0,300))`);
      let dlErr = null;
      const p = page.waitForEvent('download', { timeout: 90000 }).catch(() => { dlErr = 'timeout'; return null; });
      const picked = await clickByText(page, 'PowerPoint');
      deck.picked = picked;
      const dl = await p;
      if (dl) {
        const t = path.join(TMP, TAG + '_deck.pptx');
        await dl.saveAs(t);
        const zip = readZip(fs.readFileSync(t));
        const names = Object.keys(zip).filter(n => /ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
        deck.slides = names;
        deck.perSlide = names.map(n => {
          const xml = zip[n].toString('utf8');
          fs.writeFileSync(path.join(TMP, TAG + '_deck_' + path.basename(n)), xml);
          const sh = parseSlideShapes(xml);
          return {
            slide: n, sp: sh.length,
            wraps: sh.map(s => (s.prst || '?') + (s.txBox ? '/txBox' : '') + '=' + s.wrap),
            texts: sh.flatMap(s => s.paras.flatMap(p => p.runs.map(r => r.text))).filter(Boolean)
          };
        });
      } else deck.downloadFailed = dlErr;
    } catch (e) {
      deck.error = String(e && e.message || e).slice(0, 200);
    }
    result.deck = deck;
    result.errors = errors.slice(0, 20);
  } finally { await close(); }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
