// Bounded CI-only failure evidence. Importing this module starts no process.
import assert from 'node:assert/strict';
const message=e=>String(e?.message??e).slice(0,4096);
export async function readShellFlowRecords({fs,path}){
 const result={missingRecords:[]};
 for(const [key,name] of [['observer','observer-result'],['native','native-result'],['ready','flow-first-ready'],['finish','flow-finish-ready']]){
  const file=name+'.json';
  try{const st=await fs.lstat(path(file));assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.size<=262144,'FLOW_RECORD_BUDGET');const bytes=await fs.readFile(path(file));assert.ok(bytes.length<=262144,'FLOW_RECORD_BUDGET');result[key]=JSON.parse(bytes);}
  catch(e){if(e.code!=='ENOENT')throw e;result.missingRecords.push(file);}
 }
 return result;
}
export async function captureShellFlowFailure({fs,path,controller}){
 const result={};
 try{if(controller)result.controller=controller.snapshot();}catch(e){result.controllerError=message(e);}
 try{
  if(controller){
   const reply=await controller.read(0);assert.ok(reply.result&&reply.stats,'FLOW_DIAGNOSTIC_UNAVAILABLE');
   const r=reply.result;assert.ok(Array.isArray(r.chunks)&&r.chunks.length<=256,'FLOW_DIAGNOSTIC_CAPACITY');
   let bytes=0;for(const c of r.chunks){assert.ok(typeof c.data==='string'&&c.data.isWellFormed()&&Buffer.byteLength(c.data)===c.utf8Bytes);bytes+=c.utf8Bytes;}assert.ok(bytes<=32768,'FLOW_DIAGNOSTIC_CAPACITY');
   const output={stats:reply.stats,gap:r.gap??null,chunks:r.chunks,ptyExit:Object.hasOwn(r,'ptyExit')?r.ptyExit:{observed:false,reason:'NO_PTY_EVENT_REPLY'},outputError:r.outputError??null};
   assert.ok(Buffer.byteLength(JSON.stringify(output))<=65536,'FLOW_DIAGNOSTIC_CAPACITY');result.output=output;
  }else result.outputUnavailable='CONTROLLER_NOT_CREATED';
 }catch(e){result.outputUnavailable=message(e);}
 if(path){
  try{
   const file=path('shell-flow-terminal-state.json'),st=await fs.lstat(file);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.size<=262144,'FLOW_TERMINAL_STATE_REFUSED');
   const bytes=await fs.readFile(file);assert.ok(bytes.length<=262144,'FLOW_TERMINAL_STATE_REFUSED');const state=JSON.parse(bytes);
   assert.ok(state.admitted===false&&state.scope==='CI_WORKER_FIRST_TERMINAL_EVENT_ONLY','FLOW_TERMINAL_STATE_REFUSED');
   let outputBytes=0;assert.ok(Array.isArray(state.output?.chunks)&&state.output.chunks.length<=256,'FLOW_TERMINAL_STATE_REFUSED');
   for(const c of state.output.chunks){assert.ok(typeof c.data==='string'&&c.data.isWellFormed()&&Buffer.byteLength(c.data)===c.utf8Bytes);outputBytes+=c.utf8Bytes;}
   assert.ok(outputBytes<=32768,'FLOW_TERMINAL_STATE_REFUSED');result.workerTerminalState=state;
  }catch(e){result.workerTerminalStateUnavailable=e.code==='ENOENT'?'NOT_RECORDED':message(e);}
  result.missingReady=[];result.readyErrors={};
  for(const name of ['root','branch','grandchild','detached']){
   try{const st=await fs.lstat(path(name+'.ready'));assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.size<=16,'FLOW_READY_REFUSED');const bytes=await fs.readFile(path(name+'.ready'));assert.ok(bytes.length<=16&&/^[1-9][0-9]{0,9}$/.test(bytes.toString('utf8')),'FLOW_READY_REFUSED');}
   catch(e){if(e.code==='ENOENT')result.missingReady.push(name+'.ready');else result.readyErrors[name+'.ready']=message(e);}
  }
 }
 return result;
}
