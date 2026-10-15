// Pure deterministic CI preparation; generated builders remain guarded.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {PUBLICATION_INPUTS,CANDIDATE_BRANCH} from './terminal-peer-endpoints-contract.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function once(s,a,b){assert.equal(s.split(a).length,2,'PEER_CI_ANCHOR_DRIFT');return s.replace(a,()=>b);}
export function derivePeerEndpointCi({builder,workflow}){
 for(const [value,pin] of [[builder,'04e312ea71a1dc046b0417bf3606414c16d2481af931da51f5337652ed496d81'],[workflow,'0e9abfb2bd558f2b6a39ae142423dcfba0cfff2967783cfffcfa02b9fae10124']])assert.equal(hash(value),pin,'PEER_CI_INPUT_DRIFT');
 builder=builder.replaceAll('terminal-normal-powershell','terminal-peer-endpoints').replaceAll('native/terminal-creator-async/','native/terminal-creator-peer/').replaceAll('siren_terminal_creator_async','siren_terminal_creator_peer');
 builder=once(builder,"previous:await readFile(join(root,'.github/workflows/terminal-ownership-candidate.yml')","previous:await readFile(join(root,'.github/workflows/terminal-normal-powershell.yml')");
 builder=once(builder,"const source=await readFile(join(desktop,'native/terminal-creator-peer/ownership.cc')),binding=await readFile(join(desktop,'native/terminal-creator-peer/binding.gyp'));","const source=await readFile(join(desktop,'native/terminal-creator-peer/ownership.cc')),binding=await readFile(join(desktop,'native/terminal-creator-peer/binding.gyp')),endpointSource=await readFile(join(desktop,'native/terminal-creator-peer/peer-endpoints.inc'));");
 builder=once(builder,'validateOwnershipCandidate({source,binding})','validateOwnershipCandidate({source,binding,endpointSource})');
 builder=once(builder,"[['ownership.cc',source],['binding.gyp',binding]]","[['ownership.cc',source],['binding.gyp',binding],['peer-endpoints.inc',endpointSource]]");
 builder=once(builder,"receipt.runtimeDistribution={...await jsonArtifact('runtime-distribution.json',{files:runtimeRows}),files:runtimeRows.length,bytes:runtimeRows.reduce((n,r)=>n+r.bytes,0)};","const {bytes:manifestBytes,...manifest}=await jsonArtifact('runtime-distribution.json',{files:runtimeRows});\n receipt.runtimeDistribution={...manifest,manifestBytes,files:runtimeRows.length,runtimeBytes:runtimeRows.reduce((n,r)=>n+r.bytes,0)};");
 builder=once(builder,"phase('normal-powershell-control-history'","phase('native-peer-control-history'");
 builder=once(builder,'receipt.normalShellObservation=validateCandidateObservation({result,addon:binary,electron}).normalShell;','receipt.normalShellObservation=validateCandidateObservation({result,addon:binary,electron}).normalShell;receipt.nativePeerObservation=validateCandidateObservation({result,addon:binary,electron}).nativePeer;');
 workflow=workflow.replaceAll('terminal-normal-powershell','terminal-peer-endpoints').replaceAll('native/terminal-creator-async/','native/terminal-creator-peer/').replaceAll('siren_terminal_creator_async','siren_terminal_creator_peer');
 workflow=once(workflow,'name: Terminal normal PowerShell control and history (not admitted)','name: Terminal native peer endpoint compatibility (not admitted)');
 workflow=once(workflow,'normal-shell-candidate:','native-peer-candidate:');
 workflow=once(workflow,"    branches: ['probe/terminal-peer-endpoints-2026-10-08']", "    branches: ['"+CANDIDATE_BRANCH+"']");
 const paths=/    paths:\r?\n(?:      - '[^']+'\r?\n)+/g;assert.equal([...workflow.matchAll(paths)].length,1,'PEER_CI_ANCHOR_DRIFT');
 workflow=workflow.replace(paths,()=>"    paths:\n"+PUBLICATION_INPUTS.map(p=>"      - '"+p+"'\n").join(''));
 workflow=once(workflow,'node --test desktop/tests/terminal-normal-contract.test.mjs desktop/tests/terminal-normal-builder.test.mjs desktop/tests/terminal-normal-probe.test.mjs desktop/tests/terminal-shell-environment.test.mjs',
 'node --test desktop/tests/terminal-peer-endpoint-source.test.mjs desktop/tests/terminal-peer-endpoints-contract.test.mjs desktop/tests/terminal-peer-builder.test.mjs desktop/tests/terminal-peer-probe-source.test.mjs desktop/tests/terminal-native-peer-stream.test.mjs desktop/tests/terminal-peer-bootstrap-reader.test.mjs desktop/tests/terminal-normal-contract.test.mjs desktop/tests/terminal-normal-probe.test.mjs desktop/tests/terminal-shell-environment.test.mjs');
 workflow=once(workflow,'name: Build one exact candidate and observe finite normal PowerShell','name: Build exact peer candidate and observe verified finite streams');
 workflow=once(workflow,'            desktop/evidence/terminal-peer-endpoints-build/*/candidate/binding.gyp','            desktop/evidence/terminal-peer-endpoints-build/*/candidate/binding.gyp\n            desktop/evidence/terminal-peer-endpoints-build/*/candidate/peer-endpoints.inc');
 workflow=once(workflow,'            desktop/native/terminal-creator-peer/binding.gyp','            desktop/native/terminal-creator-peer/binding.gyp\n            desktop/native/terminal-creator-peer/peer-endpoints.inc');
 return {builder,workflow,nativeExecuted:false,admitted:false};
}
