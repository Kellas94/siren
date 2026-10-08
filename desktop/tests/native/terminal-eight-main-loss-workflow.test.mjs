// Regression for actual PR path-filter coverage; no native entrypoint imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchesGlob} from 'node:path';
const workflow=await readFile(new URL('../../../.github/workflows/terminal-prerequisite.yml',import.meta.url),'utf8');
const block=workflow.match(/  pull_request:\r?\n    paths:\r?\n([\s\S]*?)  workflow_dispatch:/);assert.ok(block,'pull_request paths must be explicit');
const patterns=[...block[1].matchAll(/^\s+- '([^']+)'/gm)].map(m=>m[1]);
const triggers=path=>patterns.some(pattern=>matchesGlob(path,pattern));
test('each eight-main-loss module-only PR triggers native qualification, including its regression',()=>{
 for(const name of ['terminal-eight-main-loss-derive.mjs','terminal-eight-main-loss-derive.test.mjs','terminal-eight-main-loss-verdict.mjs','terminal-eight-main-loss-verdict.test.mjs','terminal-eight-main-loss-test-fixture.mjs','terminal-eight-main-loss-startup.test.mjs','terminal-eight-main-loss.mjs','build-terminal-eight-main-loss.mjs','terminal-eight-main-loss-workflow.test.mjs'])assert.equal(triggers('desktop/tests/native/'+name),true,'module-only PR skipped: '+name);
});
test('existing native paths stay covered without making unrelated Docs changes trigger this job',()=>{
 for(const path of ['desktop/tests/native/terminal-composition-eight.mjs','desktop/tests/native/build-terminal-composed-main-loss.mjs','desktop/tests/fixtures/terminal-host-guard/host.cc'])assert.equal(triggers(path),true,path);
 assert.equal(triggers('desktop/src/ui/docs.js'),false);assert.equal(triggers('docs/README.md'),false);
});
