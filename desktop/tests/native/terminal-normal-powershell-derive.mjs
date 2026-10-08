// Pure pinned source derivation. Never import generated guarded native entrypoints.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PUBLICATION_INPUTS,CANDIDATE_BRANCH} from './terminal-normal-powershell-contract.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
function once(s,old,next){assert.equal(s.split(old).length,2,'NORMAL_CI_ANCHOR_DRIFT');return s.replace(old,()=>next);}

export function deriveNormalPowerShellCi({builder,workflow}){
 for(const [source,expected] of [[builder,'3f940578e914d103f3f899ec111502f107e74f70dc66ae352e9141ce88e467c9'],[workflow,'41ea75cb9c972b44009bef57691e2b82f76768fb566d7d198a5b4a246ec38bd0']])assert.equal(digest(source),expected,'NORMAL_CI_INPUT_DRIFT');
 builder=builder.replaceAll('terminal-bootstrap-async','terminal-normal-powershell');
 builder=once(builder,'normalTwoMemberObservation:false',"normalShellRequiredRoles:['creator','powershell'],exactTotalProcessCountAsserted:false");
 builder=once(builder,"phase('composed-stop-root-utility-control'","phase('normal-powershell-control-history'");
 builder=once(builder,'receipt.creatorEnvironmentObservation=validateCandidateObservation({result,addon:binary,electron}).creatorEnvironments;receipt.bootstrapAsyncObservation=validateCandidateObservation({result,addon:binary,electron}).bootstrapAsync;','receipt.normalShellObservation=validateCandidateObservation({result,addon:binary,electron}).normalShell;');
 workflow=workflow.replaceAll('terminal-bootstrap-async','terminal-normal-powershell');
 workflow=once(workflow,'name: Terminal bootstrap and async cleanup compatibility (not admitted)','name: Terminal normal PowerShell control and history (not admitted)');
 workflow=once(workflow,'ownership-candidate:', 'normal-shell-candidate:');
 const paths=/    branches: \[[^\]]+\]\r?\n    paths:\r?\n(?:      - '[^']+'\r?\n)+/g;
 assert.equal([...workflow.matchAll(paths)].length,1,'NORMAL_CI_WORKFLOW_DRIFT');
 workflow=workflow.replace(paths,()=>"    branches: ['"+CANDIDATE_BRANCH+"']\n    paths:\n"+PUBLICATION_INPUTS.map(p=>"      - '"+p+"'\n").join(''));
 workflow=workflow.replaceAll('desktop/tests/native/terminal-normal-powershell.test.mjs','desktop/tests/terminal-normal-contract.test.mjs');
 workflow=once(workflow,'node --test desktop/tests/terminal-normal-contract.test.mjs','node --test desktop/tests/terminal-normal-contract.test.mjs desktop/tests/terminal-normal-builder.test.mjs desktop/tests/terminal-normal-probe.test.mjs');
 workflow=once(workflow,'name: Build one exact candidate and run the positive compatibility control','name: Build one exact candidate and observe finite normal PowerShell');
 workflow=once(workflow,'            desktop/evidence/terminal-normal-powershell-observation/*/fixed-composition-child.exe\n','');
 workflow=once(workflow,'            desktop/evidence/terminal-normal-powershell-observation/*/composition-observer.exe','            desktop/evidence/terminal-normal-powershell-observation/*/normal-observer.exe');
 workflow=workflow.replaceAll('            desktop/native/terminal-ownership/','            desktop/native/terminal-creator-async/');
 // New derived artifacts use LF; the preserved inputs were checked before conversion.
 return {builder:builder.replaceAll('\r\n','\n'),workflow:workflow.replaceAll('\r\n','\n'),nativeExecuted:false,admitted:false};
}
