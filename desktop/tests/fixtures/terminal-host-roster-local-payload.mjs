// Fixed fixture, bounded natural lifetime. No user commands or product loader.
import {writeFileSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const [role,dir]=process.argv.slice(2);
if(!['host','canary','shell'].includes(role)||!dir)process.exit(2);
const p=join(dir,role==='shell'?'shell-'+process.pid+'.json':role+'-ready.json');
writeFileSync(p+'.tmp',JSON.stringify({pid:process.pid}),{flag:'wx'});renameSync(p+'.tmp',p);
setTimeout(()=>process.exit(122),30000);
if(role==='canary')setInterval(()=>{if(existsSync(join(dir,'canary-release.txt')))process.exit(0);},5);
