import test from 'node:test';
import assert from 'node:assert/strict';
import {control} from './terminal-session-composition-test-fixture.mjs';
let isEightCompositionObserved;
try{({isEightCompositionObserved}=await import('./terminal-composition-eight-verdict.mjs'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
export function eightControl(negative=false){
 const r=control(negative),original=structuredClone(r),template=r.groups[0];
 r.groups=Array.from({length:8},(_,i)=>{const g=JSON.parse(JSON.stringify(template)),offset=i*10;g.label='ABCDEFGH'[i];for(const p of g.before.held)p.pid+=offset;g.before.root.pid+=offset;g.before.shell.pid+=offset;g.ready.workerPid+=offset;g.ready.rootPid+=offset;for(const k of Object.keys(g.fixturePids))g.fixturePids[k]+=offset;for(let j=5;j<8;j++)g.before.held.push({...g.before.held[4],pid:21+offset+j});g.before.active=8;return g;});
 // JSON clone decouples duplicated snapshot identities before independent mutation.
 const final=(g,code)=>{const s=structuredClone(g.before);s.active=0;for(const p of s.held){p.alive=false;p.exitCode=code;}s.root={...s.held[0]};s.shell={...s.held[1]};return s;};
 r.stoppedA=final(r.groups[0],77);r.otherAlive=r.groups.slice(1).map(g=>structuredClone(g.before));
 r.rootB=structuredClone(original.rootB);for(let j=5;j<8;j++)r.rootB.held.push({...r.groups[1].before.held[j],alive:negative,exitCode:negative?259:80});r.rootB.active=negative?7:0;
 r.hostLoss.held=[r.hostLoss.root,...r.groups.slice(2).flatMap(g=>final(g,79).held)];
 r.cleanup=r.groups.map((g,i)=>({label:g.label,closed:true,snapshot:i===0?r.stoppedA:final(g,i===1?(negative?98:80):79)}));
 r.cleanup[1].snapshot.shell={...r.cleanup[1].snapshot.shell,exitCode:51};r.cleanup[1].snapshot.held[1].exitCode=51;
 const host={...r.hostLoss,active:65,root:{...r.hostLoss.root,alive:true,exitCode:259},held:[{...r.hostLoss.root,alive:true,exitCode:259},...r.groups.flatMap(g=>g.before.held)]};
 r.capacity={code:'SESSION_CAPACITY_REFUSED',attemptedLabel:'I',creatorEntered:false,hostBefore:host,hostAfter:host};
 r.status='EIGHT_SESSION_COMPOSITION_OBSERVED_NOT_ADMITTED';return JSON.parse(JSON.stringify(r));
}
for(const negative of [false,true])test('finite eight-session '+negative+' control accepted',()=>{assert.equal(typeof isEightCompositionObserved,'function');assert.equal(isEightCompositionObserved(eightControl(negative)),true);});
const changes=[
 ['ninth group started',r=>r.groups.push(r.groups[0])],['ninth creator entered',r=>r.capacity.creatorEntered=true],
 ['wrong refusal',r=>r.capacity.code='SESSION_FIXED_PATH_REFUSED'],['no capacity receipt',r=>delete r.capacity],
 ['lost eighth session before stop',r=>r.capacity.hostBefore.held.pop()],['contradictory capacity root',r=>r.capacity.hostAfter.root.exitCode=0],
 ['seventh sibling stopped',r=>{r.otherAlive[6].held[3].alive=false;r.otherAlive[6].held[3].exitCode=77;}],
 ['eighth session utility-loss cause wrong',r=>r.hostLoss.held.at(-1).exitCode=0],['eighth cleanup changes exit cause',r=>r.cleanup[7].snapshot.held[0].exitCode=98],
 ['readiness omitted eighth',r=>r.groups[7].ready.inputWrites=1],['natural fallback possible',r=>r.fixtureAgeMs=11000],
 ['capacity accounting disagrees',r=>r.capacity.hostAfter.active=64],['capacity held state contradicts original',r=>{r.capacity.hostAfter.held[2].alive=false;r.capacity.hostAfter.held[2].exitCode=98;}],
 ['Session capture exceeds32 despite aggregate below128',r=>{
  const g=r.groups[7],extra=Array.from({length:25},(_,i)=>({...g.before.held[4],pid:2000+i}));g.before.held.push(...extra);g.before.active=33;
  r.otherAlive[6].held.push(...structuredClone(extra));r.otherAlive[6].active=33;
  for(const host of [r.capacity.hostBefore,r.capacity.hostAfter]){host.held.push(...structuredClone(extra));host.active+=25;}
  const dead=extra.map(p=>({...p,alive:false,exitCode:79}));r.hostLoss.held.push(...dead);r.cleanup[7].snapshot.held.push(...structuredClone(dead));
 }],
 ['host loss swaps exact held Host identity',r=>{const root=r.hostLoss.root;root.image='C:\\other\\electron.exe';root.createdFileTime='133000000000000001';const duplicate=r.hostLoss.held.find(p=>p.pid===root.pid);duplicate.image=root.image;duplicate.createdFileTime=root.createdFileTime;}],
 ['host loss image alone drifts',r=>{r.hostLoss.root.image='C:\\other\\electron.exe';r.hostLoss.held[0].image=r.hostLoss.root.image;}],
 ['host loss creation alone drifts',r=>{r.hostLoss.root.createdFileTime='133000000000000001';r.hostLoss.held[0].createdFileTime=r.hostLoss.root.createdFileTime;}],
 ];
for(const [name,change] of changes)for(const negative of [false,true])test('eight composition refuses '+name+' '+negative,()=>{assert.equal(typeof isEightCompositionObserved,'function');const r=eightControl(negative);change(r);assert.equal(isEightCompositionObserved(r),false);});
