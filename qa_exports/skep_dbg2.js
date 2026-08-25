const { openApp, confirmDialog } = require('./r7_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]);
const S = (p, js) => p.evaluate(js);
(async () => {
  const app = await openApp(APP, PORT, { width: 1440, height: 900 });
  const page = app.page;
  await page.waitForTimeout(2000);
  console.log('sel', await S(page, `(() => { const s=document.getElementById('diagramTypeSelect'); if(!s) return 'missing'; const r=s.getBoundingClientRect(); return {value:s.value, w:r.width, h:r.height, x:r.x, y:r.y, offsetParent: !!s.offsetParent}; })()`));
  await S(page, `(() => { const b=document.getElementById('codeModeButton'); if(b) b.click(); })()`);
  await page.waitForTimeout(900);
  console.log('sel after code mode', await S(page, `(() => { const s=document.getElementById('diagramTypeSelect'); const r=s.getBoundingClientRect(); return {value:s.value, w:r.width, x:r.x, y:r.y, offsetParent: !!s.offsetParent}; })()`));
  await S(page, `(() => { const s=document.getElementById('diagramTypeSelect'); s.value='state'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await page.waitForTimeout(700);
  const btns = await S(page, `(() => Array.from(document.querySelectorAll('button')).filter(b=>b.offsetParent && /starter/i.test(b.textContent)).map(b=>{const r=b.getBoundingClientRect(); return {t:b.textContent.trim().slice(0,40), id:b.id, x:r.x+r.width/2, y:r.y+r.height/2};}))()`);
  console.log('starter buttons', btns);
  if (btns[0]) { await page.mouse.click(btns[0].x, btns[0].y); await page.waitForTimeout(700); }
  console.log('dialog', await S(page, `(() => { const d=document.querySelector('dialog[open]'); return d ? {id:d.id, text:(d.innerText||'').replace(/\\s+/g,' ').slice(0,150), btns: Array.from(d.querySelectorAll('button')).map(b=>b.textContent.trim())} : null; })()`));
  console.log('confirm', await confirmDialog(page, 2000));
  await page.waitForTimeout(2500);
  console.log('src', (await S(page, `document.getElementById('source').value`)).split('\n').slice(0,3).join(' / '));
  await app.close();
})();
