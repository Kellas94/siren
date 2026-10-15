import test from 'node:test';
import assert from 'node:assert/strict';
import {shellFixture,flush} from './fixtures/appearance-polling.mjs';

for(const kind of ['candidate'])test('SLOW-POLL '+kind+': successful reads with 1300 ms latency must eventually reveal the global theme control',async()=>{
 const f=shellFixture({kind});
 // Each disk/IPC response succeeds after 1300 ms, 100 ms beyond the shell's
 // actual 1200 ms interval. No write, refusal or context retirement occurs.
 for(let at=0;at<=6000;at+=100){
  if(at)f.clock.advance(100);
  for(let index=0;index<f.reads.length;index++){
   const started=index*1200;
   if(!f.reads[index].settled&&at>=started+1300){f.reads[index].settled=true;f.reads[index].resolve({ok:true,theme:'dark',projectName:'project-a'});}
  }
  await flush();
 }
 const bar=f.document.getElementById('sirenAppNavigation');
 const observation={kind,successfulResponses:f.reads.filter(r=>r.settled).length,startedReads:f.reads.length,barHidden:bar.hidden,bodyTheme:f.document.body.dataset.theme??null,themeEvents:f.events,elapsedMs:f.clock.now};
 console.log('OBSERVATION_SLOW_SUCCESSFUL_POLL '+JSON.stringify(observation));
 f.pagehide();
 assert.equal(observation.successfulResponses,4,'Fixture must deliver four successful read receipts.');
 assert.equal(bar.hidden,false,'Repeated successful reads must eventually make the application theme control available.');
 assert.equal(observation.bodyTheme,'dark','A valid global saved theme must eventually reach the renderer.');
});
