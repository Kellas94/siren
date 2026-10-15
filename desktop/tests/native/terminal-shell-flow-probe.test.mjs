import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
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
