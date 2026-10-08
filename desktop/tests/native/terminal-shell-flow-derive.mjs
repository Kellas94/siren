// Pure source derivation only; does not compile, import or run native code.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {deriveSessionComposition} from './terminal-session-composition-derive.mjs';
import {deriveShellFlowLongFixture} from './terminal-shell-flow-probe.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'SHELL_FLOW_ANCHOR_DRIFT');return s.replace(a,()=>b);};
export function deriveShellFlowSources({host,fixture,extension,observerBase}){
 assert.equal(sha(extension),'2cd157f5534a10659c582d538b34dee9e136148ab0192dfe8b2b433102a9b00d','EXTENSION_SOURCE_DRIFT');
 assert.equal(sha(observerBase),'19222580db0df96b9fc30f8dbc0e232a31360ef2f71210101569d1bd84322bbc','OBSERVER_SOURCE_DRIFT');
 const composed=deriveSessionComposition({host,fixture,extension});
 let observer=observerBase.replaceAll('\r\n','\n');
 observer=once(observer,'internal static class TerminalMainOwnerObserver {','internal static partial class TerminalMainOwnerObserver {');
 observer=once(observer,'static int Main(string[] args) {','static int HistoricalMain(string[] args) {');
 observer=once(observer,'count>=11&&count<=64','count>=1&&count<=64');
 const allow='string.Equals(p.image,conhost,StringComparison.OrdinalIgnoreCase)';
 observer=once(observer,allow,allow+'||string.Equals(p.image,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell\\\\v1.0\\\\powershell.exe"),StringComparison.OrdinalIgnoreCase)');
 return {host:composed.host,fixture:deriveShellFlowLongFixture(fixture),observerBase:observer};
}
export function deriveShellFlowBuilder({builder,desktop}){
 assert.equal(sha(builder),'240dfa6f8564f9e6d03d6a2bd1250f02c4bdacf03c0c6eda04ce3d4d5fb4a285','SHELL_FLOW_BUILDER_DRIFT');
 let s=once(builder,"new URL('../../',import.meta.url)",`new URL(${JSON.stringify(desktop.href)})`);
 s=once(s,"import {deriveEightComposition} from './terminal-composition-eight-derive.mjs';",`import {deriveShellFlowSources as deriveEightComposition} from ${JSON.stringify(new URL('tests/native/terminal-shell-flow-derive.mjs',desktop).href)};`);
 s=once(s,"import {isEightCompositionObserved} from './terminal-composition-eight-verdict.mjs';",`import {isShellFlowObserved} from ${JSON.stringify(new URL('tests/native/terminal-shell-flow-verdict.mjs',desktop).href)};`);
 s=once(s,"'./terminal-candidate-graph.mjs'",JSON.stringify(new URL('tests/native/terminal-candidate-graph.mjs',desktop).href));
 s=once(s,'const names=[',"const names=['tests/native/build-terminal-shell-flow.mjs','tests/native/terminal-shell-flow-derive.mjs','tests/native/terminal-shell-flow.mjs','tests/native/terminal-shell-flow-main.mjs','tests/native/terminal-shell-flow-worker.mjs','tests/native/terminal-shell-flow-core.mjs','tests/native/terminal-shell-flow-controller.mjs','tests/native/terminal-shell-flow-mailbox.mjs','tests/native/terminal-shell-flow-probe.mjs','tests/native/terminal-shell-flow-verdict.mjs','tests/fixtures/terminal-shell-flow-observer.cs','src/terminal/input-gate.mjs','src/terminal/gate-link.mjs','src/terminal/output.mjs','src/terminal/contracts.mjs',");
 s=once(s,'evidence/terminal-composition-eight-build','evidence/terminal-shell-flow-build');
 s=s.replaceAll("['terminal_composition_eight','terminal_composition_eight_negative']","['terminal_shell_flow']");
 s=once(s,"join(desktop,'tests/native/terminal-composition-eight.mjs')","join(desktop,'tests/native/terminal-shell-flow.mjs')");
 s=once(s,"[[1,'disabled-root-monitor-survival-control'],[0,'composed-stop-root-utility-control']]","[[0,'fixed-powershell-input-lock-flood']]");
 s=once(s,"],desktop,60000)","],desktop,120000)");
 s=once(s,'isEightCompositionObserved(r.native)','isShellFlowObserved(r)');
 s=once(s,"'EIGHT_COMPOSED_SESSION_CONTROLS_OBSERVED_NOT_ADMITTED'","'SHELL_FLOW_FIXED_OBSERVATION_NOT_ADMITTED'");
 return s;
}
export async function writeShellFlowBuilderPrototype(){
 const {readFile,writeFile,mkdir,lstat}=await import('node:fs/promises'),{dirname,parse,join}=await import('node:path'),{fileURLToPath,pathToFileURL}=await import('node:url'),{randomUUID}=await import('node:crypto');
 const desktop=new URL('../../',import.meta.url),source=await readFile(new URL('tests/native/build-terminal-composition-eight.mjs',desktop),'utf8'),derived=deriveShellFlowBuilder({builder:source,desktop});
 const directory=fileURLToPath(new URL('evidence/terminal-shell-flow-derived/'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID()+'/',desktop));
 for(let p=dirname(directory);p!==parse(p).root;p=dirname(p))try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_DERIVATION_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(directory,{recursive:true});const path=join(directory,'builder.mjs');await writeFile(path,derived,{flag:'wx'});return pathToFileURL(path).href;
}
