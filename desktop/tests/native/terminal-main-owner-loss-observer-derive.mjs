// Pure test-owned source derivation; no compilation or execution here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export function deriveClassicMainLossObserver(source){
 assert.equal(createHash('sha256').update(source).digest('hex'),'19222580db0df96b9fc30f8dbc0e232a31360ef2f71210101569d1bd84322bbc','CLASSIC_MAIN_LOSS_OBSERVER_DRIFT');
 const anchor='internal static class TerminalMainOwnerObserver {',helper='    static bool AllSafetyExited(List<Held> held,IntPtr safety) {foreach(var p in held)if(WaitForSingleObject(p.handle,0)!=0)return false;return Active(safety)==0;}\n';
 assert.equal(source.split(anchor).length,2);assert.equal(source.split('AllExited(held,required)').length,3);
 return source.replace(anchor,()=>anchor+'\n'+helper).replaceAll('AllExited(held,required)','AllSafetyExited(held,safety)');
}
