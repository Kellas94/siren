// Pure, hash-pinned derivation of a separate CI experiment. Originals stay intact.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveEightComposition} from './terminal-composition-eight-derive.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'EIGHT_MAIN_LOSS_ANCHOR_DRIFT');return s.replace(a,()=>b);};
const inputs="'tests/native/terminal-eight-main-loss.mjs','tests/native/build-terminal-eight-main-loss.mjs','tests/native/terminal-eight-main-loss-derive.mjs','tests/native/terminal-eight-main-loss-verdict.mjs','tests/fixtures/terminal-composed-main-loss-observer.cs',";
export function deriveEightMainLoss(args){
 assert.equal(sha(args.mainLossObserver),'2929bf2e1fa44e2378a9a31d12bec134f86cd0cd2524a3e269cf337f8fa510c1','EIGHT_MAIN_LOSS_OBSERVER_DRIFT');
 const d=deriveEightComposition(args),flag='limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;';
 assert.equal(d.host.split(flag).length,3,'BOTH_KILL_ON_CLOSE_LEVELS_REQUIRED');
 d.host=d.host.replaceAll(flag,'\n#ifndef SIREN_TEST_DISABLE_COMPOSED_KILL_ON_CLOSE\n'+flag+'\n#endif\n');
 let s=args.mainLossObserver.replaceAll('\r\n','\n');
 s=once(s,'groups.Length==2,"MAIN_LOSS_TWO_SESSIONS_REQUIRED"','groups.Length==8,"MAIN_LOSS_EIGHT_SESSIONS_REQUIRED"');
 s=once(s,'new[]{"A","B"}[i]','new[]{"A","B","C","D","E","F","G","H"}[i]');
 s=once(s,'canaries.Count==10,"MAIN_LOSS_TEN_CANARIES_REQUIRED"','canaries.Count==40,"MAIN_LOSS_FORTY_CANARIES_REQUIRED"');
 s=once(s,'        return canaries;',`        var capacity=Map(ready["capacity"]);
        Require(Convert.ToString(capacity["code"])=="SESSION_CAPACITY_REFUSED"&&Convert.ToString(capacity["attemptedLabel"])=="I"&&!(bool)capacity["creatorEntered"],"MAIN_LOSS_CAPACITY_REFUSED");
        foreach(string key in new[]{"hostBefore","hostAfter"}) {
            var capture=Map(capacity[key]);LimitsMatch(capture,negative);
            Require(Bind(Map(capture["root"]),held)==utility,"MAIN_LOSS_CAPACITY_HOST_CHANGED");
            var members=Array(capture["held"]);Require(members.Length==expected.Count&&Convert.ToInt32(capture["active"])==expected.Count,"MAIN_LOSS_CAPACITY_SET");
            seen.Clear();foreach(var raw in members){uint pid=Bind(Map(raw),held);Require(expected.Contains(pid)&&seen.Add(pid),"MAIN_LOSS_CAPACITY_BINDING");}
        }
        return canaries;`);
 s=once(s,'result["status"]="COMPOSED_MAIN_LOSS_OBSERVED_NOT_ADMITTED"','result["status"]="EIGHT_MAIN_LOSS_OBSERVED_NOT_ADMITTED"');
 return {...d,observerStage:s};
}
function relocate(source,desktop){
 let s=once(source,"new URL('../../',import.meta.url)",`new URL(${JSON.stringify(desktop.href)})`);
 s=once(s,"'./terminal-composition-eight-derive.mjs'",JSON.stringify(new URL('tests/native/terminal-eight-main-loss-derive.mjs',desktop).href));
 s=once(s,'import {deriveEightComposition}','import {deriveEightMainLoss as deriveEightComposition}');
 s=once(s,"'./terminal-composition-eight-verdict.mjs'",JSON.stringify(new URL('tests/native/terminal-eight-main-loss-verdict.mjs',desktop).href));
 if(s.includes("'./terminal-candidate-graph.mjs'"))s=once(s,"'./terminal-candidate-graph.mjs'",JSON.stringify(new URL('tests/native/terminal-candidate-graph.mjs',desktop).href));
 s=s.replaceAll('isEightCompositionObserved','isEightMainLossObserved');
 const tail="observerStage:await readFile(join(desktop,'tests/fixtures/terminal-session-composition-observer.cs'),'utf8')";
 s=once(s,tail,tail+",mainLossObserver:await readFile(join(desktop,'tests/fixtures/terminal-composed-main-loss-observer.cs'),'utf8')");
 return s;
}
export function deriveEightMainLossRunner({runner,desktop}){
 assert.equal(sha(runner),'3cdecfae06e0292bc772c686b6a84f73fa00a5c8cf9fc0b11b45c70c5a60780c','EIGHT_MAIN_LOSS_RUNNER_DRIFT');
 let s=relocate(runner,desktop);
 s=once(s,'evidence/terminal-composition-eight','evidence/terminal-eight-main-loss');
 s=once(s,'{mainPid:process.pid,held:hostSnapshot.held}','{mainPid:process.pid,held:hostSnapshot.held,hostSnapshot,groups:owned,capacity:result.capacity,runtime:result.runtime,negative:config.negative,fixtureAgeMs:now()-age}');
 s=once(s,'let hostOwner,host,hostClosed=false;','let hostOwner,host,hostClosed=false,mainLossArmed=false;');
 s=once(s,"  await persist(join(config.output,'composition-'+label+'-ready.json')","  if(label==='first')mainLossArmed=true;\n  await persist(join(config.output,'composition-'+label+'-ready.json')");
 s=once(s,'}catch(e){result.error={code:e.code,message:e.message,stack:e.stack};result.failureSnapshots=[];',"}catch(e){if(mainLossArmed){try{await persist(join(config.output,'composition-main-loss-abort.json'),{status:'ABORTED',message:e.message});}catch{await new Promise(()=>{});}}result.error={code:e.code,message:e.message,stack:e.stack};result.failureSnapshots=[];");
 s=once(s,'const paths=[','const paths=[fileURLToPath(import.meta.url).slice(desktop.length),'+inputs);
 s=once(s,'[electron,output,output,fixture]',"[electron,output,output,fixture,negative?'negative':'positive']");
 s=once(s,"receipt.native=JSON.parse(await readFile(join(output,'native-result.json'),'utf8'));","receipt.ready=JSON.parse(await readFile(join(output,'composition-first-ready.json'),'utf8'));");
 s=once(s,"receipt.observer.status==='COMPOSITION_SAFETY_OBSERVED_NOT_ADMITTED'&&receipt.observer.cleanupVerified===true&&receipt.observer.safetyOpenAtObservation===true&&receipt.observer.activeBeforeSafetyCleanup===0&&isEightMainLossObserved(receipt.native)",'isEightMainLossObserved(receipt.observer,negative)');
 s=once(s,'if(!compileOnly){receipt.qualified=',"if(!compileOnly){assert.deepEqual(receipt.ready,receipt.observer.ready,'COMPOSED_READY_READBACK_CHANGED');receipt.qualified=");
 s=once(s,"receipt.status='EIGHT_SESSION_COMPOSITION_OBSERVED_NOT_ADMITTED';","receipt.status='EIGHT_MAIN_LOSS_OBSERVED_NOT_ADMITTED';");
 s=once(s,"scope:'Eight simultaneous native Sessions, ninth refusal, Stop isolation, natural-root and utility loss; no main-loss/input/flood/peak/package admission'","scope:'Eight simultaneous Sessions and ninth refusal followed by external abrupt main loss; no input/Lock/flood/peak/package admission'");
 return s;
}
export function deriveEightMainLossBuilder({builder,desktop}){
 assert.equal(sha(builder),'240dfa6f8564f9e6d03d6a2bd1250f02c4bdacf03c0c6eda04ce3d4d5fb4a285','EIGHT_MAIN_LOSS_BUILDER_DRIFT');
 let s=relocate(builder,desktop);
 s=once(s,'const names=[','const names=[fileURLToPath(import.meta.url).slice(desktop.length),'+inputs);
 s=s.replaceAll('terminal_composition_eight','terminal_eight_main_loss');
 s=once(s,'evidence/terminal-composition-eight-build','evidence/terminal-eight-main-loss-build');
 s=once(s,'SIREN_TEST_DISABLE_SESSION_ROOT_MONITOR=1','SIREN_TEST_DISABLE_COMPOSED_KILL_ON_CLOSE=1');
 s=once(s,"join(desktop,'tests/native/terminal-composition-eight.mjs')","join(desktop,'tests/native/terminal-eight-main-loss.mjs')");
 s=once(s,'disabled-root-monitor-survival-control','disabled-both-kill-on-close-control');
 s=once(s,'composed-stop-root-utility-control','eight-composed-abrupt-main-loss-control');
 s=once(s,'isEightMainLossObserved(r.native)','isEightMainLossObserved(r.observer,index===1)');
 s=once(s,'EIGHT_COMPOSED_SESSION_CONTROLS_OBSERVED_NOT_ADMITTED','EIGHT_MAIN_LOSS_CONTROLS_OBSERVED_NOT_ADMITTED');
 return s;
}
// Writing deterministic source is separate from executing it. Only the fenced
// entrypoints import the generated program, in isolated Windows CI.
export async function writeEightMainLossPrototype(kind){
 assert.ok(['runner','builder'].includes(kind),'FIXED_PROTOTYPE_ONLY');
 const {readFile,writeFile,mkdir,lstat}=await import('node:fs/promises'),{dirname,parse,join}=await import('node:path'),{fileURLToPath,pathToFileURL}=await import('node:url'),{randomUUID}=await import('node:crypto');
 const desktop=new URL('../../',import.meta.url),name=kind==='runner'?'terminal-composition-eight.mjs':'build-terminal-composition-eight.mjs';
 const source=await readFile(new URL('tests/native/'+name,desktop),'utf8'),derived=(kind==='runner'?deriveEightMainLossRunner:deriveEightMainLossBuilder)({[kind]:source,desktop});
 const directory=fileURLToPath(new URL('evidence/terminal-eight-main-loss-derived/'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID()+'/',desktop));
 for(let p=dirname(directory);p!==parse(p).root;p=dirname(p))try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_DERIVATION_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(directory,{recursive:true});const path=join(directory,kind+'.mjs');await writeFile(path,derived,{flag:'wx'});return pathToFileURL(path).href;
}
