/* SKEPTIC probe 3: how far down the size range does the one-word-caption
 * regression actually reach? Graded density, one-word edge captions.
 * Usage: node sk_bf_probe3.js <appPath> <port> <outJson>
 */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const lib = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), OUT = process.argv[4];
const TMP = 'C:/Claude/SIREN/qa_exports/sk_tmp'; fs.mkdirSync(TMP, { recursive: true });

function readZip(buf) {
  const files = {}; let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  const count = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
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
function parseSlideShapes(xml) {
  const out = []; const spRe = /<p:sp>[\s\S]*?<\/p:sp>/g; let m;
  while ((m = spRe.exec(xml))) {
    const sp = m[0]; const nv = /<p:cNvPr [^>]*\/>/.exec(sp);
    const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(sp); const body = /<a:bodyPr [^>]*\/>/.exec(sp);
    if (!body) continue;
    const paras = []; const pRe = /<a:p>[\s\S]*?<\/a:p>/g; let pm;
    while ((pm = pRe.exec(sp))) {
      const runs = []; const rRe = /<a:r>[\s\S]*?<\/a:r>/g; let rm;
      while ((rm = rRe.exec(pm[0]))) { const t = /<a:t>([\s\S]*?)<\/a:t>/.exec(rm[0]); runs.push({ sz: Number(attr(rm[0], 'sz')), text: t ? t[1] : '' }); }
      paras.push({ runs });
    }
    out.push({ name: nv ? attr(nv[0], 'name') : null, cx: ext ? Number(ext[1]) : null, cy: ext ? Number(ext[2]) : null,
      prst: attr(sp, 'prst'), txBox: /txBox="1"/.test(sp), wrap: attr(body[0], 'wrap'),
      lIns: Number(attr(body[0], 'lIns')), rIns: Number(attr(body[0], 'rIns')), paras });
  }
  return out;
}
function chain(n) {
  const lines = ['flowchart TD'];
  for (let i = 1; i < n; i++) lines.push('  N' + i + '[Control activity ' + i + ' reviewed] -->|Reconciliation' + i + '| N' + (i + 1) + '[Control activity ' + (i + 1) + ' reviewed]');
  return lines.join('\n');
}
const FIXTURES = [4, 8, 12, 16, 24, 32].map(n => ({ key: 'chain' + n, src: chain(n) }));

async function realClick(page, sel) {
  const box = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width }; })()`);
  if (!box || box.w === 0) throw new Error('not clickable: ' + sel);
  await page.mouse.click(box.x, box.y);
}
(async () => {
  const tag = path.basename(path.dirname(APP));
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  const result = { app: APP, rows: [], errors: [] };
  try {
    for (const fx of FIXTURES) {
      await lib.setSource(page, fx.src, 3500);
      const ok = (await page.evaluate(`document.getElementById('source').value`)) === fx.src;
      const row = { key: fx.key, sourceMatches: ok };
      if (ok) {
        try {
          await realClick(page, '#exportButton'); await page.waitForTimeout(600);
          const dl = page.waitForEvent('download', { timeout: 120000 }); dl.catch(() => {});
          await realClick(page, '#exportPptxButton');
          const d = await dl; const t = path.join(TMP, fx.key + '_' + tag + '.pptx'); await d.saveAs(t);
          await page.keyboard.press('Escape'); await page.waitForTimeout(400);
          const zip = readZip(fs.readFileSync(t));
          const slide = zip['ppt/slides/slide1.xml'].toString('utf8');
          row.shapes = parseSlideShapes(slide).filter(s => s.txBox && s.paras.length === 1 && s.paras[0].runs.length);
          row.nonTxBoxWraps = [...new Set(parseSlideShapes(slide).filter(s => !s.txBox).map(s => s.wrap))];
        } catch (e) { row.error = String(e && e.message || e).slice(0, 120); }
      }
      result.rows.push(row);
    }
    const jobs = [];
    result.rows.forEach((row, ri) => (row.shapes || []).forEach((sh, i) => {
      const text = sh.paras[0].runs.map(r => r.text).join('');
      if (text) jobs.push({ ri: ri, i: i, text: text, pt: sh.paras[0].runs[0].sz / 100 });
    }));
    const widths = await page.evaluate(`((jobs) => { const c = document.createElement('canvas').getContext('2d');
      return jobs.map(j => { c.font = j.pt + 'px "Arial"'; return c.measureText(j.text).width; }); })(${JSON.stringify(jobs)})`);
    jobs.forEach((j, n) => {
      const sh = result.rows[j.ri].shapes[j.i];
      const boxPt = sh.cx / 12700, avail = boxPt - (sh.lIns + sh.rIns) / 12700;
      sh.m = { text: j.text, pt: j.pt, run: Math.round(widths[n] * 100) / 100, box: Math.round(boxPt * 100) / 100,
        avail: Math.round(avail * 100) / 100, over: Math.round((widths[n] - avail) * 100) / 100 };
    });
    result.errors = errors.slice(0, 10);
  } finally { await close(); }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
