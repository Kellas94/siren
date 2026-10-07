import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {patchDesktopTour} from '../build/onboarding.mjs';
const original="if (!state.tourDone) setTimeout(() => { if (!state.tourDone && document.body.dataset.presenting !== 'on') startWelcomeTour(); }, introPlaying ? 1900 : 1100);";
test('desktop module entry cannot start a delayed legacy tour, while manual and standalone tours remain available',()=>{
 for(const desktop of [true,false]){
  let starts=0;const context={window:desktop?{sirenDesktop:{}}:{},state:{tourDone:false},document:{body:{dataset:{}}},introPlaying:false,setTimeout:callback=>callback(),startWelcomeTour:()=>starts++};
  runInNewContext(patchDesktopTour(original),context);assert.equal(starts,desktop?0:1);
  context.startWelcomeTour();assert.equal(starts,desktop?1:2);
 }
});
