const { openApp, setSource } = require('./r7_lib');
const APP='C:/Claude/SIREN/pending/wonders_build/app.html';
const NL=String.fromCharCode(10);
(async()=>{
  const { page, close } = await openApp(APP, 9892, {width:1500,height:1000});
  await setSource(page, ['pie title Split','  "Approved" : 60','  "Rejected" : 40'].join(NL), 4000);
  await page.evaluate(`document.getElementById('visualModeButton').click()`);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(`(() => {
    const p=document.getElementById('visualModePanel');
    if(!p) return JSON.stringify({none:true});
    const ctl=Array.from(p.querySelectorAll('button,input,select')).filter(e=>{const b=e.getBoundingClientRect();return b.width>2&&b.height>2;});
    return JSON.stringify({
      controls: ctl.map(e=>({tag:e.tagName, text:(e.textContent||e.placeholder||'').replace(/\s+/g,' ').trim().slice(0,26), disabled:!!e.disabled, why:e.title||''})),
      text: p.innerText.replace(/\s+/g,' ').trim().slice(0,220)
    });
  })()`);
  const d=JSON.parse(r);
  console.log('  panel text :', JSON.stringify(d.text));
  console.log('  controls   :');
  (d.controls||[]).forEach(c=>console.log(`     ${c.disabled?'[off]':'[ on]'} ${c.tag.padEnd(7)} ${JSON.stringify(c.text)}  ${c.why?'why="'+c.why.slice(0,60)+'"':'(no reason)'}`));
  const p=page.locator('#visualModePanel');
  if(await p.count()) await p.screenshot({path:'C:/Claude/SIREN/pending/wonders/panel_pie.png'});
  await close(); process.exit(0);
})();
