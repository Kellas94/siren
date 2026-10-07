import test from 'node:test';
import assert from 'node:assert/strict';
import {HELP_ARTICLES} from '../src/help/catalog.mjs';
import {createHelpResolver} from '../src/help/resolve.mjs';
const resolver=createHelpResolver(HELP_ARTICLES),unknown=resolver.get('unknown-error');
test('exact namespace and operation select the meaning of reused codes',()=>{
 assert.equal(resolver.resolve({namespace:'appearance',operation:'choose',code:'ACCESS_REFUSED'}).id,'appearance-unavailable');
 assert.equal(resolver.resolve({namespace:'diagram',operation:'export',code:'ACCESS_REFUSED'}).id,'diagram-export-unavailable');
 for(const identity of [{code:'ACCESS_REFUSED'},{namespace:'wrong',operation:'choose',code:'ACCESS_REFUSED'},{namespace:'appearance',operation:'save',code:'ACCESS_REFUSED'}])assert.equal(resolver.resolve(identity),unknown);
});
test('unknown, arbitrary stdout, extra project text and non-data input never become diagnoses',()=>{
 for(const value of [null,'SyntaxError: broken',{},[],{namespace:'appearance',operation:'choose',code:'ACCESS_REFUSED',source:'private'},Object.create({namespace:'appearance',operation:'choose',code:'ACCESS_REFUSED'})])assert.equal(resolver.resolve(value),unknown);
 let calls=0;const identity={namespace:'appearance',operation:'choose'};Object.defineProperty(identity,'code',{enumerable:true,get(){calls++;return 'ACCESS_REFUSED';}});assert.equal(resolver.resolve(identity),unknown);assert.equal(calls,0);
});
test('exact code and title rank ahead of prose, with deterministic local category search',()=>{
 const code=resolver.search({query:'source_budget'});assert.equal(code[0],'source-import');
 const title=resolver.search({query:'source import'});assert.equal(title[0],'source-import');
 assert.deepEqual(resolver.search({query:'source_budget'}),code);
 assert.deepEqual(resolver.search({query:'source_budget',category:'pin'}),[]);
 assert.ok(resolver.search({query:'',category:'sources'}).every(id=>resolver.get(id).category==='sources'));
});
test('bounded search refuses malformed query and never interprets HTML or regex',()=>{
 for(const query of ['x'.repeat(201),null,{},['x']])assert.deepEqual(resolver.search({query}),[]);
 assert.deepEqual(resolver.search({query:'<img src=x onerror=run()>'}),[]);
 assert.deepEqual(resolver.search({query:'(.*)+'}),[]);
 assert.equal(resolver.get('../../Data'),null);assert.equal(resolver.flow('unknown-error'),null);
});
test('flow and catalog snapshots cannot be changed by the caller',()=>{
 const copy=structuredClone(HELP_ARTICLES),other=createHelpResolver(copy);copy[0].title='Replaced';assert.notEqual(other.get(copy[0].id).title,'Replaced');
 const article=HELP_ARTICLES.find(a=>a.flow),flow=other.flow(article.id);assert.ok(Object.isFrozen(flow.nodes));assert.ok(Object.isFrozen(flow.nodes[0]));
 assert.throws(()=>createHelpResolver([]),/INVALID_HELP_CATALOG/);
});
