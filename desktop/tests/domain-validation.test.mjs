import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../src/projects/domain-validation.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('one Diagram content mutation requires both original source/style validators and disposal before admission',async()=>{
 const input={domain:'diagram',action:'replace-content',payload:{source:'flowchart TD\nA-->B',fontSize:18,nodeStyles:{B:{fill:'#2277cc'}}},before:{id:'diagram-a',source:'saved'}};
 const calls=[];let disposed=0;
 assert.equal(await module.validateDomainPatch(input,{isCurrent:()=>true,createValidator:async()=>({validatePatch:async value=>{calls.push(value);return true;},dispose:async()=>disposed++})}),true);
 assert.deepEqual(calls.map(v=>v.action),['replace-source','update-style']);assert.deepEqual(calls[0].payload,{source:input.payload.source});assert.deepEqual(calls[1].payload,{fontSize:18,nodeStyles:input.payload.nodeStyles});assert.equal(disposed,1);
 assert.equal(await module.validateDomainPatch(input,{isCurrent:()=>true,createValidator:async()=>({validatePatch:async value=>value.action==='replace-source',dispose:async()=>disposed++})}),false);assert.equal(disposed,2);
});
test('owned content validation uses both frozen validators and disposes on every result without accepting normalization',async()=>{
 assert.equal(typeof module.validateDomainPatch,'function');const calls=[];let disposals=0;
 const input={domain:'docs',action:'replace-content',payload:{title:'Exact title',blocks:[{id:'block-a',kind:'text',html:'<p>Exact 😀</p>'}]},before:{id:'doc-a',blocks:[]}};
 const options={isCurrent:()=>true,createValidator:async()=>({validatePatch:async value=>{calls.push(value);return true;},dispose:async()=>{disposals++;}})};
 assert.equal(await module.validateDomainPatch(input,options),true);assert.equal(disposals,1);assert.deepEqual(calls.map(v=>v.action),['rename','replace-blocks']);assert.deepEqual(calls[1].payload,{blocks:input.payload.blocks});assert.deepEqual(calls[1].before,input.before);
 assert.equal(await module.validateDomainPatch(input,{...options,createValidator:async()=>({validatePatch:async()=>false,dispose:async()=>{disposals++;}})}),false);assert.equal(disposals,2);
});
test('native validation revocation, exception and disposal failure cannot authorize a domain save',async()=>{
 assert.equal(typeof module.validateDomainPatch,'function');let current=true,disposed=0;
 const input={domain:'docs',action:'rename',payload:{title:'Keep exact'},before:{id:'doc-a'}};
 assert.equal(await module.validateDomainPatch(input,{isCurrent:()=>current,createValidator:async()=>({validatePatch:async()=>{current=false;return true;},dispose:async()=>{disposed++;}})}),false);assert.equal(disposed,1);
 for(const mode of ['validation','disposal'])assert.equal(await module.validateDomainPatch(input,{isCurrent:()=>true,createValidator:async()=>({validatePatch:async()=>{if(mode==='validation')throw Error('private');return true;},dispose:async()=>{if(mode==='disposal')throw Error('private');}})}),false);
 let created=false;assert.equal(await module.validateDomainPatch(input,{isCurrent:()=>false,createValidator:async()=>{created=true;}}),false);assert.equal(created,false);
});
