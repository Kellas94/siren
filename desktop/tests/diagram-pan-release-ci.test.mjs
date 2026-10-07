import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
function verify(text){
 const native=text.slice(text.indexOf('  native_windows:'),text.indexOf('  packaged_windows:')),packaged=text.slice(text.indexOf('  packaged_windows:'));
 assert.match(native,/name: Actual Diagram pan release\n\s+if: matrix\.group == 'diagrams'\n\s+run: node tests\/native\/diagram-pan-release\.mjs\n/);assert.equal(native.split('run: node tests/native/diagram-pan-release.mjs').length-1,1);
 assert.match(packaged,/node tests\/native\/diagram-pan-release\.mjs --package \$preview\.previewRoot\n\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged Diagram pan release failed" \}/);
 for(const group of [native,packaged]){const upload=group.slice(group.indexOf('      - name: Retain scoped test evidence'));assert.match(upload,/if: always\(\)/);assert.deepEqual(upload.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('desktop/evidence/diagram-pan-release/')),['desktop/evidence/diagram-pan-release/*/result.json','desktop/evidence/diagram-pan-release/*/*.png']);}
}
test('CI runs actual endpoint transport in development and copied preview with scoped evidence',()=>verify(workflow));
test('CI refuses a missing copy, swallowed native exit or profile-wide evidence',()=>{
 assert.throws(()=>verify(workflow.replace('node tests/native/diagram-pan-release.mjs --package $preview.previewRoot','node tests/native/diagram-pan-release.mjs')));
 assert.throws(()=>verify(workflow.replace('throw "Packaged Diagram pan release failed"','Write-Output "Packaged Diagram pan release failed"')));
 assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/diagram-pan-release/*/result.json','desktop/evidence/diagram-pan-release/**')));
});
