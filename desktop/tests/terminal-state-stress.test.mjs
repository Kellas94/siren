import test from 'node:test';import assert from 'node:assert/strict';
import {createOutputRing} from '../src/terminal/output.mjs';
import {TerminalOutputCredits} from '../src/terminal/credits.mjs';

test('eight real rings keep32MiB after512MiB output while stalled consumers cannot grow credited deliveries',t=>{
 const started=performance.now(),credits=new TerminalOutputCredits(),rings=Array.from({length:8},()=>createOutputRing()),sent=Array(8).fill(0),acked=Array(8).fill(0),data='x'.repeat(32768);let peakCredit=0,peakAllocated=0,peakRss=process.memoryUsage().rss,visibleGaps=0;
 for(let s=0;s<8;s++)assert.equal(credits.attach('stress_'+s).ok,true);
 for(let block=0;block<2048;block++){
  for(let s=0;s<8;s++){
   const ring=rings[s],lease='stress_'+s;ring.append(data);const page=ring.read({fromSequence:sent[s]});
   if(page.gap){const moved=credits.advanceToRetained(lease,page.gap.resumeSequence);if(moved.ok){sent[s]=page.gap.resumeSequence;acked[s]=sent[s];visibleGaps++;}else continue;}
   const chunk=page.chunks[0];if(chunk&&credits.reserve(lease,{sequence:chunk.sequence,utf8Bytes:chunk.utf8Bytes}).ok)sent[s]=chunk.sequence+chunk.utf8Bytes;
  }
  peakCredit=Math.max(peakCredit,credits.stats().outstandingUtf8Bytes);peakAllocated=Math.max(peakAllocated,rings.reduce((n,r)=>n+r.stats().allocatedBytes,0));
  if(block%200===199){for(let s=0;s<8;s++){assert.equal(credits.ack('stress_'+s,sent[s]).ok,true);acked[s]=sent[s];}peakRss=Math.max(peakRss,process.memoryUsage().rss);}
 }
 for(let s=0;s<8;s++){const stats=rings[s].stats();assert.equal(stats.retainedUtf8Bytes,4194304);assert.equal(stats.droppedUtf8Bytes,62914560);assert.equal(stats.nextSequence,67108864);assert.equal(credits.ack('stress_'+s,sent[s]).ok,true);}
 assert.equal(rings.reduce((n,r)=>n+r.stats().retainedUtf8Bytes,0),33554432);assert.equal(peakCredit,2097152);assert.ok(peakAllocated<=33816576);assert.equal(credits.stats().outstandingUtf8Bytes,0);assert.ok(visibleGaps>0);
 t.diagnostic(JSON.stringify({scope:'Pure Node rings/credits only; no PTY/renderer/native latency qualification',producedUtf8Bytes:536870912,retainedUtf8Bytes:33554432,peakCreditedUtf8Bytes:peakCredit,peakAllocatedRingBytes:peakAllocated,visibleGaps,peakObservedRss:peakRss,elapsedMs:Math.round(performance.now()-started)}));
});
