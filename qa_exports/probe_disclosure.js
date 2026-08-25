#!/usr/bin/env node
/*
 * Is the picture-fallback disclosure something a PERSON sees?
 *
 * Round 5 accepts pie, gantt and sequence exporting to Office as one picture, on the condition that
 * the app discloses it. The gate reads that disclosure from the app at runtime, so the exemption
 * cannot widen without the app saying the words. What the gate cannot check is whether the words are
 * on screen: a string present in the DOM, inside a hidden node or behind a closed disclosure, would
 * satisfy every automated check and tell the person nothing.
 *
 * This opens the real export dialog the way a person does and measures the text.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app'), PORT = Number(arg('port', '9956'));

const TYPES = {
  pie: 'pie showData\n  "Ședință" : 42\n  "Înțelegerea" : 17',
  gantt: 'gantt\n  title Ședință\n  dateFormat YYYY-MM-DD\n  section Înțelegerea\n  semnificație :a1, 2026-01-01, 20d',
  sequence: 'sequenceDiagram\n  participant A as Ședință\n  participant B as Înțelegerea\n  A->>B: semnificație',
  flowchart: 'flowchart TD\n  A["Ședință"] --> B["Înțelegerea"]'
};

let fail = 0;
const check = (id, ok, exp, act) => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} | expected=${exp} | actual=${act}`); };

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  try {
    for (const [type, src] of Object.entries(TYPES)) {
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate(`(async () => {
        for (let i = 0; i < 80; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
        for (let p = 0; p < 12; p++) {
          const b = Array.from(document.querySelectorAll('.tour-card button'))
            .find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
          if (!b) break; b.click(); await new Promise(r => setTimeout(r, 200));
        }
        document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
        document.body.click();
        const s = document.querySelector('#source');
        s.value = ${JSON.stringify(src)};
        s.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 4500));
        return 1;
      })()`);

      // Open the export dialog the way a person does, then hunt for the sentence on screen.
      const seen = JSON.parse(await page.evaluate(`(async () => {
        const btn = document.querySelector('#exportButton');
        if (!btn) return JSON.stringify({ error: 'no #exportButton' });
        btn.click();
        await new Promise(r => setTimeout(r, 1600));

        const NEEDLE = 'export this diagram as one picture';
        const hits = [];
        // The app is one inline <script>, so a text walk finds the sentence in its own SOURCE.
        // That counted as an occurrence on the first run and looked like a false claim on a
        // flowchart. Script and style content is not text a person reads.
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: node => /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(node.parentElement && node.parentElement.tagName)
            ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });
        let n;
        while ((n = walk.nextNode())) {
          if (!n.nodeValue || n.nodeValue.indexOf(NEEDLE) < 0) continue;
          const host = n.parentElement;
          const r = host.getBoundingClientRect();
          const cs = getComputedStyle(host);
          hits.push({
            text: n.nodeValue.replace(/\\s+/g, ' ').trim().slice(0, 130),
            w: Math.round(r.width), h: Math.round(r.height),
            top: Math.round(r.top),
            onScreen: r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0,
            display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
            fontSize: cs.fontSize,
            insideClosedDetails: (() => { let p = host; while (p) { if (p.tagName === 'DETAILS' && !p.open) return true; p = p.parentElement; } return false; })(),
            anyHiddenAncestor: (() => { let p = host; while (p) { if (p.hasAttribute && p.hasAttribute('hidden')) return true; p = p.parentElement; } return false; })()
          });
        }
        return JSON.stringify({ hits, dialogOpen: !!document.querySelector('dialog[open]') });
      })()`));

      const pictureType = type !== 'flowchart';
      if (seen.error) { check(`${type}.dialog`, false, 'the export dialog opens', seen.error); await ctx.close(); continue; }
      const visible = (seen.hits || []).filter(h => h.onScreen && !h.insideClosedDetails && !h.anyHiddenAncestor);

      if (pictureType) {
        check(`${type}.disclosure.present`, seen.hits.length > 0,
          'the picture-fallback sentence exists', `${seen.hits.length} occurrence(s)`);
        check(`${type}.disclosure.onScreen`, visible.length > 0,
          'a person can actually read it in the open dialog',
          visible.length ? `${visible[0].w}x${visible[0].h} at top=${visible[0].top}, ${visible[0].fontSize}` :
            (seen.hits[0] ? `present but not readable: ${JSON.stringify(seen.hits[0]).slice(0, 150)}` : 'absent'));
        if (visible.length) console.log(`        text: "${visible[0].text}"`);
      } else {
        check(`${type}.noFalseDisclosure`, seen.hits.length === 0,
          'a flowchart makes real shapes, so it must NOT claim a picture fallback',
          `${seen.hits.length} occurrence(s)`);
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(`\n${fail ? 'FAILED' : 'ALL PASS'} — ${fail} failing assertion(s)`);
  process.exit(fail ? 1 : 0);
})();
