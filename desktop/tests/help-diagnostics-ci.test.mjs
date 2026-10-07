import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
function verify(text){
 const native=text.slice(text.indexOf('  native_windows:'),text.indexOf('  packaged_windows:')),packaged=text.slice(text.indexOf('  packaged_windows:'));
 assert.match(native,/name: Actual Help and diagnostics\n\s+if: matrix\.group == 'desktop'\n\s+run: node tests\/native\/help-diagnostics\.mjs\n/);
 assert.equal(native.split('run: node tests/native/help-diagnostics.mjs').length-1,1);
 assert.ok(native.indexOf('run: node tests/native/help-diagnostics.mjs')<native.indexOf('run: node scripts/native-verification.mjs'),'Help must execute before unrelated native group failures');
 assert.match(packaged,/node tests\/native\/help-diagnostics\.mjs --package \$preview\.previewRoot\n\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged Help and diagnostics failed" \}/);
 assert.ok(packaged.indexOf('node tests/native/help-diagnostics.mjs --package')<packaged.indexOf('node tests/native/diagram-annotations.mjs --package'));
 for(const group of [native,packaged]){
  const upload=group.slice(group.indexOf('      - name: Retain scoped test evidence'));
  assert.match(upload,/if: always\(\)/);
  assert.deepEqual(upload.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('desktop/evidence/help-diagnostics/')),['desktop/evidence/help-diagnostics/*/result.json','desktop/evidence/help-diagnostics/*/electron.log','desktop/evidence/help-diagnostics/*/*.png']);
 }
}
test('CI executes actual Help in development and a verified portable copy and retains its failure evidence',()=>verify(workflow));
test('CI refuses missing Help, swallowed package exit, late execution and broad private uploads',()=>{
 assert.throws(()=>verify(workflow.replace('node tests/native/help-diagnostics.mjs --package $preview.previewRoot','node tests/native/help-diagnostics.mjs')));
 assert.throws(()=>verify(workflow.replace('throw "Packaged Help and diagnostics failed"','Write-Output "Packaged Help and diagnostics failed"')));
 assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/help-diagnostics/*/result.json','desktop/evidence/help-diagnostics/**')));
 assert.throws(()=>verify(workflow.replace('run: node tests/native/help-diagnostics.mjs','run: node scripts/native-verification.mjs')));
});
