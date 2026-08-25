/* Probe 9: at boot, is the word "Style" visible anywhere on screen? */
const { openApp } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
(async () => {
  const { page, close } = await openApp(APP, 9876, { width: 1500, height: 1000 });
  const hits = await page.evaluate(`(() => {
    const out = [];
    document.querySelectorAll('*').forEach(e => {
      if (e.children.length) return;
      const t = (e.textContent || '').trim();
      if (!/style/i.test(t)) return;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
      out.push({ text: t.slice(0, 50), id: e.id, top: Math.round(r.top), left: Math.round(r.left) });
    });
    return out;
  })()`);
  console.log('visible "style" text at boot: ' + JSON.stringify(hits, null, 1));
  const inPane = await page.evaluate(`(() => {
    const ss = document.getElementById('settingsSection');
    const r = ss.getBoundingClientRect();
    return { summaryText: ss.querySelector('summary').textContent.trim(), top: Math.round(r.top), inViewport: r.top < innerHeight };
  })()`);
  console.log('Style card position at boot: ' + JSON.stringify(inPane));
  await close();
})();
