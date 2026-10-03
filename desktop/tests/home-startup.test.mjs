import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const home=await readFile(new URL('../src/ui/workspace/home.js',import.meta.url),'utf8');
const intro=await readFile(new URL('../src/ui/workspace/intro.js',import.meta.url),'utf8');
function opening(options={}){
  const {mode='locked',reduced=false}=options;
  const opening=Object.hasOwn(options,'opening')?options.opening:'intro';
  const plate={hidden:false,setAttribute(){},classList:{add(){}}},vault={hidden:true};const timers=[];
  const window={sirenDesktopBootstrap:{mode,opening},matchMedia:()=>({matches:reduced})};
  const document={getElementById:id=>id==='sirenIntroOverlay'?plate:vault};
  runInNewContext(intro,{window,document,setTimeout:(fn,ms)=>timers.push({fn,ms})});
  return {window,plate,vault,timers};
}
test('locked Home startup never constructs project UI or requests metadata',()=>{
  let requests=0;
  const window={sirenDesktopBootstrap:{mode:'locked'},sirenHome:{getHomeState:()=>{requests++;}}};
  const document={readyState:'complete',createElement(){throw Error('Locked UI mount');},getElementById(){throw Error('Locked root lookup');}};
  runInNewContext(home,{window,document});assert.equal(requests,0);assert.equal(window.sirenHomeView,undefined);
});
test('introduction requires an explicit native startup request and plays once',()=>{
  const f=opening();assert.equal(f.window.sirenDesktopStartOpening(),true);assert.equal(f.plate.hidden,false);
  assert.equal(f.timers.length,1);assert.equal(f.timers[0].ms,1050);f.timers[0].fn();assert.equal(f.plate.hidden,true);
  assert.equal(f.window.sirenDesktopStartOpening(),false);assert.equal(f.timers.length,1);
  for(const options of [{mode:'normal'},{opening:undefined},{opening:'none'},{reduced:true}]){const g=opening({...options,opening:Object.hasOwn(options,'opening')?options.opening:'intro'});assert.equal(g.window.sirenDesktopStartOpening(),false);assert.equal(g.plate.hidden,true);assert.equal(g.timers.length,0);}
});
test('reduced motion has no mandatory vault timer',async()=>{
  const f=opening({reduced:true});await f.window.sirenHomeCloseVault();assert.equal(f.vault.hidden,false);assert.equal(f.timers.length,0);
});
