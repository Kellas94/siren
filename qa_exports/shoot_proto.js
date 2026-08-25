#!/usr/bin/env node
/* Render the prototype in a real browser and photograph four states, so the description of it
 * is a description of an image and not of the source. */
const path = require('path'), fs = require('fs'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const FILE = 'C:/Claude/SIREN/prototypes/look_bar.html';
const PORT = 9877;

(async () => {
  const root = path.dirname(FILE), file = path.basename(FILE);
  const server = http.createServer((q,s)=>fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e,d)=>e?(s.writeHead(404),s.end()):(s.writeHead(200),s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1180, height:1000 } });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e.message)));
  page.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil:'load' });
  await page.waitForTimeout(700);
  await page.screenshot({ path:'C:/Claude/SIREN/qa_exports/proto_1_rest.png', fullPage:true });

  // open the Type chip
  await page.evaluate(`Array.from(document.querySelectorAll('.chip')).find(c=>/Type/.test(c.textContent)).click()`);
  await page.waitForTimeout(500);
  await page.screenshot({ path:'C:/Claude/SIREN/qa_exports/proto_2_type_open.png', fullPage:true });

  // measure: does the tray push the preview down rather than cover it?
  const geo = await page.evaluate(`(() => {
    const t=document.getElementById('tray').getBoundingClientRect();
    const p=document.getElementById('preview').getBoundingClientRect();
    const b=document.getElementById('bar').getBoundingClientRect();
    const chips=Array.from(document.querySelectorAll('.chip')).map(c=>c.textContent.replace(/[ ]+/g,' ').trim());
    return { trayBottom:Math.round(t.bottom), previewTop:Math.round(p.top),
      overlaps: t.bottom > p.top + 1, barChips: chips, trayH: Math.round(t.height) };
  })()`);
  console.log('GEOMETRY', JSON.stringify(geo));

  // switch to pie: chips must change
  await page.selectOption('#type','pie'); await page.waitForTimeout(600);
  const pieChips = await page.evaluate(`Array.from(document.querySelectorAll('.chip')).map(c=>c.textContent.replace(/[ ]+/g,' ').trim())`);
  await page.evaluate(`(Array.from(document.querySelectorAll('.chip')).find(c=>/Colours/.test(c.textContent))||{click(){}}).click()`);
  await page.waitForTimeout(500);
  await page.screenshot({ path:'C:/Claude/SIREN/qa_exports/proto_3_pie_colours.png', fullPage:true });
  console.log('PIE CHIPS', JSON.stringify(pieChips));

  // gitgraph + spacing
  await page.selectOption('#type','gitgraph'); await page.waitForTimeout(600);
  const gitChips = await page.evaluate(`Array.from(document.querySelectorAll('.chip')).map(c=>c.textContent.replace(/[ ]+/g,' ').trim())`);
  await page.evaluate(`(Array.from(document.querySelectorAll('.chip')).find(c=>/Spacing/.test(c.textContent))||{click(){}}).click()`);
  await page.waitForTimeout(400);
  await page.screenshot({ path:'C:/Claude/SIREN/qa_exports/proto_4_git_spacing.png', fullPage:true });
  console.log('GIT CHIPS', JSON.stringify(gitChips));
  console.log('ERRORS', JSON.stringify(errs.slice(0,8)));
  await browser.close(); server.close();
})().catch(e=>{console.error(e);process.exit(1);});
