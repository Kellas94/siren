import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {diffSourceText} from '../src/sources/diff-worker.mjs';

const hash=text=>createHash('sha256').update(text).digest('hex');
const budget={maxUnits:1,maxCells:1,maxPreviewUnits:17,maxTotalPreviewUnits:31};
// Python-shaped text is DATA only; none of it is executed.
const script=lines=>'value = "Ș😀"  # retained Python source\r\n'.repeat(lines);
function assertExactChange(left,right,fromLeft,toLeft,fromRight,toRight){
 const before=[hash(left),hash(right)],r=diffSourceText(left,right,budget);
 assert.equal(r.status,'complete','a pure insertion/deletion requires no dense comparison');
 assert.equal(r.result.approximate,false);assert.equal(r.result.identical,false);
 assert.equal(r.result.hunks.length,1);
 const h=r.result.hunks[0];
 assert.deepEqual([h.left.from,h.left.to,h.right.from,h.right.to],[fromLeft,toLeft,fromRight,toRight]);
 assert.equal(h.approximate,false);
 assert.ok(h.left.preview.length+h.right.preview.length<=budget.maxTotalPreviewUnits);
 for(const side of [h.left,h.right])assert.equal(side.preview.isWellFormed(),true);
 assert.equal(r.coverage.left.to,left.length);assert.equal(r.coverage.right.to,right.length);
 assert.deepEqual([hash(left),hash(right)],before);return r;
}
for(const lines of [100000,300000]){
 test(`new ${lines}-line source is an exact insertion despite a one-cell comparison budget`,()=>{
  const text=script(lines);assertExactChange('',text,0,0,0,text.length);
 });
 test(`removed ${lines}-line source is an exact deletion despite a one-cell comparison budget`,()=>{
  const text=script(lines);assertExactChange(text,'',0,text.length,0,0);
 });
}
test('large insertion/deletion between common lines has exact ranges and bounded Unicode previews',()=>{
 const prefix='def existing():\r\n    pass\r\n',suffix='tail = "😀"\r\n',added=script(100000);
 const left=prefix+suffix,right=prefix+added+suffix;
 const inserted=assertExactChange(left,right,prefix.length,prefix.length,prefix.length,prefix.length+added.length);
 assert.equal(inserted.result.previewTruncated,true);
 assertExactChange(right,left,prefix.length,prefix.length+added.length,prefix.length,prefix.length);
});
test('dense changed spans still report approximation when the comparison budget is exhausted',()=>{
 const r=diffSourceText('old\r\n','new\r\n',budget);
 assert.equal(r.status,'partial');assert.equal(r.result.approximate,true);assert.equal(r.reason,'DIFF_APPROXIMATION');
});
test('exact insertion shortcut retains source, line and budget validation',()=>{
 assert.throws(()=>diffSourceText('', 'a\nb\nc\n',{maxLines:2}),/DIFF_LINE_BUDGET/);
 assert.throws(()=>diffSourceText('', '\ud800'),/DIFF_SOURCE_REFUSED/);
 assert.throws(()=>diffSourceText('', 'a',{maxCells:0}),/DIFF_BUDGET/);
});
