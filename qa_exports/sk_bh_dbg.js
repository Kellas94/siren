/* Debug: does the tall fixture render, and where do the zoom controls live? */
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]);

const TALL = [
  'flowchart TD',
  '  START[Trial balance received] --> CTRL["Control C-114<br/>Owner Financial Controller<br/>Frequency Monthly<br/>Evidence signed reconciliation<br/>Population 1284 journals<br/>Sample 25 items<br/>Test agree to source<br/>Threshold zero<br/>Reviewer Engagement Manager<br/>Status operating effectively"]',
  '  CTRL --> DONE[Conclusion reached]'
].join('\n');

(async () => {
  const { page, errors, close } = await L.openApp(APP, PORT, { width: 1280, height: 860 });
  try {
    await L.setSource(page, TALL, 4000);
    const r1 = await page.evaluate(() => {
      const svg = document.querySelector('#diagram svg');
      const err = document.querySelector('#previewStatus, .preview-status, #renderStatus');
      return {
        hasSvg: !!svg,
        groupIds: svg ? Array.from(svg.querySelectorAll('g.node,g[id]')).map(g => g.id).slice(0, 20) : [],
        status: err ? (err.textContent || '').trim().slice(0, 200) : null,
        diagramText: (document.querySelector('#diagram') || {}).textContent ? document.querySelector('#diagram').textContent.trim().slice(0, 200) : null
      };
    });
    console.log('TALL RENDER', JSON.stringify(r1, null, 1));

    // Where are the zoom controls?
    const z1 = await page.evaluate(() => {
      const ids = ['zoomInButton', 'zoomOutButton', 'actualSizeButton', 'zoomMenuButton', 'fitButton'];
      return ids.map(i => {
        const n = document.getElementById(i);
        if (!n) return { id: i, missing: true };
        const r = n.getBoundingClientRect();
        return { id: i, w: Math.round(r.width), h: Math.round(r.height), parentId: n.parentElement && n.parentElement.id, parentCls: n.parentElement && String(n.parentElement.className).slice(0, 50) };
      });
    });
    console.log('ZOOM BEFORE MENU', JSON.stringify(z1));
    await L.realClick(page, '#zoomMenuButton', 'zoom menu');
    await page.waitForTimeout(600);
    const z2 = await page.evaluate(() => {
      const ids = ['zoomInButton', 'zoomOutButton', 'actualSizeButton'];
      const menu = document.querySelector('[role="menu"]');
      return {
        controls: ids.map(i => { const n = document.getElementById(i); if (!n) return { id: i, missing: true }; const r = n.getBoundingClientRect(); return { id: i, w: Math.round(r.width), h: Math.round(r.height) }; }),
        menuItems: menu ? Array.from(menu.querySelectorAll('*')).filter(n => n.getBoundingClientRect().width > 2 && !n.children.length).map(n => (n.textContent || '').trim()).slice(0, 20) : null
      };
    });
    console.log('ZOOM AFTER MENU', JSON.stringify(z2, null, 1));
    console.log('ERRORS', JSON.stringify(errors));
  } finally { await close(); }
})();
