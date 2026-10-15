import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Text,EditorState,Transaction} from '@codemirror/state';
import {history,undo as cmUndo,redo as cmRedo,undoSelection as cmUndoSelection,redoSelection as cmRedoSelection,undoDepth,redoDepth,isolateHistory} from '@codemirror/commands';
import {keymap,runScopeHandlers} from '@codemirror/view';
import {createEditorAdapter} from '../src/ui/code/editor-adapter.js';
import * as sourceHistory from '../src/ui/code/source-newlines.js';

const sha=text=>createHash('sha256').update(Buffer.from(text)).digest('hex');
const projection=text=>text.replace(/\r(?!\n)/g,'\n');
// The fallback retains an executable regression against the original v1 API.
// A separate contract assertion below requires the corrected source commands.
const sourceUndo=sourceHistory.sourceUndo??cmUndo,sourceRedo=sourceHistory.sourceRedo??cmRedo;
async function fixture(t,original,{readonly=false}={}){
 let native=original,ref={sourceId:'raw-history',version:1,sha256:sha(original)},fenced=false,editGate=null,commitGate=null;const initial={...ref},writes=[];
 const client={getState:()=>({...ref,disposed:false,fenced}),
  loadDocument:async()=>({ok:true,...initial,doc:Text.of(original.split('\n')),metrics:{utf8Bytes:Buffer.byteLength(original),utf16Units:original.length}}),
  applyEdit:async edit=>{if(editGate)await editGate.promise;assert.equal(edit.expectedVersion,ref.version);native=native.slice(0,edit.start)+edit.insertedText+native.slice(edit.end);ref={...ref,version:ref.version+1,sha256:sha(native)};writes.push({...edit,raw:native,utf8Hex:Buffer.from(native).toString('hex'),sha256:ref.sha256});return {ok:true,...ref,operationId:edit.operationId,durability:'draft'};},
  commitSource:async request=>{if(commitGate)await commitGate.promise;return {ok:true,...ref,operationId:request.operationId,durability:'committed'};}};
 const editor=createEditorAdapter({client,readonly,extensions:[history(),EditorState.allowMultipleSelections.of(true),keymap.of(sourceHistory.sourceHistoryKeymap??[])]});t.after(()=>{editGate?.release();commitGate?.release();editor.dispose();});assert.equal((await editor.open(initial)).ok,true);
 const hold=kind=>{let release;const gate={promise:new Promise(resolve=>{release=resolve;}),release:()=>{release();if(kind==='edit')editGate=null;else commitGate=null;}};if(kind==='edit')editGate=gate;else commitGate=gate;return gate.release;};
 return {editor,writes,native:()=>native,fence:()=>{fenced=true;},hold,target:()=>({state:editor.getState(),dispatch:transaction=>assert.equal(editor.applyTransaction(transaction).ok,true)})};
}
function exact(f,expected){assert.equal(f.editor.getSourceText().toString('\n'),expected,'raw source');assert.equal(f.editor.getState().doc.toString('\n'),projection(expected),'actual display projection');assert.equal(f.editor.getState().doc.length,expected.length);assert.equal(f.native(),expected,'recording persistence boundary');assert.equal(f.editor.getStatus().sourceRef.sha256,sha(expected));}

