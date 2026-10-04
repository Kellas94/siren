import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
const script=resolve('.github/ci/qualification.mjs');
test('real git scope includes code after 350 documentation changes and renamed documentation',()=>{
  const root=mkdtempSync(join(tmpdir(),'siren-ci-scope-'));
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  git('init','--quiet');git('config','user.name','SIREN owned CI fixture');git('config','user.email','fixture@example.invalid');
  mkdirSync(join(root,'desktop/src'),{recursive:true});mkdirSync(join(root,'docs'));
  for(const path of ['desktop/package.json','desktop/package-lock.json','desktop/src/main.mjs'])writeFileSync(join(root,path),'{}');
  writeFileSync(join(root,'README.md'),'original');git('add','.');git('commit','--quiet','-m','owned base');const base=git('rev-parse','HEAD');
  git('mv','README.md','desktop/src/renamed.js');
  for(let n=0;n<350;n++)writeFileSync(join(root,'docs',n+'.md'),'owned doc');
  git('add','.');git('commit','--quiet','-m','owned changed scope');const head=git('rev-parse','HEAD');
  const event=join(root,'event.json'),output=join(root,'output.txt');writeFileSync(event,JSON.stringify({pull_request:{base:{sha:base},head:{sha:head}}}));
  const result=spawnSync(process.execPath,[script,'scope'],{cwd:root,encoding:'utf8',env:{...process.env,GITHUB_EVENT_NAME:'pull_request',GITHUB_EVENT_PATH:event,GITHUB_OUTPUT:output}});
  assert.equal(result.status,0,result.stderr);assert.equal(readFileSync(output,'utf8'),'desktop=true\nlauncher=true\n');
  assert.equal(JSON.parse(result.stdout).changedFiles,352);
});
test('actual gate command exits nonzero for a failed suite and zero for explicit documentation scope',()=>{
  const run=(results,outputs)=>spawnSync(process.execPath,[script,'verify'],{encoding:'utf8',env:{...process.env,SIREN_JOB_RESULTS:JSON.stringify(results),SIREN_SCOPE_OUTPUTS:JSON.stringify(outputs)}});
  const refused=run({scope:'success',desktop:'failure',launcher:'success'},{desktop:'true',launcher:'true'});
  assert.equal(refused.status,1);assert.match(refused.stderr,/qualification incomplete/);
  const admitted=run({scope:'success',desktop:'skipped',launcher:'skipped'},{desktop:'false',launcher:'false'});
  assert.equal(admitted.status,0,admitted.stderr);assert.equal(JSON.parse(admitted.stdout).releaseAdmitted,false);
});
