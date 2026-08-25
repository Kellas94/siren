#!/usr/bin/env node
/* Read the release notes out of the SHIPPED file, through the app's own What's new surface.
 *
 * A changelog is a promise. This opens it the way a person does and reads back what it says, so the
 * claim "1.70.0 ships these seven notes" is measured on the bytes that were copied to Downloads
 * rather than on the script that wrote them.
 */
const { openApp, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9940'));

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });

  const version = await page.evaluate(`(() => {
    const el = Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0 &&
      /^v?1\\.\\d+\\.\\d+$/.test((e.textContent || '').trim()));
    return el ? el.textContent.trim() : null;
  })()`);

  // The notes live inside the Guide, under a collapsed <details> called "Recent versions" -
  // there is no standalone changelog button. A probe that hunts for one finds nothing and
  // reports a working app as nine failures.
  const seen = JSON.parse(await page.evaluate(`(async () => {
    const guide = document.getElementById('guideButton');
    if (guide) { guide.click(); await new Promise(r => setTimeout(r, 1100)); }
    const wrap = document.querySelector('.guide-changelog-wrap');
    if (wrap) { wrap.open = true; await new Promise(r => setTimeout(r, 600)); }
    const box = document.getElementById('guideChangelog');
    const text = ((box && box.textContent) || '').replace(/ /g, ' ');
    const first = box ? box.querySelector('.guide-release h4') : null;
    return JSON.stringify({
      opened: !!(box && box.getBoundingClientRect().height > 2),
      firstHeading: first ? first.textContent.trim() : null,
      mentions170: text.indexOf('1.70.0') >= 0,
      notes: [
        'names the editor it opens',
        'use the name you typed',
        'Two new themes',
        'stays on the screen and wraps',
        'slash you deleted can be typed again',
        'open where you clicked',
        'squeezed into a very narrow window'
      ].map(fragment => [fragment, text.indexOf(fragment) >= 0])
    });
  })()`));

  check('shipped.version', /1\.70\.0/.test(String(version)), 'the app reports 1.70.0', String(version));
  check('shipped.changelogOpens', seen.opened, 'the release notes are on screen', String(seen.opened) + ' first=' + seen.firstHeading);
  check('shipped.listsThisRelease', seen.mentions170, '1.70.0 is in the notes', String(seen.mentions170));
  seen.notes.forEach(([fragment, found], i) => {
    check(`shipped.note${i + 1}`, found, `note ${i + 1} is present`, `"${fragment}" ${found ? 'found' : 'MISSING'}`);
  });
  check('shipped.noErrors', errors.length === 0, 'no page or console errors on boot', errors.slice(0, 3).join(' // ') || 'none');

  await page.screenshot({ path: 'C:/Claude/SIREN/pending/release170/shipped_notes.png' });
  await close();
  process.exit(report('shipped 1.70.0') ? 1 : 0);
})();
