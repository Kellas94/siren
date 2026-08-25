/* JOB BF verification probe.
 * Drives the REAL export UI (mouse clicks on #exportButton then #exportPptxButton),
 * catches the browser download, unzips the OOXML and measures wrap / overflow /
 * emitted point size / run width against the shape's own xfrm width.
 *
 * Usage: node bf_probe.js <appPath> <port> <outJson>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const lib = require('C:/Claude/SIREN/qa_exports/r7_lib.js');

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const OUT = process.argv[4];
const TMP = 'C:/Claude/SIREN/qa_exports/bf_tmp';
fs.mkdirSync(TMP, { recursive: true });

/* ---------- minimal zip reader (no deps) ---------- */
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
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad CD sig at ' + p);
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

/* ---------- OOXML shape parsing ---------- */
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
      const empty = /<a:endParaRPr [^>]*\/>/.exec(pm[0]);
      paras.push({ runs, emptySz: empty ? Number(attr(empty[0], 'sz')) : null });
    }
    out.push({
      id: nv ? attr(nv[0], 'id') : null,
      name: nv ? attr(nv[0], 'name') : null,
      cx: ext ? Number(ext[1]) : null,
      cy: ext ? Number(ext[2]) : null,
      prst: attr(sp, 'prst'),
      txBox: /txBox="1"/.test(sp),
      wrap: attr(body[0], 'wrap'),
      vertOverflow: attr(body[0], 'vertOverflow'),
      horzOverflow: attr(body[0], 'horzOverflow'),
      lIns: Number(attr(body[0], 'lIns')),
      rIns: Number(attr(body[0], 'rIns')),
      paras
    });
  }
  return out;
}

function parseXlsxShapes(xml) {
  const out = [];
  const spRe = /<xdr:sp[\s\S]*?<\/xdr:sp>/g;
  let m;
  while ((m = spRe.exec(xml))) {
    const sp = m[0];
    const body = /<a:bodyPr [^>]*\/>/.exec(sp);
    const nv = /<xdr:cNvPr [^>]*\/>/.exec(sp);
    const texts = [];
    const tRe = /<a:t>([\s\S]*?)<\/a:t>/g;
    let tm;
    while ((tm = tRe.exec(sp))) texts.push(tm[1]);
    out.push({
      name: nv ? attr(nv[0], 'name') : null,
      prst: attr(sp, 'prst'),
      wrap: body ? attr(body[0], 'wrap') : null,
      vertOverflow: body ? attr(body[0], 'vertOverflow') : null,
      horzOverflow: body ? attr(body[0], 'horzOverflow') : null,
      texts
    });
  }
  return out;
}

/* ---------- fixtures ---------- */
function dense44() {
  const lines = ['flowchart TD'];
  for (let i = 1; i < 44; i++) {
    lines.push('  N' + i + '[Control activity ' + i + ' reviewed] -->|step ' + i + ' evidence| N' + (i + 1) + '[Control activity ' + (i + 1) + ' reviewed]');
  }
  return lines.join('\n');
}

const FIXTURES = [
  { key: 'cyl2', src: 'flowchart LR\n  A[(Customer master database)] --> B[(General ledger extract)]' },
  { key: 'dense44', src: dense44() },
  { key: 'multiline_edge', src: 'flowchart LR\n  A[Start] -->|"Approved by<br/>the finance manager"| B[End]' },
  { key: 'longword', src: 'flowchart LR\n  A[(Supercalifragilisticexpialidociousreconciliation)] -->|Unbreakableedgecaptionwordxyzq| B[(Short)]' },
  { key: 'manualbreak', src: 'flowchart LR\n  A[("Ledger line one<br/>ledger line two")] --> B[(Plain cylinder)]' },
  { key: 'emptylabel', src: 'flowchart LR\n  A[(" ")] --> B[(Beta)]' },
  { key: 'romanian', src: 'flowchart LR\n  A[(Situație financiară consolidată)] -->|"verificări încrucișate"| B[(Închidere lunară țărănească)]' },
  { key: 'diamond_pill', src: 'flowchart LR\n  A{Approved by the finance manager?} --> B([Stadium pill caption here])' },
  { key: 'subgraph', src: 'flowchart TD\n  subgraph SG[Revenue cycle controls group]\n    A[(Invoice register)] --> B[(Cash receipts)]\n  end' }
];

/* ---------- driving ---------- */
async function realClick(page, sel) {
  const box = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);
  if (!box || box.w === 0) throw new Error('not clickable: ' + sel + ' ' + JSON.stringify(box));
  await page.mouse.click(box.x, box.y);
}

