import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {buildDiagramStyle} from '../build/diagram-style.mjs';
const module=await import('../build/native-node-style-validation.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const built=await buildDiagramStyle({baselinePath:new URL('../baseline/R78.html',import.meta.url)}),window={};vm.runInNewContext(built.script.replace('window.SirenNativeDiagramStyle=Object.freeze','window.actualSanitizeNodeStyles=sanitizeNodeStyles;window.SirenNativeDiagramStyle=Object.freeze'),{window});
test('managed block typography validates with actual frozen sanitizer while preserving opaque sibling data exactly',()=>{
 assert.equal(typeof module.validateNativeNodeStyles,'function');const before={A:{fill:'#ff3366',future:{reviewer:'EXACT'}},B:{text:'#112233',fontFamily:'Georgia',fontWeight:700}},next=structuredClone(before);next.A.fontSize=22;delete next.B.fontFamily;delete next.B.fontWeight;
 const check=value=>module.validateNativeNodeStyles(value,before,window.actualSanitizeNodeStyles);assert.equal(check(next),true);assert.equal(check({...next,A:{fill:'#ff3366',fontSize:22}}),false);assert.equal(check({...next,A:{...next.A,future:{reviewer:'CHANGED'}}}),false);assert.equal(check({...next,B:{text:'#112233',fontWeight:'inherit'}}),false);assert.equal(check({...next,A:{...next.A,fill:'url(https://unsafe)'}}),false);assert.equal(check({...next,C:{future:'new unknown'}}),false);assert.equal(check({B:next.B}),false);
 assert.equal(module.validateNativeNodeStyles({},{B:{fontWeight:700}},window.actualSanitizeNodeStyles),true);assert.equal(module.validateNativeNodeStyles({A:{}},{A:{}},window.actualSanitizeNodeStyles),true);
});
test('new node entries retain actual aggregate frozen admission and reject invalid empty node keys',()=>{
 const nodes=Object.fromEntries(Array.from({length:2000},(_,i)=>['node_'+i,{fontWeight:700}]));assert.equal(module.validateNativeNodeStyles(nodes,{},window.actualSanitizeNodeStyles),false);assert.equal(module.validateNativeNodeStyles({'invalid id':{}},{},window.actualSanitizeNodeStyles),false);assert.equal(module.validateNativeNodeStyles({newNode:{}},{},window.actualSanitizeNodeStyles),true);
});

test('prototype-named nodes use own data for first style and deletion; sanitizer prototype writes never grant admission',()=>{
 for(const id of ['constructor','toString','hasOwnProperty']){
  const value={[id]:{fontSize:22}};assert.equal(Object.hasOwn(window.actualSanitizeNodeStyles(value),id),true);assert.equal(module.validateNativeNodeStyles(value,{},window.actualSanitizeNodeStyles),true,id+' first style');assert.equal(module.validateNativeNodeStyles({},value,window.actualSanitizeNodeStyles),true,id+' deletion');
 }
 const unsafe=JSON.parse('{"__proto__":{"fontSize":22}}');assert.equal(Object.hasOwn(window.actualSanitizeNodeStyles(unsafe),'__proto__'),false);assert.equal(module.validateNativeNodeStyles(unsafe,{},window.actualSanitizeNodeStyles),false);assert.equal(Object.getPrototypeOf(unsafe),Object.prototype);
});