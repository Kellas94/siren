/* Independent check of the shared-lineage risk: the Excel writer (ooxmlTextBody)
 * must be untouched by BF. Real clicks: #exportButton -> Data fold -> #exportXlsxButton.
 * Usage: node sk_xlsx_probe.js <appPath> <port> <outJson>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const lib = require('C:/Claude/SIREN/qa_exports/r7_lib.js');

const APP = process.argv[2], PORT = Number(process.argv[3]), OUT = process.argv[4];
const TMP = 'C:/Claude/SIREN/qa_exports/sk_tmp';
fs.mkdirSync(TMP, { recursive: true });

function readZip(buf) {
  const files = {};
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
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

async function realClick(page, sel) {
  const box = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width }; })()`);
  if (!box || box.w === 0) throw new Error('not clickable: ' + sel);
  await page.mouse.click(box.x, box.y);
}

const SRC = 'flowchart LR\n  A[(Customer master database reconciliation and general ledger posting summary prepared quarterly)] --> B{Approved?}';

(async () => {
  const tag = path.basename(path.dirname(APP));
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  const out = { app: APP, errors: [] };
  try {
    await lib.setSource(page, SRC, 3800);
    out.sourceMatches = (await page.evaluate(`document.getElementById('source').value`)) === SRC;
    await realClick(page, '#exportButton');
    await page.waitForTimeout(600);
    await page.evaluate(`(() => { const d = document.getElementById('exportDataGroup'); if (d) d.open = true; })()`);
    await page.waitForTimeout(300);
    const dl = page.waitForEvent('download', { timeout: 120000 });
    dl.catch(() => {});
    await realClick(page, '#exportXlsxButton');
    const d = await dl;
    const target = path.join(TMP, 'sheet_' + tag + '.xlsx');
    await d.saveAs(target);
    const zip = readZip(fs.readFileSync(target));
    const d1 = zip['xl/drawings/drawing1.xml'];
    out.entries = Object.keys(zip).sort();
    out.drawing1Bytes = d1 ? d1.length : null;
    out.drawing1Sha = d1 ? crypto.createHash('sha256').update(d1).digest('hex') : null;
    out.bodyPrs = d1 ? (d1.toString('utf8').match(/<a:bodyPr [^>]*\/>/g) || []) : null;
    out.texts = d1 ? (d1.toString('utf8').match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map(t => t.replace(/<[^>]*>/g, '')) : null;
    fs.writeFileSync(path.join(TMP, 'drawing1_' + tag + '.xml'), d1);
    out.errors = errors.slice(0, 20);
  } finally { await close(); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
