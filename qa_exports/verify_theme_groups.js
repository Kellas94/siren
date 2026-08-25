const { openApp, check, report } = require('./r7_lib');
const APP='C:/Claude/SIREN/pending/slot/app.html';
const READ=`(async () => {
  document.getElementById('themeMenuButton').click();
  await new Promise(r=>setTimeout(r,900));
  // Measure BOTH states. The cap governs the quick view; pressing More is a deliberate
  // request for the whole list, and judging the cap by the expanded state confuses the two.
  const quickBox=document.getElementById('themeMenu').getBoundingClientRect();
  const quickHidden=Math.max(0,document.getElementById('themeMenu').scrollHeight-document.getElementById('themeMenu').clientHeight);
  const quickShown=Array.from(document.querySelectorAll('#themeMenu .theme-menu-option')).filter(o=>{const r=o.getBoundingClientRect();return r.height>2;}).length;
  const more=document.getElementById('themeMenuMoreButton');
  if(more&&more.offsetParent!==null){more.click();await new Promise(r=>setTimeout(r,700));}
  const menu=document.getElementById('themeMenu');
  const pills=Array.from(menu.querySelectorAll('.theme-menu-jump')).map(b=>({
    text:b.textContent.trim(), target:b.dataset.jumpGroup}));
  const groups=Array.from(menu.querySelectorAll('.theme-menu-group')).map(g=>({
    label:(g.querySelector('.theme-menu-group-label')||{}).textContent,
    aria:g.getAttribute('aria-label'),
    count:g.querySelectorAll('.theme-menu-option').length}));
  const box=menu.getBoundingClientRect();
  return JSON.stringify({pills,groups,quickHidden,quickShown,quickBox:[Math.round(quickBox.width),Math.round(quickBox.height)],
    total:menu.querySelectorAll('.theme-menu-option').length,
    hiddenPx:Math.max(0,menu.scrollHeight-menu.clientHeight),
    box:[Math.round(box.width),Math.round(box.height)]});
})()`;
(async()=>{
  const { page, errors, close } = await openApp(APP, 9936, {width:1440,height:900});
  const r=JSON.parse(await page.evaluate(READ));
  console.log('\n  groups:');
  r.groups.forEach(g=>console.log(`     ${String(g.label).padEnd(12)} ${String(g.count).padStart(2)} themes   aria="${g.aria}"`));
  console.log('  pills :', r.pills.map(p=>p.text).join(' | '));
  console.log(`  total : ${r.total} themes, menu ${r.box.join('x')}, ${r.hiddenPx}px hidden\n`);
  check('groups.four', r.groups.length===4, 'four groups', `${r.groups.length}: ${r.groups.map(g=>g.label).join(', ')}`);
  check('pills.matchGroups', r.pills.length===r.groups.length &&
    r.pills.every(p=>r.groups.some(g=>g.aria===p.target)),
    'every pill points at a group that exists',
    r.pills.map(p=>`${p.text}->${p.target}`).join(' | '));
  check('worlds.merged', r.groups.some(g=>g.label==='Worlds'&&g.count===21),
    'Worlds holds all 21', (r.groups.find(g=>g.label==='Worlds')||{}).count);
  check('none.lost', r.total===39, 'all 39 themes are still offered', String(r.total));
  check('cap.holdsInQuickView', r.quickHidden===0,
    'the quick view hides nothing below the fold',
    `quick: ${r.quickShown} shown, ${r.quickBox.join('x')}, ${r.quickHidden}px hidden | expanded: ${r.box.join('x')}, ${r.hiddenPx}px`);
  check('noErrors', errors.length===0,'no page errors', errors.slice(0,2).join(' // ')||'none');
  const m=page.locator('#themeMenu');
  if(await m.count()) await m.screenshot({path:'C:/Claude/SIREN/pending/slot/theme_groups.png'});
  await close(); process.exit(report('theme groups')?1:0);
})();
