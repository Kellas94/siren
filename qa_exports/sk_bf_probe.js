/* SKEPTIC probe for JOB BF.  Independent of bf_probe*.js.
 *
 * What it adds over the first engineer's suite:
 *   - LONG labels that Mermaid visually wraps in the SVG (the case his five short
 *     two-node fixtures never reached), measured as visual line count in the SVG
 *     via Range.getClientRects() as well as via the exported <a:p> count.
 *   - The overhang is computed BOTH ways: against the shape's own xfrm width and
 *     against the width the SVG actually drew the label at.
 *   - A rect control that should be byte-identical between the builds.
 *
 * Usage: node sk_bf_probe.js <appPath> <port> <outJson>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const lib = require('C:/Claude/SIREN/qa_exports/r7_lib.js');

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const OUT = process.argv[4];
const ONLY = process.argv[5] ? process.argv[5].split(',') : null;
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
      id: nv ? attr(nv[0], 'id') : null,
      name: nv ? attr(nv[0], 'name') : null,
      cx: ext ? Number(ext[1]) : null,
      cy: ext ? Number(ext[2]) : null,
      prst: attr(sp, 'prst'),
      adj: adj ? Number(adj[1]) : null,
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

function dense44() {
  const lines = ['flowchart TD'];
  for (let i = 1; i < 44; i++) {
    lines.push('  N' + i + '[Control activity ' + i + ' reviewed] -->|step ' + i + ' evidence| N' + (i + 1) + '[Control activity ' + (i + 1) + ' reviewed]');
  }
  return lines.join('\n');
}

const LONG = 'Customer master database reconciliation and general ledger posting summary prepared quarterly';

const FIXTURES = [
  // THE CASE HIS SUITE NEVER REACHED: a label long enough that Mermaid wraps it.
  { key: 'long_cyl', src: 'flowchart LR\n  A[(' + LONG + ')] --> B[(Short)]' },
  { key: 'long_diamond', src: 'flowchart LR\n  A{' + LONG + '} --> B[End]' },
  { key: 'long_pill', src: 'flowchart LR\n  A([' + LONG + ']) --> B[End]' },
  // Control: the same long label in a plain rect. Rect already wrapped on BASE.
  { key: 'long_rect', src: 'flowchart LR\n  A[' + LONG + '] --> B[End]' },
  // Reproduce his HIGH finding.
  { key: 'approved_diamond', src: 'flowchart LR\n  A{Approved?} --> B[End]' },
  { key: 'ellipse_balance', src: 'flowchart LR\n  A((Balance)) --> B[End]' },
  // Long single-word, no break opportunity, in a diamond.
  { key: 'longword_diamond', src: 'flowchart LR\n  A{Unreconcilableintercompanybalance} --> B[End]' },
  // A long EDGE caption on a two-node fixture.
  { key: 'long_edge', src: 'flowchart LR\n  A[Start] -->|"' + LONG + '"| B[End]' },
  // His guard case.
  { key: 'multiline_edge', src: 'flowchart LR\n  A[Start] -->|"Approved by<br/>the finance manager"| B[End]' },
  // His dense fixture verbatim.
  { key: 'dense44', src: dense44() },
  // <br/> in a node label - his "pre-existing, does not render" claim.
  { key: 'br_node', src: 'flowchart LR\n  A["Line one<br/>line two"] --> B[End]' },
  // ONE STEP SIDEWAYS: a different diagram type entirely.
  { key: 'state', src: 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> UnderPartnerReview: submitted for signoff\n  UnderPartnerReview --> [*]' },
  // Subgraph title, long.
  { key: 'subgraph_long', src: 'flowchart TD\n  subgraph SG["Revenue cycle controls group for the consolidated entity"]\n    A[(Invoice register)] --> B[(Cash receipts)]\n  end' }
];

async function realClick(page, sel) {
  const box = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);
  if (!box || box.w === 0) throw new Error('not clickable: ' + sel + ' ' + JSON.stringify(box));
  await page.mouse.click(box.x, box.y);
}

async function exportOnce(page, buttonSel, fileName) {
  await realClick(page, '#exportButton');
  await page.waitForTimeout(600);
  const dlPromise = page.waitForEvent('download', { timeout: 120000 });
  await realClick(page, buttonSel);
  const dl = await dlPromise;
  const target = path.join(TMP, fileName);
  await dl.saveAs(target);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  return fs.readFileSync(target);
}

/* Visual truth in the SVG: for every node label, how many lines did the browser
   actually paint, how wide is the painted label, and how wide is the node box. */
const SVG_FACTS = `(() => {
  const svg = document.querySelector('#diagram svg');
  if (!svg) return null;
  const out = [];
  const groups = Array.from(svg.querySelectorAll('g.node, [data-node-id]'));
  groups.forEach(g => {
    const label = g.querySelector('.nodeLabel') || g.querySelector('foreignObject') || g.querySelector('text');
    if (!label) return;
    let visualLines = 0, labelW = 0;
    try {
      const r = document.createRange();
      r.selectNodeContents(label);
      const rects = Array.from(r.getClientRects()).filter(x => x.width > 0.5 && x.height > 0.5);
      visualLines = rects.length;
      labelW = rects.reduce((a, x) => Math.max(a, x.width), 0);
    } catch (e) {}
    const gb = g.getBoundingClientRect();
    const cs = getComputedStyle(label);
    out.push({
      id: g.getAttribute('id') || g.getAttribute('data-node-id'),
      text: String(label.textContent || '').replace(/\\s+/g, ' ').trim(),
      visualLines: visualLines,
      widestPaintedLinePx: Math.round(labelW * 100) / 100,
      nodeBoxPx: Math.round(gb.width * 100) / 100,
      fontFamily: cs.fontFamily,
      fontSizePx: cs.fontSize,
      pTagCount: label.querySelectorAll ? label.querySelectorAll('p').length : 0,
      tspanCount: label.querySelectorAll ? label.querySelectorAll('tspan').length : 0
    });
  });
  const edges = [];
  Array.from(svg.querySelectorAll('g.edgeLabel')).forEach(n => {
    const t = String(n.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!t) return;
    const b = n.getBoundingClientRect();
    edges.push({ text: t, w: Math.round(b.width * 100) / 100, h: Math.round(b.height * 100) / 100 });
  });
  return { nodes: out, edges: edges };
})()`;

