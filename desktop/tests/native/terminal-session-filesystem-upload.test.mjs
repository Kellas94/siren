import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {posix} from 'node:path';

test('hosted filesystem artifact retains every declared source input', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/terminal-session-filesystem.yml', import.meta.url), 'utf8');
  const inputs = JSON.parse(readFileSync(new URL('./terminal-session-filesystem-inputs.json', import.meta.url), 'utf8')).inputs;
  const block = workflow.match(/^          path: \|\r?\n((?:            .+\r?\n?)+)/m);
  assert.ok(block, 'fixed artifact path block must exist');
  const patterns = block[1].split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const missing = inputs.map(row => row.path).filter(path => !patterns.some(pattern => posix.matchesGlob(path, pattern)));
  assert.deepEqual(missing, [], `Declared sources missing from upload: ${missing.join(', ')}`);
});
