import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {domainHelper} from '../build/import-validation.mjs';
const names=['sanitizeNodeStyles','sanitizeStyleClasses','sanitizeNodeClasses','sanitizeEdgeStyles','sanitizeEdgeRoutes','sanitizeNodeMetadata','sanitizeComments','sanitizeLayout','sanitizeView','sanitizeNodeLinks','sanitizeNodeIcons','sanitizeFormatRules','sanitizeNumbering','sanitizeLegend','sanitizeGitBranchColours','sanitizePresentation','normalizeFontFamily','normalizeFontWeight'];
function validate(nodeMetadata,before){const context={window:{},raw:JSON.stringify({domain:'diagram',action:'update-style',payload:{nodeMetadata},before:{nodeMetadata:before}})};for(const n of names)context[n]=v=>n==='sanitizeNodeMetadata'?{}:v;return runInNewContext(domainHelper+'\nwindow.sirenDesktopValidateDomainPatch(JSON.parse(raw));',context);}
test('actual isolated domain helper validates metadata deltas without the lossy general import sanitizer',()=>{
 const before={A:{owner:'Before',opaque:{sourceRef:{sourceId:'source-a',version:3,sha256:'a'.repeat(64)}}},B:{status:'unknown-preserved'}},next=structuredClone(before);next.A.owner='After 😀';
 assert.equal(validate(next,before),true);assert.equal(validate({...next,A:{owner:'dropped'}},before),false);assert.equal(validate({...next,A:{...next.A,owner:44}},before),false);assert.equal(validate({...next,C:{newOpaque:true}},before),false);
});
