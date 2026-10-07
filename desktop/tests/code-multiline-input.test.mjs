import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState,EditorSelection,Transaction} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {history,undo,redo} from '@codemirror/commands';
import {preserveMultilineInput} from '../src/ui/code/multiline-input.js';
function fixture({readonly=false,editable=true,composing=false}={}){
 let state=EditorState.create({doc:'def first():\n    pass\n',selection:{anchor:22},extensions:[history(),EditorState.readOnly.of(readonly),EditorView.editable.of(editable)]}),prevented=0;const transactions=[];
 const view={get state(){return state;},composing,dispatch(...specs){const transaction=state.update(...specs);transactions.push(transaction);state=transaction.state;}};
 return {view,transactions,event:extra=>({isTrusted:true,cancelable:true,inputType:'insertText',data:'\ndef next():\n    return "Ș😀"\n',preventDefault(){prevented++;},...extra}),prevented:()=>prevented};
}
test('trusted multiline beforeinput preserves blank LF at EOF as one ordinary undoable typed transaction',()=>{
 const f=fixture(),original=f.view.state.doc.toString(),event=f.event();assert.equal(preserveMultilineInput(event,f.view),true);assert.equal(f.prevented(),1);assert.equal(f.view.state.doc.toString(),original+event.data);assert.equal(f.transactions[0].annotation(Transaction.userEvent),'input.type');assert.equal(undo(f.view),true);assert.equal(f.view.state.doc.toString(),original);assert.equal(redo(f.view),true);assert.equal(f.view.state.doc.toString(),original+event.data);
});
test('composition, untrusted/noncancelable events, single-line input, paste and disabled/read-only editing retain their existing handlers',()=>{
 for(const extra of [{isTrusted:false},{cancelable:false},{isComposing:true},{inputType:'insertFromPaste'},{data:'one line'},{data:null},{defaultPrevented:true}]){const f=fixture();assert.equal(preserveMultilineInput(f.event(extra),f.view),false);assert.equal(f.transactions.length,0);assert.equal(f.prevented(),0);}
 for(const options of [{readonly:true},{editable:false},{composing:true}]){const f=fixture(options);assert.equal(preserveMultilineInput(f.event(),f.view),false);assert.equal(f.transactions.length,0);}
});
test('normal selection replacement and multiple blank lines use exact state offsets and retain Unicode',()=>{
 const f=fixture();f.view.dispatch({selection:EditorSelection.single(4,9)});const before=f.view.state.doc.toString(),text='\n\nȘ😀\n';assert.equal(preserveMultilineInput(f.event({data:text}),f.view),true);assert.equal(f.view.state.doc.toString(),before.slice(0,4)+text+before.slice(9));
});