test('isolated raw history mapped through non-history edits never resurrects a display-only CRLF repair',async t=>{
 const original='\nab\r\n',f=await fixture(t,original);
 let control=EditorState.create({doc:Text.of(original.split('\n')),extensions:[history(),EditorState.lineSeparator.of('\n')]});
 const edits=[{from:4,to:5,insert:'\r'},{from:1,to:1,insert:'Ω😀'},{from:2,to:8,insert:'',nonHistory:true},{from:0,to:1,insert:'Ω😀'},{from:0,to:1,insert:'\r\r'},{from:0,to:5,insert:'Ω😀',nonHistory:true}];
 for(const [step,edit]of edits.entries()){
  const annotations=[Transaction.userEvent.of('input.type'),Transaction.time.of(100000+step),isolateHistory.of('full')];if(edit.nonHistory)annotations.push(Transaction.addToHistory.of(false));
  const spec={changes:{from:edit.from,to:edit.to,insert:edit.insert},annotations};control=control.update(spec).state;
  assert.equal(f.editor.applyTransaction(f.editor.getState().update(spec)).ok,true);assert.equal((await f.editor.flush()).ok,true);exact(f,control.doc.toString('\n'));
 }
 const controlTarget=()=>({state:control,dispatch:transaction=>{control=transaction.state;}});
 for(const [command,sourceCommand,depth]of [[cmUndo,sourceUndo,undoDepth],[cmRedo,sourceRedo,redoDepth]]){
  let steps=0;while(depth(control)){assert.equal(command(controlTarget()),true);assert.equal(sourceCommand(f.target()),true);assert.equal((await f.editor.flush()).ok,true);exact(f,control.doc.toString('\n'));assert(++steps<10);}
 }
});

test('source history exposes commands separate from projected CM history',()=>{
 assert.equal(typeof sourceHistory.sourceUndo,'function');assert.equal(typeof sourceHistory.sourceRedo,'function');
});

test('refused, paused, saving, fenced and stale history transactions do not consume raw history',async t=>{
 for(const mode of ['paused','saving','fenced','stale']){
  const f=await fixture(t,'a\r\nb');assert.equal(f.editor.dispatch({changes:{from:2,to:3,insert:'\r'},annotations:[Transaction.userEvent.of('input.type'),isolateHistory.of('full')]}).ok,true);await f.editor.flush();
  const before=f.editor.getState(),depth=sourceHistory.sourceUndoDepth(before);let transaction;
  assert.equal(sourceUndo({state:before,dispatch:next=>{transaction=next;}}),true);assert.equal(f.editor.getState(),before,'constructing a history transaction does not admit it');
  let finish=null,expected;
  if(mode==='paused'){f.editor.pauseView();expected='EDITOR_PAUSED';}
  if(mode==='saving'){const release=f.hold('commit'),saving=f.editor.flush();finish=async()=>{release();await saving;};expected='EDITOR_SAVING';}
  if(mode==='fenced'){f.fence();expected='EDITOR_IDENTITY_CHANGED';}
  if(mode==='stale'){assert.equal(f.editor.dispatch({selection:{anchor:0}}).ok,true);expected='EDITOR_STALE_TRANSACTION';}
  const admittedState=f.editor.getState();assert.equal(f.editor.applyTransaction(transaction).code,expected);assert.equal(f.editor.getState(),admittedState);assert.equal(sourceHistory.sourceUndoDepth(f.editor.getState()),depth);
  if(finish)await finish();
  if(mode==='paused'){assert.equal(f.editor.resumeView().ok,true);assert.equal(sourceUndo(f.target()),true);await f.editor.flush();exact(f,'a\r\nb');}
 }
});

test('queue-full history refusal preserves the same raw stack and optimistic document',async t=>{
 const f=await fixture(t,'a\rb'),release=f.hold('edit');
 for(let step=0;step<64;step++)assert.equal(f.editor.dispatch({changes:{from:0,insert:'x'},annotations:isolateHistory.of('full')}).ok,true);
 const before=f.editor.getState(),depth=sourceHistory.sourceUndoDepth(before);let result;
 assert.equal(sourceUndo({state:before,dispatch:transaction=>{result=f.editor.applyTransaction(transaction);}}),true);
 assert.equal(result.code,'EDITOR_QUEUE_FULL');assert.equal(f.editor.getState(),before);assert.equal(sourceHistory.sourceUndoDepth(before),depth);
 release();await f.editor.flush();assert.equal(sourceUndo(f.target()),true);await f.editor.flush();exact(f,'x'.repeat(63)+'a\rb');
});

