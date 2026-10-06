import assert from 'node:assert/strict';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
import {exportSourceSnapshot} from '../../src/sources/recovery.mjs';
export async function actualSourceBundle(root){
 const projects=new ProjectStore(root),sources=new SourceRepository(root),initial=await projects.createProject({label:'Bundle original',json:'{}'});
 const bytes=Buffer.from('\ufeff# ORIGINAL_SOURCE\r\nprint("Ș😀")\n'),ref=await sources.importSource({projectId:initial.project.id,bytes,provenance:{agentId:'original-agent'}});
 const metadata={kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':JSON.stringify({diagrams:[],workpapers:[],codeFiles:[{id:'file-a',name:'example.py',language:'python',sourceRef:{sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256}}]})}};
 assert.equal((await commitManifest({projects,repository:sources,projectId:initial.project.id,baseRevision:1,sourceRefs:[ref],metadata,operationId:'fixture-bundle'})).ok,true);
 const snapshot=await projects.readProject(initial.project.id);return {bytes,snapshot,bundle:await exportSourceSnapshot({snapshot,repository:sources}),sources};
}
