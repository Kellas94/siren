import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {diffSourceText} from '../src/sources/diff-worker.mjs';
const hash=text=>createHash('sha256').update(text).digest('hex');
test('exact bounded LCS produces independent before/after ranges with CRLF, Unicode and EOF endings intact',()=>{
 const left='a\r\nold Ș😀\r\nkeep\r\nend',right='a\r\nnew Ș😀\r\nkeep\r\nend\r\n',a=hash(left),b=hash(right),r=diffSourceText(left,right);
 assert.equal(r.status,'complete');assert.equal(r.result.approximate,false);assert.equal(r.result.identical,false);assert.equal(r.result.hunks.length,2);
 for(const h of r.result.hunks){assert.equal(left.slice(h.left.from,h.left.to),h.left.preview);assert.equal(right.slice(h.right.from,h.right.to),h.right.preview);}
 assert.equal(r.result.hunks[0].left.preview,'old Ș😀\r\n');assert.equal(r.result.hunks[0].right.preview,'new Ș😀\r\n');assert.equal(hash(left),a);assert.equal(hash(right),b);
});
test('real 300k-line localized EOF change is an exact complete comparison beyond prefix budgets',()=>{
 const left=Array.from({length:300000},(_,i)=>`v_${i}=${i}\n`).join(''),right=left+'def tail():\n    return "Ș😀"\n',r=diffSourceText(left,right);
 assert.equal(r.status,'complete');assert.equal(r.result.hunks.length,1);const h=r.result.hunks[0];assert.equal(h.left.from,left.length);assert.equal(h.left.to,left.length);assert.equal(h.right.preview,'def tail():\n    return "Ș😀"\n');assert.equal(h.right.from,left.length);assert.equal(r.coverage.left.to,left.length);assert.equal(r.coverage.right.to,right.length);
});
test('dense region and hunk/preview budgets explicitly aggregate approximation, preserving full comparison coverage',()=>{
 const left=Array.from({length:300},(_,i)=>`old_${i}\n`).join(''),right=Array.from({length:300},(_,i)=>`new_${i}\n`).join('');
 const dense=diffSourceText(left,right,{maxCells:8,maxPreviewUnits:5,maxTotalPreviewUnits:8});assert.equal(dense.status,'partial');assert.equal(dense.result.approximate,true);assert.equal(dense.result.hunks.length,1);assert.equal(dense.result.hunks[0].left.to,left.length);assert.equal(dense.result.hunks[0].right.to,right.length);assert.ok(dense.result.hunks[0].left.preview.length+dense.result.hunks[0].right.preview.length<=8);assert.equal(dense.result.previewTruncated,true);
 const a='a\nold\nkeep\nold2\nkeep2\nold3\n',b='a\nnew\nkeep\nnew2\nkeep2\nnew3\n',limited=diffSourceText(a,b,{maxHunks:2});assert.equal(limited.status,'partial');assert.equal(limited.result.hunks.length,2);assert.equal(limited.result.hunks[1].left.to,a.length);assert.equal(limited.result.hunks[1].right.to,b.length);assert.equal(limited.result.hunks[1].approximate,true);
});
test('identical and empty sources remain exact; UTF16 preview never splits a surrogate and invalid budgets are refused',()=>{
 for(const text of ['', '\uFEFFa\r\nb\rc\n','😀']){const r=diffSourceText(text,text);assert.equal(r.result.identical,true);assert.deepEqual(r.result.hunks,[]);assert.equal(r.status,'complete');}
 const r=diffSourceText('😀\n','Ș\n',{maxPreviewUnits:1});assert.equal(r.result.hunks[0].left.preview,'');assert.equal(r.result.previewTruncated,true);
 assert.throws(()=>diffSourceText('a','b',{maxCells:Infinity}),/DIFF_BUDGET/);
 assert.throws(()=>diffSourceText('a\nb\nc\n','a\nb\nx\n',{maxLines:2}),/DIFF_LINE_BUDGET/);
});
