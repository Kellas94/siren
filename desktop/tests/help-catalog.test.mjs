import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {HELP_ARTICLES,validateHelpCatalog} from '../src/help/catalog.mjs';
const clone=()=>structuredClone(HELP_ARTICLES);
test('shipped manual is finite, immutable and tied to real source files',async()=>{
 assert.equal(validateHelpCatalog(HELP_ARTICLES).ok,true);assert.ok(HELP_ARTICLES.length>=16&&HELP_ARTICLES.length<=64);
 assert.ok(Object.isFrozen(HELP_ARTICLES));
 for(const a of HELP_ARTICLES){assert.ok(Object.isFrozen(a));for(const source of a.sources)await access(source);}
 assert.equal(HELP_ARTICLES.filter(a=>a.id==='unknown-error').length,1);
});
test('catalog refuses duplicate article and scoped mapping identities',()=>{
 const a=clone();a.push(structuredClone(a[0]));assert.equal(validateHelpCatalog(a).ok,false);
 const b=clone(),mapped=b.filter(a=>a.mappings.length);mapped[1].mappings.push({...mapped[0].mappings[0]});assert.equal(validateHelpCatalog(b).ok,false);
});
test('catalog rejects dangling relations, executable fields, getters and oversized prose without invoking getters',()=>{
 for(const mutate of [a=>a[0].related.push('missing'),a=>a[0].action='delete',a=>a[0].summary='x'.repeat(601),a=>a[0].observed='x'.repeat(4001)]){const a=clone();mutate(a);assert.equal(validateHelpCatalog(a).ok,false);}
 let calls=0;const a=clone();Object.defineProperty(a[0],'summary',{enumerable:true,get(){calls++;return 'getter';}});assert.equal(validateHelpCatalog(a).ok,false);assert.equal(calls,0);
});
test('non-enumerable required fields cannot disappear when a validated catalog is snapshotted',()=>{
 for(const choose of [a=>[a[0],'id'],a=>[a.find(x=>x.mappings.length).mappings[0],'namespace'],a=>[a.find(x=>x.flow).flow.nodes[0],'label']]){
  const a=clone(),[object,key]=choose(a);Object.defineProperty(object,key,{...Object.getOwnPropertyDescriptor(object,key),enumerable:false});
  assert.equal(validateHelpCatalog(a).ok,false,key+' must survive the data snapshot');
 }
});
test('flow bounds and references refuse cycles, duplicate nodes and excessive data',()=>{
 const baseline=HELP_ARTICLES.find(a=>a.flow);assert.ok(baseline);
 for(const mutate of [f=>f.edges.push({from:f.nodes.at(-1).id,to:f.nodes[0].id,label:'Again'}),f=>f.nodes.push({...f.nodes[0]}),f=>f.edges.push({from:'missing',to:f.nodes[0].id,label:'Bad'}),f=>f.nodes[0].type='execute',f=>{while(f.nodes.length<25)f.nodes.push({id:'extra-'+f.nodes.length,type:'check',label:'Check'});},f=>{while(f.edges.length<49)f.edges.push({...f.edges[0]});}]){const a=clone();mutate(a.find(x=>x.id===baseline.id).flow);assert.equal(validateHelpCatalog(a).ok,false);}
});
test('partial export and opening failure never imply that a committed result disappeared',()=>{
 const exported=HELP_ARTICLES.find(a=>a.mappings.some(m=>m.code==='EXPORT_COMMITTED'));assert.ok(exported);assert.match(exported.observed,/saved|committed/i);
 const opened=HELP_ARTICLES.find(a=>a.id==='diagram-created-not-opened');assert.ok(opened);assert.match(opened.observed,/saved|created/i);
 assert.doesNotMatch(opened.recovery,/create another/i);
});
test('every shipped exact mapped code occurs in at least one referenced source',async()=>{
 for(const a of HELP_ARTICLES){const source=(await Promise.all(a.sources.map(p=>readFile(p,'utf8')))).join('\n');for(const m of a.mappings)assert.ok(source.includes(m.code),a.id+' '+m.code);}
});
