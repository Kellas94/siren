import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {exportSourceSnapshot} from '../src/sources/recovery.mjs';

const moduleURL=new URL('../src/projects/import-admission.mjs',import.meta.url);
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'siren-bundle-door-')),projects=new ProjectStore(root),repository=new SourceRepository(root),initial=await projects.createProject({label:'Actual emitted backup',json:'{}'});
 const bytes=Buffer.from('\ufeff# PRIVATE_PYTHON_SENTINEL\r\nprint("Ș😀")\n'),ref=await repository.importSource({projectId:initial.project.id,bytes,provenance:{agentId:'actual-agent',opaque:{owner:'as written'}}}),pointer={sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256};
 const metadata={kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':JSON.stringify({diagrams:[],workpapers:[],codeFiles:[{id:'file-a',name:'example.py',language:'python',sourceRef:pointer}]})},opaque:{author:'file assertion'}};
 const receipt=await commitManifest({projects,repository,projectId:initial.project.id,baseRevision:1,sourceRefs:[ref],metadata,operationId:randomUUID()});assert.equal(receipt.ok,true);
 const snapshot=await projects.readProject(initial.project.id),bundle=await exportSourceSnapshot({snapshot,repository});
 return {root,projects,repository,bytes,metadata,snapshot,bundle};
}
const load=()=>import(moduleURL);

test('actual source export uses metadata-only admission and retains exact native source bytes',async()=>{
 const f=await fixture(),{admitImportedProject}=await load(),before=Buffer.from(f.bundle),known=await f.projects.listProjects();let seen,disposed=false;
 const result=await admitImportedProject({bytes:f.bundle,fileName:'chosen.siren-backup'},{isCurrent:()=>true,createValidator:async()=>({validate:()=>assert.fail('No legacy sanitizer for bundle'),validateBundleMetadata:async(text,name)=>{seen={text,name};assert.equal(text.includes('PRIVATE_PYTHON_SENTINEL'),false);assert.equal(text.includes(f.bytes.toString('base64')),false);return text;},dispose:async()=>{disposed=true;}})});
 assert.equal(result.kind,'sources');assert.equal(seen.text,f.snapshot.json);assert.equal(disposed,true);assert.deepEqual(result.metadata,f.metadata);assert.deepEqual(result.bundle.sources[0].bytes,f.bytes);assert.deepEqual(f.bundle,before);assert.deepEqual(await f.projects.listProjects(),known);
});

test('a declared corrupt bundle refuses before isolated resources and cannot fall through to legacy',async()=>{
 const f=await fixture(),{admitImportedProject}=await load(),value=JSON.parse(f.bundle);value.sources[0].base64='a===';let created=0;
 await assert.rejects(admitImportedProject({bytes:Buffer.from(JSON.stringify(value)),fileName:'chosen.siren-backup'},{isCurrent:()=>true,createValidator:async()=>{created++;assert.fail();}}));assert.equal(created,0);
});

test('metadata admission cannot substitute a source pointer or become current again after revocation',async()=>{
 const f=await fixture(),{admitImportedProject}=await load();let current=true,disposed=false;
 await assert.rejects(admitImportedProject({bytes:f.bundle,fileName:'chosen.siren-backup'},{isCurrent:()=>current,createValidator:async()=>({validateBundleMetadata:async text=>{current=false;return text;},dispose:async()=>{disposed=true;}})}),{code:'ACCESS_REFUSED'});assert.equal(disposed,true);
 current=true;await assert.rejects(admitImportedProject({bytes:f.bundle,fileName:'chosen.siren-backup'},{isCurrent:()=>current,createValidator:async()=>({validateBundleMetadata:async text=>{const metadata=JSON.parse(text),state=JSON.parse(metadata.storage['t-industries-siren-v23-state']);state.codeFiles[0].sourceRef.version=999;metadata.storage['t-industries-siren-v23-state']=JSON.stringify(state);return JSON.stringify(metadata);},dispose:async()=>{}})}));
});

test('the existing legacy project path still uses its frozen validation method',async()=>{
 const {admitImportedProject}=await load();let legacyCalls=0;
 const input={type:'siren-project',version:'1.131.0',state:{diagrams:[{id:'diagram-a',source:'flowchart TD\n A-->B'}],workpapers:[]}};
 const result=await admitImportedProject({bytes:Buffer.from(JSON.stringify(input)),fileName:'old.siren'},{isCurrent:()=>true,createValidator:async()=>({validate:async text=>{legacyCalls++;return text;},validateBundleMetadata:()=>assert.fail('Legacy format stays legacy'),dispose:async()=>{}})});
 assert.equal(result.kind,'legacy');assert.equal(legacyCalls,1);const bag=JSON.parse(result.json);assert.equal(JSON.parse(bag.storage['t-industries-siren-v23-state']).diagrams[0].source,input.state.diagrams[0].source);
});
