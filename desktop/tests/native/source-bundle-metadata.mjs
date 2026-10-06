import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {buildImportValidation} from '../../build/import-validation.mjs';
import {bundleMetadataHelper} from '../../build/source-bundle-metadata.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
import {RecoveryStore} from '../../src/recovery/checkpoints.mjs';
import {exportSourceSnapshot} from '../../src/sources/recovery.mjs';
import {applyPresentationEdits} from '../../src/documents/presentation-edits.mjs';

const desktop=fileURLToPath(new URL('../../',import.meta.url)),root=resolve(desktop,'evidence/source-bundle-metadata-native',new Date().toISOString().replaceAll(':','-'));
await mkdir(join(root,'owned-data'),{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const names=['baseline/R78.html','build/import-validation.mjs','build/source-bundle-metadata.mjs','src/projects/import-validation.mjs','src/projects/import-validator-window.mjs','src/sources/manifest.mjs','src/sources/repository.mjs','src/sources/recovery.mjs','src/documents/presentation-edits.mjs','tests/native/source-bundle-metadata.mjs','tests/native/source-bundle-metadata-app.mjs'];
const capture=async()=>Object.fromEntries(await Promise.all(names.map(async name=>[name,hash(await readFile(join(desktop,name)))])));
const inputs=await capture(),build=await buildImportValidation({baselinePath:join(desktop,'baseline/R78.html'),outputDir:join(root,'generated')});
// The default requires genuine integration. The explicit development-only mode
// records an owned helper injection and recomputes the exact CSP script hashes;
// it verifies frozen semantics, never claims the root builder is integrated.
const entry=join(root,'generated','import-validation.html');let html=await readFile(entry,'utf8'),ownedHelperInjection=false;
if(!html.includes('Source bundle metadata refused: ')){
 if(!process.argv.includes('--allow-owned-helper-injection'))throw Error('Integrated metadata helper missing from genuine builder');
 ownedHelperInjection=true;html=html.replace('window.sirenImportValidationReady = true;',bundleMetadataHelper+'\nwindow.sirenImportValidationReady = true;');
 const nodes=[];const visit=node=>{nodes.push(node);for(const child of node.childNodes??[])visit(child);};visit(parse(html,{sourceCodeLocationInfo:true}));
 const hashes=nodes.filter(n=>n.tagName==='script').map(n=>"'sha256-"+createHash('sha256').update(n.childNodes.map(c=>c.value??'').join('')).digest('base64')+"'");
 const meta=nodes.find(n=>n.tagName==='meta'&&n.attrs.some(a=>a.name==='http-equiv'&&a.value.toLowerCase()==='content-security-policy'));if(!meta)throw Error('Owned CSP marker missing');
 const policy=meta.attrs.find(a=>a.name==='content').value.replace(/script-src[^;]*;/,'script-src '+[...new Set(hashes)].join(' ')+';'),loc=meta.sourceCodeLocation;
 html=html.slice(0,loc.startOffset)+'<meta http-equiv="Content-Security-Policy" content="'+policy+'" />'+html.slice(loc.endOffset);await writeFile(entry,html);build.entrySha256=hash(Buffer.from(html));
}
const projects=new ProjectStore(join(root,'owned-data')),repository=new SourceRepository(join(root,'owned-data')),recovery=new RecoveryStore(join(root,'owned-data'),{sources:repository});
const initial=await projects.createProject({label:'Actual exported metadata fixture',json:'{}'}),raw=Buffer.from('\ufeff# source 😀\r\nx = 1\n');
const ref=await repository.importSource({projectId:initial.project.id,bytes:raw,provenance:{author:'File author',releaseId:'release-one',unknown:{opaque:true}}});
const ref2=await repository.importSource({projectId:initial.project.id,bytes:Buffer.from('x = 2\r\n'),provenance:{draftId:'draft-one',unknown:'base version'}});
const pointer=ref=>({sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256});
const row={id:'row-one',name:'Exact.py',fileType:'python',role:'code',sourceRef:pointer(ref),opaque:{provenance:'unchanged'}};
const presentation=applyPresentationEdits(undefined,[{action:'add',id:'table-one',kind:'table'},{action:'add',id:'text-one',kind:'text'},{action:'update',id:'text-one',changes:{body:'  first\nsecond  \n'}},{action:'add',id:'title-one',kind:'title'}]);
const workspace={activeDiagramId:'diagram-one',diagrams:[{id:'diagram-one',source:'flowchart TD\nA[Start]-->B[Next]',presentation}],workpapers:[
 {id:'doc-one',title:'Sparse Home document',blocks:[],agent:null,releases:[]},
 {id:'agent-one',title:'Linked agent document',type:'agent-spec',status:'approved',review:{state:'approved',decidedBy:'File reviewer',approvedDigest:'unmatched-claim',trail:[]},signoffFromFile:{opaque:'previous claim'},blocks:[{id:'knowledge-one',kind:'knowledge',rows:[row]},{id:'testruns-one',kind:'testruns',rows:[{verdict:'not-run',by:'Planned tester'}]}],
  links:[{kind:'diagram',diagramId:'diagram-one',nodeId:'',label:'',dangling:false}],
  revisions:[{at:'2026-10-06T00:00:00.000Z',author:'File author',opaque:'revision',blocks:[{id:'old-knowledge',kind:'knowledge',rows:[{...row,id:'old-row'}]}]}],
  releases:[{id:'release-one',seq:1,status:'superseded',approvedBy:'Earlier reviewer',snapshot:{knowledge:[{name:'Exact.py',fileType:'python',role:'code',sourceRef:pointer(ref),opaque:'release provenance'}],opaque:'snapshot provenance'}}]
 }],codeFiles:[{id:'file-one',name:'Exact.py',language:'python',sourceRef:pointer(ref),opaque:{version:'external'}}],codeWorkspace:{drafts:[{id:'draft-one',name:'Exact.py',language:'python',generation:2,ref:{kind:'standalone',fileId:'file-one'},sourceRef:pointer(ref2),baseSourceRef:pointer(ref),opaque:'draft provenance'}]}};
const zeroDiagrams=process.argv.includes('--zero-diagrams'),diagramTemplate=structuredClone(workspace.diagrams[0]),documentTemplates=structuredClone(workspace.workpapers);
if(zeroDiagrams){workspace.diagrams=[];delete workspace.activeDiagramId;workspace.workpapers=[];documentTemplates[1].links[0].dangling=true;}
const metadata={kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':JSON.stringify(workspace),'opaque-storage':'  {"opaque":true}  '},opaque:{unknown:'preserve'}};
const receipt=await commitManifest({projects,repository,recovery,projectId:initial.project.id,baseRevision:1,sourceRefs:[ref,ref2],metadata,operationId:'metadata-export-one'});if(!receipt.ok)throw Error(receipt.code);
const snapshot=await projects.readProject(initial.project.id),bundle=await exportSourceSnapshot({snapshot,repository});await writeFile(join(root,'actual-export.siren-backup'),bundle);
let docsOnlyExportSHA;
if(zeroDiagrams){const docsOnly=structuredClone(metadata),docsWorkspace=structuredClone(workspace);docsWorkspace.workpapers=documentTemplates;docsWorkspace.codeFiles=[];delete docsWorkspace.codeWorkspace;docsOnly.storage['t-industries-siren-v23-state']=JSON.stringify(docsWorkspace);const saved=await commitManifest({projects,repository,recovery,projectId:initial.project.id,baseRevision:snapshot.revision,sourceRefs:[ref,ref2],metadata:docsOnly,operationId:'metadata-docs-only-export'});if(!saved.ok)throw Error(saved.code);const docsBundle=await exportSourceSnapshot({snapshot:await projects.readProject(initial.project.id),repository});await writeFile(join(root,'actual-docs-only.siren-backup'),docsBundle);docsOnlyExportSHA=hash(docsBundle);}
await writeFile(join(root,'prepared.json'),JSON.stringify({inputs,build,ownedHelperInjection,zeroDiagrams,diagramTemplate,documentTemplates,docsOnlyExportSHA,snapshot,exportSHA:hash(bundle),sourceSHA:hash(raw)},null,2));
const child=spawn(join(desktop,'node_modules/electron/dist/electron.exe'),[join(desktop,'tests/native/source-bundle-metadata-app.mjs'),'--siren-bundle-metadata-fixture='+root],{cwd:desktop,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:undefined},stdio:['ignore','pipe','pipe']});
let logs='',timedOut=false;child.stdout.on('data',v=>{logs+=v;});child.stderr.on('data',v=>{logs+=v;});const timer=setTimeout(()=>{timedOut=true;child.kill();},120000);
const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));}).finally(()=>clearTimeout(timer));await writeFile(join(root,'electron.log'),logs);
const after=await capture();let native;try{native=JSON.parse(await readFile(join(root,'native-result.json'),'utf8'));}catch{}
const inputsUnchanged=JSON.stringify(inputs)===JSON.stringify(after),result={root,ownedPid:child.pid,inputs,afterInputs:after,inputsUnchanged,exit,timedOut,nativeStatus:native?.status,status:exit.code===0&&!timedOut&&inputsUnchanged&&native?.status==='COMPLETE'?'COMPLETE':'ADVERSE'};
await writeFile(join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,status:result.status,exit,error:native?.error?.message}));process.exitCode=result.status==='COMPLETE'?0:1;
