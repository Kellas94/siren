#!/usr/bin/env node
/* Scroll the left pane to the Style section AT REST (nothing clicked) and photograph it,
 * so the fold-state reading can be checked against what a person actually sees.
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg=(n,d)=>{const i=argv.indexOf('--'+n);return i>=0&&argv[i+1]?argv[i+1]:d;};
const APP=arg('app','C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT=Number(arg('port','9868'));
const NL=String.fromCharCode(10);
const FLOW=['flowchart TD','  A[Purchase request] --> B{Approved}','  B -->|Yes| C[Raise order]','  B -->|No| D[Reject]'].join(NL);
const KILL=`(async()=>{for(let p=0;p<22;p++){const b=Array.from(document.querySelectorAll('.tour-card button')).find(x=>/skip|done|got it|close|next|finish/i.test(x.textContent));if(!b){await new Promise(r=>setTimeout(r,140));continue;}b.click();await new Promise(r=>setTimeout(r,170));}return 1;})()`;

(async()=>{
  const {page,close}=await openApp(APP,PORT,{width:1440,height:900});
  await page.evaluate(KILL);
  await setSource(page,FLOW,3200);
  await page.evaluate(KILL);
  await page.waitForTimeout(600);
  const fx = await page.evaluate(`document.getElementById('source').value.split(String.fromCharCode(10))[0]`);
  console.log('FIXTURE', fx);

  // Find the scroller that actually holds diagramFontFamily and scroll it there, touching nothing else.
  const info = await page.evaluate(`(() => {
    const f=document.getElementById('diagramFontFamily');
    let sc=f.parentElement, scroller=null;
    while(sc&&sc!==document.documentElement){ if(sc.scrollHeight>sc.clientHeight+30){scroller=sc;break;} sc=sc.parentElement; }
    const before = scroller?scroller.scrollTop:window.scrollY;
    f.scrollIntoView({block:'center'});
    const after = scroller?scroller.scrollTop:window.scrollY;
    const r=f.getBoundingClientRect();
    return { scroller: scroller?(scroller.id||scroller.className.toString().slice(0,40)):'window',
      scrollBefore:Math.round(before), scrollAfter:Math.round(after), distance:Math.round(after-before),
      nowTop:Math.round(r.top),
      foldChevrons: Array.from(document.querySelectorAll('details.style-fold')).map(d=>({
        name:(d.querySelector('summary')||{textContent:''}).textContent.replace(/[ ]+/g,' ').trim().slice(0,24),
        open:d.open })) };
  })()`);
  await page.waitForTimeout(700);
  console.log(JSON.stringify(info,null,1));
  await page.screenshot({path:'C:/Claude/SIREN/qa_exports/shot_style_area_at_rest.png'});
  await close();
})().catch(e=>{console.error(e);process.exit(1);});
