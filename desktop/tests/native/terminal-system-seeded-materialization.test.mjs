import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {win32,posix} from 'node:path';
import vm from 'node:vm';
const api=await import('./terminal-system-seeded-materialization.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const root=new URL('../../../',import.meta.url),prep=new URL('terminal-fresh-provisioner-preparation-20261011/',root);
const mapping=JSON.parse(await readFile(new URL('historical-source-mapping.json',prep),'utf8'));
const names=['desktop/src/terminal/profiles.mjs','desktop/src/terminal/shutdown-graph.mjs'];
const originals=await Promise.all(names.map(name=>readFile(new URL(mapping.inputs.find(r=>r.path===name).snapshot,prep),'utf8')));
const sha=s=>createHash('sha256').update(s).digest('hex');
function generate(...args){assert.equal(typeof api.generateSystemSeededProfileMaterialization,'function','Missing pinned literal materializer');return api.generateSystemSeededProfileMaterialization(...args);}
test('materializes exact approved profile candidate and separately labelled historical graph',async()=>{const r=generate(...originals);assert.equal(r.ok,true);assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);assert.equal(r.scope,'INACTIVE_HISTORICAL_SYSTEM_SEEDED_PROFILE_SOURCE_DERIVATION');assert.equal(r.files.length,2);assert.deepEqual(r.files.map(x=>x.path),names);assert.equal(r.files[0].derivative,await readFile(new URL(names[0],root),'utf8'));assert(Object.isFrozen(r.files));assert(Object.isFrozen(r.files[0]));});
test('every original byte interval is retained or explicitly replaced and reversible',()=>{const r=generate(...originals);for(let i=0;i<2;i++){const f=r.files[i],source=Buffer.from(originals[i]),target=Buffer.from(f.derivative);assert.equal(f.originalSha256,sha(source));assert.equal(f.sha256,sha(target));assert.equal(f.bytes,target.length);let sourceEnd=0,targetEnd=0;const inverse=[];for(const row of f.map){assert.equal(row.sourceStart,sourceEnd);assert.equal(row.targetStart,targetEnd);const a=source.subarray(row.sourceStart,row.sourceEnd),b=target.subarray(row.targetStart,row.targetEnd);assert.equal(sha(a),row.sourceSha256);assert.equal(sha(b),row.targetSha256);if(row.kind==='preserved')assert.deepEqual(a,b);else{assert.equal(row.kind,'replacement');assert.equal(a.toString('utf8'),row.before);assert.equal(b.toString('utf8'),row.after);}inverse.push(a);sourceEnd=row.sourceEnd;targetEnd=row.targetEnd;}assert.equal(sourceEnd,source.length);assert.equal(targetEnd,target.length);assert.deepEqual(Buffer.concat(inverse),source);}});
test('refuses source drift extra arity and nonprimitive arguments without coercion',()=>{let calls=0;const hostile={toString(){calls++;return originals[0];}};for(const args of [[originals[0]+'\n',originals[1]],[originals[0],originals[1]+'\n'],[originals[1],originals[0]],[hostile,originals[1]],[new Proxy(hostile,{}),originals[1]],[...originals,undefined]]){const r=generate(...args);assert.equal(r.ok,false);assert.equal(r.code,'SYSTEM_SEEDED_SOURCE_REFUSED');assert.equal(r.nativeAdmission,false);}assert.equal(calls,0);});
test('derived historical graph keeps the original topology and its full static dependency membership',async()=>{const r=generate(...originals),sourceMap=new Map(mapping.inputs.filter(x=>x.path.endsWith('.mjs')).map(x=>[x.path,x]));const todo=[...names],seen=new Set();while(todo.length){const name=todo.pop();if(seen.has(name))continue;seen.add(name);const replacement=r.files.find(x=>x.path===name),row=sourceMap.get(name);assert(row,'historical source member '+name);const text=replacement?.derivative??await readFile(new URL(row.snapshot,prep),'utf8');for(const m of text.matchAll(/(?:import|export)\s[^;\n]*?from\s*['"]([^'"]+)['"]/g)){if(m[1].startsWith('node:'))continue;assert(m[1].startsWith('.'),'no unbound package import');const next=posix.normalize(posix.join(posix.dirname(name),m[1]));assert(sourceMap.has(next),'materialized dependency '+next);todo.push(next);}}assert(seen.size>15);assert(!r.files[1].derivative.includes("from './profile-catalogue-owner.mjs'"));assert(r.files[1].derivative.includes('#profileRows=[]'));});
test('actual materialized profile executes seeded resolution in finite isolated VM with real lifetime',async()=>{
 const r=generate(...originals),context=vm.createContext({Buffer});
 const profile=new vm.SourceTextModule(r.files[0].derivative,{context});
 const lifeSource=await readFile(new URL('desktop/src/terminal/provider-lifetime.mjs',root),'utf8');
 const life=new vm.SourceTextModule(lifeSource,{context});
 const util=new vm.SyntheticModule(['types'],function(){this.setExport('types',types);},{context});
 const path=new vm.SyntheticModule(['win32'],function(){this.setExport('win32',win32);},{context});
 const link=specifier=>specifier==='node:util'?util:specifier==='node:path'?path:specifier==='./provider-lifetime.mjs'?life:assert.fail('unexpected import '+specifier);
 await profile.link(link);await profile.evaluate();context.create=profile.namespace.createShellProfileCatalogue;
 const promise=vm.runInContext(String.raw`(()=>{
  const chain=p=>{const parts=p.slice(3).split('\\');return ['C:\\',...parts.map((_,i)=>'C:\\'+parts.slice(0,i+1).join('\\'))].map(path=>({path,identity:'dir:'+path,directory:true,reparse:false}));};
  return create({modulePathPolicy:'system-seeded',getSystemDirectory:async()=> 'C:\\Windows\\System32',
   inspectExecutable:async p=>({canonicalPath:p,identity:'exe',file:true,reparse:false,ancestors:chain(p.slice(0,p.lastIndexOf('\\')))}),
   inspectModuleDirectory:async p=>({canonicalPath:p,identity:'dir:'+p,directory:true,reparse:false,ancestors:chain(p)}),
   readEnvironment:async()=>({SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32'}),authorize:()=>true,captureAdmission:()=>({isCurrent:()=>true})
  }).resolveShellProfile('powershell');
 })()`,context,{timeout:1000});
 const resolved=await promise;assert.equal(resolved.env.PSModulePath,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules');assert.deepEqual(Array.from(resolved.args),['-NoLogo','-NoProfile']);
});
