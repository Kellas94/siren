#!/usr/bin/env node
/*
 * Export fidelity gate.
 *
 * Why this exists: the diagram PDF export shipped as a raster image for months, and three diagram
 * types shipped as a flat picture in PowerPoint, under a changelog promising editable shapes.
 * Every existing check passed the whole time, because a raster PDF is a perfectly valid PDF and a
 * one-picture PPTX is a perfectly valid PPTX. Structural validity was measured; *kind* was not.
 *
 * This gate asks the question that was missing: is the thing inside the file the thing we promised?
 *
 * Usage:
 *   node run_export_fidelity.js --app <path-to-siren.html> [--port 9931] [--output <dir>]
 *
 * Exit code 0 only if every assertion passes.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const { createRequire } = require('module');

const PW = 'file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/';
const { chromium } = createRequire(PW)('playwright');

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const APP = arg('app');
const PORT = Number(arg('port', '9931'));
const OUTDIR = arg('output', path.join(process.cwd(), 'export_fidelity_out'));
if (!APP || !fs.existsSync(APP)) {
  console.error('--app must point at an existing SIREN html file');
  process.exit(2);
}
fs.mkdirSync(OUTDIR, { recursive: true });

// ---------------------------------------------------------------- fixtures
// Romanian diacritics are in every label on purpose: they are the owner's working language and
// the thing most likely to survive as pixels rather than characters.
const DIACRITICS = ['Ședință', 'Înțelegerea', 'semnificație', 'Excepții'];
const TITLE = 'Ciclul de audit — misiunea FY26';

const TYPES = {
  flowchart: 'flowchart TD\n  A["Ședință de deschidere"] --> B["Înțelegerea proceselor"]\n  B --> C{"Excepții semnificație?"}\n  C -->|Da| D["Escaladare"]\n  C -->|Nu| E["Raportare"]',
  mindmap:   'mindmap\n  root(("Ședință"))\n    Înțelegerea\n      semnificație\n    Excepții',
  pie:       'pie showData\n  "Ședință" : 42\n  "Înțelegerea" : 17\n  "Excepții" : 6',
  gantt:     'gantt\n  title Ședință\n  dateFormat YYYY-MM-DD\n  section Înțelegerea\n  semnificație :a1, 2026-01-01, 20d\n  Excepții :a2, after a1, 10d',
  sequence:  'sequenceDiagram\n  participant A as Ședință\n  participant B as Înțelegerea\n  A->>B: semnificație\n  B-->>A: Excepții'
};

// A type may only be exempt from the vector expectation if the application TELLS the person that
// this export is an image. An exemption without a disclosure is a silent lie, which is the whole
// defect this gate exists to prevent. Add to this list only together with that UI text, and name it.
const RASTER_EXEMPT = {
  // 'pie': 'the export dialog says "this diagram type exports as an image"'
};

// ---------------------------------------------------------------- assertions
const results = [];
let failed = 0;
function check(id, ok, expected, actual) {
  results.push({ id, ok, expected, actual });
  if (!ok) failed++;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} | expected=${expected} | actual=${actual}`);
}

// A PDF that contains text carries font objects. A PDF that is a picture carries image XObjects
// and no fonts. Validated against a known-vector deck PDF (/BaseFont x4, images 0) and two known
// raster diagram PDFs (/BaseFont 0, images 1 and 4).
function pdfKind(buf) {
  const s = buf.toString('latin1');
  const fonts = (s.match(/\/BaseFont/g) || []).length;
  const images = (s.match(/\/Subtype\s*\/Image/g) || []).length;
  return { fonts, images, kind: fonts > 0 ? 'vector' : 'raster' };
}

// Minimal zip reader: enough to pull entry names and inflate the ones we need, with no dependency.
function zipEntries(buf) {
  const out = {};
  let i = buf.length - 22;
  while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < 0) return out;
  const count = buf.readUInt16LE(i + 10);
  let p = buf.readUInt32LE(i + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(dataStart, dataStart + compSize);
    out[name] = () => {
      try { return method === 0 ? raw : zlib.inflateRawSync(raw); } catch (e) { return Buffer.alloc(0); }
    };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ---------------------------------------------------------------- run
(async () => {
  const root = path.dirname(APP);
  const file = path.basename(APP);
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200), res.end(d)));
  }).listen(PORT);

  const browser = await chromium.launch();
  try {
    for (const [type, source] of Object.entries(TYPES)) {
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate(`(async () => {
        for (let i = 0; i < 60; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 400)); }
        document.querySelectorAll('.tour-card button').forEach(b => { if (/skip|done|got it|close/i.test(b.textContent)) b.click(); });
        document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
        document.body.click(); return 1;
      })()`);

      const grabbed = await page.evaluate(`(async () => {
        const blobs = [];
        const orig = URL.createObjectURL.bind(URL);
        URL.createObjectURL = b => { if (b instanceof Blob) blobs.push(b); return orig(b); };
        HTMLAnchorElement.prototype.click = function () {};
        const s = document.querySelector('#source');
        s.value = ${JSON.stringify(source)};
        s.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 5000));
        const t = document.querySelector('#diagramTitle');
        if (t) { t.value = ${JSON.stringify(TITLE)}; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }
        await new Promise(r => setTimeout(r, 2000));
        const out = {};
        for (const [name, id] of [['pdf','#exportPdfButton'],['pptx','#exportPptxButton'],['xlsx','#exportXlsxButton']]) {
          const before = blobs.length;
          const btn = document.querySelector(id);
          if (!btn) { out[name] = null; continue; }
          btn.click();
          await new Promise(r => setTimeout(r, 6000));
          const made = blobs.slice(before);
          if (!made.length) { out[name] = null; continue; }
          const buf = new Uint8Array(await made[made.length - 1].arrayBuffer());
          let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
          out[name] = btoa(bin);
        }
        return JSON.stringify(out);
      })()`);
      await ctx.close();

      const files = JSON.parse(grabbed);
      const exempt = RASTER_EXEMPT[type];

      // ---- PDF: is it a document or a photograph of one? ----
      if (!files.pdf) { check(`${type}.PDF.produced`, false, 'a pdf blob', 'none'); }
      else {
        const buf = Buffer.from(files.pdf, 'base64');
        fs.writeFileSync(path.join(OUTDIR, `${type}.pdf`), buf);
        const k = pdfKind(buf);
        check(`${type}.PDF.hasText`, exempt ? true : k.fonts > 0,
          exempt ? `exempt: ${exempt}` : 'at least one embedded font (a readable document)',
          `fonts=${k.fonts} images=${k.images} bytes=${buf.length} -> ${k.kind}`);
      }

      // ---- PPTX: shapes, or one flat picture? ----
      if (!files.pptx) { check(`${type}.PPTX.produced`, false, 'a pptx blob', 'none'); }
      else {
        const buf = Buffer.from(files.pptx, 'base64');
        fs.writeFileSync(path.join(OUTDIR, `${type}.pptx`), buf);
        const z = zipEntries(buf);
        let sp = 0, pic = 0, xml = '';
        for (const n of Object.keys(z)) {
          if (!/^ppt\/slides\/slide\d+\.xml$/.test(n)) continue;
          const x = z[n]().toString('utf8');
          sp += (x.match(/<p:sp>/g) || []).length;
          pic += (x.match(/<p:pic>/g) || []).length;
          xml += x;
        }
        check(`${type}.PPTX.editableShapes`, exempt ? true : (sp > 0 && pic === 0),
          exempt ? `exempt: ${exempt}` : 'shapes and no embedded picture',
          `shapes=${sp} pictures=${pic}`);
        check(`${type}.PPTX.diacriticsAsText`, DIACRITICS.some(d => xml.includes(d)),
          'Romanian diacritics present as text', DIACRITICS.filter(d => xml.includes(d)).join(',') || 'none');
        check(`${type}.PPTX.noLeakedTitle`, !xml.includes('Flowchart Preview'),
          'no "Flowchart Preview" when the diagram has a real title',
          xml.includes('Flowchart Preview') ? 'LEAKED' : 'clean');
      }

      // ---- XLSX: native shapes, or a pasted image? ----
      if (!files.xlsx) { check(`${type}.XLSX.produced`, false, 'an xlsx blob', 'none'); }
      else {
        const buf = Buffer.from(files.xlsx, 'base64');
        fs.writeFileSync(path.join(OUTDIR, `${type}.xlsx`), buf);
        const z = zipEntries(buf);
        let shapes = 0;
        for (const n of Object.keys(z)) {
          if (!n.startsWith('xl/drawings/drawing')) continue;
          shapes += (z[n]().toString('utf8').match(/<xdr:sp\b/g) || []).length;
        }
        check(`${type}.XLSX.nativeShapes`, exempt ? true : shapes > 0,
          exempt ? `exempt: ${exempt}` : 'native Excel shapes in the drawing',
          `shapes=${shapes}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const summary = { total: results.length, passed: results.length - failed, failed, fatal: false };
  fs.writeFileSync(path.join(OUTDIR, 'report.json'), JSON.stringify({ app: APP, summary, results }, null, 1));
  console.log('\nSummary: ' + JSON.stringify(summary, null, 2));
  console.log('Report: ' + path.join(OUTDIR, 'report.json'));
  process.exit(failed ? 1 : 0);
})();
