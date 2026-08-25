/* Final BF analysis: preset-aware text rectangles, measured with the deck's own theme
 * font (Arial), for every fixture exported in probes 1 and 5, base vs merged. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const TMP = 'C:/Claude/SIREN/qa_exports/bf_tmp';

function readZip(buf) {
  const files = {};
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(p + 10), compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), cmtLen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const raw = buf.slice(start, start + compSize);
    files[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return files;
}
function attr(s, k) { const m = new RegExp(k + '="([^"]*)"').exec(s); return m ? m[1] : null; }

function shapesFromPptx(file) {
  const zip = readZip(fs.readFileSync(file));
  const xml = zip['ppt/slides/slide1.xml'].toString('utf8');
  const out = [];
  const spRe = /<p:sp>[\s\S]*?<\/p:sp>/g;
  let m;
  while ((m = spRe.exec(xml))) {
    const sp = m[0];
    const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(sp);
    const body = /<a:bodyPr [^>]*\/>/.exec(sp);
    if (!body) continue;
    const nv = /<p:cNvPr [^>]*\/>/.exec(sp);
    const adj = /<a:gd name="adj" fmla="val (\d+)"\/>/.exec(sp);
    const paras = [];
    const pRe = /<a:p>[\s\S]*?<\/a:p>/g; let pm;
    while ((pm = pRe.exec(sp))) {
      const runs = []; const rRe = /<a:r>[\s\S]*?<\/a:r>/g; let rm;
      while ((rm = rRe.exec(pm[0]))) {
        const t = /<a:t>([\s\S]*?)<\/a:t>/.exec(rm[0]);
        runs.push({ sz: Number(attr(rm[0], 'sz')), text: (t ? t[1] : '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') });
      }
      paras.push(runs);
    }
    out.push({
      name: nv ? attr(nv[0], 'name') : null, prst: attr(sp, 'prst'),
      adj: adj ? Number(adj[1]) : null, txBox: /txBox="1"/.test(sp),
      cx: Number(ext[1]), cy: Number(ext[2]), wrap: attr(body[0], 'wrap'),
      lIns: Number(attr(body[0], 'lIns')), rIns: Number(attr(body[0], 'rIns')), paras
    });
  }
  return out;
}

/* ECMA-376 preset text rectangles, horizontal extent only */
function presetTextWidthEmu(sh) {
  const w = sh.cx, h = sh.cy, ss = Math.min(w, h);
  switch (sh.prst) {
    case 'flowChartDecision': return w / 2;
    case 'ellipse': case 'flowChartConnector': return w * 0.70711;
    case 'roundRect': { const a = (sh.adj === null ? 16667 : sh.adj) / 100000; return w - 2 * 0.29289 * a * ss; }
    case 'hexagon': { const a = (sh.adj === null ? 25000 : sh.adj) / 100000; return w - 2 * a * ss; }
    default: return w; // rect, flowChartProcess, can (can's text rect spans the full width)
  }
}

const PAIRS = [
  ['cyl2'], ['dense44'], ['multiline_edge'], ['longword'], ['emptylabel'], ['romanian'], ['diamond_pill'], ['subgraph']
];
const P5 = ['tiny_diamond', 'tiny_pill', 'tiny_cyl', 'tiny_circle', 'tiny_hex', 'tiny_edge'];

(async () => {
  const rows = [];
  // probe 1 wrote base and merged pptx to the SAME filename, so only probe-5 files exist per build.
  for (const k of P5) {
    const b = shapesFromPptx(path.join(TMP, 'codex_' + k + '.pptx'));
    const m = shapesFromPptx(path.join(TMP, 'round13_' + k + '.pptx'));
    rows.push({ key: k, b, m });
  }
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto('about:blank');
  const jobs = [];
  rows.forEach((r, ri) => ['b', 'm'].forEach(side => r[side].forEach((sh, si) => sh.paras.forEach((runs, pi) => {
    const text = runs.map(x => x.text).join('');
    if (text) jobs.push({ ri, side, si, pi, text, pt: runs[0].sz / 100 });
  }))));
  const measured = await page.evaluate((jobs) => {
    const c = document.createElement('canvas').getContext('2d');
    return jobs.map(j => {
      c.font = j.pt + 'px Arial';
      const words = j.text.split(' ');
      return { full: c.measureText(j.text).width, longest: Math.max.apply(null, words.map(w => c.measureText(w).width)) };
    });
  }, jobs);
  await browser.close();

  console.log('key                 shape                     prst              BASEwrap MERGEDwrap  pt   xfrmPt presetPt availPt runPt longestWordPt  overVsXfrm overVsPreset  forcedMidWordBreak(MERGED)');
  jobs.forEach((j, n) => {
    const r = rows[j.ri];
    const sh = r[j.side][j.si];
    const other = r[j.side === 'b' ? 'm' : 'b'][j.si];
    if (j.side !== 'b') return;
    const mm = measured[n];
    const xfrmPt = sh.cx / 12700;
    const presetPt = presetTextWidthEmu(sh) / 12700;
    const avail = presetPt - (sh.lIns + sh.rIns) / 12700;
    const text = j.text.length > 24 ? j.text.slice(0, 22) + '..' : j.text;
    console.log([
      j.key || r.key.padEnd(18),
      ('"' + text + '"').padEnd(26),
      String(sh.prst + (sh.txBox ? '/txBox' : '')).padEnd(18),
      String(sh.wrap).padEnd(8), String(other.wrap).padEnd(11),
      String(j.pt).padEnd(5),
      xfrmPt.toFixed(1).padStart(6), presetPt.toFixed(1).padStart(8), avail.toFixed(1).padStart(7),
      mm.full.toFixed(1).padStart(6), mm.longest.toFixed(1).padStart(13),
      (mm.full - xfrmPt).toFixed(1).padStart(11), (mm.full - avail).toFixed(1).padStart(13),
      String(other.wrap === 'square' && mm.longest > avail).padStart(10)
    ].join(' '));
  });
})();
