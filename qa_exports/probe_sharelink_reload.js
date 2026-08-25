const fs=require('fs'),path=require('path'),http=require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const { SETTLE, check, report } = require('./r7_lib');
const APP='C:/Claude/SIREN/codex/FROZEN_R8_BASE.html', PORT=9784;
const ST=`(() => JSON.stringify({ro:document.body.classList.contains('read-only-mode'),
  title:(document.getElementById('confirmDialogTitle')||{}).textContent||null,
  btn:(document.getElementById('confirmActionButton')||{}).textContent||null,
  src:(document.getElementById('source')||{}).value||'', hash:location.hash.slice(0,20)}))()`;
(async()=>{
  const root=path.dirname(APP),file=path.basename(APP);
  const server=http.createServer((q,s)=>fs.readFile(path.join(root,decodeURIComponent(q.url.split('?')[0])),
    (e,d)=>e?(s.writeHead(404),s.end()):(s.writeHead(200),s.end(d)))).listen(PORT);
  const browser=await chromium.launch(); const url=`http://127.0.0.1:${PORT}/${file}`;
  const mk=await browser.newContext(); const mp=await mk.newPage();
  await mp.route(url, async r=>{const res=await r.fetch(); let b=await res.text();
    b=b.replace('function buildShareLink(readOnly = false)','window.__share=(ro)=>buildShareLink(ro); function buildShareLink(readOnly = false)');
    await r.fulfill({response:res,body:b});});
  await mp.goto(url,{waitUntil:'load'}); await mp.evaluate(SETTLE);
  await mp.evaluate(`(()=>{const s=document.getElementById('source');s.value=['flowchart TD','  RO[Shared read only]'].join(String.fromCharCode(10));s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await mp.waitForTimeout(2500);
  const shared=url+'#'+(await mp.evaluate(`window.__share(true)`)).split('#')[1];
  await mk.close();

  const ctx=await browser.newContext(); const p=await ctx.newPage();
  await p.goto(url,{waitUntil:'load'}); await p.evaluate(SETTLE);
  await p.evaluate(`(()=>{const s=document.getElementById('source');s.value=['flowchart TD','  MINE[My own work]'].join(String.fromCharCode(10));s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await p.waitForTimeout(3000);
  await p.goto(shared,{waitUntil:'load'}); await p.waitForTimeout(3500);
  let a=JSON.parse(await p.evaluate(ST));
  console.log('  first visit :', JSON.stringify(a));
  await p.evaluate(`document.getElementById('confirmActionButton').click()`); await p.waitForTimeout(1800);
  a=JSON.parse(await p.evaluate(ST));
  console.log('  after button:', JSON.stringify(a));
  // now the question: can a reload recover the shared view?
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(3800);
  let b=JSON.parse(await p.evaluate(ST));
  console.log('  after reload:', JSON.stringify(b));
  if (b.title) { await p.evaluate(`document.getElementById('confirmActionButton').click()`); await p.waitForTimeout(1800);
    b=JSON.parse(await p.evaluate(ST)); console.log('  reload+button:', JSON.stringify(b)); }
  check('reload.recoversTheShare', b.ro===true,
    'a reload gets the viewer back into the read-only shared view',
    `read-only=${b.ro} src=${JSON.stringify(b.src.slice(0,36))} hash=${JSON.stringify(b.hash)}`);
  await ctx.close(); await browser.close(); server.close(); report('reload recovery'); process.exit(0);
})();
