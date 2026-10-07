import test from 'node:test';
import assert from 'node:assert/strict';
import * as creation from '../src/windows/diagram-create.mjs';
import {catalogueContext} from './fixtures/catalogue-context.mjs';
import {workspaceMetadata} from '../src/windows/entities.mjs';
const request={entryId:'starter:flowchart',title:'Exact birth identity',operationId:'marker-regression-b'};
test('full main-derived birth marker is verified independently of legitimate later diagram edits',async()=>{
 assert.equal(typeof creation.matchesCatalogueCreation,'function');const f=await catalogueContext(),receipt=await f.owner.invoke(f.grant(1),{kind:'catalogue',method:'appendDiagram',payload:request});assert.equal(receipt.ok,true);
 const entity=workspaceMetadata(f.getSelected()).diagrams.find(d=>d.id===receipt.entityId),check=e=>creation.matchesCatalogueCreation(e,request,f.selected.project.id);assert.equal(check(entity),true);assert.equal(check({...entity,source:'flowchart LR\nA-->Z',name:'Changed after birth',sirenNativeVersion:9}),true);
 for(const [field,value]of [['requestHash','f'.repeat(64)],['catalogueVersion',99],['referenceSha256','e'.repeat(64)],['sourceSha256','d'.repeat(64)],['entitySha256','c'.repeat(64)],['entryId','starter:sequence'],['schema',2],['extra','opaque']])assert.equal(check({...entity,sirenNativeCatalogueCreation:{...entity.sirenNativeCatalogueCreation,[field]:value}}),false,field);
 assert.equal(creation.matchesCatalogueCreation(entity,{...request,title:'Different'},f.selected.project.id),false);assert.equal(creation.matchesCatalogueCreation(entity,request,'foreign-project'),false);
});
