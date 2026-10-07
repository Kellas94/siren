import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
function verify(text){
 const native=text.slice(text.indexOf('  native_windows:'),text.indexOf('  packaged_windows:')),packaged=text.slice(text.indexOf('  packaged_windows:'));
 assert.match(native,/name: Actual Diagram layout\n\s+if: matrix\.group == 'diagrams'\n\s+run: node tests\/native\/diagram-layout\.mjs\n/);
 assert.equal(native.split('run: node tests/native/diagram-layout.mjs').length-1,1);
 assert.match(native,/name: Actual Diagram layout SVG and Present\n\s+if: matrix\.group == 'diagrams'\n\s+run: node tests\/native\/diagram-layout-render\.mjs\n/);
 assert.equal(native.split('run: node tests/native/diagram-layout-render.mjs').length-1,1);
 assert.match(packaged,/node tests\/native\/diagram-layout\.mjs --package \$preview\.previewRoot\n\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged Diagram layout failed" \}/);
 for(const group of [native,packaged]){
  const upload=group.slice(group.indexOf('      - name: Retain scoped test evidence'));assert.match(upload,/if: always\(\)/);
  assert.deepEqual(upload.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('desktop/evidence/diagram-layout-native/')),['desktop/evidence/diagram-layout-native/*/result.json','desktop/evidence/diagram-layout-native/*/*.png']);
  assert.deepEqual(upload.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('desktop/evidence/diagram-layout-render/')),['desktop/evidence/diagram-layout-render/*/result.json','desktop/evidence/diagram-layout-render/*/driver-result.json']);
 }
}
test('CI runs real layout controls in development and isolated copied preview, retaining only scoped evidence',()=>verify(workflow));
test('CI rejects omitted copied execution, swallowed failure and profile-wide upload',()=>{
 assert.throws(()=>verify(workflow.replace('node tests/native/diagram-layout.mjs --package $preview.previewRoot','node tests/native/diagram-layout.mjs')));
 assert.throws(()=>verify(workflow.replace('throw "Packaged Diagram layout failed"','Write-Output "Packaged Diagram layout failed"')));
 assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/diagram-layout-native/*/result.json','desktop/evidence/diagram-layout-native/**')));
});
test('CI rejects omitted or duplicated utility execution and missing utility result retention',()=>{
 const step='      - name: Actual Diagram layout SVG and Present\n        if: matrix.group == \'diagrams\'\n        run: node tests/native/diagram-layout-render.mjs\n';
 assert.throws(()=>verify(workflow.replace(step,'')));
 assert.throws(()=>verify(workflow.replace(step,step+step)));
 for(const file of ['result.json','driver-result.json'])assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/diagram-layout-render/*/'+file,'')));
 assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/diagram-layout-render/*/result.json','desktop/evidence/diagram-layout-render/**')));
});
