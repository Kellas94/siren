import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
function once(source,before,after){assert.equal(source.split(before).length,2,'MAIN_LOSS_ANCHOR_DRIFT');return source.replace(before,()=>after);}
const inputs="'tests/native/terminal-composed-main-loss.mjs','tests/native/build-terminal-composed-main-loss.mjs','tests/native/terminal-composed-main-loss-derive.mjs','tests/native/terminal-composed-main-loss-verdict.mjs','tests/fixtures/terminal-composed-main-loss-observer.cs',";
function relocated(source,desktop){
 source=once(source,"new URL('../../',import.meta.url)",`new URL(${JSON.stringify(desktop.href)})`);
 for(const name of ['terminal-session-composition-derive.mjs','terminal-candidate-graph.mjs'])if(source.includes(`'./${name}'`))source=once(source,`'./${name}'`,JSON.stringify(new URL('tests/native/'+name,desktop).href));
 source=once(source,"'./terminal-session-composition-verdict.mjs'",JSON.stringify(new URL('tests/native/terminal-composed-main-loss-verdict.mjs',desktop).href));
 return source.replaceAll('isSessionCompositionObserved','isComposedMainLossObserved');
}
export function deriveComposedMainLossHost(host){
 assert.equal(sha(host),'d2dcb3f4f63e157196891454e452886df0f50ea3da58862fc255dcfd5b2a6591','MAIN_LOSS_NATIVE_DRIFT');
 const flag='limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;';
 assert.equal(host.split(flag).length,3,'BOTH_KILL_ON_CLOSE_ANCHORS_REQUIRED');
 return host.replaceAll(flag,'\n#ifndef SIREN_TEST_DISABLE_COMPOSED_KILL_ON_CLOSE\n'+flag+'\n#endif\n');
}
export function deriveComposedMainLossRunner({runner,desktop}){
 assert.equal(sha(runner),'92210151a252b3c0f10559129abe67e88b0d81e3e586cef42c801c07161b14d2','MAIN_LOSS_RUNNER_DRIFT');
 let s=relocated(runner,desktop);
 s=once(s,"evidence/terminal-session-composition","evidence/terminal-composed-main-loss");
 s=once(s,'{mainPid:process.pid,held:hostSnapshot.held}','{mainPid:process.pid,held:hostSnapshot.held,hostSnapshot,groups:owned,runtime:result.runtime,negative:config.negative,fixtureAgeMs:Date.now()-age}');
 // A first-barrier timeout may not masquerade as externally caused main loss.
 // Await atomic abort publication before fallback cleanup; failed publication
 // parks this main until the bounded external Safety observer removes it.
 s=once(s,'let hostOwner,host,hostClosed=false;','let hostOwner,host,hostClosed=false,mainLossArmed=false;');
 s=once(s,"  await persist(join(config.output,'composition-'+label+'-ready.json')","  if(label==='first')mainLossArmed=true;\n  await persist(join(config.output,'composition-'+label+'-ready.json')");
 s=once(s,'}catch(e){result.error={code:e.code,message:e.message,stack:e.stack};result.failureSnapshots=[];',"}catch(e){if(mainLossArmed){try{await persist(join(config.output,'composition-main-loss-abort.json'),{status:'ABORTED',message:e.message});}catch{await new Promise(()=>{});}}result.error={code:e.code,message:e.message,stack:e.stack};result.failureSnapshots=[];");
 s=once(s,"const paths=[","const paths=[fileURLToPath(import.meta.url).slice(desktop.length),"+inputs);
 s=once(s,"join(desktop,'tests/fixtures/terminal-session-composition-observer.cs')","join(desktop,'tests/fixtures/terminal-composed-main-loss-observer.cs')");
 s=once(s,'[electron,output,output,fixture]','[electron,output,output,fixture,negative?\'negative\':\'positive\']');
 s=once(s,"receipt.native=JSON.parse(await readFile(join(output,'native-result.json'),'utf8'));","receipt.ready=JSON.parse(await readFile(join(output,'composition-first-ready.json'),'utf8'));");
 s=once(s,"receipt.observer.status==='COMPOSITION_SAFETY_OBSERVED_NOT_ADMITTED'&&receipt.observer.cleanupVerified===true&&receipt.observer.safetyOpenAtObservation===true&&receipt.observer.activeBeforeSafetyCleanup===0&&isComposedMainLossObserved(receipt.native)","isComposedMainLossObserved(receipt.observer,negative)");
 s=once(s,'if(!compileOnly){receipt.qualified=','if(!compileOnly){assert.deepEqual(receipt.ready,receipt.observer.ready,\'COMPOSED_READY_READBACK_CHANGED\');receipt.qualified=');
 s=once(s,"receipt.status='SESSION_COMPOSITION_OBSERVED_NOT_ADMITTED';","receipt.status='COMPOSED_MAIN_LOSS_OBSERVED_NOT_ADMITTED';");
 s=once(s,"scope:'Finite native Session creator, Stop, natural-root and utility-loss composition with an external Safety observer; no main-loss/input/flood/package admission'","scope:'Separate composed abrupt main-loss observation; original composition main killed at first barrier; no product/input/flood/package admission'");
 return s;
}
export function deriveComposedMainLossBuilder({builder,desktop}){
 assert.equal(sha(builder),'5a4bc27b28c844fc143dd15aa0bd582024cb44bcd24d72744e200778c8eb9190','MAIN_LOSS_BUILDER_DRIFT');
 let s=relocated(builder,desktop);
 s=once(s,'import {deriveSessionComposition}', 'import {deriveSessionComposition as baseDeriveSessionComposition}');
 s=once(s,'// CI-only isolated prototype;',`import {deriveComposedMainLossHost} from ${JSON.stringify(new URL('tests/native/terminal-composed-main-loss-derive.mjs',desktop).href)};\nconst deriveSessionComposition=args=>{const original=baseDeriveSessionComposition(args);return {...original,host:deriveComposedMainLossHost(original.host)};};\n// CI-only isolated prototype;`);
 s=once(s,'const names=[','const names=[fileURLToPath(import.meta.url).slice(desktop.length),'+inputs);
 s=s.replaceAll('terminal_session_composition','terminal_composed_main_loss');
 s=once(s,'evidence/terminal-session-composition-build','evidence/terminal-composed-main-loss-build');
 s=once(s,'SIREN_TEST_DISABLE_SESSION_ROOT_MONITOR=1','SIREN_TEST_DISABLE_COMPOSED_KILL_ON_CLOSE=1');
 s=once(s,"join(desktop,'tests/native/terminal-session-composition.mjs')","join(desktop,'tests/native/terminal-composed-main-loss.mjs')");
 s=once(s,'disabled-root-monitor-survival-control','disabled-both-kill-on-close-control');
 s=once(s,'composed-stop-root-utility-control','composed-abrupt-main-loss-control');
 s=once(s,'isComposedMainLossObserved(r.native)','isComposedMainLossObserved(r.observer,index===1)');
 s=once(s,'COMPOSED_SESSION_CONTROLS_OBSERVED_NOT_ADMITTED','COMPOSED_MAIN_LOSS_CONTROLS_OBSERVED_NOT_ADMITTED');
 return s;
}

