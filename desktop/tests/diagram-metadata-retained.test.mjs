import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,webcrypto} from 'node:crypto';
import {mkdtemp} from './fixtures/temporary.mjs';
import {createDiagramMetadataContract} from '../src/documents/diagram-metadata.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {domainHelper} from '../build/import-validation.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),contract=createDiagramMetadataContract(),point={sourceId:'retained-source',version:1,sha256:'b'.repeat(64)};
const unsupported=[{sourceRef:point,opaque:'keep'},[point],7,null,'x'.repeat(601)];

test('retained unsupported managed objects/scalars cannot be overwritten, cleared or reset; valid sibling fields stay editable',()=>{
 for(const value of unsupported){const before={A:{evidence:value,owner:'Owner'}};assert.equal(contract.validate({A:{evidence:'replacement',owner:'Owner'}},before),false);assert.equal(contract.validate({A:{owner:'Owner'}},before),false);assert.equal(contract.validate(undefined,{A:{evidence:value}}),false);assert.throws(()=>contract.update(before,{id:'A',changes:{evidence:'replacement'}}));assert.throws(()=>contract.update(before,{id:'A',changes:{evidence:''}}));assert.equal(contract.validate(contract.update(before,{id:'A',changes:{owner:'Readable owner'}}),before),true);}
 const future={A:{status:'future-status',owner:7}};assert.throws(()=>contract.update(future,{id:'A',changes:{status:'approved'}}));assert.throws(()=>contract.update(future,{id:'A',changes:{owner:'Readable owner'}}));
 assert.equal(typeof contract.canEditField,'function');assert.equal(contract.canEditField('owner',undefined),true);assert.equal(contract.canEditField('owner','Valid'),true);assert.equal(contract.canEditField('owner',7),false);assert.equal(contract.canEditField('status','future-status'),false);assert.equal(contract.canEditField('evidence',{sourceRef:point}),false);
});

test('production hidden helper refuses managed-field pointer replacement/removal without relaxing arbitrary invalid renderer input',()=>{
 const names=['sanitizeNodeStyles','sanitizeStyleClasses','sanitizeNodeClasses','sanitizeEdgeStyles','sanitizeEdgeRoutes','sanitizeNodeMetadata','sanitizeComments','sanitizeLayout','sanitizeView','sanitizeNodeLinks','sanitizeNodeIcons','sanitizeFormatRules','sanitizeNumbering','sanitizeLegend','sanitizeGitBranchColours','sanitizePresentation','normalizeFontFamily','normalizeFontWeight'];
 const ctx={window:{}};for(const n of names)ctx[n]=v=>v;runInNewContext(domainHelper,ctx);
 for(const value of unsupported){const before={nodeMetadata:{A:{evidence:value}}};for(const nodeMetadata of [{A:{evidence:'replacement'}},{}]){ctx.raw=JSON.stringify({domain:'diagram',action:'update-style',before,payload:{nodeMetadata}});assert.equal(runInNewContext('window.sirenDesktopValidateDomainPatch(JSON.parse(raw))',ctx),false);}}
});

test('actual native owner refuses managed pointer/scalar loss and whole metadata reset even with permissive external validator',async()=>{
 const root=await mkdtemp(join(tmpdir(),'siren-managed-retention-')),projects=new ProjectStore(root),sources=new SourceRepository(root),initial=await projects.createProject({label:'Metadata retention',json:'{}'}),ref=await sources.importSource({projectId:initial.project.id,bytes:Buffer.from('print("retained")\r\n')}),sourceRef={sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256};
 const metadata={diagrams:[{id:'flow',source:'flowchart TD\nA-->B',nodeMetadata:{A:{evidence:{sourceRef,opaque:'keep'},owner:7,status:'future-status'}}}],workpapers:[]};assert.equal((await commitManifest({projects,repository:sources,projectId:initial.project.id,baseRevision:1,sourceRefs:[ref],metadata,operationId:'retention-fixture'})).ok,true);const saved=await projects.readProject(initial.project.id),scope={projectId:initial.project.id,isCurrent:()=>true};
 const owner=new DomainRepository({projects:()=>projects,sources:()=>sources,validatePatch:async()=>true});
 for(const[operationId,payload]of [['pointer-loss',{source:'flowchart TD\nA-->B',nodeMetadata:{A:{owner:7,status:'future-status',evidence:'New text'}}}],['scalar-correction',{source:'flowchart TD\nA-->B',nodeMetadata:{A:{...metadata.diagrams[0].nodeMetadata.A,owner:'Readable'}}}],['unsafe-reset',{source:'flowchart TD\nA-->B',resetStyleFields:['nodeMetadata']}]]){const r=await owner.apply('diagram',{diagramId:'flow',expectedVersion:1,operationId,action:'replace-content',payload},scope);assert.equal(r.code,'DOMAIN_VALIDATION_FAILED');assert.deepEqual(await projects.readProject(initial.project.id),saved);}
 assert.deepEqual(await sources.exportSource({projectId:initial.project.id,...ref}),Buffer.from('print("retained")\r\n'));
});

test('draft refuses unsupported-field correction before it can create an unsavable historical state',async()=>{
 const diagram={id:'flow',source:'flowchart TD\nA-->B',nodeMetadata:{A:{owner:7,evidence:{sourceRef:point}}}},window={SirenDiagramMetadata:contract};runInNewContext(await readFile(new URL('../src/ui/diagram/draft.js',import.meta.url),'utf8'),{window,structuredClone,TextEncoder,crypto:webcrypto});
 const d=window.SirenNativeDiagramDraft.create({context:{ok:true,readonly:false,diagram,version:1,sha256:hash(diagram)},bridge:{}});
 assert.equal(d.editMetadata({id:'A',changes:{owner:'Readable owner'}}).ok,false);assert.equal(d.editMetadata({id:'A',changes:{evidence:'New text'}}).ok,false);assert.deepEqual(d.getDiagram(),diagram);assert.equal(d.getStatus().dirty,false);assert.equal(d.getHistory().entries.length,1);
});
