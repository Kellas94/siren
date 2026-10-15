import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {copySessionProvisionTree} from './terminal-session-provision-copy.mjs';
test('copies a prepared tree to a previously absent execution root',async()=>{
 const work=await mkdtemp(join(tmpdir(),'siren-copy-test-'));
 try{const source=join(work,'prepared'),destination=join(work,'execution');await mkdir(join(source,'nested'),{recursive:true});await writeFile(join(source,'nested','inert.txt'),'bytes, never executable');await copySessionProvisionTree(source,destination);assert.equal(await readFile(join(destination,'nested','inert.txt'),'utf8'),'bytes, never executable');}
 finally{await rm(work,{recursive:true,force:true});}
});
test('refuses an existing destination and preserves its contents',async()=>{
 const work=await mkdtemp(join(tmpdir(),'siren-copy-test-'));
 try{const source=join(work,'prepared'),destination=join(work,'execution');await mkdir(source);await writeFile(join(source,'input.txt'),'source');await mkdir(destination);await writeFile(join(destination,'held.txt'),'original');await assert.rejects(copySessionProvisionTree(source,destination),{code:'ERR_FS_CP_EEXIST'});assert.equal(await readFile(join(destination,'held.txt'),'utf8'),'original');await assert.rejects(readFile(join(destination,'input.txt')),{code:'ENOENT'});}
 finally{await rm(work,{recursive:true,force:true});}
});
