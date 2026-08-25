#!/usr/bin/env node
/* Counts the option set of each candidate expandable chip, per diagram type, using the app's own
 * enabled/disabled state as the authority on relevance. A chip is only a candidate if its set is
 * small AND non-empty for the type on screen.
 */
const { openApp, confirmDialog } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg=(n,d)=>{const i=argv.indexOf('--'+n);return i>=0&&argv[i+1]?argv[i+1]:d;};
const APP=arg('app','C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT=Number(arg('port','9869'));
const KILL=`(async()=>{for(let p=0;p<20;p++){const b=Array.from(document.querySelectorAll('.tour-card button')).find(x=>/skip|done|got it|close|next|finish/i.test(x.textContent));if(!b){await new Promise(r=>setTimeout(r,120));continue;}b.click();await new Promise(r=>setTimeout(r,160));}return 1;})()`;

const CHIPS = {
  Theme:     ['themePreset'],
  Type:      ['diagramFontFamily','diagramFontSize','diagramFontWeight'],
  Spacing:   ['layoutDensity','layoutNodeSpacing','layoutRankSpacing','layoutAlignment'],
  Lines:     ['curve','layoutRouting'],
  Direction: ['direction'],
  Colours:   ['diagramPaletteColour0','diagramPaletteColour1','diagramPaletteColour2','diagramPaletteColour3'],
  Legend:    ['legendEnabled','legendTitle','legendPosition']
};

(async()=>{
  const out={ chips:{}, themeCount:null, types:{} };
  const {page,errors,close}=await openApp(APP,PORT,{width:1440,height:900});
  await page.evaluate(KILL);

  out.themeCount = await page.evaluate(`(() => {
    const s=document.getElementById('themePreset');
    const m=document.getElementById('themeMenu');
    return { presetOpts: s?s.options.length:null,
      menuRows: m?m.querySelectorAll('button,[role="menuitemradio"],[role="menuitem"]').length:null }; })()`);

  const types = await page.evaluate(`Array.from(document.getElementById('diagramTypeSelect').options).map(o=>o.value)`);
  for (const ty of types) {
    await page.evaluate(`(() => { const s=document.getElementById('diagramTypeSelect');
      s.value=${'`'}${'$'}{0}${'`'}; })()`.replace('`${0}`', JSON.stringify(ty)));
    await page.evaluate(`(() => { const s=document.getElementById('diagramTypeSelect');
      s.value=${JSON.stringify(ty)}; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await page.waitForTimeout(400);
    await page.evaluate(`(() => { const b=Array.from(document.querySelectorAll('button')).find(x=>/new starter/i.test((x.textContent||'').replace(/[ ]+/g,' '))); if(b) b.click(); })()`);
    await page.waitForTimeout(400);
    await confirmDialog(page, 1300);
    await page.waitForTimeout(1600);
    await page.evaluate(KILL);
    const first = await page.evaluate(`(document.getElementById('source').value||'').split(String.fromCharCode(10)).find(l=>l.trim())||''`);
    const live = await page.evaluate(`(() => {
      const chips = ${JSON.stringify(CHIPS)};
      const res = {};
      for (const [name, ids] of Object.entries(chips)) {
        let usable = 0, opts = 0;
        for (const id of ids) {
          const c = document.getElementById(id);
          if (!c) continue;
          const wrap = c.closest('div,fieldset');
          const wrapHidden = wrap ? (wrap.hasAttribute('hidden') || getComputedStyle(wrap).display==='none') : false;
          const off = !!c.disabled || c.getAttribute('aria-disabled')==='true' || wrapHidden;
          if (!off) { usable++; opts += (c.tagName==='SELECT' ? c.options.length : 1); }
        }
        res[name] = { usable, totalIds: ids.length, opts };
      }
      return res;
    })()`);
    out.types[ty] = { first: first.slice(0,24), live };
    const summary = Object.entries(live).map(([n,v])=>n+':'+v.usable+'/'+v.totalIds).join(' ');
    console.log(ty.padEnd(14), first.slice(0,22).padEnd(24), summary);
  }
  out.errors=errors.slice(0,8);
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/chip_sets.json', JSON.stringify(out,null,1));
  console.log('theme:', JSON.stringify(out.themeCount));
  await close();
})().catch(e=>{console.error('PROBE ERROR',e);process.exit(1);});
