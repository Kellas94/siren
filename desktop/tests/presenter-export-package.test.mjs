import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedAppFile} from '../scripts/package.mjs';
test('finite application inventory admits real Presenter export modules, refusing similarly named test/draft files',()=>{
 for(const p of ['src/documents/presentation-notes.mjs','src/windows/presenter-export.mjs'])assert.equal(allowedAppFile(p,new Set()),true,p);
 for(const p of ['src/documents/presentation-notes.test.mjs','src/windows/presenter-export-draft.mjs','tests/presenter-export.test.mjs'])assert.equal(allowedAppFile(p,new Set()),false,p);
});
