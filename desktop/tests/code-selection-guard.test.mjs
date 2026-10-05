import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState,Transaction} from '@codemirror/state';
const module=await import('../src/ui/code/selection-guard.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('read-only toolbar focus retains selected range against delayed DOM selection after theme repaint',()=>{
 assert.equal(typeof module.readonlySelectionGuard,'function');
 let focused=false;
 const state=EditorState.create({doc:'def agent(): return context',selection:{anchor:4,head:9},extensions:[module.readonlySelectionGuard({readonly:true,isFocused:()=>focused})]});
 const repaint=state.update({selection:{anchor:16},annotations:Transaction.userEvent.of('select')});
 assert.deepEqual([repaint.state.selection.main.from,repaint.state.selection.main.to],[4,9]);
 assert.equal(repaint.state.doc.toString(),state.doc.toString());
 focused=true;
 assert.equal(state.update({selection:{anchor:16},userEvent:'select'}).state.selection.main.from,16);
});
test('pointer, keyboard, exact map navigation and writable selections remain available',()=>{
 assert.equal(typeof module.readonlySelectionGuard,'function');
 for(const readonly of [true,false])for(const userEvent of ['select.pointer','select.keyboard',undefined]){
  const state=EditorState.create({doc:'abc def ghi',selection:{anchor:1,head:4},extensions:[module.readonlySelectionGuard({readonly,isFocused:()=>false})]});
  assert.deepEqual([state.update({selection:{anchor:5,head:8},...(userEvent?{userEvent}:{})}).state.selection.main.from,state.update({selection:{anchor:5,head:8},...(userEvent?{userEvent}:{})}).state.selection.main.to],[5,8]);
 }
 const state=EditorState.create({doc:'abc def ghi',extensions:[module.readonlySelectionGuard({readonly:false,isFocused:()=>false})]});
 assert.equal(state.update({selection:{anchor:5},userEvent:'select'}).state.selection.main.from,5);
});
