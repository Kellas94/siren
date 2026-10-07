import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../src/documents/presentation-notes.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const deck=()=>({deckId:'deck-a',version:'a'.repeat(64),title:'Context Ș😀',slides:[{id:'one',title:'First',notes:' exact\r\nȘ😀\n '},{id:'two',title:'Second',notes:''}]});
function format(value,options){assert.equal(typeof module.formatPresentationNotes,'function','Captured Presenter notes formatter must exist');return module.formatPresentationNotes(value,options);}
test('captured notes preserve exact Unicode/newlines/blank notes, ordered slide identities and deck version',()=>{
 const d=deck(),result=format(d);assert.equal(result.extension,'txt');assert.ok(Buffer.isBuffer(result.bytes));const text=result.bytes.toString('utf8');
 assert.ok(text.includes(d.title));assert.ok(text.includes(d.version));assert.ok(text.includes(d.deckId));assert.ok(text.includes(d.slides[0].notes));assert.ok(text.indexOf('Slide 1 · one · First')<text.indexOf('Slide 2 · two · Second'));assert.ok(text.endsWith('Slide 2 · two · Second\n\n\n'));assert.equal(result.bytes.length,Buffer.byteLength(text));
});
test('all 600 slides retained; encoded output is bounded before final allocation and never truncated',()=>{
 const d=deck();d.slides=Array.from({length:600},(_,i)=>({id:'s-'+i,title:'Title '+i,notes:'Note '+i}));assert.ok(format(d).bytes.includes(Buffer.from('Note 599')));
 d.slides=d.slides.map(s=>({...s,notes:'😀'.repeat(16384)}));assert.throws(()=>format(d),/PRESENTATION_NOTES_BUDGET/);
 const small=deck(),size=format(small).bytes.length;assert.equal(format(small,{maximum:size}).bytes.length,size);assert.throws(()=>format(small,{maximum:size-1}),/PRESENTATION_NOTES_BUDGET/);
});
test('invalid captured projections refuse getters, duplicates, extras, malformed Unicode and unbounded slides',()=>{
 const cases=[{...deck(),version:'bad'},{...deck(),slides:[]},{...deck(),slides:Array(601).fill(deck().slides[0])},{...deck(),slides:[deck().slides[0],deck().slides[0]]},{...deck(),title:'\ud800'},{...deck(),path:'outside'},{...deck(),slides:[{...deck().slides[0],notes:'x'.repeat(65537)}]}];for(const d of cases)assert.throws(()=>format(d));
 let invoked=false;const d=Object.defineProperty(deck(),'title',{enumerable:true,get(){invoked=true;return'bad';}});assert.throws(()=>format(d));assert.equal(invoked,false);
});
