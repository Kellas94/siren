import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
function verify(text){
 const native=text.slice(text.indexOf('  native_windows:'),text.indexOf('  packaged_windows:')),packaged=text.slice(text.indexOf('  packaged_windows:'));
 assert.match(native,/name: Actual Docs Activity\n\s+if: matrix\.group == 'desktop'\n\s+run: node tests\/native\/docs-activity\.mjs\n/);assert.equal(native.split('run: node tests/native/docs-activity.mjs').length-1,1);
 assert.match(packaged,/node tests\/native\/docs-activity\.mjs --package \$preview\.previewRoot\n\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged Docs Activity failed" \}/);
 for(const group of [native,packaged]){const upload=group.slice(group.indexOf('      - name: Retain scoped test evidence'));assert.match(upload,/if: always\(\)/);assert.deepEqual(upload.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('desktop/evidence/docs-activity-native/')),['desktop/evidence/docs-activity-native/*/result.json','desktop/evidence/docs-activity-native/*/*.png']);}
}
test('CI runs actual Docs Activity in development and genuine copied package with bounded failure evidence',()=>verify(workflow));
test('CI rejects missing copied Activity, swallowed exit and profile-wide upload',()=>{
 assert.throws(()=>verify(workflow.replace('node tests/native/docs-activity.mjs --package $preview.previewRoot','node tests/native/docs-activity.mjs')));
 assert.throws(()=>verify(workflow.replace('throw "Packaged Docs Activity failed"','Write-Output "Packaged Docs Activity failed"')));
 assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/docs-activity-native/*/result.json','desktop/evidence/docs-activity-native/**')));
});
