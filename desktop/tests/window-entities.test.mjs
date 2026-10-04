import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MAX_WORKSPACE_BYTES } from '../src/projects/budgets.mjs';
import { verifySnapshot } from '../src/projects/store.mjs';
import { manifestRequestHash } from '../src/sources/manifest.mjs';

const module = await import('../src/windows/entities.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const roster = snapshot => module.workspaceEntities(snapshot);
const ref = (sourceId, extra = {}) => ({sourceId,version:1,sha256:'a'.repeat(64),utf8Bytes:0,utf16Units:0,lines:1,longestLineUnits:0,encoding:'utf8',bom:false,newline:'none',provenance:{},...extra});
const snapshot = (metadata, schema=1, sourceRefs=[]) => {
  const json=JSON.stringify(metadata);
  return {schema,project:{id:'project_a',label:'Native fixture',external:false},revision:schema===2?2:1,json,
    sha256:createHash('sha256').update(json).digest('hex'),...(schema===2?{sourceRefs}:{} )};
};
const primary='t-industries-siren-v23-state';
const empty={code:[],docs:[],diagram:[]};
test('workspaceEntities implementation exists',()=>assert.equal(typeof module.workspaceEntities,'function'));
const feature=(name,fn)=>test(name,{skip:!module.workspaceEntities},fn);

feature('schema 1 native direct workpapers grant Docs but never infer legacy Code file IDs',()=>{
  const metadata={diagrams:[{id:'diagram_a',source:'private'}],workpapers:[{id:'doc_a',blocks:[{kind:'knowledge',rows:[{sourceId:'legacy_row',content:'private'}]}]}],codeFiles:[{id:'legacy_file',content:'private'}],codeWorkspace:{drafts:[{id:'legacy_draft',text:'private'}]}};
  assert.deepEqual(roster({...snapshot(metadata),sourceRefs:[ref('fake_native')]}),{code:[],docs:['doc_a'],diagram:['diagram_a']});
});
feature('schema 2 sourceRefs produce unique Code IDs independently from provenance docs',()=>{
  const s=snapshot({workpapers:[{id:'actual_doc'}]},2,[ref('source_a',{provenance:{docId:'orphan_doc',content:'private'}}),ref('source_a',{version:2,sha256:'b'.repeat(64)}),ref('source_b')]);
  assert.deepEqual(roster(s),{code:['source_a','source_b'],docs:['actual_doc'],diagram:[]});
});
feature('actual desktop primary bag outranks imported state, direct workpapers and old caches',()=>{
  const metadata={kind:'siren-desktop',schema:2,storage:{
    [primary+'-backup']:JSON.stringify({workpapers:[{id:'old_doc'}]}),
    'siren-code-drafts-v1':JSON.stringify([{id:'draft_doc',workpapers:[{id:'nested_draft_doc'}]}]),
    [primary]:JSON.stringify({diagrams:[],workpapers:[{id:'current_doc',releases:[{snapshot:{workpapers:[{id:'released_doc'}]}}]}]}),
  },state:{workpapers:[{id:'fallback_doc'}]},workpapers:[{id:'direct_doc'}]};
  assert.deepEqual(roster(snapshot(metadata,2,[ref('native_source')])),{code:['native_source'],docs:['current_doc'],diagram:[]});
});
feature('imported bag.state and direct active workpapers are recognized without recursive crawling',()=>{
  assert.deepEqual(roster(snapshot({type:'siren-project',state:{workpapers:[{id:'imported_doc'}]},workpapers:[{id:'stale_direct'}]})),{code:[],docs:['imported_doc'],diagram:[]});
  assert.deepEqual(roster(snapshot({workpapers:[{id:'direct_doc'}],releases:[{workpapers:[{id:'released_doc'}]}],draft:{workpapers:[{id:'draft_doc'}]},unrelated:{workpapers:[{id:'other_doc'}]}})),{code:[],docs:['direct_doc'],diagram:[]});
});
feature('storage bag without primary and unrelated/release/draft arrays grant no Docs',()=>{
  for(const metadata of [
    {kind:'siren-desktop',schema:1,storage:{[primary+'-backup']:JSON.stringify({workpapers:[{id:'old_doc'}]})},state:{workpapers:[{id:'stale_doc'}]},workpapers:[{id:'direct_doc'}]},
    {storage:{other:JSON.stringify({workpapers:[{id:'library_doc'}]})}},
    {releases:[{snapshot:{workpapers:[{id:'released_doc'}]}}],draft:{workpapers:[{id:'draft_doc'}]}},
  ]) assert.deepEqual(roster(snapshot(metadata)),empty);
});
feature('invalid present primary or imported state fails closed instead of falling back',()=>{
  for(const raw of ['{','null','[]','false','"text"',null,{},3]) {
    assert.deepEqual(roster(snapshot({storage:{[primary]:raw},state:{workpapers:[{id:'fallback'}]},workpapers:[{id:'direct'}]},2,[ref('native_source')])),empty);
  }
  for(const state of [null,[],false,'text']) assert.deepEqual(roster(snapshot({state,workpapers:[{id:'direct'}]},2,[ref('native_source')])),empty);
});
feature('malformed snapshots, schemas and outer JSON return empty without throwing',()=>{
  for(const s of [undefined,null,[],{},false,{schema:0,json:'{}'},{schema:'2',json:'{}'},{schema:3,json:'{}'},
    {schema:1,json:null},{schema:2,json:{}},{schema:2,json:'{'},{schema:2,json:'null'},{schema:2,json:'[]'},{schema:1,json:'false'}]) assert.deepEqual(roster(s),empty);
});
feature('invalid IDs, versions and hashes are filtered without numeric coercion',()=>{
  const invalid=[ref('../escape'),ref(''),ref('A_UPPER'),ref('source_bad',{version:0}),ref('source_bad',{version:1.5}),ref('source_bad',{version:'1'}),ref('source_bad',{version:Infinity}),ref('source_bad',{sha256:'A'.repeat(64)}),ref('source_bad',{sha256:'a'.repeat(63)}),ref('source_bad',{sha256:9}),null,{}];
  assert.deepEqual(roster(snapshot({workpapers:[null,{}, {id:0},{id:'../doc'}, {id:'doc_valid'},{id:'doc_valid'},{id:'WP_IMPORT'}]},2,[...invalid,ref('source_valid')])),{code:['source_valid'],docs:['doc_valid','WP_IMPORT'],diagram:[]});
});
feature('missing or malformed sourceRefs yield no Code while actual Docs remain scoped',()=>{
  for(const sourceRefs of [undefined,null,{},'refs']) assert.deepEqual(roster({...snapshot({workpapers:[{id:'doc_a'}]},2),sourceRefs}),{code:[],docs:['doc_a'],diagram:[]});
});
feature('own data descriptors avoid snapshot/ref getters and inherited authority',()=>{
  let calls=0;
  for(const s of [{get schema(){calls++;return 2;},json:'{}'}, {schema:2,get json(){calls++;return '{}';}},Object.create({schema:2,json:'{}',sourceRefs:[ref('source_fake')]})]) assert.deepEqual(roster(s),empty);
  const inheritedRef=Object.create(ref('source_inherited'));
  const accessorRef={get sourceId(){calls++;return 'source_accessor';},version:1,sha256:'a'.repeat(64)};
  const privateRef=ref('source_actual');Object.defineProperty(privateRef,'provenance',{get(){calls++;throw new Error('private');}});
  const s=snapshot({workpapers:[{id:'doc_actual'}]},2,[inheritedRef,accessorRef,privateRef]);
  Object.defineProperty(s,'sourceText',{get(){calls++;throw new Error('private');}});
  assert.deepEqual(roster(s),{code:['source_actual'],docs:['doc_actual'],diagram:[]});assert.equal(calls,0);
});
feature('array accessors and inherited sparse entries cannot contribute Code IDs',()=>{
  let calls=0;const refs=new Array(3);Object.defineProperty(refs,'0',{get(){calls++;return ref('source_accessor');}});refs[2]=ref('source_actual');
  Object.setPrototypeOf(refs,Object.create(Array.prototype,{1:{value:ref('source_inherited')}}));
  assert.deepEqual(roster(snapshot({},2,refs)),{code:['source_actual'],docs:[],diagram:[]});assert.equal(calls,0);
});
feature('JSON special keys never create inherited workpapers or pollute prototypes',()=>{
  const s={schema:1,json:'{"__proto__":{"workpapers":[{"id":"forged"}]},"constructor":{"workpapers":[{"id":"other"}]}}'};
  assert.deepEqual(roster(s),empty);assert.equal(Object.hasOwn(Object.prototype,'workpapers'),false);
});
feature('workspace UTF-8 byte cap rejects oversized multibyte JSON before parsing/granting',()=>{
  const json='{"workpapers":[{"id":"forged"}],"padding":"'+'ș'.repeat(Math.floor(MAX_WORKSPACE_BYTES/2))+'"}';
  assert.ok(json.length<MAX_WORKSPACE_BYTES);assert.ok(Buffer.byteLength(json)>MAX_WORKSPACE_BYTES);
  assert.deepEqual(roster({schema:2,json,sourceRefs:[ref('source_a')]}),empty);
});
feature('roster contains only fresh ID arrays and preserves frozen native inputs',()=>{
  const source=Object.freeze(ref('source_a'));const s=Object.freeze(snapshot({workpapers:[{id:'doc_a',title:'private',blocks:[{content:'private'}]}]},2,Object.freeze([source])));
  const before=s.json;const first=roster(s);assert.deepEqual(Object.keys(first).sort(),['code','diagram','docs']);first.code.push('forged');first.docs.length=0;
  assert.deepEqual(roster(s),{code:['source_a'],docs:['doc_a'],diagram:[]});assert.equal(s.json,before);
});
feature('actual ProjectStore-verifiable schema 1 and schema 2 snapshots produce native rosters',()=>{
  const legacy=snapshot({workpapers:[{id:'legacy_doc'}],codeFiles:[{id:'legacy_code',content:'old'}]});
  assert.equal(verifySnapshot(legacy),legacy);assert.deepEqual(roster(legacy),{code:[],docs:['legacy_doc'],diagram:[]});
  const nativeRef=ref('native_empty',{sha256:createHash('sha256').update('').digest('hex')});
  const current=snapshot({kind:'siren-desktop',schema:2,storage:{[primary]:JSON.stringify({workpapers:[{id:'native_doc',blocks:[{kind:'knowledge',rows:[{id:'owner_row',sourceRef:{sourceId:nativeRef.sourceId,version:1,sha256:nativeRef.sha256}}]}]}]})}},2,[nativeRef]);
  Object.assign(current,{operationId:'verified_fixture',parentRequestHash:null,parentManifestHash:null,requestHash:manifestRequestHash({projectId:current.project.id,baseRevision:1,sourceRefs:current.sourceRefs,json:current.json,operationId:'verified_fixture'})});
  assert.equal(verifySnapshot(current),current);assert.deepEqual(roster(current),{code:['native_empty'],docs:['native_doc'],diagram:[]});
});
