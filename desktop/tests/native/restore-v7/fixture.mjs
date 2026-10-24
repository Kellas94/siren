import {mkdir,readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {join,dirname,resolve,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {ProjectStore} from './app/src/projects/store.mjs';
import {SourceRepository} from './app/src/sources/repository.mjs';
import {RecoveryStore} from './app/src/recovery/checkpoints.mjs';
import {RecoveryAccess} from './app/src/recovery/access.mjs';
import {commitManifest} from './app/src/sources/manifest.mjs';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
export async function save(p,value){await writeFile(p,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
export function child(root,relative){
  assert.equal(typeof relative,'string');assert(!relative.includes(':')&&!relative.includes('\\'));
  assert(relative.split('/').every(p=>p&&p!=='.'&&p!=='..'));
  const out=resolve(root,...relative.split('/'));assert(out.startsWith(resolve(root)+sep));return out;
}
export async function noLinks(p){for(let q=resolve(p);;q=dirname(q)){assert(!(await lstat(q)).isSymbolicLink(),'LINK_REFUSED');if(dirname(q)===q)break;}}
export async function inventory(root){
  await noLinks(root);const files=[],directories=[];
  async function walk(dir,prefix=''){
    for(const name of (await readdir(dir)).sort()){
      const path=join(dir,name),rel=prefix+name,s=await lstat(path);assert(!s.isSymbolicLink(),'LINK_REFUSED');
      assert(files.length+directories.length<5000,'TREE_BUDGET');
      if(s.isDirectory()){directories.push(rel);await walk(path,rel+'/');}
      else {assert(s.isFile()&&s.size<=64*1024**2);const bytes=await readFile(path);assert.equal(bytes.length,s.size);files.push({relativePath:rel,bytes:bytes.length,sha256:sha(bytes)});}
    }
  }
  await walk(root);return {files,directories};
}
export async function copyCapture(route,data){
  await mkdir(data);await noLinks(data);
  const dirs=[...route.directories].sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b));
  assert.equal(new Set(dirs.map(d=>d.toLowerCase())).size,dirs.length);
  for(const relative of dirs)await mkdir(child(data,relative));
  for(const row of route.files){
    assert(/^(Projects\/|Recovery\/|session-selection\.json$)/.test(row.relativePath));await noLinks(row.path);
    const bytes=await readFile(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
    await writeFile(child(data,row.relativePath),bytes,{flag:'wx'});
  }
  const actual=await inventory(data);
  assert.deepEqual(actual.files,[...route.files].map(({relativePath,bytes,sha256})=>({relativePath,bytes,sha256})).sort((a,b)=>a.relativePath.localeCompare(b.relativePath,'en')));
  return {reconstructedDeclaredDirectories:dirs,originalPhysicalDirectoryEvidence:false};
}
export async function prepareFixture(route,data,out){
  const reconstruction=await copyCapture(route,data);
  const projects=new ProjectStore(data),repository=new SourceRepository(data),recovery=new RecoveryStore(data,{sources:repository});
  const original=await projects.readProject(route.projectId);assert.equal(original.revision,2);assert.deepEqual(original.sourceRefs,[route.v1]);
  const old=await recovery.scan(route.projectId);assert.equal(old.damaged,false);assert.equal(old.invalid.length,0);assert.equal(old.valid.length,1);
  assert.equal(old.valid[0].id,route.oldPointId);assert.equal(old.valid[0].kind,'saved');assert.equal(old.valid[0].snapshot.revision,2);
  const before=await inventory(data);await save(join(out,'copied-baseline.json'),before);
  const one=await repository.readVerifiedVersion({projectId:route.projectId,sourceId:route.sourceId,version:1});
  const seven=await repository.readVerifiedVersion({projectId:route.projectId,sourceId:route.sourceId,version:7});
  assert.deepEqual(one.ref,route.v1);assert.deepEqual(seven.ref,route.v7);assert.equal(sha(one.bytes),route.v1.sha256);assert.equal(sha(seven.bytes),route.v7.sha256);
  const metadata=JSON.parse(original.json);assert(!Object.hasOwn(metadata,'recoveryProbe'));
  assert(!Object.hasOwn(metadata,'diagrams')&&!Object.hasOwn(metadata,'source'),'DECLARED_MINIMAL_LEGACY_FIXTURE_ONLY');
  metadata.diagrams=[]; // Explicit synthetic R3 compatibility; original R1/R2 and source history remain untouched.
  metadata.recoveryProbe={label:'EXPLICIT_SYNTHETIC_V7_CHECKPOINT',sourceRef:{sourceId:route.sourceId,version:7,sha256:route.v7.sha256}};
  const operationId=randomUUID();
  const receipt=await commitManifest({projects,repository,recovery,projectId:route.projectId,baseRevision:2,sourceRefs:[one.ref,seven.ref],metadata,operationId});
  assert.equal(receipt.ok,true);assert.notEqual(receipt.durability,'recovery-degraded');
  const snapshot=await projects.readProject(route.projectId);assert.equal(snapshot.revision,3);assert.equal(snapshot.sourceRefs.length,2);assert.deepEqual(JSON.parse(snapshot.json),metadata);
  const points=await recovery.scan(route.projectId);assert.equal(points.damaged,false);assert.equal(points.invalid.length,0);assert.equal(points.valid.length,2);
  assert(points.valid.every(p=>p.kind==='saved'));assert(points.valid.length<10);assert(points.valid.some(p=>p.id===route.oldPointId));
  const matches=points.valid.filter(p=>p.snapshot.operationId===operationId);assert.equal(matches.length,1);const point=matches[0];
  const prepared=await inventory(data);
  const beforeMap=new Map(before.files.map(f=>[f.relativePath,f]));
  const added=prepared.files.filter(f=>!beforeMap.has(f.relativePath));
  const changed=prepared.files.filter(f=>beforeMap.has(f.relativePath)&&beforeMap.get(f.relativePath).sha256!==f.sha256);
  assert.equal(added.length,2);assert(added.some(f=>f.relativePath===`Recovery/${route.projectId}/${point.id}.json`));
  assert(added.some(f=>new RegExp(`^Projects/${route.projectId}/revisions/3-[a-f0-9-]{36}\\.json$`).test(f.relativePath)));
  assert.deepEqual(changed.map(f=>f.relativePath).sort(),[`Projects/${route.projectId}/current.json`,'Recovery/catalog.json'].sort());
  assert.equal(prepared.files.length,before.files.length+2);
  const oldStable=before.files.filter(f=>f.relativePath.startsWith(`Projects/${route.projectId}/`)&&!f.relativePath.endsWith('/current.json')||f.relativePath===`Recovery/${route.projectId}/${route.oldPointId}.json`);
  for(const f of oldStable)assert.deepEqual(prepared.files.find(p=>p.relativePath===f.relativePath),f);
  await save(join(out,'fixture.json'),{route,original,snapshot,point,operationId,receipt,reconstruction,scope:'Synthetic store setup; not ordinary SourceSave/native checkpoint evidence'});
  await save(join(out,'prepared-inventory.json'),prepared);
  return {projects,repository,recovery,access:new RecoveryAccess({projects,recovery,grants:new Set([route.projectId])}),snapshot,point,one,seven,metadata,prepared};
}
export async function verifyRestored(ctx,route,restored){
  assert.notEqual(restored.project.id,route.projectId);assert.equal(restored.schema,2);assert.equal(restored.revision,2);assert.equal(restored.sourceRefs.length,2);
  const one=restored.sourceRefs.find(r=>r.sha256===route.v1.sha256),seven=restored.sourceRefs.find(r=>r.sha256===route.v7.sha256);
  assert(one&&seven);assert.notEqual(one.sourceId,seven.sourceId);
  for(const ref of [one,seven]){assert.notEqual(ref.sourceId,route.sourceId);assert.equal(ref.version,1);}
  const bytes1=await ctx.repository.exportSource({projectId:restored.project.id,sourceId:one.sourceId,version:1});
  const bytes7=await ctx.repository.exportSource({projectId:restored.project.id,sourceId:seven.sourceId,version:1});
  assert.deepEqual(bytes1,ctx.one.bytes);assert.deepEqual(bytes7,ctx.seven.bytes);assert.equal(sha(bytes7),route.v7.sha256);
  const metadata=JSON.parse(restored.json);assert.equal(metadata.recoveryProbe.sourceRef.sourceId,seven.sourceId);assert.equal(metadata.recoveryProbe.sourceRef.version,1);
  const back=structuredClone(metadata);
  function revert(v){if(!v||typeof v!=='object')return;for(const [key,value]of Object.entries(v)){if(key==='sourceRef'){const original=value.sourceId===one.sourceId?route.v1:value.sourceId===seven.sourceId?route.v7:null;assert(original);v[key]={sourceId:route.sourceId,version:original.version,sha256:original.sha256};}else revert(value);}}
  revert(back);assert.deepEqual(back,ctx.metadata);
  return {sourceV1:one,sourceV7:seven,v1Bytes:bytes1.length,v7Bytes:bytes7.length,v7Sha256:sha(bytes7),metadata};
}
