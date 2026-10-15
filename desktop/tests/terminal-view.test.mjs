import test from 'node:test';
import assert from 'node:assert/strict';
const {createTerminalView}=await import('../src/ui/terminal/view.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const {createTerminalDisplayFilter}=await import('../src/ui/terminal/display-filter.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const lease={sessionId:'session_a',leaseId:'lease_a',generation:1};
const info={sessionId:'session_a',projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Project',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a'};
function setup(options={}){
 const listeners={},calls=[],emulators=[],container={replaceChildren(){}};let operation=0;
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{
  calls.push({name,p});const value=name==='Attach'?{session:{...info,...options.info},leaseId:'lease_a',generation:1,firstSequence:options.first??0,nextSequence:options.end??0}:name==='Input'?{inputSequence:p.inputSequence,accepted:true}:name==='Ack'?{acknowledged:true}:name==='Resize'?{resized:true}:{};
  return options.dispatch?.(name,p,value)??Promise.resolve({ok:true,value,operationId:p.operationId});
 }]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=fn=>{listeners[name]=fn;return()=>delete listeners[name];};
 function terminalFactory(config){
  const e={options:config,writes:[],completed:[],clears:0,disposed:0,open(){},clear(){this.clears++;},dispose(){this.disposed++;},onData(fn){this.data=fn;return {dispose:()=>{this.data=null;}};},onResize(fn){this.resize=fn;return {dispose:()=>{this.resize=null;}};},write(data,done){this.writes.push(data);this.completed.push(done);options.write?.(this,data,done);}};emulators.push(e);return e;
 }
 const view=createTerminalView({container,bridge,epoch:4,operationId:()=>`operation_${++operation}`,terminalFactory,reviewPaste:options.reviewPaste,search:options.search});
 const output=(sequence,data,extra={})=>listeners.Data?.({epoch:4,...lease,sequence,data,utf8Bytes:new TextEncoder().encode(data).length,...extra});
 return {view,bridge,listeners,calls,emulators,output,async attach(){const result=await view.attach('session_a');assert.equal(result.ok,true);return emulators.at(-1);},async complete(){emulators.at(-1).completed.shift()?.();await tick();}};
}
test('retained replay is display-only and each frame is ACKed only after emulator processing',async()=>{
 const s=setup({end:3,write:e=>e.data?.('generated reply')});const e=await s.attach();assert.equal(e.options.disableStdin,true);s.output(0,'abc');assert.equal(s.calls.filter(c=>c.name==='Ack').length,0);assert.equal((await s.view.sendInput('x')).code,'REPLAY_PENDING');assert.equal(s.calls.filter(c=>c.name==='Input').length,0);await s.complete();assert.equal(s.calls.filter(c=>c.name==='Ack').length,1);assert.equal(s.calls.find(c=>c.name==='Ack').p.throughSequence,3);assert.equal(s.view.snapshot().replaying,false);assert.equal(e.options.disableStdin,false);e.data('x');await tick();assert.equal(s.calls.filter(c=>c.name==='Input').length,1);s.view.dispose();await s.view.drain();
});
test('synchronous final replay callback cannot enable generated input before write returns',async()=>{
 const s=setup({end:1,write:(e,_data,done)=>{done();e.data?.('late generated reply');}});await s.attach();s.output(0,'a');await tick();assert.equal(s.calls.filter(c=>c.name==='Input').length,0);assert.equal(s.view.snapshot().replaying,false);s.view.dispose();await s.view.drain();
});
test('wrong lease/generation/epoch and duplicate frames cannot alter display or ACK',async()=>{
 const s=setup();const e=await s.attach();for(const extra of [{leaseId:'old'},{generation:2},{epoch:3}])s.output(0,'x',extra);assert.equal(e.writes.length,0);s.output(0,'a');await s.complete();s.output(0,'a');await tick();assert.equal(e.writes.length,1);assert.equal(s.calls.filter(c=>c.name==='Ack').length,1);s.view.dispose();
});
test('missing sequence and retained-tail gaps are visibly marked, without fictitious gap ACKs',async()=>{
 const s=setup({first:20,end:22});const e=await s.attach();assert.match(e.writes.join(''),/history incomplete/i);assert.equal(s.calls.filter(c=>c.name==='Ack').length,0);await s.complete();s.listeners.Gap({epoch:4,...lease,droppedUtf8Bytes:10,resumeSequence:30});await s.complete();s.output(30,'ok');await s.complete();assert.match(e.writes.join(''),/10 UTF-8 bytes/);assert.equal(s.calls.filter(c=>c.name==='Ack').length,1);assert.equal(s.calls.find(c=>c.name==='Ack').p.throughSequence,32);s.view.dispose();
});
test('early output arriving before attach receipt is retained and matched to returned lease',async()=>{
 let release;const s=setup({end:1,dispatch:(name,p,v)=>name==='Attach'?new Promise(resolve=>release=()=>resolve({ok:true,value:v,operationId:p.operationId})):undefined});const attached=s.view.attach('session_a');s.output(0,'bad',{leaseId:'old'});s.output(0,'a');release();assert.equal((await attached).ok,true);assert.equal(s.emulators[0].writes.join(''),'a');await s.complete();assert.equal(s.calls.filter(c=>c.name==='Ack').length,1);s.view.dispose();
});
test('dispose fences immediately, discards text and never stops or interrupts the shell',async()=>{
 const s=setup({end:1});const e=await s.attach();s.output(0,'a');const callback=e.completed[0],oldData=e.data;s.view.dispose();callback();oldData('x');await tick();assert.equal(e.disposed,1);assert.equal((await s.view.sendInput('x')).ok,false);assert.equal(s.calls.filter(c=>['Input','Ack','Stop'].includes(c.name)).length,0);assert.equal(s.calls.filter(c=>c.name==='Detach').length,1);await s.view.drain();
});
test('output overflow retires the local view, with zero credit for unprocessed output',async()=>{
 const s=setup();const e=await s.attach();for(let i=0;i<9;i++)s.output(i*32768,'a'.repeat(32768));await tick();assert.equal(s.view.snapshot().code,'OUTPUT_OVERFLOW');assert.equal(e.disposed,1);assert.equal(s.calls.filter(c=>c.name==='Ack').length,0);assert.equal(s.calls.filter(c=>c.name==='Stop').length,0);s.view.dispose();
});
test('input rejects oversized paste whole and requires explicit multiline review',async()=>{
 let reviews=0;const s=setup({reviewPaste:async()=>{reviews++;return true;}});await s.attach();assert.equal((await s.view.paste('😀'.repeat(8193))).ok,false);assert.equal(reviews,0);assert.equal((await s.view.sendInput('a\nb')).code,'PASTE_REVIEW_REQUIRED');assert.equal((await s.view.paste('a\nb')).ok,true);assert.equal(reviews,1);assert.equal(s.calls.filter(c=>c.name==='Input').length,1);assert.equal(s.calls.find(c=>c.name==='Input').p.data,'a\nb');s.view.dispose();
});
test('pending paste review cannot send after detach or exceed queued input byte budget',async()=>{
 const reviews=[];const s=setup({reviewPaste:()=>new Promise(resolve=>reviews.push(resolve))});await s.attach();const work=Array.from({length:8},()=>s.view.paste('x'.repeat(32766)+'\ny'));assert.equal((await s.view.paste('a\nb')).code,'CAPACITY_EXCEEDED');await s.view.detach();reviews.forEach(r=>r(true));assert.ok((await Promise.all(work)).every(r=>!r.ok));assert.equal(s.calls.filter(c=>c.name==='Input').length,0);await s.view.drain();s.view.dispose();
});
test('input ordering waits for actual receipts and uses consecutive per-lease sequences',async()=>{
 const held=[];const s=setup({dispatch:(name,p)=>name==='Input'?new Promise(resolve=>held.push(()=>resolve({ok:true,value:{inputSequence:p.inputSequence,accepted:true},operationId:p.operationId}))):undefined});await s.attach();const a=s.view.sendInput('a'),b=s.view.sendInput('b');await tick();assert.equal(s.calls.filter(c=>c.name==='Input').length,1);held.shift()();await tick();assert.equal(s.calls.filter(c=>c.name==='Input').length,2);held.shift()();assert.equal((await a).ok,true);assert.equal((await b).ok,true);assert.deepEqual(s.calls.filter(c=>c.name==='Input').map(c=>c.p.inputSequence),[0,1]);s.view.dispose();
});
test('ACK refusal fences further input; exited state is never overridden by an old attach receipt',async()=>{
 const s=setup({dispatch:(name,p)=>name==='Ack'?Promise.resolve({ok:false,code:'LEASE_STALE',operationId:p.operationId}):undefined});await s.attach();s.output(0,'a');await s.complete();assert.equal((await s.view.sendInput('x')).ok,false);s.view.dispose();
 let release;const t=setup({dispatch:(name,p,v)=>name==='Attach'?new Promise(resolve=>release=()=>resolve({ok:true,value:v,operationId:p.operationId})):undefined});const attached=t.view.attach('session_a');t.listeners.State({epoch:4,session:{...info,state:'exited',exitCode:77}});release();await attached;assert.equal((await t.view.sendInput('x')).code,'SESSION_NOT_RUNNING');t.view.dispose();
});
test('clear/search/theme are local display operations and resize remains finite',async()=>{
 const searches=[];const s=setup({search:{findNext:q=>{searches.push(q);return true;}}});const e=await s.attach();s.view.clearView();assert.equal(e.clears,1);assert.equal(s.view.find('abc'),true);assert.deepEqual(searches,['abc']);assert.equal(s.view.setTheme({background:'#101010',foreground:'#eeeeee'}).ok,true);assert.equal(e.options.theme.background,'#101010');assert.equal((await s.view.resize(100,30)).ok,true);assert.equal((await s.view.resize(10000,30)).ok,false);assert.deepEqual(s.calls.map(c=>c.name),['Attach','Resize']);s.view.dispose();
});
test('display filter preserves ANSI/Unicode while discarding all OSC, DCS, native window and oversized controls',()=>{
 const f=createTerminalDisplayFilter();assert.equal(f.push('Ș😀\x1b[31mred\x1b[0m').data,'Ș😀\x1b[31mred\x1b[0m');
 for(const text of ['\x1b]52;c;secret\x07','\x1b]0;title\x07','\x1b]8;;https://example.invalid\x1b\\','\x1bPimage\x1b\\','\x1b[8;40;80t'])assert.equal(f.push(text).data,'');
 assert.equal(f.push('\x1b]'+'a'.repeat(3000)).data,'');assert.equal(f.push('b'.repeat(3000)).data,'');assert.ok(f.snapshot().pendingUtf8Bytes<=4096);assert.equal(f.push('\x07safe').data,'safe');assert.ok(f.snapshot().omittedUtf8Bytes>6000);
});
test('gap reset cancels an incomplete terminal control without swallowing resumed plain output',()=>{
 const f=createTerminalDisplayFilter();f.push('\x1b[31');f.reset();assert.equal(f.push('safe').data,'safe');assert.equal(f.push('\ud800').ok,false);
});
test('idle and disposed views refuse input and controls without throwing',async()=>{
 const s=setup();assert.equal((await s.view.sendInput('x')).code,'VIEW_INACTIVE');assert.equal((await s.view.resize(80,24)).ok,false);assert.equal(s.view.snapshot().active,false);s.view.dispose();assert.equal((await s.view.paste('a\nb')).ok,false);await s.view.drain();assert.equal(s.calls.length,0);
});
test('reentrant paste review preserves submission order and cannot bypass held review',async()=>{
 let s,nested,approve;s=setup({reviewPaste:()=>{nested=s.view.sendInput('nested');return new Promise(resolve=>approve=resolve);}});await s.attach();const outer=s.view.paste('outer\nline');await tick();assert.equal(s.calls.filter(c=>c.name==='Input').length,0);approve(true);assert.equal((await outer).ok,true);assert.equal((await nested).ok,true);assert.deepEqual(s.calls.filter(c=>c.name==='Input').map(c=>c.p.data),['outer\nline','nested']);s.view.dispose();
});
test('malformed affirmative input and ACK receipts fence the view instead of reporting success',async()=>{
 for(const method of ['Input','Ack']){
  const s=setup({dispatch:(name,p)=>name===method?Promise.resolve({ok:true,value:{},operationId:p.operationId}):undefined});await s.attach();if(method==='Input')assert.equal((await s.view.sendInput('x')).ok,false);else{s.output(0,'a');await s.complete();}assert.equal((await s.view.sendInput('after')).ok,false);s.view.dispose();
 }
});
test('filtered control data is visibly reported without forwarding native actions or replay replies',async()=>{
 const s=setup({end:10,write:e=>e.data?.('generated')});const e=await s.attach();s.output(0,'\x1b]0;title\x07');assert.match(e.writes.join(''),/control data omitted/i);assert.doesNotMatch(e.writes.join(''),/title/);await s.complete();assert.equal(s.calls.filter(c=>c.name==='Input').length,0);s.view.dispose();
});
