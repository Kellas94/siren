import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLocation} from '../src/navigation/contracts.mjs';
import {normalizeRoute} from '../src/navigation/entries.mjs';
import {normalizeDomainRequest,normalizeDomainIntent} from '../src/windows/domain.mjs';
test('imported entity identity survives navigation and native read/save contracts without becoming a filesystem ID',()=>{
 for(const entityId of ['AgentNotes','_Deck-A']){
  for(const surface of ['docs','diagrams','present']){assert.equal(normalizeLocation({surface,entityId},{projectId:'project-a'}).entityId,entityId);assert.equal(normalizeRoute({surface,entityId}).entityId,entityId);}
  for(const domain of ['docs','diagram']){
   assert.equal(normalizeDomainRequest(domain,domain==='docs'?'readDocument':'readDiagram',{entityId}).entityId,entityId);
   const request=domain==='docs'?{operationId:'operation-a',documentId:entityId,expectedVersion:'a'.repeat(64),action:'rename',payload:{title:'Imported'}}:{operationId:'operation-a',diagramId:entityId,expectedVersion:1,action:'replace-source',payload:{source:'flowchart TD\nA-->B'}};
   assert.equal(normalizeDomainIntent(domain,request)[domain==='docs'?'documentId':'diagramId'],entityId);
  }
 }
});
test('imported metadata identity never permits path components, control characters or noncanonical source IDs',()=>{
 for(const entityId of ['../Agent','A/B','A\\B','A:Notes','A\0B',''])for(const surface of ['docs','diagrams','present'])assert.throws(()=>normalizeLocation({surface,entityId},{projectId:'project-a'}));
 for(const entityId of ['AgentNotes','_Deck-A'])assert.throws(()=>normalizeLocation({surface:'code',entityId},{projectId:'project-a'}));
});
