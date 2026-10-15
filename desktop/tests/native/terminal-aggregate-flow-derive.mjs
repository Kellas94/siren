// Pure derivation. Historical one-Session sources/observations stay immutable.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {deriveShellFlowSources,deriveShellFlowBuilder} from './terminal-shell-flow-derive.mjs';
import {fixedShellFlowProbe} from './terminal-shell-flow-probe.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'AGGREGATE_ANCHOR_DRIFT');return s.replace(a,()=>b);};
export function fixedAggregateFlowProbe(){
 const old=fixedShellFlowProbe();let script=once(old.script,"$fixture = Join-Path $PSScriptRoot 'fixed-shell-flow-child.exe'","$fixture = Join-Path (Split-Path $PSScriptRoot -Parent) 'fixed-shell-flow-child.exe'");
 script=once(script,'$watch = [Diagnostics.Stopwatch]::StartNew()','$startedQpc = [Diagnostics.Stopwatch]::GetTimestamp()\n$watch = [Diagnostics.Stopwatch]::StartNew()');
 script=once(script,'ElapsedMilliseconds -lt 60000','ElapsedMilliseconds -lt 62000');
 script=once(script,'$record = @{','$finishedQpc = [Diagnostics.Stopwatch]::GetTimestamp()\n$record = @{ startedQpc=$startedQpc; finishedQpc=$finishedQpc; qpcFrequency=[Diagnostics.Stopwatch]::Frequency;');
 script=once(script,'minimumMs=60000','minimumMs=62000');
 return Object.freeze({...old,script,minimumFloodMs:62000});
}
export function deriveAggregateFlowSources(input){
 assert.equal(sha(input.observerStage),'8532bc685672120197054613e4f1082ee396074c7b09296d7c8fa9c8c3f7629c','AGGREGATE_OBSERVER_STAGE_DRIFT');
 const d=deriveShellFlowSources(input);
 d.host=once(d.host,'+64*sizeof(ULONG_PTR)','+128*sizeof(ULONG_PTR)');
 d.host=once(d.host,'list->NumberOfProcessIdsInList>64','list->NumberOfProcessIdsInList>128');
 d.observerBase=once(d.observerBase,'count>=1&&count<=64','count>=1&&count<=128');
 let s=input.observerStage.replaceAll('\r\n','\n');
 const start=s.indexOf('    static List<uint> ValidateFlow('),end=s.indexOf('    static int Main(string[] args) {');assert.ok(start>=0&&end>start,'AGGREGATE_OBSERVER_ANCHOR_DRIFT');
 const validation=`    static List<uint> ValidateFlow(Dictionary<string,object> ready,List<Held> held,uint main,string electron,string fixture) {
        Require(Pid(ready["mainPid"])==main,"AGGREGATE_MAIN_IDENTITY");
        var slots=Array(ready["slots"]);Require(slots.Length==8,"AGGREGATE_EIGHT_SESSIONS");
        var host=Map(ready["host"]);var all=new HashSet<uint>();
        string expected=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell\\\\v1.0\\\\powershell.exe");
        foreach(var rawSlot in slots){
            var slot=Map(rawSlot);var session=Map(slot["before"]);var worker=Map(slot["worker"]);
            Require((bool)session["killOnClose"]&&!(bool)session["breakaway"]&&!(bool)session["inheritable"],"AGGREGATE_SESSION_FLAGS");
            var ids=new HashSet<uint>();foreach(var raw in Array(session["held"])){uint pid=FlowBind(Map(raw),held);Require(ids.Add(pid)&&all.Add(pid),"AGGREGATE_SESSION_OVERLAP");}
            Require(ids.Count>=6&&ids.Count<=32&&Convert.ToInt32(session["active"])==ids.Count,"AGGREGATE_SESSION_COUNT");
            uint creator=FlowBind(Map(session["root"]),held),shell=FlowBind(Map(session["shell"]),held);
            Require(ids.Contains(creator)&&ids.Contains(shell)&&creator!=shell&&creator==Pid(worker["workerPid"])&&shell==Pid(worker["rootPid"]),"AGGREGATE_WORKER_BINDING");
            Require(string.Equals(Find(held,shell).image,expected,StringComparison.OrdinalIgnoreCase)&&string.Equals(Find(held,creator).image,electron,StringComparison.OrdinalIgnoreCase),"AGGREGATE_IMAGES");
            var canaries=new HashSet<uint>();foreach(var raw in Map(slot["fixturePids"]).Values){uint pid=Pid(raw);Require(ids.Contains(pid)&&canaries.Add(pid)&&string.Equals(Find(held,pid).image,fixture,StringComparison.OrdinalIgnoreCase),"AGGREGATE_FIXED_CANARY");}
            Require(canaries.Count==4,"AGGREGATE_FOUR_CANARIES");
        }
        Require((bool)host["killOnClose"]&&!(bool)host["breakaway"]&&!(bool)host["inheritable"],"AGGREGATE_HOST_FLAGS");
        uint utility=FlowBind(Map(host["root"]),held);Require(!all.Contains(utility)&&string.Equals(Find(held,utility).image,electron,StringComparison.OrdinalIgnoreCase),"AGGREGATE_UTILITY");
        var expectedHost=new HashSet<uint>(all);expectedHost.Add(utility);var actualHost=new HashSet<uint>();
        foreach(var raw in Array(host["held"]))Require(actualHost.Add(FlowBind(Map(raw),held)),"AGGREGATE_HOST_DUPLICATE");
        Require(actualHost.SetEquals(expectedHost)&&Convert.ToInt32(host["active"])==actualHost.Count&&actualHost.Count<=128,"AGGREGATE_HOST_SET");
        return new List<uint>(all);
    }
`;
 s=s.slice(0,start)+validation+s.slice(end);
 d.observerStage=once(s,'SHELL_FLOW_SAFETY_OBSERVED_NOT_ADMITTED','AGGREGATE_FLOW_SAFETY_OBSERVED_NOT_ADMITTED');return d;
}
export function deriveAggregateFlowRunner({runner,desktop}){
 assert.equal(sha(runner),'f00b6016188d2199cb0ca50c5563fb7d6f3a391a26046383e38941f32d4ad205','AGGREGATE_RUNNER_DRIFT');
 let s=once(runner,"new URL('../../',import.meta.url)",`new URL(${JSON.stringify(desktop.href)})`);
 const imports="import {deriveShellFlowSources} from './terminal-shell-flow-derive.mjs';import {fixedShellFlowProbe} from './terminal-shell-flow-probe.mjs';import {runShellFlowMain} from './terminal-shell-flow-main.mjs';import {isShellFlowObserved} from './terminal-shell-flow-verdict.mjs';";
 s=once(s,imports,`import {deriveAggregateFlowSources,fixedAggregateFlowProbe} from ${JSON.stringify(new URL('tests/native/terminal-aggregate-flow-derive.mjs',desktop).href)};import {runAggregateFlowMain} from ${JSON.stringify(new URL('tests/native/terminal-aggregate-flow-main.mjs',desktop).href)};import {isAggregateFlowObserved} from ${JSON.stringify(new URL('tests/native/terminal-aggregate-flow-verdict.mjs',desktop).href)};`);
 s=once(s,"evidence/terminal-shell-flow'","evidence/terminal-aggregate-flow'");
 s=once(s,'One actual fixed PowerShell Session, input/Lock/unlock, >=60s bounded generated output and whole Safety Job kernel peak. No eight-interactive-session/global credits/xterm/PIN UI/package/production admission.','Eight fixed PowerShell Sessions, common bounded credits and >=60s overlap, shared input Lock, isolated Stop and whole Safety Job kernel peak. No product/xterm/PIN UI/package admission.');
 s=once(s,"const files=['terminal-shell-flow'","const files=['terminal-aggregate-flow-derive','terminal-aggregate-flow-main','terminal-aggregate-flow-delivery','terminal-aggregate-flow-verdict','build-terminal-aggregate-flow','terminal-shell-flow'");
 s=once(s,"['input-gate','gate-link','contracts','output']","['input-gate','gate-link','contracts','output','credits']");
 s=once(s,"for(const rel of files)await record(join(desktop,rel));","for(const rel of files)await record(join(desktop,rel));await record(fileURLToPath(import.meta.url));");
 s=once(s,"observerBase:'terminal-main-owner-observer.cs'","observerBase:'terminal-main-owner-observer.cs',observerStage:'terminal-shell-flow-observer.cs'");
 s=once(s,'derived=deriveShellFlowSources(sources)','derived=deriveAggregateFlowSources(sources)');
 s=once(s,"await fs.readFile(join(desktop,'tests/fixtures/terminal-shell-flow-observer.cs'),'utf8')","derived.observerStage");
 s=once(s,'probe:fixedShellFlowProbe()','probe:fixedAggregateFlowProbe()');
 s=once(s,'await fs.writeFile(creatorEntry,',`config.deliveryUrl=new URL('tests/native/terminal-aggregate-flow-delivery.mjs',pathToFileURL(desktop+'/')).href;\n await fs.writeFile(creatorEntry,`);
 s=once(s,'runShellFlowMain.toString()','runAggregateFlowMain.toString()');
 s=once(s,"[electron,output,output,join(output,'Șiren flow α','fixed-shell-flow-child.exe')]","[electron,output,output,fixture]");
 const copy=" const copiedFixture=join(output,'Șiren flow α','fixed-shell-flow-child.exe');await record(copiedFixture);assert.equal(receipt.inputs.at(-1).sha256,receipt.inputs.find(p=>p.path===fixture).sha256,'FLOW_COPIED_FIXTURE_CHANGED');";
 s=once(s,copy,' // All eight canary trees execute the same absolute, recorded fixed fixture.');
 s=once(s,'isShellFlowObserved(receipt)','isAggregateFlowObserved(receipt)');
 return s.replaceAll('SHELL_FLOW_OBSERVED_NOT_ADMITTED','AGGREGATE_FLOW_OBSERVED_NOT_ADMITTED');
}
export function deriveAggregateFlowBuilder({builder,desktop,runnerPath}){
 let s=deriveShellFlowBuilder({builder,desktop});
 s=once(s,'deriveShellFlowSources as deriveEightComposition','deriveAggregateFlowSources as deriveEightComposition');
 s=once(s,new URL('tests/native/terminal-shell-flow-derive.mjs',desktop).href,new URL('tests/native/terminal-aggregate-flow-derive.mjs',desktop).href);
 s=once(s,'import {isShellFlowObserved}','import {isAggregateFlowObserved}');
 s=once(s,new URL('tests/native/terminal-shell-flow-verdict.mjs',desktop).href,new URL('tests/native/terminal-aggregate-flow-verdict.mjs',desktop).href);
 s=once(s,'isShellFlowObserved(r)','isAggregateFlowObserved(r)');
 s=once(s,'const names=[',"const names=['tests/native/terminal-aggregate-flow-derive.mjs','tests/native/terminal-aggregate-flow-main.mjs','tests/native/terminal-aggregate-flow-delivery.mjs','tests/native/terminal-aggregate-flow-verdict.mjs','tests/native/build-terminal-aggregate-flow.mjs','src/terminal/credits.mjs',");
 s=once(s,' const packagePath=join(desktop,'," for(const path of [fileURLToPath(import.meta.url),"+JSON.stringify(runnerPath)+"]){const bytes=await readFile(path);receipt.sources.push({path,bytes:bytes.length,sha256:hash(bytes)});}\n const packagePath=join(desktop,");
 s=once(s,"observerStage:await readFile(join(desktop,'tests/fixtures/terminal-session-composition-observer.cs')","observerStage:await readFile(join(desktop,'tests/fixtures/terminal-shell-flow-observer.cs')");
 s=once(s,"join(desktop,'tests/native/terminal-shell-flow.mjs')",JSON.stringify(runnerPath));
 s=once(s,'evidence/terminal-shell-flow-build','evidence/terminal-aggregate-flow-build');
 s=s.replaceAll("['terminal_shell_flow']","['terminal_aggregate_flow']");
 s=once(s,'fixed-powershell-input-lock-flood','eight-fixed-powershell-global-credits-lock-flood');
 return once(s,'SHELL_FLOW_FIXED_OBSERVATION_NOT_ADMITTED','AGGREGATE_FLOW_FIXED_OBSERVATION_NOT_ADMITTED');
}
export async function writeAggregateFlowPrototype(){
 const {readFile,writeFile,mkdir,lstat}=await import('node:fs/promises'),{dirname,parse,join}=await import('node:path'),{fileURLToPath,pathToFileURL}=await import('node:url'),{randomUUID}=await import('node:crypto');
 const desktop=new URL('../../',import.meta.url),directory=fileURLToPath(new URL('evidence/terminal-aggregate-flow-derived/'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID()+'/',desktop));
 for(let p=dirname(directory);p!==parse(p).root;p=dirname(p))try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_DERIVATION_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(directory,{recursive:true});const runnerPath=join(directory,'runner.mjs'),builderPath=join(directory,'builder.mjs');
 await writeFile(runnerPath,deriveAggregateFlowRunner({runner:await readFile(new URL('tests/native/terminal-shell-flow.mjs',desktop),'utf8'),desktop}),{flag:'wx'});
 await writeFile(builderPath,deriveAggregateFlowBuilder({builder:await readFile(new URL('tests/native/build-terminal-composition-eight.mjs',desktop),'utf8'),desktop,runnerPath}),{flag:'wx'});return pathToFileURL(builderPath).href;
}
