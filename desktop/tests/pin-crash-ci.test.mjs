import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
test('actual first-session PIN crash regression gates development and copied-package qualification',()=>{
 const native=workflow.slice(workflow.indexOf('  native_windows:'),workflow.indexOf('  packaged_windows:'));
 assert.match(native,/name: Actual first-session PIN crash recovery\n\s+if: matrix\.group == 'desktop'\n\s+run: node tests\/native\/pin-crash-recovery\.mjs/);
 const packaged=workflow.slice(workflow.indexOf('  packaged_windows:'));
 const command='node tests/native/pin-crash-recovery.mjs --package $preview.previewRoot';
 assert.equal(packaged.split(command).length-1,1);
 assert.match(packaged,/node tests\/native\/pin-crash-recovery\.mjs --package \$preview\.previewRoot\n\s+if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged first-session PIN crash recovery failed" \}/);
 assert.ok(packaged.indexOf(command)<packaged.indexOf('node tests/native/shell.mjs --package'));
});

test('every original PIN crash receipt is retained without including protected profile data',()=>{
 const verify=text=>{
  const blocks=text.split(/(?=^      - )/m).map(block=>block.split(/(?=^  [A-Za-z_][A-Za-z0-9_-]*:)/m)[0]);
  for(const name of ['desktop-development-evidence','desktop-native-${{ matrix.group }}-evidence','desktop-packaged-evidence']){
   const own=blocks.filter(block=>block.split('\n').some(line=>line.trim()==='name: '+name));
   assert.equal(own.length,1);assert.match(own[0],/if: always\(\)/);
   const lines=own[0].split('\n').map(line=>line.trim()).filter(line=>line.startsWith('desktop/evidence/pin-crash-recovery/'));
   assert.deepEqual(lines,['desktop/evidence/pin-crash-recovery/*/result.json','desktop/evidence/pin-crash-recovery/*/*/result.json']);
  }
 };
 verify(workflow);
 const line='            desktop/evidence/pin-crash-recovery/*/result.json';
 const misplaced=workflow.replace(line+'\n','').replace(line,line+'\n'+line);
 assert.equal(misplaced.split(line).length-1,3);assert.throws(()=>verify(misplaced));
 assert.throws(()=>verify(workflow.replace(line,line+'\n            desktop/evidence/pin-crash-recovery/**')));
});
