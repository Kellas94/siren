import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const evidence=resolve('evidence',`protected-storage-${new Date().toISOString().replaceAll(':','-')}`);await mkdir(evidence,{recursive:true});
const started=performance.now(),child = spawn(resolve('node_modules/electron/dist/electron.exe'), [resolve('tests/native/protected-storage-main.mjs'),'--siren-owned-probe='+evidence], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; let errors = '',timedOut=false;
child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { errors += bytes; });
const code = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { timedOut=true;child.kill(); }, 15000);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', code => { clearTimeout(timer); resolve(code); });
});
await writeFile(join(evidence,'electron.log'),output+'\n'+errors);
await writeFile(join(evidence,'launch.json'),JSON.stringify({ownedPid:child.pid,elapsedMs:performance.now()-started,deadlineMs:15000,exitCode:code,timedOut,phases:output.split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)).filter(result=>typeof result.phase==='string')},null,2));
if(timedOut){await writeFile(join(evidence,'result.json'),JSON.stringify({completed:false,scope:'Actual safeStorage/DPAPI probe exceeded its unchanged deadline; phase diagnostics only, no PASS.',error:'Owned protected-storage probe timeout',deadlineMs:15000},null,2));throw Error('Owned protected-storage probe timeout: '+evidence);}
assert.equal(code, 0, errors.slice(-2000));
const sentinel = output.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line)).find(result => result.completed === true);
assert.ok(sentinel, 'Empty successful GUI launch is not a completed test');
assert.equal(sentinel.evidence,evidence,'Only this actual owned probe may publish evidence');
const result = JSON.parse(await readFile(join(sentinel.evidence, 'result.json')));
assert.equal(result.completed, true); assert.equal(result.electron, '44.5.1'); assert.ok(result.ciphertextBytes > 0);
console.log(JSON.stringify(sentinel));
