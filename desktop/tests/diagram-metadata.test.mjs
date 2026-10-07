import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../src/documents/diagram-metadata.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const create=()=>{assert.equal(typeof module.createDiagramMetadataContract,'function');return module.createDiagramMetadataContract();};

test('finite metadata edit preserves opaque nested source pointers and unrelated node data exactly',()=>{
 const m=create(),ref={sourceId:'source-a',version:2,sha256:'a'.repeat(64)},before={A:{owner:'Original',status:'future-status',opaque:{sourceRef:ref,array:[true,null,42]}},B:{owner:7,external:'retained'}};
 const saved=structuredClone(before),next=m.update(before,{id:'A',changes:{owner:'Știință 😀',control:'Exact control'}});
 assert.deepEqual(before,saved);assert.deepEqual(next,{...saved,A:{...saved.A,owner:'Știință 😀',control:'Exact control'}});assert.equal(m.validate(next,before),true);assert.notEqual(next.A.opaque,before.A.opaque);
 assert.equal(m.validate({...next,A:{...next.A,opaque:{sourceRef:{...ref,version:3}}}},before),false);
 assert.equal(m.validate({...next,A:{...next.A,newUnknown:'forged'}},before),false);
 assert.equal(m.validate({A:next.A},before),false);assert.equal(m.validate(undefined,before),false);
});

test('strict field ceilings and status values reject overflow/coercion without partial mutation',()=>{
 const m=create();assert.deepEqual(m.fields,{risk:180,control:180,owner:100,system:100,evidence:600,reference:220,frequency:80,status:8});
 for(const[field,limit]of Object.entries(m.fields)){
  const exact=field==='status'?'approved':'x'.repeat(limit);assert.equal(m.validate(m.update(undefined,{id:'A',changes:{[field]:exact}}),undefined),true);
  for(const value of ['x'.repeat(limit+1),5,null,{},'\ud800'])assert.throws(()=>m.update(undefined,{id:'A',changes:{owner:'valid',[field]:value}}));
 }
 for(const status of m.statuses)assert.doesNotThrow(()=>m.update(undefined,{id:'A',changes:{status}}));
 assert.throws(()=>m.update(undefined,{id:'A',changes:{status:'APPROVED'}}));assert.throws(()=>m.update(undefined,{id:'A',changes:{sourceRef:'forged'}}));
});

test('empty edits preserve optional absence and clearing deletes only managed keys',()=>{
 const m=create();assert.equal(m.update(undefined,{id:'A',changes:{owner:''}}),undefined);assert.equal(m.validate(undefined,undefined),true);
 assert.deepEqual(m.update({}, {id:'A',changes:{}}),{});
 assert.deepEqual(m.update({A:{owner:'remove',opaque:{keep:true}}},{id:'A',changes:{owner:''}}),{A:{opaque:{keep:true}}});
 assert.deepEqual(m.update({A:{owner:'remove'}},{id:'A',changes:{owner:''}}),{});
 assert.equal(m.validate(undefined,{A:{owner:'remove'}}),true);assert.equal(m.validate(undefined,{A:{sourceRef:{version:1}}}),false);
 assert.equal(m.validate({A:{owner:'next',status:99}}, {A:{owner:'old',status:99}}),true);
 assert.equal(m.validate({A:{owner:'next',status:98}}, {A:{owner:'old',status:99}}),false);
});

test('prototype-name semantic IDs create own data without prototype writes',()=>{
 const m=create();let before;
 for(const id of ['constructor','toString','__proto__']){const next=m.update(before,{id,changes:{owner:'owner-'+id}});assert.equal(Object.hasOwn(next,id),true);assert.equal(next[id].owner,'owner-'+id);assert.equal(Object.getPrototypeOf(next),Object.prototype);assert.equal(m.validate(next,before),true);before=next;}
 assert.equal(Object.prototype.owner,undefined);assert.equal(m.validate({...before,constructor:{sourceRef:'forged'}},before),false);
});

test('untrusted descriptors, non-data input and malformed identities refuse without executing accessors',()=>{
 const m=create();let reads=0;const evil=Object.defineProperty({},'owner',{enumerable:true,get(){reads++;return 'executed';}});
 assert.throws(()=>m.update({}, {id:'A',changes:evil}));assert.equal(m.validate({A:evil},{}),false);assert.equal(reads,0);
 for(const changes of [{[Symbol('x')]:'bad'},new Date(),[],Object.defineProperty({},'owner',{value:'hidden'})])assert.throws(()=>m.update({}, {id:'A',changes}));
 for(const id of ['','A B','1bad','A\n'])assert.throws(()=>m.update({}, {id,changes:{owner:'bad'}}));
 assert.equal(m.validate({A:{owner:'forged'}},{A:'opaque scalar'}),false);assert.equal(m.validate({A:'opaque scalar'},{A:'opaque scalar'}),true);
 assert.throws(()=>m.update({A:'opaque scalar'},{id:'A',changes:{owner:'bad'}}));
});

test('bounded maps and exact Unicode values do not normalize retained data or silently widen budgets',()=>{
 const m=create(),before=Object.fromEntries(Array.from({length:500},(_,i)=>['N'+i,{owner:'é'}]));
 assert.equal(m.validate(m.update(before,{id:'N1',changes:{owner:'e\u0301'}}),before),true);
 assert.throws(()=>m.update(before,{id:'N500',changes:{owner:'new'}}));
 assert.equal(m.validate({...before,N500:{owner:'new'}},before),false);
 const oversized={...before,N500:{owner:'existing'}};assert.equal(m.validate(structuredClone(oversized),oversized),true);assert.throws(()=>m.update(oversized,{id:'N1',changes:{owner:'changed'}}));
 let deep={};for(let i=0;i<34;i++)deep={nested:deep};assert.equal(m.validate({A:{opaque:deep}},{A:{opaque:deep}}),false);
});
