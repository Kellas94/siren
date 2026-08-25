#!/usr/bin/env node
/* CLAIM 1: the "Chart colours" swatches are enabled on a flowchart although the fold's own text
 *          says they are only for pie/mindmap/git/timeline. Do they change anything?
 * CLAIM 2: flow direction is DISABLED in the Style panel (#direction) while the same setting is
 *          ENABLED in the Build panel (#visualDirection). Which one works?
 */
const { openApp, setSource } = require('./r7_lib');
const fs = require('fs');
const argv=process.argv.slice(2);
const arg=(n,d)=>{const i=argv.indexOf('--'+n);return i>=0&&argv[i+1]?argv[i+1]:d;};
const APP=arg('app','C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT=Number(arg('port','9870'));
const NL=String.fromCharCode(10);
const FLOW=['flowchart TD','  A[Purchase request] --> B{Approved}','  B -->|Yes| C[Raise order]','  B -->|No| D[Reject]'].join(NL);
const KILL=`(async()=>{for(let p=0;p<20;p++){const b=Array.from(document.querySelectorAll('.tour-card button')).find(x=>/skip|done|got it|close|next|finish/i.test(x.textContent));if(!b){await new Promise(r=>setTimeout(r,120));continue;}b.click();await new Promise(r=>setTimeout(r,160));}return 1;})()`;

(async()=>{
  const out={};
  const {page,errors,close}=await openApp(APP,PORT,{width:1440,height:900});
  await page.evaluate(KILL);
  await setSource(page,FLOW,3200);
  await page.evaluate(KILL);
  out.fixture=await page.evaluate(`document.getElementById('source').value.split(String.fromCharCode(10))[0]`);
  if(!/flowchart/.test(out.fixture)){console.log('ABORT');await close();process.exit(2);}

  // ---- CLAIM 1: palette on a flowchart ----
  out.claim1={};
  out.claim1.foldText = await page.evaluate(`(() => {
    const d=Array.from(document.querySelectorAll('details.style-fold')).find(x=>/Chart colours/i.test(x.textContent));
    return d?d.querySelector('summary').textContent.replace(/[ ]+/g,' ').trim().slice(0,160):null; })()`);
  out.claim1.swatchState = await page.evaluate(`['diagramPaletteColour0','diagramPaletteColour1','diagramPaletteColour2','diagramPaletteColour3','applyDiagramPaletteButton','resetDiagramPaletteButton'].map(id=>{
    const c=document.getElementById(id); if(!c) return {id,absent:true};
    const w=c.closest('div,fieldset');
    return { id, disabled:!!c.disabled||c.getAttribute('aria-disabled')==='true',
      wrapHidden: w?(w.hasAttribute('hidden')||getComputedStyle(w).display==='none'):false }; })`);
  const svgBefore = await page.evaluate(`(document.querySelector('#diagram svg')||{outerHTML:''}).outerHTML`);
  out.claim1.applied = await page.evaluate(`(async () => {
    const set=(id,v)=>{const c=document.getElementById(id); if(!c) return false;
      c.value=v; c.dispatchEvent(new Event('input',{bubbles:true})); c.dispatchEvent(new Event('change',{bubbles:true})); return true;};
    const ok=[set('diagramPaletteColour0','#ff0090'),set('diagramPaletteColour1','#00ff90')];
    await new Promise(x=>setTimeout(x,600));
    const ab=document.getElementById('applyDiagramPaletteButton'); if(ab) ab.click();
    await new Promise(x=>setTimeout(x,1800));
    return ok;
  })()`);
  const svgAfter = await page.evaluate(`(document.querySelector('#diagram svg')||{outerHTML:''}).outerHTML`);
  out.claim1.svgChanged = svgBefore !== svgAfter;
  out.claim1.colourInSvg = svgAfter.indexOf('#ff0090') >= 0 || svgAfter.toLowerCase().indexOf('ff0090') >= 0;
  out.claim1.notes = await page.evaluate(`(() => { const n=document.getElementById('diagramPaletteNotes');
    return n?n.textContent.replace(/[ ]+/g,' ').trim().slice(0,180):null; })()`);

  // ---- CLAIM 2: two direction controls ----
  out.claim2={};
  out.claim2.styleDirection = await page.evaluate(`(() => { const c=document.getElementById('direction');
    if(!c) return {absent:true}; const w=c.closest('div,fieldset');
    return { disabled:!!c.disabled, ariaDisabled:c.getAttribute('aria-disabled'), value:c.value, opts:c.options.length,
      wrapHidden: w?(w.hasAttribute('hidden')||getComputedStyle(w).display==='none'):false,
      hint: (document.getElementById('directionHint')||{textContent:''}).textContent.replace(/[ ]+/g,' ').trim().slice(0,140) }; })()`);
  out.claim2.buildDirection = await page.evaluate(`(() => { const c=document.getElementById('visualDirection');
    if(!c) return {absent:true}; const r=c.getBoundingClientRect();
    return { disabled:!!c.disabled, value:c.value, opts:c.options.length, w:Math.round(r.width) }; })()`);
  const srcBefore = await page.evaluate(`document.getElementById('source').value.split(String.fromCharCode(10))[0]`);
  out.claim2.viaBuild = await page.evaluate(`(async () => {
    const c=document.getElementById('visualDirection'); if(!c) return 'absent';
    c.value='LR'; c.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(x=>setTimeout(x,1800));
    return document.getElementById('source').value.split(String.fromCharCode(10))[0];
  })()`);
  out.claim2.srcBefore = srcBefore;

  out.errors=errors.slice(0,8);
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/two_claims.json',JSON.stringify(out,null,1));
  console.log(JSON.stringify(out,null,1));
  await close();
})().catch(e=>{console.error('PROBE ERROR',e);process.exit(1);});
