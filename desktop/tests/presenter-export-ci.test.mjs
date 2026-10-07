import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
function verify(text){
 const native=text.slice(text.indexOf('  native_windows:'),text.indexOf('  packaged_windows:')),packaged=text.slice(text.indexOf('  packaged_windows:'));
 assert.match(native,/name: Actual Presenter captured-notes export\n\s+if: matrix\.group == 'desktop'\n\s+run: node tests\/native\/presenter-notes-export\.mjs\n/);
 assert.equal(native.split('run: node tests/native/presenter-notes-export.mjs').length-1,1);
 assert.match(packaged,/node tests\/native\/presenter-notes-export\.mjs --package \$preview\.previewRoot\n\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged Presenter notes export failed" \}/);
 for(const group of [native,packaged]){
  const upload=group.slice(group.indexOf('      - name: Retain scoped test evidence'));
  assert.match(upload,/if: always\(\)/);
  const header=upload.split('\n').find(line=>line.trim()==='path: |'),body=upload.split('\n').filter(line=>line.trim().startsWith('desktop/'));
  assert.ok(header&&body.length);assert.ok(body.every(line=>line.search(/\S/)>header.search(/\S/)),'YAML literal upload content must be more indented than its path header');
  assert.deepEqual(upload.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('desktop/evidence/presenter-notes-export-native/')),['desktop/evidence/presenter-notes-export-native/*/result.json']);
 }
}
test('Presenter native and genuine copied-package regression run and retain bounded original receipts on failure',()=>verify(workflow));
test('Presenter CI refuses missing copied execution/retention and profiles or exported data capture',()=>{
 assert.throws(()=>verify(workflow.replace('node tests/native/presenter-notes-export.mjs --package $preview.previewRoot','node tests/native/presenter-notes-export.mjs')));
 assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/presenter-notes-export-native/*/result.json','')));
 assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/presenter-notes-export-native/*/result.json','desktop/evidence/presenter-notes-export-native/**')));
 assert.throws(()=>verify(workflow.replaceAll('          path: |','            path: |')));
});
