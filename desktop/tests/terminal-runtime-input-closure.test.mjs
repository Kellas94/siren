// Source identity closure only. Does not build or execute a native probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
const root=new URL('../../',import.meta.url);
const names=['terminal-session-filesystem','terminal-session-provision','terminal-session-runtime','terminal-cmdlet-runtime','terminal-discovery-runtime','terminal-resolution-runtime'];
const read=path=>readFile(new URL(path,root));
const manifests=Object.fromEntries(await Promise.all(names.map(async name=>[name,JSON.parse(await read('desktop/tests/native/'+name+'-inputs.json'))])));
for(const name of names)test(name+' has a complete exact source-input closure',async()=>{
 const manifest=manifests[name],seen=new Set();assert.equal(manifest.nativeExecutionAdmitted,false);
 for(const row of manifest.inputs){assert.equal(posix.normalize(row.path),row.path);assert.equal(row.path.includes('\\'),false);assert.equal(row.path.startsWith('../')||posix.isAbsolute(row.path),false);assert.equal(seen.has(row.path),false);seen.add(row.path);const bytes=await read(row.path);assert.equal(bytes.length,row.bytes,row.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,row.path);}
 const runner=await read('desktop/tests/native/'+(name==='terminal-session-filesystem'?name+'-probe':name)+'.mjs');
 const requiredLists=[...runner.toString().matchAll(/for\(const required of (\[(?:'[^'\r\n]*'\s*,?\s*)+\])\)/g)];
 for(const list of requiredLists)for(const [,path] of list[1].matchAll(/'([^']+)'/g))assert.equal(seen.has(path),true,'runner-required source '+path);
});
for(const [parent,child] of [['terminal-session-runtime','terminal-session-filesystem'],['terminal-session-runtime','terminal-session-provision'],['terminal-cmdlet-runtime','terminal-session-runtime'],['terminal-discovery-runtime','terminal-session-runtime'],['terminal-resolution-runtime','terminal-discovery-runtime']])test(parent+' inherits identical '+child+' source rows',()=>{
 const inherited=new Map(manifests[parent].inputs.map(row=>[row.path,row]));for(const row of manifests[child].inputs)assert.deepEqual(inherited.get(row.path),row,row.path);
});
