/* Which tall/wide label forms actually render here? */
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]);

const CASES = {
  brQuoted: 'flowchart TD\n  START[Trial balance] --> CTRL["Line one<br/>Line two<br/>Line three"]\n  CTRL --> DONE[Done]',
  brBare: 'flowchart TD\n  START[Trial balance] --> CTRL[Line one<br/>Line two<br/>Line three]\n  CTRL --> DONE[Done]',
  brShort: 'flowchart TD\n  START[Trial balance] --> CTRL["A<br>B<br>C<br>D<br>E<br>F<br>G<br>H<br>I<br>J<br>K<br>L"]\n  CTRL --> DONE[Done]',
  wideOne: 'flowchart TD\n  START[Trial balance] --> CTRL[Reconciliation of intercompany balances between subsidiary Alpha and subsidiary Bravo for the year ended 31 December]\n  CTRL --> DONE[Done]',
  plain: 'flowchart TD\n  START[Trial balance] --> CTRL[Control C114]\n  CTRL --> DONE[Done]'
};

(async () => {
  for (const [name, src] of Object.entries(CASES)) {
    const { page, close } = await L.openApp(APP, PORT, { width: 1280, height: 860 });
    try {
      await L.setSource(page, src, 3800);
      const r = await page.evaluate(() => {
        const svg = document.querySelector('#diagram svg');
        const groups = svg ? Array.from(svg.querySelectorAll('g.node,g[id]')) : [];
        const ctrl = groups.find(g => (g.id || '').split('-').includes('CTRL'));
        const vp = document.getElementById('zoomViewport').getBoundingClientRect();
        return {
          ids: groups.map(g => g.id.replace(/^t_flow_\d+_\d+-/, '')).slice(0, 8),
          ctrl: ctrl ? { w: Math.round(ctrl.getBoundingClientRect().width), h: Math.round(ctrl.getBoundingClientRect().height) } : null,
          vp: { w: Math.round(vp.width), h: Math.round(vp.height) }
        };
      });
      console.log(name, JSON.stringify(r));
    } catch (e) { console.log(name, 'ERR', e.message); }
    finally { await close(); }
  }
})();
