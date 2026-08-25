/* Skeptic's shared driver for JOB BH. Builds the Docs->diagram reference fixture for real
   and measures the arrival. Nothing here reads the diff; every number comes off the page. */
const { openApp, setSource } = require('./r7_lib.js');

async function realClick(page, selector, note) {
  const box = await page.evaluate(sel => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }, selector);
  if (!box || box.w < 1) throw new Error('realClick: not clickable ' + selector + ' ' + (note || '') + ' ' + JSON.stringify(box));
  await page.mouse.click(box.x, box.y);
  return box;
}

async function clickMenuItemByLabel(page, rx) {
  const hit = await page.evaluate(pattern => {
    const re = new RegExp(pattern, 'i');
    const cands = Array.from(document.querySelectorAll('[role="menuitem"],[role="menuitemradio"],button,li'));
    const vis = cands.filter(n => {
      const r = n.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && re.test((n.textContent || '').trim());
    });
    if (!vis.length) return null;
    const n = vis[vis.length - 1];
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: (n.textContent || '').trim() };
  }, rx);
  if (!hit) throw new Error('menu item not found for /' + rx + '/');
  await page.mouse.click(hit.x, hit.y);
  return hit.text;
}

/* Watch every toast the app raises, and every scroll position the canvas takes. */
async function armObservers(page) {
  await page.evaluate(() => {
    window.__toasts = [];
    const t = document.getElementById('toast');
    if (t) {
      const grab = () => {
        const txt = (t.textContent || '').trim();
        if (txt) window.__toasts.push({ text: txt, kind: t.dataset.kind || t.getAttribute('data-kind') || '', hidden: !!t.hidden });
      };
      new MutationObserver(grab).observe(t, { childList: true, subtree: true, characterData: true, attributes: true });
    }
    window.__scrolls = [];
    const vp = document.getElementById('zoomViewport');
    let frames = 0;
    const tick = () => {
      if (vp) {
        const last = window.__scrolls[window.__scrolls.length - 1];
        if (!last || last[1] !== vp.scrollTop || last[2] !== vp.scrollLeft) {
          window.__scrolls.push([frames, vp.scrollTop, vp.scrollLeft]);
        }
      }
      frames += 1;
      if (frames < 120) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function snapshot(page, nodeId) {
  return page.evaluate(id => {
    const q = s => document.querySelector(s);
    const vp = q('#zoomViewport');
    const vr = vp ? vp.getBoundingClientRect() : null;
    const svg = q('#diagram svg');
    let box = null;
    if (svg) {
      const groups = Array.from(svg.querySelectorAll('g.node, g[id]'));
      const hit = groups.find(g => {
        const gid = g.id || '';
        return gid === id || gid.split('-').includes(id) || (g.dataset && g.dataset.id === id);
      });
      if (hit) {
        const r = hit.getBoundingClientRect();
        box = { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) };
      }
    }
    const ring = q('#diagram svg g.t-handles[data-ring-for]');
    const insp = q('#nodeInspector');
    const ir = insp && !insp.hidden ? insp.getBoundingClientRect() : null;
    let visible = null;
    if (box && vr) {
      visible = {
        fully: box.left >= vr.left && box.right <= vr.right && box.top >= vr.top && box.bottom <= vr.bottom,
        any: box.right > vr.left && box.left < vr.right && box.bottom > vr.top && box.top < vr.bottom,
        dx: Math.round((box.left + box.w / 2) - (vr.left + vr.width / 2)),
        dy: Math.round((box.top + box.h / 2) - (vr.top + vr.height / 2))
      };
    }
    return {
      scrollTop: vp ? vp.scrollTop : null,
      scrollLeft: vp ? vp.scrollLeft : null,
      viewport: vr ? { left: Math.round(vr.left), top: Math.round(vr.top), w: Math.round(vr.width), h: Math.round(vr.height) } : null,
      box, visible,
      ring: ring ? ring.getAttribute('data-ring-for') : null,
      styleTarget: q('#nodeStyleTarget') ? q('#nodeStyleTarget').value : null,
      buildSelect: q('#visualNodeSelect') ? q('#visualNodeSelect').value : null,
      buildLabel: q('#visualNodeEditLabel') ? q('#visualNodeEditLabel').value : null,
      inspectorHidden: insp ? !!insp.hidden : null,
      inspectorHeading: q('#nodeInspectorHeading') ? (q('#nodeInspectorHeading').textContent || '').trim() : null,
      inspectorRect: ir ? { left: Math.round(ir.left), top: Math.round(ir.top), right: Math.round(ir.right), bottom: Math.round(ir.bottom) } : null,
      docsOpen: !!(q('#wpWorkspace') && !q('#wpWorkspace').hidden),
      zoomLabel: q('#zoomMenuButton') ? (q('#zoomMenuButton').textContent || '').trim() : null,
      source: q('#source') ? q('#source').value : null,
      toasts: window.__toasts || [],
      scrolls: window.__scrolls || []
    };
  }, nodeId);
}

/* Docs -> New Note -> add a diagram reference to nodeId. Returns the chip's own text. */
async function makeReference(page, nodeId, kind = 'diagram') {
  await realClick(page, '#workpapersButton', 'open Docs');
  await page.waitForTimeout(700);
  await realClick(page, '#wpNewButton', 'new document');
  await page.waitForTimeout(450);
  const picked = await clickMenuItemByLabel(page, 'Note');
  await page.waitForTimeout(900);
  await page.selectOption('#wpLinkKind', kind);
  await page.waitForTimeout(350);
  const diagOpts = await page.$$eval('#wpLinkDiagram option', os => os.map(o => o.value));
  await page.selectOption('#wpLinkDiagram', diagOpts[0]);
  await page.waitForTimeout(350);
  const nodeOpts = await page.$$eval('#wpLinkNode option', os => os.map(o => ({ v: o.value, t: o.textContent.trim() })));
  const want = nodeOpts.find(o => o.v === nodeId);
  if (!want) throw new Error('node ' + nodeId + ' not offered; options=' + JSON.stringify(nodeOpts));
  await page.selectOption('#wpLinkNode', nodeId);
  await page.waitForTimeout(300);
  await realClick(page, '#wpAddLinkButton', 'add reference');
  await page.waitForTimeout(800);
  const chip = await page.evaluate(() => {
    const c = document.querySelector('.wp-chip-open');
    return c ? { text: c.textContent.trim(), title: c.title } : null;
  });
  if (!chip) throw new Error('no .wp-chip-open after add');
  return { picked, chip, nodeOptions: nodeOpts };
}

async function clickChip(page) {
  return realClick(page, '.wp-chip-open', 'reference chip');
}

module.exports = { openApp, setSource, realClick, clickMenuItemByLabel, armObservers, snapshot, makeReference, clickChip };
