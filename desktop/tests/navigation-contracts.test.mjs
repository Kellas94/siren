import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocation, normalizeRecord } from '../src/navigation/contracts.mjs';

const hash = 'a'.repeat(64);
const ref = { sourceId:'source-a', version:7, sha256:hash };
const layout = () => ({role:'code',entityId:'source-a',version:7,normalBounds:{x:-1200,y:5,width:960,height:640},displayId:2,maximized:false,fullscreen:false});
const context = {projectId:'project-a'};
const reject = input => assert.throws(() => normalizeLocation(input,context),{code:'INVALID_NAVIGATION'});

test('navigation preserves exact immutable reference and copies all nested data',()=>{
  const input={surface:'code',entityId:'source-a',sourceRef:{...ref},cursor:{anchor:12,head:4},scroll:{x:0,y:230},layouts:[layout()]};
  const actual=normalizeLocation(input,context);
  assert.deepEqual(actual,{schema:1,projectId:'project-a',...input});
  input.sourceRef.version=8;input.layouts[0].normalBounds.width=1;
  assert.equal(actual.sourceRef.version,7);assert.equal(actual.layouts[0].normalBounds.width,960);
});
test('navigation refuses accessor and inherited or unknown fields without evaluating getters',()=>{
  let reads=0;
  const bad={surface:'code'};Object.defineProperty(bad,'entityId',{get(){reads++;throw Error('getter ran');},enumerable:true});
  reject(bad);assert.equal(reads,0);
  reject(Object.assign(Object.create({entityId:'inherited'}),{surface:'code'}));
  for(const extra of [{text:'secret'},{epoch:1},{projectId:'forged'},{schema:1},{path:'C:/private'},{[Symbol('secret')]:1}])reject({surface:'code',...extra});
  const hidden={surface:'code'};Object.defineProperty(hidden,'secret',{value:'hidden'});reject(hidden);
});
test('navigation rejects invalid IDs references and numeric offsets',()=>{
  for(const entityId of ['../outside','',1,'A'.repeat(129)])reject({surface:'code',entityId});
  for(const version of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1])reject({surface:'code',sourceRef:{...ref,version}});
  reject({surface:'code',sourceRef:{...ref,sha256:'invalid'}});
  reject({surface:'code',sourceRef:{...ref,content:'secret'}});
  for(const anchor of [-1,Infinity,NaN,0.5,Number.MAX_SAFE_INTEGER+1])reject({surface:'code',cursor:{anchor,head:0}});
  reject({surface:'code',scroll:{x:0,y:Infinity}});reject({surface:'unknown'});
  assert.throws(()=>normalizeLocation({surface:'code'},{projectId:'../bad'}),{code:'INVALID_NAVIGATION'});
});
test('navigation accepts sixteen validated layouts and rejects seventeen or bad geometry',()=>{
  assert.equal(normalizeLocation({surface:'code',layouts:Array.from({length:16},layout)},context).layouts.length,16);
  assert.throws(()=>normalizeLocation({surface:'code',layouts:Array.from({length:17},layout)},context),{code:'NAVIGATION_LIMIT'});
  for(const patch of [{role:'terminal'},{entityId:'../bad'},{maximized:1},{displayId:''},{windowId:'old-bearer-id'},{normalBounds:{x:0,y:0,width:0,height:640}},{normalBounds:{x:Number.MAX_SAFE_INTEGER,y:0,width:960,height:640}}])reject({surface:'code',layouts:[{...layout(),...patch}]});
  const invalid=[layout()];Object.defineProperty(invalid,'0',{get(){throw Error('array getter ran');}});reject({surface:'code',layouts:invalid});
});
test('record validation bounds labels timestamps unique projects and native scope',()=>{
  const location=normalizeLocation({surface:'code',sourceRef:ref},context);
  const entry={projectId:'project-a',label:'a'.repeat(256),location,visitedAt:'2026-10-03T07:00:00.000Z'};
  assert.deepEqual(normalizeRecord({schema:1,entries:[entry]}),{schema:1,entries:[entry]});
  for(const replacement of [{label:'a'.repeat(257)},{visitedAt:'yesterday'},{location:{...location,projectId:'project-b'}},{location:{...location,text:'secret'}}])assert.throws(()=>normalizeRecord({schema:1,entries:[{...entry,...replacement}]}),{code:'INVALID_NAVIGATION'});
  assert.throws(()=>normalizeRecord({schema:1,entries:[entry,entry]}),{code:'INVALID_NAVIGATION'});
});
