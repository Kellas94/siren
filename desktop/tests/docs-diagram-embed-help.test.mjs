import test from 'node:test';
import assert from 'node:assert/strict';
import {HELP_ARTICLES,validateHelpCatalog} from '../src/help/catalog.mjs';
import {createHelpResolver} from '../src/help/resolve.mjs';
const resolver=createHelpResolver(HELP_ARTICLES);
test('diagram insertion explanations are scoped to operation and preserve uncertain outcomes',()=>{
 for(const code of ['WRITER_BUSY','PENDING_CLEANUP_FAILED','DIAGRAM_EMBED_ASSET_CORRUPT']){
  const a=resolver.resolve({namespace:'docs-diagram',operation:'insert',code});assert.equal(a.id,'docs-diagram-insert');assert.match(a.recovery,/Do not delete/);assert.match(a.dataImpact,/inspect/i);
  assert.equal(resolver.resolve({namespace:'docs',operation:'save',code}).id,'unknown-error');assert.equal(resolver.resolve({namespace:'docs-diagram',operation:'preview',code}).id,'unknown-error');
 }
 assert.equal(resolver.resolve({namespace:'docs-diagram',operation:'insert',code:'UNRECOGNIZED_CODE'}).id,'unknown-error');
 assert.equal(resolver.search({query:'PENDING_CLEANUP_FAILED'})[0],'docs-diagram-insert');assert.equal(validateHelpCatalog(HELP_ARTICLES).ok,true);
});
test('budget explanation is separate from integrity diagnosis and the offline flow grants no repair action',()=>{
 const a=resolver.resolve({namespace:'docs-diagram',operation:'insert',code:'DIAGRAM_EMBED_BUDGET'});assert.equal(a.id,'docs-diagram-budget');assert.match(a.checks,/2 MiB/);assert.match(a.recovery,/Keep/);
 const flow=resolver.flow('docs-diagram-insert');assert.ok(flow);assert.equal(flow.nodes[0].id,'keep');assert.equal(flow.nodes.at(-1).type,'outcome');assert.ok(flow.nodes.every(n=>!Object.hasOwn(n,'action')));
});
