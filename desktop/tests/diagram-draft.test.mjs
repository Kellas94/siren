import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
const code=await readFile(new URL('../src/ui/diagram/draft.js',import.meta.url),'utf8').catch(error=>{if(error.code!=='ENOENT')throw error;return '';});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function create(bridge,extra={},runtimeCrypto=webcrypto){const window={};runInNewContext(code,{window,crypto:runtimeCrypto,structuredClone,TextEncoder});assert.equal(typeof window.SirenNativeDiagramDraft?.create,'function');const diagram={id:'diagram-a',name:'Exact source',source:'flowchart TD\nA-->B',nodeStyles:{A:{fill:'#ff3366'}},sirenNativeVersion:1};return window.SirenNativeDiagramDraft.create({context:{ok:true,readonly:false,diagram,version:1,sha256:hash(diagram),projectRevision:2},bridge,operationId:()=> 'exact-op',...extra});}
const receipt=(draft,request)=>{const entity={...draft.getDiagram(),source:request.payload.source,sirenNativeVersion:2};return {ok:true,domain:'diagram',entityId:'diagram-a',version:2,sha256:hash(entity),projectRevision:3,durability:'committed',operationId:request.operationId};};
test('working Diagram sends source-only typed CAS and accepts only exact source/entity/version/hash receipts',async()=>{
 let draft,request;draft=create({async applyDiagram(value){request=value;return receipt(draft,value);},async flushDiagram(value){assert.equal(value.expectedVersion,2);return {...receipt(draft,request),sha256:hash(draft.getDiagram())};}});
 assert.equal(draft.setSource('flowchart TD\nA-->C\nstyle A fill:#ff3366').ok,true);assert.equal((await draft.save()).ok,true);
 assert.deepEqual(JSON.parse(JSON.stringify(request)),{diagramId:'diagram-a',expectedVersion:1,operationId:'exact-op',action:'replace-source',payload:{source:'flowchart TD\nA-->C\nstyle A fill:#ff3366'}});assert.equal(draft.getStatus().dirty,false);assert.equal(draft.getStatus().version,2);assert.deepEqual(JSON.parse(JSON.stringify(draft.getDiagram().nodeStyles)),{A:{fill:'#ff3366'}});assert.equal((await draft.flushView()).ok,true);
 for(const wrong of [{entityId:'diagram-b'},{version:3},{sha256:'0'.repeat(64)},{operationId:'forged-op'}]){let own;own=create({applyDiagram:async value=>({...receipt(own,value),...wrong})});own.setSource('Exact local text');assert.equal((await own.save()).ok,false);assert.equal(own.getStatus().dirty,true);assert.equal(own.getStatus().fenced,true);assert.equal(own.getDiagram().source,'Exact local text');}
});
test('stale Diagram saves retain and fence local source; frozen validation refusal remains correctable without a blind fresh-version retry',async()=>{
 const stale=create({applyDiagram:async()=>({ok:false,code:'REVISION_CONFLICT'})});stale.setSource('STALE_LOCAL');assert.equal((await stale.save()).code,'REVISION_CONFLICT');assert.equal(stale.setSource('REWRITE').ok,false);assert.equal(stale.getDiagram().source,'STALE_LOCAL');
 let tries=0,own;own=create({applyDiagram:async request=>++tries===1?{ok:false,code:'DOMAIN_VALIDATION_FAILED'}:receipt(own,request)});own.setSource('flowchart TD\nA[');assert.equal((await own.save()).ok,false);assert.equal(own.getStatus().fenced,false);assert.equal(own.setSource('flowchart TD\nA-->C').ok,true);assert.equal((await own.save()).ok,true);assert.equal(own.getStatus().version,2);
});
test('Diagram Lock waits its real pending save, rollback releases input state and a late refused receipt cannot clear local source',async()=>{
 let release;const own=create({applyDiagram:()=>new Promise(resolve=>release=resolve)});own.setSource('PENDING_LOCAL');const save=own.save(),draining=own.flushView();assert.equal(own.getStatus().paused,true);own.resumeView();assert.equal(own.getStatus().paused,false);release({ok:false,code:'REVISION_CONFLICT'});assert.equal((await save).ok,false);assert.equal((await draining).ok,false);assert.equal(own.getDiagram().source,'PENDING_LOCAL');assert.equal(own.getStatus().dirty,true);
});
test('a failed client hash check cannot report a successful save or silently permit a new operation after uncertain commit',async()=>{
 let own;own=create({applyDiagram:async request=>receipt(own,request)}, {},{subtle:{digest:async()=>{throw Error('Owned hash provider failure');}}});own.setSource('Exact unverified local source');const result=await own.save();assert.equal(result.ok,false);assert.equal(own.getStatus().dirty,true);assert.equal(own.getStatus().fenced,true);assert.equal(own.getDiagram().source,'Exact unverified local source');
});
test('only a clean preparing Diagram may reread its exact newer native entity before flush; dirty conflicts retain their original source',async()=>{
 let own,reads=0;const latest={id:'diagram-a',name:'Exact source',source:'Saved elsewhere',nodeStyles:{A:{fill:'#ff3366'}},sirenNativeVersion:2};
 own=create({getDiagram:async()=>{reads++;return {ok:true,readonly:false,diagram:latest,version:2,sha256:hash(latest),projectRevision:3};},flushDiagram:async request=>{assert.equal(request.expectedVersion,2);return {ok:true,domain:'diagram',entityId:'diagram-a',version:2,sha256:hash(latest),projectRevision:3,durability:'committed'};}});
 assert.equal((await own.flushView()).ok,true);assert.equal(reads,1);assert.equal(own.getDiagram().source,'Saved elsewhere');assert.equal(own.getStatus().dirty,false);
 const dirty=create({getDiagram:async()=>{reads++;throw Error('No dirty reread');},applyDiagram:async()=>({ok:false,code:'REVISION_CONFLICT'})});dirty.setSource('Exact unsaved');assert.equal((await dirty.flushView()).ok,false);assert.equal(dirty.getDiagram().source,'Exact unsaved');assert.equal(reads,1);
});
test('a queued same-diagram save between clean read and flush permits one read-only recapture, never a blind mutation retry',async()=>{
 let reads=0,flushes=0;const entity=()=>({id:'diagram-a',source:'Saved version '+(reads+1),sirenNativeVersion:reads+1});
 const own=create({getDiagram:async()=>{reads++;const diagram=entity();return {ok:true,readonly:false,diagram,version:diagram.sirenNativeVersion,sha256:hash(diagram),projectRevision:reads+2};},applyDiagram:async()=>{throw Error('No blind save retry');},flushDiagram:async request=>{if(++flushes===1)return {ok:false,code:'REVISION_CONFLICT'};const diagram=entity();return {ok:true,domain:'diagram',entityId:'diagram-a',version:request.expectedVersion,sha256:hash(diagram),projectRevision:reads+2,durability:'committed'};}});
 assert.equal((await own.flushView()).ok,true);assert.equal(reads,2);assert.equal(flushes,2);assert.equal(own.getStatus().version,3);assert.equal(own.getStatus().dirty,false);
});
