import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
function verify(text){
 const native=text.slice(text.indexOf('  native_windows:'),text.indexOf('  packaged_windows:')),packaged=text.slice(text.indexOf('  packaged_windows:'));
 assert.match(native,/name: Actual Diagram catalogue\n\s+if: matrix\.group == 'diagrams'\n\s+run: node tests\/native\/diagram-catalogue\.mjs\n/);
 assert.equal(native.split('run: node tests/native/diagram-catalogue.mjs').length-1,1);
 assert.match(packaged,/node tests\/native\/diagram-catalogue\.mjs --package \$preview\.previewRoot\n\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged Diagram catalogue failed" \}/);
 for(const group of [native,packaged]){
  const upload=group.slice(group.indexOf('      - name: Retain scoped test evidence'));assert.match(upload,/if: always\(\)/);
  assert.deepEqual(upload.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('desktop/evidence/diagram-catalogue/')),['desktop/evidence/diagram-catalogue/*/result.json','desktop/evidence/diagram-catalogue/*/*.png']);
 }
}
test('CI runs real catalogue controls in development and isolated copied preview, retaining only scoped evidence',()=>verify(workflow));
test('CI rejects omitted copied execution, swallowed failure and profile-wide upload',()=>{
 assert.throws(()=>verify(workflow.replace('node tests/native/diagram-catalogue.mjs --package $preview.previewRoot','node tests/native/diagram-catalogue.mjs')));
 assert.throws(()=>verify(workflow.replace('throw "Packaged Diagram catalogue failed"','Write-Output "Packaged Diagram catalogue failed"')));
 assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/diagram-catalogue/*/result.json','desktop/evidence/diagram-catalogue/**')));
});
