import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
let fixedShellFlowProbe,deriveShellFlowLongFixture,ShellFlowMarkerScanner;
try{({fixedShellFlowProbe,deriveShellFlowLongFixture,ShellFlowMarkerScanner}=await import('./terminal-shell-flow-probe.mjs'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const source=await readFile(new URL('../fixtures/terminal-job-list.cs',import.meta.url),'utf8');
test('fixed script has finite time/byte caps and no literal completion sentinel to mistake echo for execution',()=>{
 assert.equal(typeof fixedShellFlowProbe,'function','MISSING_SHELL_FLOW_PROBE');const p=fixedShellFlowProbe();
 assert.equal(p.minimumFloodMs,60000);assert.equal(p.naturalDeadlineMs,110000);assert.equal(p.generatedByteCap,128*1024*1024);
 for(const marker of Object.values(p.markers))assert.equal(p.script.includes(marker),false,'Echo may not be accepted as completion');
 assert.match(p.script,/ElapsedMilliseconds -lt 60000/);assert.match(p.script,/134217728/);assert.match(p.script,/WindowStyle Hidden/);assert.doesNotMatch(p.script,/Invoke-Expression|DownloadString|https?:|ExecutionPolicy|Stop-Process/i);
});
test('marker scanner ignores echoed commands, handles split/ANSI/multibyte output, rejects suffixes and gaps',()=>{
 assert.equal(typeof ShellFlowMarkerScanner,'function','MISSING_MARKER_SCANNER');const p=fixedShellFlowProbe(),scan=new ShellFlowMarkerScanner(p.markers);
 scan.append(0,p.script);assert.equal(scan.seen('done'),false);let seq=Buffer.byteLength(p.script);
 const output='\r\n'+p.markers.start+'\r\n'+'😀noise\r\n'+p.markers.done+'\r\n';
 for(const c of [...output]){scan.append(seq,c);seq+=Buffer.byteLength(c);}assert.equal(scan.seen('start'),true);assert.equal(scan.seen('done'),true);
 const other=new ShellFlowMarkerScanner(p.markers);other.append(0,'\n'+p.markers.done+'BAD\n');assert.equal(other.seen('done'),false);
 const gap=new ShellFlowMarkerScanner(p.markers);gap.append(0,'\n'+p.markers.done.slice(0,8));gap.append(999,p.markers.done.slice(8)+'\n');assert.equal(gap.seen('done'),false);assert.equal(gap.stats().gaps,1);
});
test('scanner bounds memory under hostile long lines and does not invent markers',()=>{
 assert.equal(typeof ShellFlowMarkerScanner,'function');const scan=new ShellFlowMarkerScanner(fixedShellFlowProbe().markers);scan.append(0,'x'.repeat(1024*1024));assert.ok(scan.stats().bufferedCharacters<=512);assert.equal(scan.seen('done'),false);
});
test('separate long fixture is derived from exact immutable source; old deadline stays intact',()=>{
 assert.equal(typeof deriveShellFlowLongFixture,'function','MISSING_LONG_FIXTURE');const d=deriveShellFlowLongFixture(source);assert.match(d,/Thread.Sleep\(110000\);return 0;/);assert.match(source,/Thread.Sleep\(12000\);return 0;/);
 assert.throws(()=>deriveShellFlowLongFixture(source+'\n'),/FIXTURE_SOURCE_DRIFT/);
});

test('exact historical and closed-readiness fixture versions retain derivation lineage and refuse all other bytes',async()=>{
 const sha=s=>createHash('sha256').update(s).digest('hex');
 const oldHash='a978af9537ff1c50cdb99849bca18f1f3dbf8181ccfdce41ad7448ab0a2f680a',newHash='c59b53e791d765545ccaf0e7a149507a55ddb03576027b2ac850ee827bb41477';
 const previous='        File.WriteAllText(Path.Combine(directory,mode+".ready"),Process.GetCurrentProcess().Id.ToString());';
 const closed=('        string ready=Path.Combine(directory,mode+".ready"),pending=ready+"."+Guid.NewGuid().ToString("N")+".pending";\n        File.WriteAllText(pending,Process.GetCurrentProcess().Id.ToString());\n        File.Move(pending,ready);').replaceAll('\n',source.includes('\r\n')?'\r\n':'\n');
 assert.equal(sha(source),newHash,'CURRENT_READY_FIXTURE_REQUIRED');assert.equal(source.split(closed).length,2);
 const historical=source.replace(closed,previous);assert.equal(sha(historical),oldHash,'EXACT_HISTORICAL_INVERSE_REQUIRED');
 const fixture=async name=>readFile(new URL('../fixtures/'+name,import.meta.url),'utf8');
 const host=await fixture('terminal-host-guard/host.cc'),extension=await fixture('terminal-session-composition.inc'),shared=await fixture('terminal-conpty-membership.cs');
 const {deriveSessionComposition}=await import('./terminal-session-composition-derive.mjs'),{deriveBrokerSources}=await import('./terminal-conpty-broker-derive.mjs');
 const variants=[
  ['session',s=>deriveSessionComposition({host,fixture:s,extension}).fixture],
  ['long',deriveShellFlowLongFixture],
  ['broker',s=>deriveBrokerSources({original:s,shared}).original]
 ];
 for(const [name,derive] of variants){
  const before=historical,oldOutput=derive(historical),currentOutput=derive(source);
  assert.equal(historical,before,name+' input unchanged');assert.equal(source.split(closed).length,2);
  const outputBlock=closed.replaceAll('\r\n','\n').replaceAll('\n',currentOutput.includes('\r\n')?'\r\n':'\n');
  assert.equal(currentOutput.split(outputBlock).length,2,name+' closed readiness retained');
  assert.equal(currentOutput.replace(outputBlock,previous),oldOutput,name+' only reviewed readiness delta');
  if(name==='long')assert.match(oldOutput,/Thread.Sleep\(110000\);return 0;/);else assert.doesNotMatch(oldOutput,/Thread.Sleep\(110000\)/);
  for(const original of [historical,source])for(const changed of [original+'\n',original.replace('Thread.Sleep(12000)','Thread.Sleep(12001)'),original.replace('File.WriteAllText','File.WriteAllTexT')])assert.throws(()=>derive(changed),/DRIFT/,name+' unknown bytes refused');
 }
 for(const name of ['terminal-session-composition-derive.mjs','terminal-shell-flow-probe.mjs','terminal-conpty-broker-derive.mjs','terminal-conpty-membership.mjs']){
  const guard=await readFile(new URL('./'+name,import.meta.url),'utf8');assert.equal(guard.split(oldHash).length,2,name+' historical pin');assert.equal(guard.split(newHash).length,2,name+' current pin');
 }
 const membership=await readFile(new URL('./terminal-conpty-membership.mjs',import.meta.url),'utf8');assert.match(membership,/originalSha256:hash\(Buffer.from\(original\)\),derivedSha256/,'Actual source identities stay distinct in native receipt');
});
