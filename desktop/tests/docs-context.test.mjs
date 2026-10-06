import test from 'node:test';import assert from 'node:assert/strict';
const model=await import('../src/documents/context.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const original={id:'doc-a',title:'Original',type:'agent-spec',owner:'Old',status:'draft',agent:{schema:1,agentId:'AG-1',platform:'old',oversight:{mode:'unknown',future:'KEEP'},data:{personal:'unknown',opaque:['exact']},future:{keep:'EXACT'},incompleteFields:['platform','environment']},links:[{kind:'block',documentId:'doc-peer',blockId:'b-1',label:'Opaque',future:'EXACT'}],comments:[{author:'Human',text:'Keep'}],releases:[{hash:'original'}],blocks:[{id:'opaque',kind:'future',payload:{keep:'Exact'}}]};
test('finite context changes retain unknown agent fields, review, releases, blocks and unsupported references',()=>{
 assert.equal(typeof model.applyDocumentContext,'function');const before=structuredClone(original);
 const actual=model.applyDocumentContext(original,{owner:'New',agent:{platform:'Python',oversight:{mode:'always'},data:{personal:'yes'}}});
 assert.deepEqual(actual,{...before,owner:'New',agent:{...before.agent,platform:'Python',oversight:{...before.agent.oversight,mode:'always'},data:{...before.agent.data,personal:'yes'},incompleteFields:['environment']}});assert.deepEqual(original,before);
});
test('whole saved references add and remove by exact kind/id, preserving unrelated opaque records',()=>{
 assert.equal(typeof model.applyDocumentContext,'function');const targets={diagrams:[{id:'diagram-a'}],workpapers:[{id:'doc-a'},{id:'doc-peer'}]};
 const added=model.applyDocumentContext(original,{references:{add:[{kind:'diagram',id:'diagram-a'},{kind:'document',id:'doc-peer'}]}},{targets});
 assert.deepEqual(added.links,[...original.links,{kind:'diagram',diagramId:'diagram-a',nodeId:'',label:'',dangling:false},{kind:'document',documentId:'doc-peer',blockId:'',label:'',dangling:false}]);
 const removed=model.applyDocumentContext(added,{references:{remove:[{kind:'diagram',id:'diagram-a'}]}},{targets});assert.deepEqual(removed.links,[original.links[0],added.links[2]]);
 assert.throws(()=>model.applyDocumentContext(original,{references:{add:[{kind:'document',id:'foreign'}]}},{targets}),/REFERENCE_TARGET_REFUSED/);
 assert.throws(()=>model.applyDocumentContext(original,{references:{add:[{kind:'document',id:'doc-a'}]}},{targets}),/REFERENCE_TARGET_REFUSED/);
});
test('context normalization rejects arbitrary approval, paths, extra nested fields, overlimits and accessors without invoking them',()=>{
 assert.equal(typeof model.normalizeDocumentContext,'function');let reads=0;const malicious={};Object.defineProperty(malicious,'owner',{enumerable:true,get(){reads++;return 'bad';}});
 for(const value of [{status:'approved'},{path:'C:/foreign'},{agent:{future:'overwrite'}},{agent:{oversight:{mode:'sometimes'}}},{owner:'x'.repeat(81)},{agent:{data:{restrictions:'x'.repeat(2001)}}},malicious,{references:{add:[{kind:'block',id:'doc-peer'}]}}])assert.throws(()=>model.normalizeDocumentContext(value),/CONTEXT_REFUSED/);
 assert.equal(reads,0);assert.deepEqual(model.normalizeDocumentContext({type:'control',owner:'Ș😀',agent:{agentId:'AG-2',data:{personal:'possible'}}}),{type:'control',owner:'Ș😀',agent:{agentId:'AG-2',data:{personal:'possible'}}});
});
