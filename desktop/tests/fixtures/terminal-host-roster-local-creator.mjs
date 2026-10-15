// Native createSession supplies exactly one fixed directory argument.
import {spawn} from 'node:child_process';
import {writeFileSync,renameSync,existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const dir=process.argv[2],config=JSON.parse(readFileSync(join(dir,'config.json'),'utf8'));
const shell=spawn(process.execPath,[config.payload,'shell',dir],{cwd:dir,stdio:'ignore',windowsHide:true});
const timer=setInterval(()=>{
 if(!existsSync(join(dir,'shell-'+shell.pid+'.json')))return;
 clearInterval(timer);const p=join(dir,'creator-'+process.pid+'.json');
 writeFileSync(p+'.tmp',JSON.stringify({creatorPid:process.pid,shellPid:shell.pid}),{flag:'wx'});renameSync(p+'.tmp',p);
},5);
setTimeout(()=>process.exit(122),30000);
