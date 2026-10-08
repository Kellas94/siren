import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
// Reuse the reviewed launcher; only the entry point and snapshot bound differ.
export function deriveEightCreatorSource(source){
 assert.equal(createHash('sha256').update(source,'utf8').digest('hex'),'8cd689e7695f7b39d09b3e2fe33bed6d9023765cdc92925c310a0d7f91650063','ELECTRON_CREATOR_SOURCE_DRIFT');
 for(const [before,after] of [['static int Main(string[] args) {','static int TwoCreatorMain(string[] args) {'],['count>=12&&count<=32','count>=12&&count<=128']]){
  assert.equal(source.split(before).length,2,'EXACT_DERIVATION_ANCHOR_REQUIRED');source=source.replace(before,after);
 }
 return source;
}