// Writing the deterministic source is separate from executing it. Only the
// explicitly CI-fenced entry points below import the generated program.
export async function writeComposedMainLossPrototype(kind){
 assert.ok(['runner','builder'].includes(kind),'FIXED_PROTOTYPE_ONLY');
 const {readFile,writeFile,mkdir,lstat}=await import('node:fs/promises');
 const {dirname,parse,join}=await import('node:path');
 const {fileURLToPath,pathToFileURL}=await import('node:url');
 const {randomUUID}=await import('node:crypto');
 const desktop=new URL('../../',import.meta.url);
 const name=kind==='runner'?'terminal-session-composition.mjs':'build-terminal-session-composition.mjs';
 const source=await readFile(new URL('tests/native/'+name,desktop),'utf8');
 const derived=(kind==='runner'?deriveComposedMainLossRunner:deriveComposedMainLossBuilder)({[kind]:source,desktop});
 const directory=fileURLToPath(new URL('evidence/terminal-composed-main-loss-derived/'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID()+'/',desktop));
 for(let parent=dirname(directory);parent!==parse(parent).root;parent=dirname(parent))try{assert.equal((await lstat(parent)).isSymbolicLink(),false,'LINKED_DERIVATION_PARENT');}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(directory,{recursive:true});
 const path=join(directory,kind+'.mjs');
 await writeFile(path,derived,{flag:'wx'});
 return pathToFileURL(path).href;
}
