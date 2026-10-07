import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import * as presentation from '../src/documents/presentation-edits.mjs';
const script=await readFile(new URL('../src/ui/diagram/draft.js',import.meta.url),'utf8');
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fixture({readonly=false,source='flowchart TD\nA-->B',bridge:extra={}}={}){
 const initial={id:'diagram-a',source,nodeStyles:{A:{fill:'#ff3366'}},presentation:{sequence:[],notes:{},future:'EXACT'},future:{owner:'RETAIN'}},requests=[];let now=0,saved=structuredClone(initial),version=1,revision=2;
 const window={SirenPresentationEdits:Object.fromEntries(['normalizePresentationEdits','applyPresentationEdits'].map(k=>[k,(...args)=>presentation[k](...args.map(v=>structuredClone(v)))]))};
 vm.runInNewContext(script,{window,crypto:webcrypto,structuredClone,TextEncoder});
 const bridge={async applyDiagram(r){requests.push(structuredClone(r));assert.equal(r.expectedVersion,version);const payload=structuredClone(r.payload),resets=payload.resetStyleFields||[];delete payload.resetStyleFields;for(const k of resets)delete saved[k];if(payload.presentationEdits){payload.presentation=presentation.applyPresentationEdits(saved.presentation,payload.presentationEdits);delete payload.presentationEdits;}saved={...saved,...payload,sirenNativeVersion:++version};revision++;return{ok:true,domain:'diagram',entityId:saved.id,version,sha256:hash(saved),projectRevision:revision,durability:'committed',operationId:r.operationId};},async getDiagram(){return{ok:true,readonly:false,diagram:structuredClone(saved),version,sha256:hash(saved),projectRevision:revision};},async flushDiagram(){return{ok:true,domain:'diagram',entityId:saved.id,version,sha256:hash(saved),projectRevision:revision,durability:'committed'};},...extra};
 const draft=window.SirenNativeDiagramDraft.create({context:{ok:true,readonly,diagram:initial,version,sha256:hash(initial),projectRevision:revision},bridge,now:()=>now,operationId:()=> 'history-op'});
 return {draft,initial,requests,tick:n=>now+=n,replaceSaved(value){saved=structuredClone(value);version=saved.sirenNativeVersion;revision++;},saved:()=>structuredClone(saved)};
}
test('complete source/style history restores exact optional fields after Save using current CAS and preserves presentation edits',async()=>{
 const f=fixture(),d=f.draft;assert.equal(typeof d.getHistory,'function');const first=d.getHistory().entries[0].id;
 d.setSource('flowchart TD\r\nA-->C',{label:'Build connection'});d.setStyle({fontWeight:700,diagramTitle:'Exact title',diagramTitleTouched:true,nodeStyles:{A:{fill:'#ff3366',fontFamily:'Georgia'},C:{text:'#112233'}}});
 assert.equal((await d.save()).ok,true);assert.equal(d.getStatus().version,2);
 assert.equal(d.editPresentation({action:'add',id:'new-card',kind:'text'}).ok,true);const deck=d.getDiagram().presentation;
 assert.equal(d.restoreHistory(first).ok,true);assert.equal(d.getDiagram().source,f.initial.source);assert.deepEqual(d.getDiagram().nodeStyles,f.initial.nodeStyles);assert.equal(Object.hasOwn(d.getDiagram(),'fontWeight'),false);assert.deepEqual(d.getDiagram().presentation,deck);assert.deepEqual(d.getDiagram().future,f.initial.future);assert.equal(d.getStatus().version,2);assert.equal(d.getStatus().dirty,true);
 assert.equal((await d.save()).ok,true);assert.equal(f.requests[1].expectedVersion,2);assert.deepEqual(new Set(f.requests[1].payload.resetStyleFields),new Set(['fontWeight','diagramTitle','diagramTitleTouched']));assert.equal(d.getStatus().version,3);assert.equal(Object.hasOwn(f.saved(),'fontWeight'),false);assert.deepEqual(d.getDiagram().presentation,deck);
 assert.equal(d.redo().ok,true);assert.equal(d.getDiagram().source,'flowchart TD\r\nA-->C');assert.equal(Object.hasOwn(d.getDiagram(),'fontWeight'),false);assert.equal(d.redo().ok,true);assert.equal(d.getDiagram().fontWeight,700);assert.equal(d.getStatus().version,3);
});
test('typing coalesces within750ms, equal input creates no step, structured edits and Save seal typing, new input truncates redo',async()=>{
 const f=fixture(),d=f.draft;assert.equal(typeof d.undo,'function');d.setSource('a',{coalesce:true});f.tick(500);d.setSource('ab',{coalesce:true});assert.equal(d.getHistory().entries.length,2);d.setSource('ab',{coalesce:true});assert.equal(d.getHistory().entries.length,2);f.tick(751);d.setSource('abc',{coalesce:true});assert.equal(d.getHistory().entries.length,3);
 assert.equal(d.undo().ok,true);assert.equal(d.getDiagram().source,'ab');assert.equal(d.redo().ok,true);d.setStyle({fontSize:20});assert.equal(d.getHistory().entries.length,4);assert.equal((await d.save()).ok,true);f.tick(1);d.setSource('abcd',{coalesce:true});assert.equal(d.getHistory().entries.length,5);d.undo();d.setSource('branch');assert.equal(d.redo().ok,false);assert.equal(d.getDiagram().source,'branch');assert.equal(d.restoreHistory('foreign').ok,false);
});
test('60state/8MiB UTF8 history evicts oldest states without truncating current work, oversized state clears undo safely',()=>{
 const f=fixture(),d=f.draft;assert.equal(typeof d.getHistory,'function');for(let i=0;i<80;i++)d.setSource('step '+i);assert.equal(d.getHistory().entries.length,60);assert.equal(d.getHistory().index,59);assert.equal(d.getHistory().limitStates,60);assert.equal(d.getHistory().limitBytes,8*1024*1024);
 const large='💠'.repeat(400000);for(let i=0;i<8;i++)d.setSource(large+i);assert.ok(d.getHistory().bytes<=8*1024*1024);assert.ok(d.getHistory().entries.length<8);assert.equal(d.getDiagram().source,large+7);
 const oversized='💠'.repeat(2200000);d.setSource(oversized);assert.equal(d.getDiagram().source,oversized);assert.equal(d.getHistory().entries.length,1);assert.equal(d.undo().ok,false);d.setSource('small');assert.equal(d.undo().ok,false);assert.equal(d.getDiagram().source,'small');
});
test('readonly/pending/fenced/paused/disposed history commands cannot mutate; failed validation remains correctable',async()=>{
 const read=fixture({readonly:true}).draft;assert.equal(typeof read.undo,'function');assert.equal(read.undo().ok,false);let release;const f=fixture({bridge:{applyDiagram:()=>new Promise(r=>release=r)}}),d=f.draft;d.setSource('pending');const save=d.save();assert.equal(d.undo().ok,false);release({ok:false,code:'REVISION_CONFLICT'});await save;assert.equal(d.undo().ok,false);assert.equal(d.getDiagram().source,'pending');
 const p=fixture().draft;p.setSource('changed');assert.equal((await p.flushView()).ok,true);assert.equal(p.undo().ok,false);p.resumeView();assert.equal(p.undo().ok,true);p.dispose();assert.equal(p.redo().ok,false);
 const v=fixture({bridge:{applyDiagram:async()=>({ok:false,code:'DOMAIN_VALIDATION_FAILED'})}}).draft;v.setSource('invalid[');await v.save();assert.equal(v.undo().ok,true);assert.equal(v.getStatus().fenced,false);
});
test('new saved version adopted during preparing resets local history; same saved content retains it on rollback',async()=>{
 const f=fixture(),d=f.draft;assert.equal(typeof d.getHistory,'function');d.setSource('local');await d.save();await d.flushView();d.resumeView();assert.equal(d.undo().ok,true);assert.equal(d.redo().ok,true);f.replaceSaved({...f.saved(),source:'external',sirenNativeVersion:3});await d.flushView();d.resumeView();assert.equal(d.getDiagram().source,'external');assert.equal(d.getHistory().entries.length,1);assert.equal(d.undo().ok,false);
});
