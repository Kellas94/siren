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
