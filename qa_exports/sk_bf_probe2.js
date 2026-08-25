/* SKEPTIC probe 2 for JOB BF: the over-correction hunt.
 * Ordinary-size single-word captions and short inscribed-preset labels, plus a
 * reproduction of the first engineer's own headline fixture and his sideways
 * one-word dense fixture.
 *
 * Usage: node sk_bf_probe2.js <appPath> <port> <outJson>
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
    const adj = /<a:gd name="adj" fmla="val (\d+)"\/>/.exec(sp);
    out.push({
      name: nv ? attr(nv[0], 'name') : null,
      cx: ext ? Number(ext[1]) : null, cy: ext ? Number(ext[2]) : null,
      prst: attr(sp, 'prst'), adj: adj ? Number(adj[1]) : null,
      txBox: /txBox="1"/.test(sp),
      wrap: attr(body[0], 'wrap'),
      lIns: Number(attr(body[0], 'lIns')), rIns: Number(attr(body[0], 'rIns')),
      paras
    });
  }
  return out;
}

function dense44oneword() {
  const lines = ['flowchart TD'];
  for (let i = 1; i < 44; i++) lines.push('  N' + i + '[Control activity ' + i + ' reviewed] -->|Reconciliation' + i + '| N' + (i + 1) + '[Control activity ' + (i + 1) + ' reviewed]');
  return lines.join('\n');
}

const FIXTURES = [
  { key: 'oneword_edge', src: 'flowchart LR\n  A[Start] -->|Reconciliation| B[End]' },
  { key: 'twoword_edge', src: 'flowchart LR\n  A[Start] -->|Quarterly reconciliation| B[End]' },
  { key: 'short_diamond', src: 'flowchart LR\n  A{Yes} --> B[End]' },
  { key: 'twoword_diamond', src: 'flowchart LR\n  A{Approved by finance?} --> B[End]' },
  { key: 'hex', src: 'flowchart LR\n  A{{Prepared}} --> B[End]' },
  { key: 'cyl_oneword', src: 'flowchart LR\n  A[(Ledger)] --> B[End]' },
  // The first engineer's own headline fixture, reproduced verbatim.
  { key: 'his_cyl2', src: 'flowchart LR\n  A[(Customer master database)] --> B[(General ledger extract)]' },
  { key: 'his_diamond_pill', src: 'flowchart LR\n  A{Approved by the finance manager?} --> B([Stadium pill caption here])' },
  { key: 'dense44_oneword', src: dense44oneword() }
];

async function realClick(page, sel) {
  const box = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);
  if (!box || box.w === 0) throw new Error('not clickable: ' + sel);
  await page.mouse.click(box.x, box.y);
}

async function exportOnce(page, fileName) {
  await realClick(page, '#exportButton');
  await page.waitForTimeout(600);
  const dlPromise = page.waitForEvent('download', { timeout: 120000 });
  dlPromise.catch(() => {});
  await realClick(page, '#exportPptxButton');
  const dl = await dlPromise;
  const target = path.join(TMP, fileName);
  await dl.saveAs(target);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  return fs.readFileSync(target);
}

(async () => {
  const tag = path.basename(path.dirname(APP));
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  const result = { app: APP, fixtures: {}, errors: [] };
  try {
    for (const fx of FIXTURES) {
      const rec = { key: fx.key };
      await lib.setSource(page, fx.src, 3800);
      rec.sourceEcho = await page.evaluate(`document.getElementById('source').value`);
      rec.sourceMatches = rec.sourceEcho === fx.src;
      if (!rec.sourceMatches) { result.fixtures[fx.key] = rec; continue; }
      try {
        const buf = await exportOnce(page, fx.key + '_' + tag + '.pptx');
        const zip = readZip(buf);
        const slide = zip['ppt/slides/slide1.xml'].toString('utf8');
        rec.slideBytes = slide.length;
        rec.shapes = parseSlideShapes(slide);
        const theme = zip['ppt/theme/theme1.xml'] ? zip['ppt/theme/theme1.xml'].toString('utf8') : '';
        const minor = /<a:minorFont><a:latin typeface="([^"]*)"/.exec(theme);
        rec.themeMinorFont = minor ? minor[1] : null;
      } catch (e) { rec.exportError = String(e && e.message || e).slice(0, 160); }
      rec.exportStatus = await page.evaluate(`(() => { const e = document.getElementById('exportStatus'); return e ? { text: e.textContent.trim().slice(0,180), state: e.getAttribute('data-state') } : null; })()`);
      result.fixtures[fx.key] = rec;
    }

    const jobs = [];
    Object.keys(result.fixtures).forEach(key => {
      const rec = result.fixtures[key];
      if (!rec.shapes) return;
      const font = rec.themeMinorFont || 'Calibri';
      rec.shapes.forEach((sh, i) => sh.paras.forEach((p, j) => {
        const text = p.runs.map(r => r.text).join('');
        if (!text) return;
        jobs.push({ key: key, i: i, j: j, text: text, pt: p.runs[0].sz / 100, font: font });
      }));
    });
    const widths = await page.evaluate(`((jobs) => {
      const c = document.createElement('canvas').getContext('2d');
      return jobs.map(j => {
        c.font = j.pt + 'px "' + j.font + '"';
        let longest = 0;
        j.text.split(' ').forEach(w => { longest = Math.max(longest, c.measureText(w).width); });
        return [c.measureText(j.text).width, longest];
      });
    })(${JSON.stringify(jobs)})`);
    jobs.forEach((j, n) => {
      const sh = result.fixtures[j.key].shapes[j.i];
      const boxPt = sh.cx / 12700, insetPt = (sh.lIns + sh.rIns) / 12700;
      const ss = Math.min(sh.cx, sh.cy) / 12700;
      let presetRectPt = boxPt;
      if (sh.prst === 'flowChartDecision') presetRectPt = boxPt / 2;
      else if (sh.prst === 'ellipse') presetRectPt = boxPt * 0.70711;
      else if (sh.prst === 'roundRect') presetRectPt = boxPt - 2 * 0.29289 * ((sh.adj === null ? 16667 : sh.adj) / 100000) * ss;
      else if (sh.prst === 'hexagon') presetRectPt = boxPt - 2 * ((sh.adj === null ? 25000 : sh.adj) / 100000) * ss;
      sh.paras[j.j].measured = {
        text: j.text.slice(0, 80), pt: j.pt,
        runWidthPt: Math.round(widths[n][0] * 100) / 100,
        longestWordPt: Math.round(widths[n][1] * 100) / 100,
        boxWidthPt: Math.round(boxPt * 100) / 100,
        availBoxPt: Math.round((boxPt - insetPt) * 100) / 100,
        availPresetPt: Math.round((presetRectPt - insetPt) * 100) / 100,
        overhangVsBoxPt: Math.round((widths[n][0] - (boxPt - insetPt)) * 100) / 100,
        wordOverVsPresetPt: Math.round((widths[n][1] - (presetRectPt - insetPt)) * 100) / 100
      };
    });
    result.errors = errors.slice(0, 20);
  } finally { await close(); }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
