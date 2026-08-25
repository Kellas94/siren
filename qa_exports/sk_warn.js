const fs=require('fs'),path=require('path');
const lib=require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP=process.argv[2],PORT=Number(process.argv[3]);
function chain(n){const l=['flowchart TD'];for(let i=1;i<n;i++)l.push('  N'+i+'[Control activity '+i+' reviewed] -->|Reconciliation'+i+'| N'+(i+1)+'[Control activity '+(i+1)+' reviewed]');return l.join('\n');}
async function rc(page,sel){const b=await page.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width};})()`);if(!b||!b.w)throw new Error('no '+sel);await page.mouse.click(b.x,b.y);}
(async()=>{const {page,errors,close}=await lib.openApp(APP,PORT,{width:1440,height:900});
for(const n of [8,12]){
  const src=chain(n);
  await lib.setSource(page,src,3500);
  const ok=(await page.evaluate(`document.getElementById('source').value`))===src;
  await rc(page,'#exportButton');await page.waitForTimeout(600);
  const dl=page.waitForEvent('download',{timeout:120000});dl.catch(()=>{});
  await rc(page,'#exportPptxButton');
  try{const d=await dl;await d.saveAs(path.join('C:/Claude/SIREN/qa_exports/sk_tmp','warn'+n+'.pptx'));}catch(e){}
  await page.waitForTimeout(500);
  const st=await page.evaluate(`(()=>{const e=document.getElementById('exportStatus');return e?{t:e.textContent.trim(),s:e.getAttribute('data-state')}:null;})()`);
  console.log('n='+n+' srcOK='+ok+' status='+JSON.stringify(st));
  await page.keyboard.press('Escape');await page.waitForTimeout(400);
}
console.log('errors',JSON.stringify(errors));
await close();})().catch(e=>{console.error('FATAL',e);process.exit(1);});
