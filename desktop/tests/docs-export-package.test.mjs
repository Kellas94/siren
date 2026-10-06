import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {buildInventory} from '../scripts/inventory.mjs';
import {collectApplicationInputs} from '../scripts/package.mjs';
test('document export parser is shipped with exact existing runtime versions and actual license notices',async()=>{
 const root=resolve('.'),inventory=await buildInventory({desktopRoot:root,electronRoot:resolve('node_modules/electron/dist')});
 const parser=inventory.npm.find(p=>p.name==='parse5'),entities=inventory.npm.find(p=>p.name==='entities');
 assert.equal(parser?.version,'8.0.1');assert.equal(parser.license,'MIT');assert.match(parser.noticeSha256,/^[a-f0-9]{64}$/);
 assert.equal(entities?.version,'8.1.0');assert.equal(entities.license,'BSD-2-Clause');assert.match(entities.noticeSha256,/^[a-f0-9]{64}$/);
 const paths=await collectApplicationInputs(root,new Set(inventory.npm.map(p=>p.name)));
 for(const name of ['src/documents/export.mjs','src/windows/docs-export.mjs','node_modules/parse5/dist/index.js','node_modules/entities/dist/index.js',parser.notice,entities.notice])assert.ok(paths.includes(name),name);
 assert.equal(paths.some(path=>/parse5.*\.d\.ts$/.test(path)),false);
});