async function exportOnce(page, buttonSel, fileName, preOpen) {
  await realClick(page, '#exportButton');
  await page.waitForTimeout(600);
  if (preOpen) await page.evaluate(`(() => { const d = document.getElementById(${JSON.stringify(preOpen)}); if (d) d.open = true; })()`);
  await page.waitForTimeout(200);
  const dlPromise = page.waitForEvent('download', { timeout: 120000 });
  await realClick(page, buttonSel);
  const dl = await dlPromise;
  const target = path.join(TMP, fileName);
  await dl.saveAs(target);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  return fs.readFileSync(target);
}

(async () => {
  const label = path.basename(path.dirname(APP)) + '/' + path.basename(APP);
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  const result = { label, app: APP, fixtures: {}, errors: [] };
  try {
    for (const fx of FIXTURES) {
      const rec = { key: fx.key };
      await lib.setSource(page, fx.src, 3500);
      rec.sourceEcho = await page.evaluate(`document.getElementById('source').value`);
      rec.sourceMatches = rec.sourceEcho === fx.src;
      rec.svgNodes = await page.evaluate(`document.querySelectorAll('#diagram svg g.node, #diagram svg [data-node-id]').length`);
      rec.renderError = await page.evaluate(`(() => { const e = document.querySelector('#diagram .render-error, #diagram .error'); return e ? e.textContent.slice(0,120) : null; })()`);
      try {
        const buf = await exportOnce(page, '#exportPptxButton', fx.key + '.pptx');
        const zip = readZip(buf);
        const slide = zip['ppt/slides/slide1.xml'].toString('utf8');
        rec.slideBytes = slide.length;
        rec.shapes = parseSlideShapes(slide);
        const theme = zip['ppt/theme/theme1.xml'] ? zip['ppt/theme/theme1.xml'].toString('utf8') : '';
        const minor = /<a:minorFont><a:latin typeface="([^"]*)"/.exec(theme);
        const major = /<a:majorFont><a:latin typeface="([^"]*)"/.exec(theme);
        rec.themeMinorFont = minor ? minor[1] : null;
        rec.themeMajorFont = major ? major[1] : null;
        rec.hasPicture = /<p:pic>/.test(slide);
      } catch (e) {
        rec.exportError = String(e && e.message || e);
      }
      result.fixtures[fx.key] = rec;
    }

    /* Excel: same cylinder fixture, byte-compare drawing1.xml */
    await lib.setSource(page, FIXTURES[0].src, 3500);
    try {
      const buf = await exportOnce(page, '#exportXlsxButton', 'cyl2.xlsx', 'exportDataGroup');
      const zip = readZip(buf);
      const names = Object.keys(zip).sort();
      const d1 = zip['xl/drawings/drawing1.xml'];
      result.xlsx = {
        entries: names,
        drawing1Bytes: d1 ? d1.length : null,
        drawing1Sha: d1 ? require('crypto').createHash('sha256').update(d1).digest('hex') : null,
        drawing1Text: d1 ? d1.toString('utf8') : null,
        shapes: d1 ? parseXlsxShapes(d1.toString('utf8')) : null
      };
      fs.writeFileSync(path.join(TMP, path.basename(path.dirname(APP)) + '_drawing1.xml'), d1);
    } catch (e) {
      result.xlsx = { error: String(e && e.message || e) };
    }

    /* text width measurement, done in the page with the real theme font */
    const jobs = [];
    for (const key of Object.keys(result.fixtures)) {
      const rec = result.fixtures[key];
      if (!rec.shapes) continue;
      const font = rec.themeMinorFont || 'Calibri';
      rec.shapes.forEach((sh, i) => {
        sh.paras.forEach((p, j) => {
          const text = p.runs.map(r => r.text).join('');
          if (!text) return;
          const pt = p.runs[0].sz / 100;
          jobs.push({ key, i, j, text, pt, font });
        });
      });
    }
    const widths = await page.evaluate(`((jobs) => {
      const c = document.createElement('canvas').getContext('2d');
      return jobs.map(j => {
        c.font = j.pt + 'px "' + j.font + '"';
        return c.measureText(j.text).width;
      });
    })(${JSON.stringify(jobs)})`);
    jobs.forEach((j, n) => {
      const sh = result.fixtures[j.key].shapes[j.i];
      const boxPt = sh.cx / 12700;
      const insetPt = (sh.lIns + sh.rIns) / 12700;
      const avail = boxPt - insetPt;
      const w = widths[n];
      sh.paras[j.j].measured = {
        text: j.text, pt: j.pt, font: j.font,
        runWidthPt: Math.round(w * 100) / 100,
        boxWidthPt: Math.round(boxPt * 100) / 100,
        availablePt: Math.round(avail * 100) / 100,
        overhangPt: Math.round((w - avail) * 100) / 100,
        hasBreakOpportunity: /[\s\-\u2013\u2014\/]/.test(j.text)
      };
    });

    result.errors = errors.slice(0, 20);
  } finally {
    await close();
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
