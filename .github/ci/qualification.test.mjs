import test from 'node:test';
import assert from 'node:assert/strict';

const policy = await import('./qualification.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});

test('documentation can qualify without a desktop build, including the initial main branch', () => {
  assert.equal(typeof policy.classifyChanges, 'function');
  assert.deepEqual(policy.classifyChanges(['README.md', 'docs/history/notes.md'], false), {desktop:false, launcher:false});
  assert.deepEqual(policy.classifyChanges(['desktop/reviews/result.md'], true), {desktop:false, launcher:false});
});
test('code, dependency, renderer and workflow edits require both real application qualifications', () => {
  for (const path of ['desktop/src/main.mjs','desktop/package-lock.json','desktop/baseline/R78.html', '.github/ci/qualification.mjs','.github/workflows/desktop-verify.yml', 'new-tool.js']) {
    assert.deepEqual(policy.classifyChanges(['README.md', path], true), {desktop:true, launcher:true}, path);
  }
});
test('bootstrap admits only CI policy and documentation when desktop is absent', () => {
  assert.deepEqual(policy.classifyChanges(['.github/workflows/merge-qualification.yml','.github/ci/qualification.mjs'], false), {desktop:false, launcher:false});
  for (const path of ['desktop/src/main.mjs','SIREN.html','new-tool.js','desktop/package.json']) {
    assert.throws(() => policy.classifyChanges([path], false), /qualification unavailable/, path);
  }
});
test('unknown, empty and malformed scope fails closed', () => {
  for (const paths of [null, [], [''], ['../README.md'], ['/README.md'], ['README.md\0x']]) {
    assert.throws(() => policy.classifyChanges(paths, true));
  }
});
test('each required result must be an actual success', () => {
  assert.equal(typeof policy.requireQualification, 'function');
  assert.doesNotThrow(() => policy.requireQualification({scope:'success', desktop:'success', launcher:'success'}, {desktop:'true',launcher:'true'}));
  for (const job of ['scope','desktop','launcher']) {
    for (const result of ['failure','cancelled','skipped',undefined]) {
      assert.throws(() => policy.requireQualification({scope:'success', desktop:'success',launcher:'success',[job]:result}, {desktop:'true',launcher:'true'}), /incomplete/);
    }
  }
});
test('documentation records explicit skipped suites and still requires the scope job', () => {
  assert.doesNotThrow(() => policy.requireQualification({scope:'success',desktop:'skipped',launcher:'skipped'}, {desktop:'false',launcher:'false'}));
  for (const result of ['failure','cancelled',undefined]) {
    assert.throws(() => policy.requireQualification({scope:'success',desktop:result,launcher:'skipped'}, {desktop:'false',launcher:'false'}));
  }
  assert.throws(() => policy.requireQualification({scope:'failure',desktop:'skipped',launcher:'skipped'}, {desktop:'false',launcher:'false'}));
});
test('missing or corrupt routing output cannot masquerade as documentation', () => {
  for (const outputs of [{}, {desktop:'false'}, {desktop:false,launcher:false}, {desktop:'false',launcher:'garbage'}]) {
    assert.throws(() => policy.requireQualification({scope:'success',desktop:'skipped',launcher:'skipped'}, outputs));
  }
});
