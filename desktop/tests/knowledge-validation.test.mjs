import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {domainHelper} from '../build/import-validation.mjs';
const ref={sourceId:'source-a',version:1,sha256:'a'.repeat(64)};
const prior={id:'knowledge-a',kind:'knowledge',reasoningEffort:'Retain',rows:[{id:'row-a',name:'Old',notes:'Context',sourceRef:ref,private:'Exact provenance'},{id:'row-b',name:'Other',content:'Untouched legacy source',sourceRef:ref}]};
function fixture(refuse=false){
 const calls=[],window={};
 vm.runInNewContext(domainHelper,{window,MAX_WP_BLOCKS:300,sanitizeWorkpaperBlock:(value,report)=>{calls.push(structuredClone(value));if(refuse)report.push('Actual sanitizer refused');return {...value,rows:value.rows.map(({id,sourceRef,...row})=>row)};}});
 return {calls,validate:block=>window.sirenDesktopValidateDomainPatch({domain:'docs',action:'replace-blocks',before:{blocks:[prior]},payload:{blocks:[block]}})};
}
test('native linked labels validate only finite editable text with the original sanitizer while keeping all immutable row fields',()=>{
 const f=fixture(),next=structuredClone(prior);next.rows[0].name='New <literal> 😀';next.rows[0].notes='Context matters';assert.equal(f.validate(next),true);
 assert.deepEqual(f.calls,[{id:'knowledge-a',kind:'knowledge',reasoningEffort:'',rows:[{name:'New <literal> 😀',fileType:'txt',role:'',notes:'Context matters',content:'',sourceOrigin:'',confirmedAt:'',sourceId:''}]}]);
 assert.deepEqual(prior.rows[0].sourceRef,ref);assert.equal(prior.rows[0].name,'Old');assert.equal(fixture(true).validate(next),false);
});
test('linked metadata cannot rewrite source identity/version/hash, provenance, row order, other content or preserved block fields',()=>{
 const attacks=[r=>r.rows[0].sourceRef.version++,r=>r.rows[0].sourceRef.sha256='b'.repeat(64),r=>r.rows[0].sourceRef.sourceId='source-b',r=>delete r.rows[0].private,r=>r.rows[0].content='Injected',r=>r.rows.reverse(),r=>r.rows.pop(),r=>r.reasoningEffort='Changed',r=>delete r.rows[0].notes,r=>r.rows[0].notes=42];
 for(const attack of attacks){const next=structuredClone(prior);next.rows[0].name='Changed';attack(next);const f=fixture();assert.equal(f.validate(next),false);}
});
test('unchanged legacy linked blocks remain exact without sanitizing or deleting native references',()=>{
 const f=fixture(true);assert.equal(f.validate(structuredClone(prior)),true);assert.equal(f.calls.length,0);
});
