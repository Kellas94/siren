// Inert owner fixture shared by pure tests only.
import {control} from './terminal-session-composition-test-fixture.mjs';
export function eightMainControl(negative=false){
 const base=control(),template=base.groups[0];
 const groups=Array.from({length:8},(_,i)=>{const g=JSON.parse(JSON.stringify(template)),offset=i*10;g.label='ABCDEFGH'[i];for(const p of g.before.held)p.pid+=offset;g.before.root.pid+=offset;g.before.shell.pid+=offset;g.ready.workerPid+=offset;g.ready.rootPid+=offset;for(const k of Object.keys(g.fixturePids))g.fixturePids[k]+=offset;for(let j=5;j<8;j++)g.before.held.push({...g.before.held[4],pid:21+offset+j});g.before.active=8;g.before.killOnClose=!negative;return g;});
 const main={pid:1,image:groups[0].before.root.image,createdFileTime:'133000000000000000',alive:true,exitCode:259},root={...main,pid:10};
 const host={active:65,root,held:[root,...groups.flatMap(g=>g.before.held)],killOnClose:!negative,breakaway:false,inheritable:false};
 const capacity={code:'SESSION_CAPACITY_REFUSED',attemptedLabel:'I',creatorEntered:false,hostBefore:host,hostAfter:host};
 const ready={mainPid:1,held:host.held,hostSnapshot:host,groups,capacity,runtime:base.runtime,negative,fixtureAgeMs:1800};
 const before=[main,...host.held],after=before.map(p=>({...p,alive:negative&&p.pid!==1,exitCode:p.pid===1?101:negative?259:0})),cleanup=after.map(p=>({...p,alive:false,exitCode:p.alive?98:p.exitCode}));
 return JSON.parse(JSON.stringify({admitted:false,status:'EIGHT_MAIN_LOSS_OBSERVED_NOT_ADMITTED',guardEnabled:!negative,atomicSafety:true,safetyKillOnClose:true,safetyInheritable:false,main,mainExit:after[0],mainTerminationCode:101,ready,before,after,observeMs:negative?2000:20,mainAgeMs:negative?4000:2000,abortCheck:{checkedAfterMainExit:true,present:false,pending:false,firstGoPresent:false},safetyOpenAtObservation:true,activeBeforeSafetyCleanup:negative?65:0,cleanup:{verified:true,active:0,held:cleanup}}));
}