(async () => {
  const label = path.basename(path.dirname(APP)) + '/' + path.basename(APP);
  const { page, errors, close } = await lib.openApp(APP, PORT, { width: 1440, height: 900 });
  const result = { label: label, app: APP, fixtures: {}, errors: [] };
  try {
    for (const fx of FIXTURES) {
      if (ONLY && ONLY.indexOf(fx.key) < 0) continue;
      const rec = { key: fx.key };
      await lib.setSource(page, fx.src, 3800);
      rec.sourceEcho = await page.evaluate(`document.getElementById('source').value`);
      rec.sourceMatches = rec.sourceEcho === fx.src;
      if (!rec.sourceMatches) { result.fixtures[fx.key] = rec; continue; }
      rec.svg = await page.evaluate(SVG_FACTS);
      try {
        const buf = await exportOnce(page, '#exportPptxButton', fx.key + '_' + path.basename(path.dirname(APP)) + '.pptx');
        const zip = readZip(buf);
        const slide = zip['ppt/slides/slide1.xml'].toString('utf8');
        fs.writeFileSync(path.join(TMP, fx.key + '_' + path.basename(path.dirname(APP)) + '_slide1.xml'), slide);
        rec.slideBytes = slide.length;
        rec.shapes = parseSlideShapes(slide);
        rec.hasPicture = /<p:pic>/.test(slide);
        const theme = zip['ppt/theme/theme1.xml'] ? zip['ppt/theme/theme1.xml'].toString('utf8') : '';
        const minor = /<a:minorFont><a:latin typeface="([^"]*)"/.exec(theme);
        rec.themeMinorFont = minor ? minor[1] : null;
      } catch (e) {
        rec.exportError = String(e && e.message || e);
      }
      rec.exportStatus = await page.evaluate(`(() => { const e = document.getElementById('exportStatus'); return e ? { text: e.textContent.trim().slice(0,160), state: e.getAttribute('data-state') } : null; })()`);
      result.fixtures[fx.key] = rec;
    }

    /* Arial run widths, measured in the page. */
    const jobs = [];
    Object.keys(result.fixtures).forEach(key => {
      const rec = result.fixtures[key];
      if (!rec.shapes) return;
      const font = rec.themeMinorFont || 'Calibri';
      rec.shapes.forEach((sh, i) => {
        sh.paras.forEach((p, j) => {
          const text = p.runs.map(r => r.text).join('');
          if (!text) return;
          jobs.push({ key: key, i: i, j: j, text: text, pt: p.runs[0].sz / 100, font: font });
        });
      });
    });
    const widths = await page.evaluate(`((jobs) => {
      const c = document.createElement('canvas').getContext('2d');
      return jobs.map(j => {
        c.font = j.pt + 'px "' + j.font + '"';
        const full = c.measureText(j.text).width;
        let longest = 0;
        j.text.split(' ').forEach(w => { longest = Math.max(longest, c.measureText(w).width); });
        return [full, longest];
      });
    })(${JSON.stringify(jobs)})`);
    jobs.forEach((j, n) => {
      const sh = result.fixtures[j.key].shapes[j.i];
      const boxPt = sh.cx / 12700;
      const insetPt = (sh.lIns + sh.rIns) / 12700;
      const ss = Math.min(sh.cx, sh.cy) / 12700;
      let presetRectPt = boxPt;
      if (sh.prst === 'flowChartDecision') presetRectPt = boxPt / 2;
      else if (sh.prst === 'ellipse') presetRectPt = boxPt * 0.70711;
      else if (sh.prst === 'roundRect') presetRectPt = boxPt - 2 * 0.29289 * ((sh.adj === null ? 16667 : sh.adj) / 100000) * ss;
      else if (sh.prst === 'hexagon') presetRectPt = boxPt - 2 * ((sh.adj === null ? 25000 : sh.adj) / 100000) * ss;
      const availBox = boxPt - insetPt;
      const availPreset = presetRectPt - insetPt;
      sh.paras[j.j].measured = {
        text: j.text.slice(0, 120), pt: j.pt,
        runWidthPt: Math.round(widths[n][0] * 100) / 100,
        longestWordPt: Math.round(widths[n][1] * 100) / 100,
        boxWidthPt: Math.round(boxPt * 100) / 100,
        boxHeightPt: Math.round(sh.cy / 12700 * 100) / 100,
        availBoxPt: Math.round(availBox * 100) / 100,
        availPresetPt: Math.round(availPreset * 100) / 100,
        overhangVsBoxPt: Math.round((widths[n][0] - availBox) * 100) / 100,
        overhangVsPresetPt: Math.round((widths[n][0] - availPreset) * 100) / 100,
        wordOverhangVsPresetPt: Math.round((widths[n][1] - availPreset) * 100) / 100
      };
    });

    result.errors = errors.slice(0, 20);
  } finally {
    await close();
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
