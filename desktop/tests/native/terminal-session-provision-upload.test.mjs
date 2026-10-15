import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {posix} from 'node:path';
test('provision artifact retains all source, inspector and dependency inputs',()=>{
 const workflow=readFileSync(new URL('../../../.github/workflows/terminal-session-provision.yml',import.meta.url),'utf8');
 const inputs=JSON.parse(readFileSync(new URL('./terminal-session-provision-inputs.json',import.meta.url),'utf8')).inputs;
 const block=workflow.match(/^          path: \|\r?\n((?:            .+\r?\n?)+)/m);assert.ok(block);
 const patterns=block[1].split(/\r?\n/).map(line=>line.trim()).filter(Boolean),missing=inputs.map(row=>row.path).filter(path=>!patterns.some(pattern=>posix.matchesGlob(path,pattern)));
 assert.deepEqual(missing,[],`Missing input sources: ${missing.join(', ')}`);
});
