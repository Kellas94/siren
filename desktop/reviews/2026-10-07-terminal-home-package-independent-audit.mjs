import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {resolve,join,relative,sep,posix} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {listPackage,statFile,extractFile} from '@electron/asar';
const root=resolve('.'),repo=resolve('..'),commit='7cb9d2c5ab121d3a4a31feaa2390f03720cd14dd';
const preview=resolve('dist/development-232d578c-6769-43fe-a817-c975949d8dc8');
const identityPath='evidence/workspace-surface/terminal-home-package-identity-2026-10-07T16-25-55.415Z/result.json';
const aggregatePath='evidence/workspace-surface/terminal-home-copied-2026-10-07T16-26-07.811Z/result.json';
const prefix='evidence/workspace-surface/home-backup-neutral-cancel/';
const transformationPath=prefix+'home-backup-export-copied-one-off-transformation.json';
const J=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const file=p=>{const b=readFileSync(p);return {bytes:b.length,sha256:hash(b)};};
const normalized=b=>Buffer.from(b.toString('utf8').replaceAll('\r\n','\n'));
const receipt=J(join(preview,'BUILD-IDENTITY.json')),identity=J(identityPath),agg=J(aggregatePath),trans=J(transformationPath);
const app=p=>join(p,'App/versions/0.1.0');
const binaries=p=>[join(app(p),'resources/app.asar'),join(app(p),'SIREN.exe'),join(app(p),'resources/siren-process-identity.exe')];
const metadata=p=>[join(p,'BUILD-IDENTITY.json'),join(app(p),'resources/siren-process-identity.json'),join(app(p),'SIREN-RUNTIME-INVENTORY.json')];
const archive=binaries(preview)[0];
const names=listPackage(archive).map(p=>p.replaceAll('\\','/').replace(/^\//,'')).filter(p=>!statFile(archive,p.replaceAll('/',sep)).files).sort();
const protectedFiles=readdirSync('reviews').filter(p=>/2026-10-07-terminal-(?:cwd|profiles)/.test(p)).map(p=>'reviews/'+p);
const copies=agg.results.map(r=>r.postExitCopy.copy);
const paths=new Set([...Object.keys(agg.before).map(p=>resolve(p)),...names.map(p=>resolve(p)),identityPath,aggregatePath,transformationPath,prefix+'home-backup-export-copied-one-off.diff',trans.base.copy,trans.probe.path,
'evidence/workspace-surface/run-terminal-home-copied-owner.mjs','evidence/workspace-surface/verify-terminal-home-package-owner.mjs','evidence/workspace-surface/terminal-home-package-build.json',
'native/process-identity.cs','native/generated/process-identity.exe','native/generated/process-identity.json','C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe','node_modules/electron/dist/electron.exe',...protectedFiles,
...[preview,...copies].flatMap(p=>[...binaries(p),...metadata(p)]),...agg.results.map(r=>join(r.evidence,'result.json'))].map(p=>resolve(p)));
const capture=()=>Object.fromEntries([...paths].sort().map(p=>[p,file(p)]));
const result={author:'/root/terminal_foundation_review',startedAt:new Date().toISOString(),scope:'Independent read-only package bytes and retained receipt review. No GUI/build/test suite/native execution.',commit,preview,status:'ADVERSE',before:capture(),checks:[]};
const check=(name,details)=>result.checks.push({name,ok:true,...details});
try {
assert.equal(receipt.sourceCommit,commit);assert.equal(identity.commit,commit);assert.equal(agg.sourceCommit,commit);
for(const f of ['releaseAdmitted','inventoryQualified','launcherQualified','accountConfigured','updatesConfigured'])assert.equal(receipt[f],false);
assert.equal(receipt.kind,'development-preview');assert.deepEqual(identity.receipt,receipt);assert.deepEqual(J('evidence/workspace-surface/terminal-home-package-build.json').receipt,receipt);
assert.equal(identity.status,'COMPLETE');assert.equal(agg.status,'COMPLETE');assert.deepEqual(agg.changedInputs,[]);assert.deepEqual(agg.before,agg.after);
for(const [p,h] of Object.entries(agg.before))assert.equal(file(p).sha256,h,'Aggregate actual input '+p);
check('668 retained aggregate inputs unchanged and current',{count:Object.keys(agg.before).length});
const git='C:/Users/Taras/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe';
const gitArgs=['-c','safe.directory='+repo];
const tree=execFileSync(git,[...gitArgs,'ls-tree','--full-tree','-r','-z',commit],{cwd:repo,maxBuffer:32*1024*1024}).toString('utf8').split('\0').filter(Boolean);
const tracked=new Set(tree.map(x=>x.slice(x.indexOf('\t')+1)));
const trackedPaths=[...new Set([...Object.keys(agg.before),...names.filter(p=>p.startsWith('src/')||p==='package.json'),'native/process-identity.cs'])].filter(p=>tracked.has(posix.normalize('desktop/'+p)));
const specs=trackedPaths.map(p=>commit+':'+posix.normalize('desktop/'+p));
const batch=execFileSync(git,[...gitArgs,'cat-file','--batch'],{cwd:repo,input:specs.join('\n')+'\n',maxBuffer:256*1024*1024});
let at=0;const blobs=new Map();for(const p of trackedPaths){const end=batch.indexOf(10,at),header=batch.subarray(at,end).toString();assert.match(header,/^[a-f0-9]{40} blob \d+$/);const size=Number(header.split(' ')[2]);at=end+1;blobs.set(p,batch.subarray(at,at+size));at+=size+1;}
const gitResults=trackedPaths.map(p=>{const actual=readFileSync(p),frozen=blobs.get(p);const exact=actual.equals(frozen);assert.ok(exact||normalized(actual).equals(normalized(frozen)),'Frozen Git '+p);return {path:p,comparison:exact?'byte-exact':'CRLF/LF-only',currentSha256:hash(actual),gitSha256:hash(frozen)};});
result.gitInputs=gitResults;check('Frozen tracked input binding',{count:gitResults.length,raw:gitResults.filter(x=>x.comparison==='byte-exact').length,normalized:gitResults.filter(x=>x.comparison!=='byte-exact').length});
const script=blobs.get('scripts/package.mjs').toString('utf8');
const pure=script.slice(script.indexOf('const sourceFiles ='),script.indexOf('async function walk')).replace('export function allowedAppFile','function allowedAppFile');
const policy=runInNewContext(pure+';({sourceFiles,allowedAppFile})',{Set});
const lock=JSON.parse(blobs.get('package-lock.json').toString()),production=new Set(Object.entries(lock.packages).filter(([p,e])=>p&&!e.dev).map(([p])=>p.replace(/^node_modules\//,'')));
const inventory=J(join(app(preview),'SIREN-RUNTIME-INVENTORY.json'));
assert.deepEqual([...production].sort(),inventory.npm.map(p=>p.name).sort());
function walk(p,prefix=''){const out=[];for(const n of readdirSync(p)){const full=join(p,n),s=lstatSync(full);assert.equal(s.isSymbolicLink(),false);if(s.isDirectory())out.push(...walk(full,prefix+n+'/'));else {assert.equal(s.isFile(),true);out.push(prefix+n);}}return out;}
const generated=['app.html','home.html','build.json','import-validation.html','presentation-render.html','diagram-vector.html','code-analysis-worker.cjs',...['code','docs','diagram','presenter','audience'].map(n=>'windows/'+n+'.html'),...['shell.js','shell.css','home-workspace.js','diagram-catalogue.css'].map(n=>'assets/'+n)].map(p=>'generated/'+p);
const wanted=[...policy.sourceFiles,...generated,'package.json',...[...production].flatMap(p=>walk('node_modules/'+p).map(n=>'node_modules/'+p+'/'+n)).filter(p=>policy.allowedAppFile(p,production))].sort();
assert.deepEqual(names,wanted);assert.equal(names.length,305);
assert.equal(names.some(p=>p.startsWith('src/terminal/')),false);
for(const p of ['src/terminal/cwd.mjs','src/terminal/profiles.mjs']){assert.ok(tracked.has('desktop/'+p));assert.equal(policy.allowedAppFile(p,production),false);}
result.members=[];
for(const path of names){const s=statFile(archive,path.replaceAll('/',sep));assert.equal(s.unpacked,undefined);assert.equal(s.link,undefined);const b=extractFile(archive,path.replaceAll('/',sep));assert.deepEqual(b,readFileSync(path),'ASAR exact '+path);const m={path,bytes:b.length,sha256:hash(b)};assert.deepEqual(m,identity.members.find(x=>x.path===path));if(blobs.has(path))assert.ok(b.equals(blobs.get(path))||normalized(b).equals(normalized(blobs.get(path))));result.members.push(m);}
assert.equal(new Set(identity.members.map(m=>m.path)).size,305);
check('Exact independent frozen-policy ASAR membership and bytes',{total:names.length,source:names.filter(p=>p.startsWith('src/')).length,generated:generated.length,dependencies:names.filter(p=>p.startsWith('node_modules/')).length,terminalPureShipped:false});
for(const n of inventory.npm){const p=J('node_modules/'+n.name+'/package.json'),e=lock.packages['node_modules/'+n.name];assert.equal(n.version,p.version);assert.equal(n.version,e.version);assert.equal(n.license,p.license);assert.equal(n.integrity,e.integrity);assert.equal(file(n.notice).sha256,n.noticeSha256);}
check('Production dependency metadata and notices',{packages:production.size});
assert.deepEqual(J('generated/build.json'),receipt.renderer);
const generatedBindings={'generated/app.html':receipt.renderer.rendererSha256,'generated/home.html':receipt.renderer.homeEntrypoint.sha256,'generated/presentation-render.html':receipt.renderer.presentationRender.entrySha256,'generated/diagram-vector.html':receipt.renderer.diagramVector.entrySha256,'generated/code-analysis-worker.cjs':receipt.renderer.sourceAnalysis.entrySha256,'generated/import-validation.html':receipt.renderer.importValidation.entrySha256};
for(const [name,h] of Object.entries(receipt.renderer.windowEntrypoints))generatedBindings['generated/windows/'+name+'.html']=h;
for(const [p,h] of Object.entries(generatedBindings))assert.equal(file(p).sha256,h);
assert.equal(file('baseline/R78.html').sha256,receipt.renderer.baselineSha256);
assert.equal(file('generated/.analysis-build/analysis-python.mjs').sha256,receipt.renderer.sourceAnalysis.pythonModuleSha256);
check('Generated byte-exact bindings without EOL normalization',{members:generated.length,explicitRendererBindings:Object.keys(generatedBindings).length});
assert.equal(hash(normalized(readFileSync('native/process-identity.cs'))),receipt.processReader.sourceSha256);
assert.equal(hash(normalized(blobs.get('native/process-identity.cs'))),receipt.processReader.sourceSha256);
assert.equal(file('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe').sha256,receipt.processReader.compilerSha256);
assert.deepEqual(file('native/generated/process-identity.exe'),receipt.processReader.binary);assert.deepEqual(J('native/generated/process-identity.json'),receipt.processReader);
assert.deepEqual(file('node_modules/electron/dist/electron.exe'),receipt.runtimeBinary);
for(const p of [preview,...copies]){
 const [a,r,h]=binaries(p);assert.deepEqual(file(a),receipt.appArchive);assert.deepEqual(file(r),receipt.runtimeBinary);assert.deepEqual(file(h),receipt.processReader.binary);
 assert.deepEqual(J(metadata(p)[0]),receipt);assert.deepEqual(J(metadata(p)[1]),receipt.processReader);assert.deepEqual(J(metadata(p)[2]),inventory);
}
check('Preview and three copied ASAR/runtime/helper identities',{roots:4,binaryChecks:12,metadataChecks:12,compilerExecuted:false});
assert.deepEqual(agg.results.map(r=>[r.name,r.receipt.cases.length]),[['home-backup',4],['help-diagnostics',12],['home-library-search',7]]);
result.nativeReceipts=[];
for(const row of agg.results){
 const c=J(join(row.evidence,'result.json'));assert.deepEqual(c,row.receipt);assert.equal(row.code,0);assert.equal(row.signal,null);assert.equal(c.status,'COMPLETE');assert.ok(c.cases.every(x=>x.ok===true));assert.deepEqual(c.inputs,c.afterInputs);
 if(c.changedInputs)assert.deepEqual(c.changedInputs,[]);if('inputsUnchanged'in c)assert.equal(c.inputsUnchanged,true);if('packageUnchanged'in c)assert.equal(c.packageUnchanged,true);
 assert.equal(c.package.sourceCommit,commit);assert.equal(resolve(c.package.copy),resolve(row.postExitCopy.copy));assert.deepEqual(row.postExitCopy.archive,receipt.appArchive);assert.deepEqual(row.postExitCopy.runtime,receipt.runtimeBinary);assert.deepEqual(row.postExitCopy.helper,receipt.processReader.binary);
 const extra=[];for(const [p,h] of Object.entries(c.inputs)){assert.equal(file(p).sha256,h,'Child actual input '+p);if(agg.before[p]===undefined)extra.push({path:p,sha256:h});else assert.equal(agg.before[p],h);}
 result.nativeReceipts.push({name:row.name,path:join(row.evidence,'result.json'),status:c.status,cases:c.cases,additionalChildInputs:extra});
}
const home=agg.results[0].receipt;assert.equal(home.packageVerifiedBefore,true);assert.equal(home.exitObserved,true);assert.equal(home.packageUnchanged,true);assert.deepEqual(home.probe.sha256,trans.probe.sha256);
check('Actual retained copied native results bound to current bytes',{programmes:3,cases:23,externalPostExitBinaryChecks:9,ownerExecuted:true,reviewerGUI:false});
assert.deepEqual(file(trans.base.copy),{bytes:trans.base.bytes,sha256:trans.base.sha256});assert.deepEqual(file(trans.base.path),file(trans.base.copy));assert.deepEqual(file(trans.probe.path),{bytes:trans.probe.bytes,sha256:trans.probe.sha256});
let replay=readFileSync(trans.base.copy,'utf8');for(const t of trans.transformations){assert.equal(replay.split(t.from).length-1,t.occurrences,t.id);replay=replay.replace(t.from,t.to);}
assert.equal(replay,readFileSync(trans.probe.path,'utf8'),'Exact declared transformations only');
const base=readFileSync(trans.base.copy,'utf8'),probe=readFileSync(trans.probe.path,'utf8');
const start=' const projects=new ProjectStore(data)',finish=' await chooser.close();chooser=null;';
const launchFrom=trans.transformations.find(t=>t.id==='copied-executable-launch-no-test-root');
assert.equal(base.slice(base.indexOf(start),base.indexOf(finish)).replace(launchFrom.from,launchFrom.to),probe.slice(probe.indexOf(start),probe.indexOf(finish)));
assert.equal(base.slice(base.indexOf('async function attachChooser'),base.indexOf('const result=')),probe.slice(probe.indexOf('async function attachChooser'),probe.indexOf('const result=')));
check('Home one-off exact declared adaptation and business oracles preserved',{transformations:trans.transformations.length,baseSha256:trans.base.sha256,probeSha256:trans.probe.sha256,osChooser:'same PID-checked simulation seam',deadlines:'unchanged'});
result.protectedReports=protectedFiles.map(p=>({path:p,...file(p)}));
result.status='COMPLETE';
}catch(cause){result.error={message:cause.message,stack:cause.stack};}
result.after=capture();result.changedInputs=Object.keys(result.before).filter(p=>JSON.stringify(result.before[p])!==JSON.stringify(result.after[p]));if(result.changedInputs.length)result.status='ADVERSE';
result.endedAt=new Date().toISOString();writeFileSync('reviews/2026-10-07-terminal-home-package-independent-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,checks:result.checks,error:result.error,captured:Object.keys(result.before).length,changed:result.changedInputs}));
