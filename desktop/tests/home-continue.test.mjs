import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {continueSavedLocation} from '../src/navigation/continue.mjs';

async function fixture(){
 const projects=new ProjectStore(await mkdtemp(join(tmpdir(),'siren-continue-')));
 const original=await projects.createProject({label:'Original',json:'{}'}),target=await projects.createProject({label:'Target',json:'{"workpapers":[{"id":"doc-a","title":"Target doc"}]}'});
 let projectId=original.project.id,live=true,opened=0,selected=0;
 const ticket=Object.freeze({}),selectionReceipt=Object.freeze({ok:true,epoch:2});
 const location={schema:1,projectId:target.project.id,surface:'docs',entityId:'doc-a'};
 const args={scope:{transition:ticket,isCurrent:()=>live},location,projects,selectedProjectId:()=>projectId,
  resolveEntity:async({snapshot,location})=>{assert.equal(snapshot.project.id,target.project.id);return {ok:true,location};},
  selectProject:async()=>{selected++;projectId=target.project.id;live=false;return selectionReceipt;},
  selectionIsCurrent:(own,receipt)=>own===ticket&&receipt===selectionReceipt,
  openView:async request=>{opened++;assert.deepEqual(request,{role:'docs',entityId:'doc-a'});assert.equal(projectId,target.project.id);return {ok:true,view:{epoch:2}};},
  navigateDiagrams:()=>assert.fail('Docs does not open Diagrams')};
 return {args,projects,original,target,selectionReceipt,counts:()=>({opened,selected})};
}

test('cross-project Continue opens its resolved document after genuine selection and returns only the native receipt',async()=>{
 const f=await fixture();assert.equal(await continueSavedLocation(f.args),f.selectionReceipt);
 assert.deepEqual(f.counts(),{opened:1,selected:1});assert.deepEqual(await f.projects.readProject(f.original.project.id),f.original);assert.deepEqual(await f.projects.readProject(f.target.project.id),f.target);
});

test('missing entity, unavailable project and Lock during resolution leave the previous project untouched',async()=>{
 for(const condition of ['entity','project','lock']){
  const f=await fixture();if(condition==='project')f.args.location.projectId='missing-project';
  if(condition==='entity')f.args.resolveEntity=async()=>({ok:false,code:'ENTITY_UNAVAILABLE'});
  if(condition==='lock')f.args.resolveEntity=async()=>{f.args.scope.isCurrent=()=>false;return {ok:true,location:f.args.location};};
  const result=await continueSavedLocation(f.args);assert.equal(result.ok,false,condition);assert.deepEqual(f.counts(),{opened:0,selected:0});assert.deepEqual(await f.projects.readProject(f.original.project.id),f.original);
 }
});

test('copied selection metadata cannot promote an old Home request into a new project window',async()=>{
 const f=await fixture(),select=f.args.selectProject;f.args.selectProject=async()=>({...await select()});
 assert.equal((await continueSavedLocation(f.args)).code,'ACCESS_REFUSED');assert.equal(f.counts().opened,0);
});

test('Continue for a saved native Diagram resolves and opens the exact entity in the selected project',async()=>{
 const f=await fixture();f.args.location={schema:1,projectId:f.original.project.id,surface:'diagrams',entityId:'saved-flow'};f.args.resolveEntity=async({location})=>({ok:true,location});let request;
 f.args.navigateDiagrams=()=>assert.fail('A saved native Diagram must reopen its window');f.args.openView=async value=>{request=value;return {ok:true,view:{epoch:1}};};
 assert.deepEqual(await continueSavedLocation(f.args),{ok:true,epoch:1});assert.deepEqual(request,{role:'diagram',entityId:'saved-flow'});
});

test('Continue for a saved presentation resolves the exact deck and opens a Presenter, never Audience or raw source',async()=>{
 const f=await fixture();f.args.location={schema:1,projectId:f.original.project.id,surface:'present',entityId:'saved-deck'};f.args.resolveEntity=async({location})=>({ok:true,location});let request;
 f.args.navigateDiagrams=()=>assert.fail('Presentation must reopen its Presenter');f.args.openView=async value=>{request=value;return {ok:true,view:{epoch:1}};};
 assert.deepEqual(await continueSavedLocation(f.args),{ok:true,epoch:1});assert.deepEqual(request,{role:'presenter',entityId:'saved-deck'});
});
test('Continue validates missing/cross-project native Diagram before changing the selected project',async()=>{
 const f=await fixture();f.args.location.surface='diagrams';f.args.location.entityId='saved-flow';let request;f.args.openView=async value=>{request=value;return {ok:true,view:{epoch:2}};};f.args.navigateDiagrams=()=>assert.fail('A native Diagram must reopen its window');
 assert.equal(await continueSavedLocation(f.args),f.selectionReceipt);assert.deepEqual(request,{role:'diagram',entityId:'saved-flow'});
 const denied=await fixture();denied.args.location.surface='diagrams';denied.args.location.entityId='missing-flow';denied.args.resolveEntity=async()=>({ok:false,code:'ENTITY_UNAVAILABLE'});assert.equal((await continueSavedLocation(denied.args)).code,'ENTITY_UNAVAILABLE');assert.deepEqual(denied.counts(),{opened:0,selected:0});
});