test('installed keymap dispatcher routes Ctrl-Z, Shift-Ctrl-Z and Ctrl-Y to source history with no empty fallthrough',async t=>{
 const f=await fixture(t,'a\r\nb');let viewState=f.editor.getState(),fallthrough=0,updates=0;
 const view={get state(){return viewState;},dispatch(transaction){assert.equal(transaction.startState,viewState);const admitted=f.editor.applyTransaction(transaction);if(admitted.ok){viewState=transaction.state;updates++;assert.equal(viewState,f.editor.getState(),'the same actual projected transaction is adopted by adapter and view');}}};
 const event=(key,shiftKey=false)=>({key,keyCode:key.toUpperCase().charCodeAt(0),ctrlKey:true,metaKey:false,altKey:false,shiftKey,preventDefault(){},stopPropagation(){}});
 assert.equal(f.editor.dispatch({changes:{from:2,to:3,insert:'\r'},annotations:isolateHistory.of('full')}).ok,true);viewState=f.editor.getState();await f.editor.flush();
 assert.equal(runScopeHandlers(view,event('z'),'editor'),true);await f.editor.flush();exact(f,'a\r\nb');
 assert.equal(runScopeHandlers(view,event('Z',true),'editor'),true);await f.editor.flush();exact(f,'a\r\rb');
 assert.equal(runScopeHandlers(view,event('z'),'editor'),true);await f.editor.flush();
 assert.equal(runScopeHandlers(view,event('y'),'editor'),true);await f.editor.flush();exact(f,'a\r\rb');
 assert.equal(runScopeHandlers(view,event('y'),'editor'),true);assert.equal(sourceHistory.sourceRedoDepth(view.state),0);assert.equal(updates,4);
 const empty=await fixture(t,'x',{readonly:true});const target={state:empty.editor.getState(),dispatch(){fallthrough++;}};
 for(const binding of sourceHistory.sourceHistoryKeymap)assert.equal(binding.run(target),true);assert.equal(fallthrough,0);
});

test('history beforeinput is handled once, including empty and readonly history',async t=>{
 const f=await fixture(t,'a\rb');f.editor.dispatch({changes:{from:1,to:2,insert:'\n'}});await f.editor.flush();let prevented=0;
 const input=inputType=>({inputType,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;prevented++;}});
 const undoEvent=input('historyUndo');assert.equal(sourceHistory.sourceHistoryInput(undoEvent,f.target()),true);await f.editor.flush();exact(f,'a\rb');
 assert.equal(sourceHistory.sourceHistoryInput(undoEvent,f.target()),true);assert.equal(prevented,1,'an already consumed event cannot dispatch again');
 assert.equal(sourceHistory.sourceHistoryInput(input('historyRedo'),f.target()),true);await f.editor.flush();exact(f,'a\nb');
 assert.equal(sourceHistory.sourceHistoryInput(input('historyRedo'),f.target()),true);assert.equal(sourceHistory.sourceHistoryInput(input('insertText'),f.target()),false);
 const ro=await fixture(t,'a\rb',{readonly:true});assert.equal(sourceHistory.sourceHistoryInput(input('historyUndo'),ro.target()),true);exact(ro,'a\rb');
});

test('raw selection, user event, timestamp and isolation metadata retain standard CM history behavior',async t=>{
 const f=await fixture(t,'a\rb');let control=EditorState.create({doc:Text.of(['a\rb']),extensions:[history(),EditorState.lineSeparator.of('\n')]});
 for(const spec of [{selection:{anchor:2},annotations:[Transaction.userEvent.of('select.pointer'),Transaction.time.of(800)]},
  {changes:{from:1,to:2,insert:'\n'},selection:{anchor:2},annotations:[Transaction.userEvent.of('input.type'),Transaction.time.of(1000),isolateHistory.of('full')]},
  {changes:{from:3,insert:'x'},selection:{anchor:4},annotations:[Transaction.userEvent.of('input.type'),Transaction.time.of(1001),isolateHistory.of('full')]}]){
  control=control.update(spec).state;assert.equal(f.editor.applyTransaction(f.editor.getState().update(spec)).ok,true);
 }
 assert.equal(sourceHistory.sourceUndoDepth(f.editor.getState()),undoDepth(control));
 const controlTarget=()=>({state:control,dispatch:transaction=>{control=transaction.state;}});
 while(undoDepth(control)){cmUndo(controlTarget());sourceUndo(f.target());await f.editor.flush();exact(f,control.doc.toString());assert.deepEqual(f.editor.getState().selection.toJSON(),control.selection.toJSON());}
});

