import test from 'node:test';import assert from 'node:assert/strict';
let createShellFlowMailbox;
try{({createShellFlowMailbox}=await import('./terminal-shell-flow-mailbox.mjs'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
function setup(change={}){assert.equal(typeof createShellFlowMailbox,'function','MISSING_MAILBOX');const files=new Map(),writes=[];let t=0;
 const fs={lstat:async p=>{if(p.includes('reply-')&&!files.has(p)){const e=Error();e.code='ENOENT';throw e;}return {isSymbolicLink:()=>false,isDirectory:()=>true,isFile:()=>true,size:files.has(p)?Buffer.byteLength(files.get(p)):100};},
  writeFile:async(p,s,options)=>{assert.equal(options.flag,'wx');assert.equal(files.has(p),false);files.set(p,s);writes.push(p);},
  rename:async(a,b)=>{files.set(b,files.get(a));const m=b.match(/control-(\d+)\.json$/);if(m){const packet=JSON.parse(files.get(b));files.set(b.replace('control-','reply-'),JSON.stringify({sequence:packet.sequence,kind:packet.kind,admitted:false,result:{ok:true}}));}},
  readFile:async p=>Buffer.from(files.get(p)),...change};
 const mailbox=createShellFlowMailbox({directory:'C:/inert/Șiren project',fs,now:()=>t,delay:async()=>{t+=1000;},isAlive:()=>true});return {mailbox,files,writes};
}
test('mailbox atomically creates bounded controls and checks reply identity',async()=>{const r=setup();const reply=await r.mailbox.exchange({sequence:0,kind:'snapshot',fromSequence:0});assert.equal(reply.sequence,0);assert.equal(r.writes.length,1);assert.match(r.writes[0],/pending$/);});
test('out-of-order sequence and oversized packets refuse before file creation',async()=>{const r=setup();await assert.rejects(r.mailbox.exchange({sequence:1,kind:'snapshot',fromSequence:0}));await assert.rejects(r.mailbox.exchange({sequence:0,kind:'input',generation:1,data:'x'.repeat(65536)}));assert.equal(r.writes.length,0);});
test('linked reply and oversized reply refuse without consuming content',async()=>{let reads=0;const r=setup({lstat:async p=>({isSymbolicLink:()=>p.includes('reply-'),isDirectory:()=>true,isFile:()=>true,size:300000}),readFile:async()=>{reads++;return Buffer.from('{}');}});await assert.rejects(r.mailbox.exchange({sequence:0,kind:'snapshot',fromSequence:0}));assert.equal(reads,0);});
test('missing replies expire on monotonic deadline, without retrying writes',async()=>{const r=setup({rename:async()=>{}});await assert.rejects(r.mailbox.exchange({sequence:0,kind:'snapshot',fromSequence:0}),/DEADLINE/);assert.equal(r.writes.length,1);});
