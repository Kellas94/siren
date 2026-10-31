import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
function verify(text){
 const native=text.slice(text.indexOf('  native_windows:'),text.indexOf('  packaged_windows:')),packaged=text.slice(text.indexOf('  packaged_windows:'));
 assert.match(native,/name: Actual Docs Activity\n\s+if: matrix\.group == 'desktop'\n\s+run: node tests\/native\/docs-activity\.mjs\n/);assert.equal(native.split('run: node tests/native/docs-activity.mjs').length-1,1);
 assert.match(packaged,/node tests\/native\/docs-activity\.mjs --package \$preview\.previewRoot\n\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged Docs Activity failed" \}/);
 for(const group of [native,packaged]){const upload=group.slice(group.indexOf('      - name: Retain scoped test evidence')).split('\n      - name:')[0];assert.match(upload,/if: always\(\)/);assert.deepEqual(upload.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('desktop/evidence/docs-activity-native/')),['desktop/evidence/docs-activity-native/*/result.json','desktop/evidence/docs-activity-native/*/*.png']);}
 for(const [group,name,condition] of [[native,'desktop-native-desktop-docs-activity-journals',"${{ always() && matrix.group == 'desktop' }}"],[packaged,'desktop-packaged-docs-activity-journals','${{ always() }}']]){
  const blocks=group.split('\n      - name:').filter(step=>step.includes('name: '+name+'\n'));assert.equal(blocks.length,1,'One dedicated raw Docs Activity upload per admitted route');const upload=blocks[0];assert.ok(upload.includes('if: '+condition+'\n'));assert.match(upload,/uses: actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);assert.match(upload,/path: desktop\/evidence\/docs-activity-native\/\*\/raw-captures\/\*\*\n/);assert.match(upload,/include-hidden-files: true\n/);assert.match(upload,/if-no-files-found: error\n/);assert.match(upload,/retention-days: 14\n/);assert.equal(upload.split('path:').length-1,1);
 }
}
test('CI runs actual Docs Activity in development and genuine copied package with bounded failure evidence',()=>verify(workflow));
test('CI rejects missing copied Activity, swallowed exit and profile-wide upload',()=>{
 assert.throws(()=>verify(workflow.replace('node tests/native/docs-activity.mjs --package $preview.previewRoot','node tests/native/docs-activity.mjs')));
 assert.throws(()=>verify(workflow.replace('throw "Packaged Docs Activity failed"','Write-Output "Packaged Docs Activity failed"')));
 assert.throws(()=>verify(workflow.replaceAll('desktop/evidence/docs-activity-native/*/result.json','desktop/evidence/docs-activity-native/**')));
});
test('CI rejects missing raw evidence, skipped failure capture, wrong matrix scope and hidden-file omission',()=>{
 assert.throws(()=>verify(workflow.replace('name: desktop-packaged-docs-activity-journals','name: missing-activity-journals')));
 assert.throws(()=>verify(workflow.replace("if: ${{ always() && matrix.group == 'desktop' }}","if: ${{ always() && matrix.group == 'sources' }}")));
 const raw=workflow.indexOf('      - name: Retain owned Docs Activity raw journals');assert.ok(raw>=0);const before=workflow.slice(0,raw),after=workflow.slice(raw);
 assert.throws(()=>verify(before+after.replace('include-hidden-files: true','include-hidden-files: false')));
 assert.throws(()=>verify(before+after.replace('if-no-files-found: error','if-no-files-found: warn')));
 assert.throws(()=>verify(before+after.replace('desktop/evidence/docs-activity-native/*/raw-captures/**','desktop/evidence/docs-activity-native/**')));
});