test('local edits and history retain raw rope sharing without whole-source serialization',async t=>{
 const original=Array.from({length:1000},(_,index)=>`row${index}\rvalue`).join('\n'),f=await fixture(t,original),before=f.editor.getSourceText();
 assert(before.children?.length>1);const stringify=Text.prototype.toString;let wholeSerializations=0;
 Text.prototype.toString=function(...args){if(this.length>1000)wholeSerializations++;return stringify.apply(this,args);};
 try{assert.equal(f.editor.dispatch({changes:{from:1,to:2,insert:'X'}}).ok,true);const after=f.editor.getSourceText();assert(after.children.some(child=>before.children.includes(child)),'unchanged raw rope branches are shared');assert.equal(sourceUndo(f.target()),true);assert.equal(sourceRedo(f.target()),true);}finally{Text.prototype.toString=stringify;}
 assert.equal(wholeSerializations,0);await f.editor.flush();exact(f,original.slice(0,1)+'X'+original.slice(2));
});

test('selection-only source history matches public CM selection history and obeys the admission barrier',async t=>{
 const f=await fixture(t,'a\rb');let control=EditorState.create({doc:Text.of(['a\rb']),extensions:[history(),EditorState.lineSeparator.of('\n')]});
 for(const [anchor,time]of [[1,2000],[2,3000]]){const spec={selection:{anchor},annotations:[Transaction.userEvent.of('select.pointer'),Transaction.time.of(time)]};control=control.update(spec).state;assert.equal(f.editor.applyTransaction(f.editor.getState().update(spec)).ok,true);}
 const before=f.editor.getState();f.editor.pauseView();let refused;
 assert.equal(sourceHistory.sourceUndoSelection({state:before,dispatch:transaction=>{refused=f.editor.applyTransaction(transaction);}}),true);
 assert.equal(refused.code,'EDITOR_PAUSED');assert.equal(f.editor.getState(),before);assert.equal(f.editor.resumeView().ok,true);
 const controlTarget=()=>({state:control,dispatch:transaction=>{control=transaction.state;}});
 for(const [rawCommand,sourceCommand]of [[cmUndoSelection,sourceHistory.sourceUndoSelection],[cmRedoSelection,sourceHistory.sourceRedoSelection]]){
  assert.equal(rawCommand(controlTarget()),true);assert.equal(sourceCommand(f.target()),true);assert.deepEqual(f.editor.getState().selection.toJSON(),control.selection.toJSON());exact(f,'a\rb');assert.equal(f.writes.length,0);
 }
});

test('multi-range raw inverses and redos preserve CRLF boundaries and exact queued write receipts',async t=>{
 const original='a\r\nb\rc\nd',f=await fixture(t,original),changes=[{from:2,to:3,insert:''},{from:4,to:5,insert:'\n'},{from:7,to:8,insert:'Ω😀'}];
 let control=EditorState.create({doc:Text.of(original.split('\n')),extensions:[history(),EditorState.lineSeparator.of('\n')]});const spec={changes,annotations:[Transaction.userEvent.of('input.paste'),Transaction.time.of(1234),isolateHistory.of('full')]};
 control=control.update(spec).state;assert.equal(f.editor.applyTransaction(f.editor.getState().update(spec)).ok,true);await f.editor.flush();exact(f,control.doc.toString());
 const controlTarget=()=>({state:control,dispatch:transaction=>{control=transaction.state;}});
 for(const [rawCommand,sourceCommand]of [[cmUndo,sourceUndo],[cmRedo,sourceRedo]]){rawCommand(controlTarget());assert.equal(sourceCommand(f.target()),true);await f.editor.flush();exact(f,control.doc.toString());}
 assert.equal(f.writes.length,9);assert.equal(f.writes.at(-1).sha256,sha(control.doc.toString()));
});
