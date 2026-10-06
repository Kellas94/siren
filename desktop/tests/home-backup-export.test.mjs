import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {HomeAuthority} from '../src/navigation/authority.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {createHomeProjectCopy} from '../src/navigation/project-copies.mjs';
import {parseSourceBundle,verifyParsedSourceBundle} from '../src/sources/bundle-import.mjs';
import {digest} from '../src/projects/atomic.mjs';
const implementation=await import('../src/navigation/backup-export.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const create=options=>{assert.equal(typeof implementation.createHomeBackupExporter,'function','Home requires a real saved-backup route');return implementation.createHomeBackupExporter(options);};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

async function fixture(t,{sources=false}={}){
 const root=await mkdtemp(join(tmpdir(),'siren-home-backup-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const projects=new ProjectStore(root),repository=new SourceRepository(root),recovery=new RecoveryStore(root,{sources:repository});
 const text='\uFEFFdef context():\r\n    return "Ș😀"\r\n';
 const original=await projects.createProject({label:'Exact',json:sources?JSON.stringify({codeFiles:[{id:'code-a',name:'context.py',content:text}],opaque:{owner:'agent-a',history:[{revision:7}]}}):'{"exact":"Ș😀","spacing":  true}'});
 const saved=sources?(await createHomeProjectCopy({root,legacySnapshot:original,recovery,isCurrent:()=>true})).snapshot:original;
 let state={projectId:saved.project.id,mode:'normal',generation:1,unlocked:true},ready=true,published=[];
 const frame={url:'siren://app/home.html'},sender={mainFrame:frame,getURL:()=>sender.mainFrame.url,isDestroyed:()=>false},workspace={webContents:sender,isDestroyed:()=>false};
 const authority=new HomeAuthority({workspace,state:()=>state});
 const options={authority,projects,recovery,ready:()=>ready,publish:async(bytes,name,isCurrent)=>{assert.equal(isCurrent(),true);published.push({bytes,name});return {ok:true};}};
 return {root,projects,repository,recovery,saved,text,options,authority,sender,event:{sender,senderFrame:frame},published,setState:change=>Object.assign(state,change),setReady:value=>{ready=value;},create:()=>create(options)};
}

test('Home exports internally selected saved classic bytes and returns only finite verified facts',async t=>{
 const f=await fixture(t),call=f.create(),result=await call(f.event,{});
 assert.equal(result.ok,true);assert.deepEqual(f.published[0].bytes,Buffer.from(f.saved.json));
 assert.deepEqual(result,{ok:true,revision:1,schema:1,bytes:Buffer.byteLength(f.saved.json),sha256:digest(Buffer.from(f.saved.json))});
 assert.equal(f.published[0].name,`SIREN-${f.saved.project.id}.siren-backup`);assert.deepEqual(await f.projects.readProject(f.saved.project.id),f.saved);
});

test('source-backed saved backup round-trips exact BOM CRLF Unicode and opaque history; private drafts stay outside it',async t=>{
 const f=await fixture(t,{sources:true});const privateDir=join(f.root,'PrivateDraft');await mkdir(privateDir);await writeFile(join(privateDir,'draft'),'UNSAVED SECRET');
 const result=await f.create()(f.event,{});assert.equal(result.ok,true);assert.equal(result.schema,2);
 const parsed=parseSourceBundle(f.published[0].bytes);verifyParsedSourceBundle(parsed);
 const bundle=JSON.parse(f.published[0].bytes);assert.deepEqual(bundle.snapshot,f.saved);assert.equal(bundle.sources.length,1);assert.deepEqual(Buffer.from(bundle.sources[0].base64,'base64'),Buffer.from(f.text));
 assert.equal(f.published[0].bytes.includes(Buffer.from('UNSAVED SECRET')),false);assert.equal(await readFile(join(privateDir,'draft'),'utf8'),'UNSAVED SECRET');
});

test('extra fields, accessor payloads, forged frames/URLs, locked or missing selection never read or publish',async t=>{
 for(const kind of ['extra','accessor','frame','url','locked','missing','transition']){
  const f=await fixture(t);let reads=0;f.options.projects={readProject:async()=>{reads++;return f.saved;}};const call=f.create();let event=f.event,payload={};
  if(kind==='extra')payload={projectId:f.saved.project.id};if(kind==='accessor')Object.defineProperty(payload,'path',{get:()=>assert.fail('getter must not execute'),enumerable:true});
  if(kind==='frame')event={sender:f.sender,senderFrame:{url:'siren://app/home.html'}};if(kind==='url')f.sender.mainFrame.url='siren://app/app.html';
  if(kind==='locked')f.setState({unlocked:false});if(kind==='missing')f.setState({projectId:null});if(kind==='transition')f.setReady(false);
  assert.equal((await call(event,payload)).ok,false,kind);assert.equal(reads,0,kind);assert.equal(f.published.length,0,kind);
 }
});

test('readonly saved export remains available, cancellation is not success, and a completed operation releases its pending slot',async t=>{
 const f=await fixture(t);f.setState({mode:'readonly'});let count=0;f.options.publish=async()=>++count===1?{ok:false,code:'CANCELLED'}:{ok:true};const call=f.create();
 assert.deepEqual(await call(f.event,{}),{ok:false,code:'CANCELLED'});assert.equal((await call(f.event,{})).ok,true);
});

test('one pending Home export; Lock then unlock during saved read permanently revokes it',async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();f.options.projects={readProject:async()=>{entered.resolve();await release.promise;return f.saved;}};const call=f.create(),pending=call(f.event,{});await entered.promise;
 assert.deepEqual(await call(f.event,{}),{ok:false,code:'EXPORT_BUSY'});f.authority.invalidate();f.setState({unlocked:false});f.setState({unlocked:true});release.resolve();
 assert.deepEqual(await pending,{ok:false,code:'ACCESS_REFUSED'});assert.equal(f.published.length,0);
});

test('base64 wire expansion over importer limit refuses before loading any source bytes',async t=>{
 const f=await fixture(t,{sources:true}),ref=f.saved.sourceRefs[0];const huge=structuredClone(f.saved);huge.sourceRefs=Array.from({length:3},(_,i)=>({...ref,sourceId:'budget-source-'+i,utf8Bytes:24*1024*1024,utf16Units:24*1024*1024,lines:1,longestLineUnits:24*1024*1024}));
 // Budget must precede source serialization even if an on-disk record is corrupt.
 f.options.projects={readProject:async()=>huge};f.options.recovery={exportSourceSnapshot:async()=>assert.fail('over-budget sources must never load')};
 assert.deepEqual(await f.create()(f.event,{}),{ok:false,code:'BACKUP_BUDGET'});assert.equal(f.published.length,0);
});

test('source corruption cannot fall back to metadata-only output or open a chooser',async t=>{
 const f=await fixture(t,{sources:true}),ref=f.saved.sourceRefs[0],dir=await f.repository.sourceDirectory(f.saved.project.id,ref.sourceId);
 await writeFile(join(dir,'blobs',ref.sha256+'.bin'),'corrupted fixture source');
 assert.deepEqual(await f.create()(f.event,{}),{ok:false,code:'BACKUP_UNAVAILABLE'});assert.equal(f.published.length,0);
});
