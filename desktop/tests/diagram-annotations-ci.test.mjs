import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
function verify(text){
 const native=text.slice(text.indexOf('  native_windows:'),text.indexOf('  packaged_windows:')),packaged=text.slice(text.indexOf('  packaged_windows:'));
 assert.match(native,/name: Actual Diagram Inspector and filters\n\s+if: matrix\.group == 'diagrams'\n\s+run: node tests\/native\/diagram-annotations\.mjs\n/);
 assert.equal(native.split('run: node tests/native/diagram-annotations.mjs').length-1,1);
 assert.match(packaged,/node tests\/native\/diagram-annotations\.mjs --package \$preview\.previewRoot\n\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged Diagram Inspector and filters failed" \}/);
 for(const group of [native,packaged]){const upload=group.slice(group.indexOf('      - name: Retain scoped test evidence'));assert.match(upload,/if: always\(\)/);assert.deepEqual(upload.split('\n').map(s=>s.trim()).filter(s=>s.startsWith('desktop/evidence/diagram-annotations-native/')),['desktop/evidence/diagram-annotations-native/*/result.json','desktop/evidence/diagram-annotations-native/*/*.png']);}
}
test('CI executes native Diagram Inspector and filters and copied original harness, retaining bounded original receipts on failure',()=>verify(workflow));
test('CI rejects missing original execution, hidden copied failure or profile-wide evidence upload',()=>{
 assert.throws(()=>verify(workflow.replace('node tests/native/diagram-annotations.mjs --package $preview.previewRoot','node tests/native/diagram-annotations.mjs')));
 assert.throws(()=>verify(workflow.replace('throw "Packaged Diagram Inspector and filters failed"','Write-Output "Packaged Diagram Inspector and filters failed"')));
 assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/diagram-annotations-native/*/result.json','desktop/evidence/diagram-annotations-native/**')));
});
