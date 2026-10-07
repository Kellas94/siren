import { launchDesktop } from './drive.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
const d = await launchDesktop();
try {
  await delay(2000);
  console.log(JSON.stringify(await d.evaluate(`(async()=>{
    const scripts=await Promise.all([...document.scripts].map(async s=>{
      const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s.textContent)));
      return {id:s.id,length:s.textContent.length,hash:btoa(String.fromCharCode(...bytes))};
    }));
    return {version:document.getElementById('brandVersion').textContent,scripts,csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,indexedDB:!!indexedDB};
  })()`), null, 2));
  const raw = [...(await readFile('generated/app.html', 'utf8')).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)][2][2];
  const dom = await d.evaluate('document.scripts[2].textContent');
  const diffs=[];
  for(let i=0;i<Math.max(raw.length,dom.length)&&diffs.length<5;i++) if(raw[i]!==dom[i]) diffs.push({offset:i,raw:raw.codePointAt(i),dom:dom.codePointAt(i),context:raw.slice(i-40,i+40)});
  console.log(JSON.stringify({diffs,rawLength:raw.length,domLength:dom.length}));
} finally { console.log(d.logs()); await d.close(); }
