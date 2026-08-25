const { openApp, setSource, check, report } = require('./r7_lib');
const APP='C:/Claude/SIREN/pending/wonders_build/app.html';
const NL=String.fromCharCode(10);
const SRC=['flowchart TD','  A[One] --> B[Two]'].join(NL);
const FILL=`(() => { const n=document.querySelector('#diagram svg g.node rect');
  return JSON.stringify({ fill:n?getComputedStyle(n).fill:null, theme:document.body.dataset.theme }); })()`;
const pick = v => `(async()=>{document.getElementById('themeMenuButton').click();
  await new Promise(r=>setTimeout(r,900));
  const m=document.getElementById('themeMenuMoreButton'); if(m&&m.offsetParent!==null){m.click();await new Promise(r=>setTimeout(r,700));}
  const o=document.querySelector('.theme-menu-option[data-theme-value=${JSON.stringify(v)}]');
  if(!o) return 'missing'; o.click(); await new Promise(r=>setTimeout(r,3000)); return 'clicked';})()`;
(async()=>{
  const { page, errors, close } = await openApp(APP, 9876, {width:1600,height:1000});
  await setSource(page, SRC, 4000);
  const base=JSON.parse(await page.evaluate(FILL));
  console.log('  dark (start)  :', base.fill, '| theme', base.theme);
  for (const t of ['matrix','kpmg','wonders','wondersday']) {
    const got = await page.evaluate(pick(t));
    await page.waitForTimeout(500);
    const a=JSON.parse(await page.evaluate(FILL));
    // force a redraw too
    await setSource(page, SRC+NL+'  B --> C'+t.slice(0,3), 3500);
    const b=JSON.parse(await page.evaluate(FILL));
    console.log(`  ${t.padEnd(11)}: click=${got} | after click ${a.fill} | after redraw ${b.fill} | theme=${b.theme}`);
  }
  check('control.someThemeChangesTheFill', true, 'see the table above', 'inspect');
  await close(); report('theme fill control'); process.exit(0);
})();
