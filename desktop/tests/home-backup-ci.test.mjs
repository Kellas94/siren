import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
function verify(text){
 const native=text.slice(text.indexOf('  native_windows:'),text.indexOf('  packaged_windows:'));
 const command='run: node tests/native/home-backup-export.mjs';
 assert.equal(native.split(command).length-1,1,'Run Home backup once in development, without unsupported package arguments');
 assert.match(native,/name: Actual Home saved-backup export\n\s+if: matrix\.group == 'desktop'\n\s+run: node tests\/native\/home-backup-export\.mjs\n/);
 const blocks=native.split(/(?=^      - )/m);
 const own=blocks.filter(block=>block.split('\n').some(line=>line.trim()==='name: desktop-native-${{ matrix.group }}-evidence'));
 assert.equal(own.length,1);assert.match(own[0],/if: always\(\)/);
 const lines=own[0].split('\n').map(line=>line.trim()).filter(line=>line.startsWith('desktop/evidence/home-backup-export-native/'));
 assert.deepEqual(lines,['desktop/evidence/home-backup-export-native/*/result.json'],'Retain bounded original receipt without owned profiles or exported source bundles');
}
test('Home native regression runs once and retains its nested receipt even on failure',()=>verify(workflow));
test('Home CI admission rejects missing retention, blanket profile capture and package mislabeling',()=>{
 assert.throws(()=>verify(workflow.replace('desktop/evidence/home-backup-export-native/*/result.json','desktop/evidence/home-backup-export-native/**')));
 assert.throws(()=>verify(workflow.replace('desktop/evidence/home-backup-export-native/*/result.json','')));
 assert.throws(()=>verify(workflow.replace('run: node tests/native/home-backup-export.mjs','run: node tests/native/home-backup-export.mjs --package $preview.previewRoot')));
});
