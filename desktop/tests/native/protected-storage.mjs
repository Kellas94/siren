import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const child = spawn(resolve('node_modules/electron/dist/electron.exe'), [resolve('tests/native/protected-storage-main.mjs')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; let errors = '';
child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { errors += bytes; });
const code = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { child.kill(); reject(new Error('Owned protected-storage probe timeout')); }, 15000);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', code => { clearTimeout(timer); resolve(code); });
});
assert.equal(code, 0, errors.slice(-2000));
const sentinel = output.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line)).find(result => result.completed === true);
assert.ok(sentinel, 'Empty successful GUI launch is not a completed test');
const result = JSON.parse(await readFile(join(sentinel.evidence, 'result.json')));
assert.equal(result.completed, true); assert.equal(result.electron, '44.5.1'); assert.ok(result.ciphertextBytes > 0);
console.log(JSON.stringify(sentinel));
