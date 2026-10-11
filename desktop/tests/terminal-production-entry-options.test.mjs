// Evaluate only the fixed provider adapter with inert stubs. Never import the
// actual creator entry, node-pty or a native addon, and never spawn a process.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/terminal/production-creator-entry.mjs',import.meta.url),'utf8');
function adapter(spawn,pty={}){
 const start=source.indexOf('spawn(executable,args,options){'),end=source.indexOf('\n     }}));',start);
 assert.ok(start>0&&end>start);
 return runInNewContext('({'+source.slice(start,end)+'\n}})',{spawn,pty,Reflect}).spawn;
}
function terminal(overrides={}){return{_agent:{_useConpty:true,_useConptyDll:false},pid:81,write(){},resize(){},onData(){return{dispose(){}};},onExit(){return{dispose(){}};},...overrides};}
function options(){return Object.freeze({cwd:'C:\\Project țară',env:Object.freeze({SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32'}),cols:120,rows:40,useConpty:true,useConptyDll:false,handleFlowControl:false});}

test('actual entry adapter supports node-pty 1.1.0 option initialization without mutating startup authority',()=>{
 const original=options(),args=Object.freeze(['-NoLogo','-NoProfile']),pty={};let seen;
 const run=adapter(function(executable,argv,opt){
  assert.equal(this,pty);assert.equal(executable,'powershell.exe');assert.equal(argv,args);
  // The pinned windowsTerminal.js constructor unconditionally does this in
  // strict mode, even when env already exists. It fails on a frozen object.
  opt.env=opt.env||{SHOULD_NOT_BE_USED:'fallback'};seen=opt;return terminal();
 },pty);
 assert.equal(run('powershell.exe',args,original).pid,81);
 assert.notEqual(seen,original);assert.deepEqual(seen.env,original.env);
 assert.deepEqual({...seen},{...original});assert.equal(Object.isFrozen(original),true);
});

test('provider mutations of its option object cannot alter retained startup configuration',()=>{
 const original=options();const run=adapter((_exe,_args,opt)=>{opt.cols=1;opt.cwd='C:\\Provider';return terminal();});
 run('powershell.exe',[],original);assert.equal(original.cols,120);assert.equal(original.cwd,'C:\\Project țară');
});

test('mutable provider boundary still refuses winpty and bundled ConPTY DLL backends',()=>{
 for(const agent of [{_useConpty:false,_useConptyDll:false},{_useConpty:true,_useConptyDll:true}]){
  const run=adapter(()=>terminal({_agent:agent}));assert.throws(()=>run('powershell.exe',[],options()),/CREATOR_CONPTY_BACKEND_REFUSED/);
 }
});

test('normalized callbacks retain the actual provider receiver and reject missing API',()=>{
 const seen=[],term=terminal({write(data){assert.equal(this,term);seen.push(data);}});
 const run=adapter(()=>term),normalized=run('powershell.exe',[],options());normalized.write('literal');assert.deepEqual(seen,['literal']);
 assert.throws(()=>adapter(()=>terminal({resize:undefined}))('powershell.exe',[],options()),/CREATOR_PTY_API_REFUSED/);
});
