import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
function replaceOnce(source,changes){for(const [before,after] of changes){assert.equal(source.split(before).length,2,'EXACT_DERIVATION_ANCHOR_REQUIRED');source=source.replace(before,after);}return source;}
export function deriveBrokerSources({original,shared}){
 assert.equal(hash(original),'a978af9537ff1c50cdb99849bca18f1f3dbf8181ccfdce41ad7448ab0a2f680a','ORIGINAL_FIXTURE_DRIFT');
 assert.equal(hash(shared),'2d954ae04fb751e4a24b357f8e5445f99a8e5262cf4e8d481ec2c43aadc1fc2a','SHARED_STUDY_DRIFT');
 return Object.freeze({
  original:replaceOnce(original,[['internal static class TerminalJobListProbe {','internal static partial class TerminalJobListProbe {'],['static int Main(string[] args) {','static int OriginalMain(string[] args) {']]),
  shared:replaceOnce(shared,[['static int Main(string[] args) {','static int SharedStudyMain(string[] args) {'],['out bool beforeResume) {','out bool beforeResume,bool inheritedSession=false) {'],['beforeResume==!omitSession','beforeResume==(!omitSession||inheritedSession)']])
 });
}
