const { openApp, check, report } = require('./r7_lib');
const APP='C:/Claude/SIREN/pending/wonders_build/app.html';
const READ=`(async () => {
  document.getElementById('themeMenuButton').click();
  await new Promise(r=>setTimeout(r,900));
  const menu=document.getElementById('themeMenu');
  const legend=menu?menu.querySelector('.theme-menu-legend'):null;
  const r=legend?legend.getBoundingClientRect():null;
  const opt=document.querySelector('.theme-menu-option[data-theme-value="matrix"] > span:nth-child(2)');
  const before=opt?getComputedStyle(opt,'::before').content:null;
  const box=menu?menu.getBoundingClientRect():null;
  return JSON.stringify({
    legendText: legend?legend.textContent.replace(/\\s+/g,' ').trim():null,
    legendVisible: !!(r && r.width>10 && r.height>4),
    legendInsideMenu: !!(r && box && r.bottom <= box.bottom+1),
    starContent: before,
    menuBox: box?[Math.round(box.width),Math.round(box.height)]:null,
    hiddenPx: menu?Math.max(0, menu.scrollHeight-menu.clientHeight):null
  });
})()`;
(async()=>{
  const { page, errors, close } = await openApp(APP, 9888, {width:1440,height:900});
  const r=JSON.parse(await page.evaluate(READ));
  console.log('  ', JSON.stringify(r));
  check('legend.present', !!r.legendText, 'the menu carries a legend', JSON.stringify(r.legendText));
  check('legend.saysWhatItMeans', /moves/i.test(r.legendText||''), 'and it explains the mark', JSON.stringify(r.legendText));
  check('legend.visible', r.legendVisible, 'it is actually drawn', `visible=${r.legendVisible} insideMenu=${r.legendInsideMenu}`);
  check('glyph.hasAltText', /animated/i.test(r.starContent||''),
    'the glyph carries alt text a screen reader can announce', JSON.stringify(r.starContent));
  check('cap.stillHolds', r.hiddenPx===0, 'the menu still hides nothing below the fold', `${r.hiddenPx}px hidden, box ${r.menuBox}`);
  check('noErrors', errors.length===0,'no page errors', errors.slice(0,2).join(' // ')||'none');
  const menu=page.locator('#themeMenu');
  if (await menu.count()) await menu.screenshot({ path:'C:/Claude/SIREN/pending/wonders/theme_menu_legend.png' });
  await close(); process.exit(report('theme legend')?1:0);
})();
