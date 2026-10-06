import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const slice=(start,end)=>{const from=main.indexOf(start),to=main.indexOf(end,from);assert.ok(from>=0&&to>from,'Actual production boundary must exist');return main.slice(from,to);};
test('actual Docs export main handler tracks the real promise and rejects all transition fences before invoking service',async()=>{
 let handler,release,calls=0;const writes=new Set(),context={ipcMain:{handle:(name,fn)=>{assert.equal(name,'siren:docs-export');handler=fn;}},docsExports:{invoke:()=>{calls++;return new Promise(r=>release=r);}},writes,pinTransition:false,workspaceBarrier:null,accountTransition:false,accountQuiesced:false,nativeShellFailure:false};
 runInNewContext(slice("ipcMain.handle('siren:docs-export'","ipcMain.handle('siren:deck-navigation'"),context);
 const pending=handler({},'exportSaved',{});assert.equal(writes.size,1);release({ok:true});assert.equal((await pending).ok,true);assert.equal(writes.size,0);
 for(const target of [[context,'pinTransition'],[context,'workspaceBarrier'],[context,'accountTransition'],[context,'accountQuiesced'],[context,'nativeShellFailure'],[writes,'selectionTransition'],[writes,'selectionQuiesced'],[writes,'viewClosing']]){target[0][target[1]]=true;assert.equal((await handler({},'exportSaved',{})).code,'ACCESS_REFUSED');target[0][target[1]]=false;}
 assert.equal(calls,1);
});
test('actual all-window preparation pauses, drains and checks Docs exporter before issuing quiescence',async()=>{
 const actions=[];let idle=true;const part=name=>({pause:()=>actions.push(name+':pause'),resume:()=>actions.push(name+':resume'),drain:async()=>actions.push(name+':drain'),isIdle:()=>name!=='docs'||idle});
 const owner={...part('owner'),captureQuiescence:()=>{actions.push('proof');return'proof';},isQuiescent:()=>true};
 const context={workspaceOwner:owner,presentationSession:part('present'),sourceAnalysis:part('analysis'),diagramExports:part('diagram'),docsExports:part('docs')};
 const actual=runInNewContext('(()=>{'+slice('  const capturedPresentation=presentationSession;','  workspaceBarrier=new NativeAllWorkspaceBarrier')+'return barrierOwner;})()',context);
 actual.pause('Lock');assert.ok(actions.includes('docs:pause'));await actual.drain();assert.ok(actions.includes('docs:drain'));assert.equal(actual.captureQuiescence(),'proof');idle=false;assert.throws(()=>actual.captureQuiescence());assert.equal(actual.isQuiescent('proof'),false);actual.resume();assert.ok(actions.includes('docs:resume'));
});
test('actual native retirement refuses uncertain Docs cleanup instead of proceeding to view destruction',async()=>{
 let reached=false;const context={diagramExports:{pause(){},isIdle:()=>true,resume(){}},docsExports:{pause(){},isIdle:()=>false,resume(){}},presentationSession:{dispose:()=>reached=true}};
 const prefix=slice('const retireNativeViews = async () => {','  presentationSession.dispose();');const retire=runInNewContext(prefix+'presentationSession.dispose();};retireNativeViews;',context);await assert.rejects(retire(),/Docs export not drained/);assert.equal(reached,false);
});
