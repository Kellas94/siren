// Isolated Windows API prerequisite. This does not admit a PTY or Terminal.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join,dirname,parse} from 'node:path';
const run=promisify(execFile), hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.platform,'win32');
const desktop=fileURLToPath(new URL('../../',import.meta.url));
const output=join(desktop,'evidence','terminal-job-list',new Date().toISOString().replaceAll(':','-'));
// Refuse an archived/junction family: a new native run needs real C parents.
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){
  try { assert.equal((await lstat(p)).isSymbolicLink(),false,`linked parent: ${p}`); }
  catch(error){if(error.code!=='ENOENT')throw error;}
}
await mkdir(output,{recursive:true});
const compiler=join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
const source=join(desktop,'tests/fixtures/terminal-job-list.cs'), executable=join(output,'job-list-probe.exe');
const receipt={schema:1,scope:'Win32 Job-list prerequisite; no PTY/Electron admission',admitted:false,
  node:process.version,platform:process.platform,arch:process.arch,output,results:[]};
try{
  receipt.sourceSha256=hash(await readFile(source));
  receipt.runnerSha256=hash(await readFile(fileURLToPath(import.meta.url)));
  receipt.compilerSha256=hash(await readFile(compiler));
  const built=await run(compiler,['/nologo','/optimize+','/platform:x64','/target:exe','/out:'+executable,source],{windowsHide:true,timeout:30000,maxBuffer:65536});
  await writeFile(join(output,'compiler.txt'),built.stdout+built.stderr,{flag:'wx'});
  receipt.binarySha256=hash(await readFile(executable));
  // Run the same requirement with the session Job omitted, retaining a safety
  // root Job at creation. Even forced probe loss reaps the suspended child.
  try{
    await run(executable,['negative',output],{windowsHide:true,timeout:15000,maxBuffer:65536});
    assert.fail('negative control unexpectedly accepted an unowned child');
  }catch(error){
    await writeFile(join(output,'negative.txt'),(error.stdout??'')+(error.stderr??''),{flag:'wx'});
    assert.equal(error.code,1);
    assert.match(error.stderr,/ROOT_NOT_IN_BOTH_JOBS/);
    receipt.results.push({case:'omitted session Job refused before resume; safety root retained',passed:true});
  }
  let positive;
  try {positive=await run(executable,['positive',output],{windowsHide:true,timeout:30000,maxBuffer:65536});}
  catch(error){await writeFile(join(output,'positive-failed.txt'),(error.stdout??'')+(error.stderr??''),{flag:'wx'});throw error;}
  await writeFile(join(output,'positive.txt'),positive.stdout+positive.stderr,{flag:'wx'});
  const result=JSON.parse(positive.stdout.trim());
  assert.equal(result.status,'PREREQUISITE_PASSED');
  assert.equal(result.sessionAProcesses,4);assert.equal(result.sessionBProcesses,4);
  assert.equal(result.beforeResumeMembership,true);assert.equal(result.stopIsolated,true);
  assert.equal(result.closeKillsOwnedProcesses,true);assert.equal(result.invalidHandleRefused,true);
  assert.equal(result.jobsNonInheritable,true);assert.equal(result.rootActiveProcesses,0);
  assert.ok(result.stopMs<10000);assert.ok(result.closeMs<10000);
  assert.ok(result.fixtureAgeMs<10000);assert.ok(result.exitCodesA.every(code=>code===77));
  assert.equal(result.exitCodesA.length,result.heldA.length);assert.equal(result.exitCodesB.length,result.heldB.length);
  assert.equal(result.heldA.length,4+result.sessionAHelpers);assert.equal(result.heldB.length,4+result.sessionBHelpers);
  assert.equal(new Set([...result.heldA,...result.heldB].map(p=>p.pid)).size,result.heldA.length+result.heldB.length);
  assert.equal(result.ownerLoss.passed,true);assert.equal(result.ownerLoss.safetyJobStillOpen,true);
  assert.ok(result.ownerLoss.elapsedMs<10000);assert.ok(result.ownerLoss.fixtureAgeMs<10000);
  assert.equal(result.ownerLoss.held.length,result.ownerLoss.ownedProcesses);assert.ok(result.ownerLoss.ownedProcesses>=5);
  for(const identity of [...result.heldA,...result.heldB]){
    assert.ok(identity.pid>0);assert.match(identity.createdFileTime,/^[1-9][0-9]+$/);assert.ok(identity.image.length>0);
  }
  receipt.results.push(result);receipt.status='PREREQUISITE_PASSED';
}catch(error){receipt.status='FAILED';receipt.failure={message:error.message,code:error.code};throw error;}
finally {await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));}
