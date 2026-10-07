import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
test('real Docs fixture teardown accepts canonical TEMP identity when Windows supplies a different path spelling',()=>{
 const temporary=process.platform==='win32'?tmpdir().toLowerCase():tmpdir();
 const env={...process.env,TEMP:temporary,TMP:temporary};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/native-docs-export.test.mjs'],{cwd:new URL('..',import.meta.url),env,encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
 assert.equal(result.error,undefined);assert.equal(result.status,0,result.stdout+'\n'+result.stderr);assert.match(result.stdout,/# pass 8/);assert.match(result.stdout,/# fail 0/);
});
