import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as builder from '../scripts/build-process-reader.mjs';
import {processReaderSourceSha256} from '../src/recovery/native-process.mjs';
import {readFile,writeFile,mkdir,symlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
test('first Windows build refuses a junction output without writing into its target',{skip:process.platform!=='win32'},async()=>{
 const root=await mkdtemp(join(tmpdir(),'siren-reader-junction-')),target=await mkdtemp(join(tmpdir(),'siren-reader-junction-target-'));
 await mkdir(join(root,'native'));await writeFile(join(root,'native/process-identity.cs'),await readFile(new URL('../native/process-identity.cs',import.meta.url)));
 await symlink(target,join(root,'native/generated'),'junction');
 await assert.rejects(builder.buildProcessReader({desktopRoot:root}),/Project path refused/);
 assert.deepEqual(await readdir(target),[]);
 // Only test-owned directories are linked; no generated executable is run.
});
function fixture(){const binary=Buffer.alloc(1024,7);binary.write('MZ');const compilerSha256='a'.repeat(64),receipt={schema:1,kind:'windows-process-reader',sourceSha256:processReaderSourceSha256,compilerSha256,binary:{bytes:binary.length,sha256:digest(binary)}};return {receipt,binary,compilerSha256};}
test('build cache admits only exact source/compiler/binary receipt without mutating its bytes',()=>{
 const f=fixture(),before=Buffer.from(f.binary),receipt=structuredClone(f.receipt);assert.equal(typeof builder.admitCachedProcessReader,'function');
 assert.equal(builder.admitCachedProcessReader(f.receipt,f.binary,f.compilerSha256),true);assert.deepEqual(f.receipt,receipt);assert.deepEqual(f.binary,before);
});
test('actual Windows builder compiles a missing pair once, reuses exact bytes and refuses partial or corrupted caches',{skip:process.platform!=='win32'},async()=>{
 const root=await mkdtemp(join(tmpdir(),'siren-reader-cache-'));await mkdir(join(root,'native'));
 await writeFile(join(root,'native/process-identity.cs'),await readFile(new URL('../native/process-identity.cs',import.meta.url)));
 const first=await builder.buildProcessReader({desktopRoot:root}),before=await readFile(first.executable),metadataPath=join(root,'native/generated/process-identity.json'),metadata=await readFile(metadataPath);
 assert.equal(first.reused,false);const second=await builder.buildProcessReader({desktopRoot:root});assert.equal(second.reused,true);assert.deepEqual(second.receipt,first.receipt);assert.deepEqual(await readFile(first.executable),before);assert.deepEqual(await readFile(metadataPath),metadata);
 const altered=JSON.parse(metadata);altered.compilerSha256='b'.repeat(64);await writeFile(metadataPath,JSON.stringify(altered));await assert.rejects(builder.buildProcessReader({desktopRoot:root}),/COMPILER_REFUSED/);assert.deepEqual(await readFile(first.executable),before);
 const partial=await mkdtemp(join(tmpdir(),'siren-reader-partial-'));await mkdir(join(partial,'native/generated'),{recursive:true});await writeFile(join(partial,'native/process-identity.cs'),await readFile(new URL('../native/process-identity.cs',import.meta.url)));await writeFile(join(partial,'native/generated/process-identity.json'),metadata);
 await assert.rejects(builder.buildProcessReader({desktopRoot:partial}),/CACHE_REFUSED/);assert.deepEqual(await readFile(join(partial,'native/generated/process-identity.json')),metadata);
 // Newly compiled test artifacts are admitted as data only, never executed.
});
test('source recipe, compiler change or binary replacement refuses cached native helper',()=>{
 assert.equal(typeof builder.admitCachedProcessReader,'function');
 for(const field of ['source','compiler','bytes','hash','size','header']){
  const f=fixture();if(field==='source')f.receipt.sourceSha256='b'.repeat(64);if(field==='compiler')f.receipt.compilerSha256='b'.repeat(64);if(field==='bytes')f.binary[100]^=1;if(field==='hash')f.receipt.binary.sha256='b'.repeat(64);if(field==='size')f.receipt.binary.bytes++;if(field==='header')f.binary.write('NO');
  assert.throws(()=>builder.admitCachedProcessReader(f.receipt,f.binary,f.compilerSha256));
 }
});
