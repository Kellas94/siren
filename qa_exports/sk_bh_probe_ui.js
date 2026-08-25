/* Find how a person makes #visualNodeEditLabel visible. */
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]);
(async () => {
  const { page, close } = await L.openApp(APP, PORT, { width: 1280, height: 860 });
  try {
    await L.setSource(page, 'flowchart TD\n  ALPHA[Alpha step] --> BRAVO[Bravo step]\n  BRAVO --> CHARLIE[Charlie step]', 3000);
    const info = await page.evaluate(() => {
      const n = document.getElementById('visualNodeEditLabel');
      const chain = [];
      let p = n;
      while (p && p !== document.body) {
        const r = p.getBoundingClientRect();
        chain.push({ tag: p.tagName, id: p.id, cls: p.className && String(p.className).slice(0, 80), hidden: !!p.hidden, w: Math.round(r.width), h: Math.round(r.height), open: p.tagName === 'DETAILS' ? p.open : undefined, disp: getComputedStyle(p).display });
        p = p.parentElement;
      }
      const modeButtons = Array.from(document.querySelectorAll('button')).filter(b => /mode/i.test(b.id || '')).map(b => ({ id: b.id, txt: b.textContent.trim().slice(0, 30), vis: b.getBoundingClientRect().width > 1, pressed: b.getAttribute('aria-pressed') }));
      return { chain, modeButtons };
    });
    console.log(JSON.stringify(info, null, 1));
  } finally { await close(); }
})();
