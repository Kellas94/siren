import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../src/documents/diagram-layout.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const contract=()=>{assert.equal(typeof module.createDiagramLayoutContract,'function');return module.createDiagramLayoutContract();};
test('native layout accepts only finite explicit choices and preserves unsupported imported values',()=>{
 const c=contract();for(const value of ['auto','dagre','elk'])assert.equal(c.valid(value),true);
 for(const value of [undefined,null,'ELK','elk.stress',{},false,''])assert.equal(c.valid(value),false);
 assert.equal(c.validate('elk',undefined),true);assert.equal(c.validate(undefined,'dagre'),true);assert.equal(c.validate(undefined,undefined),true);
 for(const before of ['future',{private:'EXACT'},null]){assert.equal(c.validate('elk',before),false);assert.equal(c.validate(undefined,before),false);}
 assert.equal(c.validate('forged','elk'),false);
});
test('source layout and scoped renderer declarations own layout; comments, labels and palette do not',()=>{
 const c=contract();for(const declared of [{layout:'elk'},{layout:'dagre'},{flowchart:{defaultRenderer:'elk'}},{flowchart:{layout:'dagre'}}]){
  const result=c.resolve(declared,'flowchart-v2','dagre');assert.equal(result.sourceOwned,true);assert.equal(result.layout,undefined);
 }
 for(const type of ['stateDiagram','stateDiagram-v2'])assert.equal(c.resolve({state:{defaultRenderer:'elk'}},type,'dagre').sourceOwned,true);
 const config={theme:'base',themeVariables:{primaryColor:'#ff3366'},title:'layout: elk'},before=JSON.stringify(config);
 assert.equal(c.resolve(config,'flowchart-v2','dagre').layout,'dagre');assert.equal(JSON.stringify(config),before);
 assert.equal(c.resolve({sequence:{defaultRenderer:'elk'}},'flowchart-v2','dagre').sourceOwned,false);
});
test('automatic and unsupported grammars never force a different Mermaid default',()=>{
 const c=contract();for(const choice of [undefined,'auto','future'])assert.equal(c.resolve({},'flowchart-v2',choice).layout,undefined);
 for(const type of ['sequence','pie','gitGraph','unknown']){const r=c.resolve({},type,'elk');assert.equal(r.supported,false);assert.equal(r.layout,undefined);}
 for(const type of ['flowchart','flowchart-v2','stateDiagram','stateDiagram-v2','classDiagram','classDiagram-v2','er','requirement'])assert.equal(c.resolve({},type,'elk').layout,'elk');
});
test('contract refuses descriptor tricks without running getter or mutating prototype',()=>{
 const c=contract();let called=false;const declared={};Object.defineProperty(declared,'layout',{get(){called=true;throw Error('must not run');}});
 assert.equal(c.resolve(declared,'flowchart','dagre').sourceOwned,true);assert.equal(called,false);
 const scoped={};Object.defineProperty(scoped,'defaultRenderer',{get(){called=true;}});assert.equal(c.resolve({flowchart:scoped},'flowchart','dagre').sourceOwned,true);assert.equal(called,false);
 assert.equal(c.resolve(Object.create({layout:'elk'}),'flowchart','dagre').layout,'dagre');assert.equal(called,false);
});
