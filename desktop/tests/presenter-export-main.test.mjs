import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const slice=(a,b)=>{const x=main.indexOf(a),y=main.indexOf(b,x);assert.ok(x>=0&&y>x,'Actual production boundary missing');return main.slice(x,y);};
test('actual Presenter export main handler tracks promise and refuses every transition fence',async()=>{
 let handler,release,calls=0;const writes=new Set(),context={ipcMain:{handle:(name,fn)=>{assert.equal(name,'siren:presenter-export');handler=fn;}},presenterExports:{invoke:()=>{calls++;return new Promise(r=>release=r);}},writes,pinTransition:false,workspaceBarrier:null,accountTransition:false,accountQuiesced:false,nativeShellFailure:false};
 runInNewContext(slice("ipcMain.handle('siren:presenter-export'",'const invokeNativeWindow='),context);
 const pending=handler({},'exportNotes',{});assert.equal(writes.size,1);release({ok:true});assert.equal((await pending).ok,true);assert.equal(writes.size,0);
 for(const target of [[context,'pinTransition'],[context,'workspaceBarrier'],[context,'accountTransition'],[context,'accountQuiesced'],[context,'nativeShellFailure'],[writes,'selectionTransition'],[writes,'selectionQuiesced'],[writes,'viewClosing']]){target[0][target[1]]=true;assert.equal((await handler({},'exportNotes',{})).code,'ACCESS_REFUSED');target[0][target[1]]=false;}assert.equal(calls,1);
});
test('actual native barrier pauses/drains Presenter exports and refuses proof on uncertain cleanup',async()=>{
 const actions=[];let idle=true;const part=name=>({pause:()=>actions.push(name+':pause'),resume:()=>actions.push(name+':resume'),drain:async()=>actions.push(name+':drain'),isIdle:()=>name!=='notes'||idle});
 const owner={...part('owner'),captureQuiescence:()=>true,isQuiescent:()=>true},context={workspaceOwner:owner,presentationSession:part('session'),sourceAnalysis:part('analysis'),diagramExports:part('diagram'),docsExports:part('docs'),presenterExports:part('notes')};
 const barrier=runInNewContext('(()=>{'+slice('  const capturedPresentation=presentationSession;','  workspaceBarrier=new NativeAllWorkspaceBarrier')+'return barrierOwner;})()',context);barrier.pause('Lock');assert.ok(actions.includes('notes:pause'));await barrier.drain();assert.ok(actions.includes('notes:drain'));assert.equal(barrier.captureQuiescence(),true);idle=false;assert.throws(()=>barrier.captureQuiescence());assert.equal(barrier.isQuiescent(true),false);barrier.resume();assert.ok(actions.includes('notes:resume'));
});

test('actual native retirement refuses uncertain Presenter export cleanup before session/view destruction',async()=>{
 let reached=false;const part={pause(){},isIdle:()=>true,resume(){}},context={diagramExports:part,docsExports:part,presenterExports:{...part,isIdle:()=>false},presentationSession:{dispose:()=>reached=true}};
 const retire=runInNewContext(slice('const retireNativeViews = async () => {','  presentationSession.dispose();')+'presentationSession.dispose();};retireNativeViews;',context);await assert.rejects(retire(),/Presenter export not drained/);assert.equal(reached,false);
});
