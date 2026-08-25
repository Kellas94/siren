/* JOB BF probe 4 - multi-line NODE labels reached by auto-wrap (the <br/> route does not
 * render on either build), the <br/> characterisation, and the DECK route via the Map plane.
 * Usage: node bf_probe4.js <appPath> <port> <outJson>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const lib = require('C:/Claude/SIREN/qa_exports/r7_lib.js');

const APP = process.argv[2], PORT = Number(process.argv[3]), OUT = process.argv[4];
const TAG = path.basename(path.dirname(APP));
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
    out.push({ name: nv ? attr(nv[0], 'id') + ':' + attr(nv[0], 'name') : null,
      cx: ext ? Number(ext[1]) : null, cy: ext ? Number(ext[2]) : null,
      prst: attr(sp, 'prst'), txBox: /txBox="1"/.test(sp), wrap: attr(body[0], 'wrap'), paras });
  }
  return out;
}

const FIXTURES = [
  { key: 'tiny_diamond', src: ['flowchart LR', '  A{Approved?} --> B[End]'].join(String.fromCharCode(10)) },
  { key: 'tiny_pill', src: ['flowchart LR', '  A([Reconciled]) --> B[End]'].join(String.fromCharCode(10)) },
  { key: 'tiny_cyl', src: ['flowchart LR', '  A[(Ledger)] --> B[End]'].join(String.fromCharCode(10)) },
  { key: 'tiny_circle', src: ['flowchart LR', '  A((Balance)) --> B[End]'].join(String.fromCharCode(10)) },
  { key: 'tiny_hex', src: ['flowchart LR', '  A{{Threshold}} --> B[End]'].join(String.fromCharCode(10)) },
  { key: 'tiny_edge', src: ['flowchart LR', '  A[Alpha] -->|Reconciliation| B[Beta]'].join(String.fromCharCode(10)) }
];

async function realClick(page, sel) {
  const box = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; })()`);
  if (!box || !box.w) throw new Error('not clickable: ' + sel);
  await page.mouse.click(box.x, box.y);
}
async function clickByText(page, re) {
  const box = await page.evaluate(`(() => {
    const rx = new RegExp(${JSON.stringify(re)});
    const nodes = Array.from(document.querySelectorAll('button, [role="option"], li, div, span'));
    const hit = nodes.filter(n => rx.test((n.textContent || '').trim()) && n.children.length === 0 && n.getBoundingClientRect().width > 0)
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: (hit.textContent || '').trim().slice(0, 60) };
  })()`);
  if (!box) return null;
  await page.mouse.click(box.x, box.y);
  return box.label;
}

(async () => {
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  const result = { app: APP, fixtures: {}, deck: {}, errors: [] };
  try {
    for (const fx of FIXTURES) {
      const rec = { key: fx.key };
      await lib.setSource(page, fx.src, 3500);
      rec.svgLabels = await page.evaluate(`(() => {
        const svg = document.querySelector('#diagram svg');
        return svg ? Array.from(svg.querySelectorAll('g.node')).map(g => ({
          text: (g.textContent||'').trim().slice(0,90),
          tspans: g.querySelectorAll('tspan').length,
          divs: g.querySelectorAll('foreignObject div, foreignObject p, foreignObject span').length
        })) : null; })()`);
      await realClick(page, '#exportButton');
      await page.waitForTimeout(500);
      let failed = null;
      const p = page.waitForEvent('download', { timeout: 40000 }).catch(() => { failed = 'timeout'; return null; });
      await realClick(page, '#exportPptxButton');
      const dl = await p;
      rec.exportStatus = await page.evaluate(`document.getElementById('exportStatus')?.textContent.slice(0,160)`);
      if (dl) {
        const t = path.join(TMP, TAG + '_' + fx.key + '.pptx');
        await dl.saveAs(t);
        rec.shapes = parseSlideShapes(readZip(fs.readFileSync(t))['ppt/slides/slide1.xml'].toString('utf8'));
      } else rec.downloadFailed = failed;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      result.fixtures[fx.key] = rec;
    }

    result.deck = { skipped: true };
    result.errors = errors.slice(0, 20);
  } finally { await close(); }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
