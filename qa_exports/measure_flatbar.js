#!/usr/bin/env node
/* The boring alternative: put the same controls on a permanently visible bar with no expansion.
 * Measure how tall that bar is at the widths SIREN actually runs at, using the prototype's own
 * type styles so the comparison is like for like. */
const path=require('path'),fs=require('fs'),http=require('http');
const {createRequire}=require('module');
const {chromium}=createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const FILE='C:/Claude/SIREN/prototypes/look_bar.html', PORT=9878;

const BUILD = `(() => {
  const host=document.createElement('div');
  host.id='flatbar';
  host.style.cssText='display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;padding:9px 12px;background:#0C2440;border:1px solid #1E3F66';
  const f=(label,inner)=>'<label style="display:flex;flex-direction:column;gap:5px;min-width:132px"><span style="font-size:11px;color:#8FA6C0">'+label+'</span>'+inner+'</label>';
  const sel=(o)=>'<select style="background:#102C4E;color:#EAF1FA;border:1px solid #1E3F66;border-radius:6px;padding:6px 8px;font-family:\\'IBM Plex Sans\\',sans-serif;font-size:12.5px">'+o.map(x=>'<option>'+x+'</option>').join('')+'</select>';
  const rng='<input type="range" style="height:32px;accent-color:#2563EB">';
  host.innerHTML =
    f('Typeface', sel(['IBM Plex Sans','Inter','Arial','Georgia','Courier New','Tahoma','Verdana','Trebuchet MS'])) +
    f('Size', rng) +
    f('Weight', sel(['400','500','600','700','800'])) +
    f('Density', sel(['Compact','Comfortable','Spacious'])) +
    f('Between blocks', rng) +
    f('Between rows', rng) +
    f('Curve', sel(['Smooth','Straight','Monotone','Step before','Step after'])) +
    f('Routing', sel(['Follow curve','Smooth','Straight','Orthogonal'])) +
    f('Direction', sel(['Top to bottom','Bottom to top','Left to right','Right to left']));
  document.querySelector('.stage').appendChild(host);
  return 1;
})()`;

(async()=>{
  const root=path.dirname(FILE), file=path.basename(FILE);
  const server=http.createServer((q,s)=>fs.readFile(path.join(root,decodeURIComponent(q.url.split('?')[0])),
    (e,d)=>e?(s.writeHead(404),s.end()):(s.writeHead(200),s.end(d)))).listen(PORT);
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(`http://127.0.0.1:${PORT}/${file}`,{waitUntil:'load'});
  await page.waitForTimeout(500);
  await page.evaluate(BUILD);
  const rows=[];
  for (const w of [1440,1280,1100,900]) {
    await page.setViewportSize({width:w,height:900});
    await page.waitForTimeout(350);
    const m = await page.evaluate(`(() => {
      const fb=document.getElementById('flatbar').getBoundingClientRect();
      const bar=document.getElementById('bar').getBoundingClientRect();
      const tray=document.getElementById('tray');
      const wasOpen=tray.classList.contains('open');
      return { flat:Math.round(fb.height), chipsClosed:Math.round(bar.height),
        stageW: Math.round(document.querySelector('.stage').getBoundingClientRect().width) };
    })()`);
    // and with one chip open
    await page.evaluate(`Array.from(document.querySelectorAll('.chip')).find(c=>/Spacing/.test(c.textContent)).click()`);
    await page.waitForTimeout(300);
    const open = await page.evaluate(`(() => { const b=document.getElementById('bar').getBoundingClientRect();
      const t=document.getElementById('tray').getBoundingClientRect(); return Math.round(b.height+t.height); })()`);
    await page.evaluate(`document.querySelector('.chip.more').click()`);
    await page.waitForTimeout(250);
    rows.push({ w, stageW:m.stageW, flatBar:m.flat, chipBarClosed:m.chipsClosed, chipBarOpen:open });
    console.log('viewport', w, 'stage', m.stageW, '| flat bar', m.flat + 'px', '| chips closed', m.chipsClosed + 'px', '| chips open', open + 'px');
  }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/flatbar.json', JSON.stringify(rows,null,1));
  await page.setViewportSize({width:1180,height:1100});
  await page.waitForTimeout(400);
  await page.screenshot({path:'C:/Claude/SIREN/qa_exports/proto_5_flatbar_compare.png', fullPage:true});
  await browser.close(); server.close();
})().catch(e=>{console.error(e);process.exit(1);});
