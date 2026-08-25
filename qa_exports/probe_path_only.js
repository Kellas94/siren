const { openApp, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n,d)=>{const i=argv.indexOf('--'+n);return i>=0&&argv[i+1]?argv[i+1]:d;};
const APP = arg('app'), PORT = Number(arg('port','9776')), TAG = arg('tag','x');
const OPEN = `(async () => {
  document.getElementById('workpapersButton').click();
  await new Promise(r=>setTimeout(r,1000));
  const nw=document.getElementById('wpNewButton')||document.getElementById('wpEmptyNewButton');
  if(nw){nw.click(); await new Promise(r=>setTimeout(r,800));}
  const m=document.querySelector('.struct-menu');
  if(m){const row=Array.from(m.querySelectorAll('.struct-menu-item')).find(b=>/note/i.test(b.textContent));(row||m.querySelector('.struct-menu-item')).click(); await new Promise(r=>setTimeout(r,1000));}
  const add=document.getElementById('wpAddTextButton');
  if(add){add.click(); await new Promise(r=>setTimeout(r,800));}
  const eds=Array.from(document.querySelectorAll('#wpBlocks .wp-text'));
  const e=eds.find(x=>!x.textContent.trim());
  if(!e) return JSON.stringify({ok:false, n:eds.length, texts:eds.map(x=>x.textContent)});
  const r=e.getBoundingClientRect();
  return JSON.stringify({ok:true,x:Math.round(r.left+30),y:Math.round(r.top+r.height/2)});
})()`;
(async () => {
  const { page, errors, close } = await openApp(APP, PORT, {width:1440,height:900});
  const s = JSON.parse(await page.evaluate(OPEN));
  if(!s.ok){ check('setup', false, 'an empty paragraph', JSON.stringify(s)); await close(); process.exit(1); }
  await page.mouse.click(s.x, s.y);
  await page.waitForTimeout(350);
  await page.keyboard.type('/mnt/data/evidence.pdf', { delay: 50 });
  await page.waitForTimeout(900);
  const t = JSON.parse(await page.evaluate(`(() => JSON.stringify(
    Array.from(document.querySelectorAll('#wpBlocks .wp-text')).map(e=>e.textContent)))()`));
  check('path.exact', t.some(x=>x==='/mnt/data/evidence.pdf'),
    'the paragraph holds /mnt/data/evidence.pdf', JSON.stringify(t));
  await page.screenshot({ path: `C:/Claude/SIREN/pending/round8/path_${TAG}.png` });
  await close(); report(`path (${TAG})`); process.exit(0);
})();
