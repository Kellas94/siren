/* JOB BF probe 2 - the sideways cases and the two anomalies probe 1 turned up.
 * Usage: node bf_probe2.js <appPath> <port> <outJson>
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
    out.push({
      name: nv ? attr(nv[0], 'name') : null,
      cx: ext ? Number(ext[1]) : null, cy: ext ? Number(ext[2]) : null,
      prst: attr(sp, 'prst'), txBox: /txBox="1"/.test(sp),
      wrap: attr(body[0], 'wrap'),
      vertOverflow: attr(body[0], 'vertOverflow'), horzOverflow: attr(body[0], 'horzOverflow'),
      lIns: Number(attr(body[0], 'lIns')), rIns: Number(attr(body[0], 'rIns')),
      tIns: Number(attr(body[0], 'tIns')), bIns: Number(attr(body[0], 'bIns')),
      paras
    });
  }
  return out;
}

function denseLongWord() {
  const lines = ['flowchart TD'];
  for (let i = 1; i < 44; i++) {
    lines.push('  N' + i + '[Control activity ' + i + ' reviewed] -->|Reconciliation' + i + '| N' + (i + 1) + '[Control activity ' + (i + 1) + ' reviewed]');
  }
  return lines.join('\n');
}

const FIXTURES = [
  { key: 'dense44_longword', src: denseLongWord() },
  { key: 'shortword_edge', src: 'flowchart LR\n  A[Alpha block] -->|Reconciliation| B[Beta block]' },
  { key: 'manualbreak', src: 'flowchart LR\n  A[("Ledger line one<br/>ledger line two")] --> B[(Plain cylinder)]' },
  { key: 'emptyspace', src: 'flowchart LR\n  A[(" ")] --> B[(Beta)]' }
];

async function realClick(page, sel) {
  const box = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; })()`);
  if (!box || !box.w) throw new Error('not clickable: ' + sel);
  await page.mouse.click(box.x, box.y);
}

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  const result = { app: APP, fixtures: {}, errors: [] };
  try {
    for (const fx of FIXTURES) {
      const rec = { key: fx.key };
      await lib.setSource(page, fx.src, 3500);
      rec.sourceMatches = (await page.evaluate(`document.getElementById('source').value`)) === fx.src;
      rec.svgNodeDump = await page.evaluate(`(() => {
        const svg = document.querySelector('#diagram svg');
        if (!svg) return null;
        return Array.from(svg.querySelectorAll('g.node, [data-node-id]')).map(g => ({
          id: g.getAttribute('id') || g.getAttribute('data-node-id'),
          cls: g.getAttribute('class'),
          text: (g.textContent || '').trim().slice(0, 60)
        }));
      })()`);
      await realClick(page, '#exportButton');
      await page.waitForTimeout(600);
      let dl = null, dlErr = null;
      const dlPromise = page.waitForEvent('download', { timeout: 45000 }).catch(e => { dlErr = String(e.message).slice(0, 90); return null; });
      await realClick(page, '#exportPptxButton');
      dl = await dlPromise;
      rec.exportStatus = await page.evaluate(`(() => { const e = document.getElementById('exportStatus'); return e ? { text: e.textContent.slice(0,300), state: e.dataset.state || null } : null; })()`);
      rec.toasts = await page.evaluate(`Array.from(document.querySelectorAll('.toast, [class*="toast"]')).map(t => t.textContent.trim().slice(0,200)).filter(Boolean)`);
      if (dl) {
        const target = path.join(TMP, TAG + '_' + fx.key + '.pptx');
        await dl.saveAs(target);
        const zip = readZip(fs.readFileSync(target));
        const slide = zip['ppt/slides/slide1.xml'].toString('utf8');
        fs.writeFileSync(path.join(TMP, TAG + '_' + fx.key + '_slide1.xml'), slide);
        rec.slideBytes = slide.length;
        rec.hasPicture = /<p:pic>/.test(slide);
        rec.shapes = parseSlideShapes(slide);
      } else {
        rec.downloadFailed = dlErr;
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      result.fixtures[fx.key] = rec;
    }

    /* line-breaking simulation for every shape, in the page with the theme font */
    const jobs = [];
    for (const k of Object.keys(result.fixtures)) {
      const rec = result.fixtures[k];
      if (!rec.shapes) continue;
      rec.shapes.forEach((sh, i) => sh.paras.forEach((p, j) => {
        const text = p.runs.map(r => r.text).join('');
        if (!text) return;
        jobs.push({ k, i, j, text, pt: p.runs[0].sz / 100 });
      }));
    }
    const measured = await page.evaluate(`((jobs) => {
      const c = document.createElement('canvas').getContext('2d');
      return jobs.map(j => {
        c.font = j.pt + 'px "Arial"';
        const words = j.text.split(' ');
        return {
          full: c.measureText(j.text).width,
          longestWord: Math.max.apply(null, words.map(w => c.measureText(w).width)),
          wordWidths: words.map(w => c.measureText(w).width),
          spaceW: c.measureText(' ').width
        };
      });
    })(${JSON.stringify(jobs)})`);
    jobs.forEach((j, n) => {
      const sh = result.fixtures[j.k].shapes[j.i];
      const boxPt = sh.cx / 12700;
      const avail = boxPt - (sh.lIns + sh.rIns) / 12700;
      const mm = measured[n];
      // greedy word wrap at `avail`
      let lines = 1, cur = 0;
      mm.wordWidths.forEach((w, idx) => {
        if (idx === 0) { cur = w; return; }
        if (cur + mm.spaceW + w <= avail) cur += mm.spaceW + w;
        else { lines += 1; cur = w; }
      });
      sh.paras[j.j].calc = {
        text: j.text, pt: j.pt,
        boxWidthPt: +boxPt.toFixed(2), availPt: +avail.toFixed(2),
        fullRunPt: +mm.full.toFixed(2),
        longestWordPt: +mm.longestWord.toFixed(2),
        overhangVsBoxPt: +(mm.full - boxPt).toFixed(2),
        overhangVsAvailPt: +(mm.full - avail).toFixed(2),
        wrapLinesIfSquare: lines,
        wordLongerThanAvail: mm.longestWord > avail,
        boxHeightPt: +(sh.cy / 12700).toFixed(2),
        textHeightIfWrappedPt: +(lines * 1.2 * j.pt).toFixed(2)
      };
    });
    result.errors = errors.slice(0, 20);
  } finally { await close(); }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
