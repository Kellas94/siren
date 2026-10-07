import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from './fixtures/temporary.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { Script } from 'node:vm';
import { buildImportValidation } from '../build/import-validation.mjs';
import { validateImportedProject } from '../src/projects/import-validation.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
test('headless import build retains frozen validator/signoff and stops before workspace initialization',async()=>{
  const root=await mkdtemp(join(tmpdir(),'siren-headless-build-'));
  const before=await readFile('baseline/R78.html');
  const receipt=await buildImportValidation({baselinePath:'baseline/R78.html',outputDir:root});
  const html=await readFile(join(root,'import-validation.html'),'utf8');
  assert.equal(receipt.baselineSha256,digest(before));assert.equal(receipt.entrySha256,digest(Buffer.from(html)));
  assert.deepEqual(await readFile('baseline/R78.html'),before);
  assert.deepEqual(await buildImportValidation({baselinePath:'baseline/R78.html',outputDir:root}),receipt);
  assert.match(html,/await validatePortableProjectForImport\(payload, fileName\)/);
  assert.match(html,/stampWorkpaperFileSignoff\(doc, workpaperProjectReviewInput.get\(doc\)\)/);
  assert.match(html,/sirenImportValidationReady = true;\s*return;\s*sirenStore.start\(\)/);
  assert.match(html,/connect-src 'none'/);assert.equal(html.includes('window.sirenDesktopBootstrap'),false);
  const scripts=[];const visit=node=>{if(node.tagName==='script')scripts.push(node);for(const child of node.childNodes||[])visit(child);};visit(parse(html));
  for(const node of scripts){assert.equal(node.attrs.some(attr=>attr.name==='src'),false);const text=node.childNodes.map(child=>child.value||'').join('');new Script(text);assert.ok(html.includes("'sha256-"+createHash('sha256').update(text).digest('base64')+"'"));}
});

test('unrecognized baseline cannot overwrite an existing validator entry',async()=>{
  const root=await mkdtemp(join(tmpdir(),'siren-headless-refusal-'));const path=join(root,'import-validation.html'),bad=join(root,'baseline.html');
  await writeFile(path,'preserved existing entry');await writeFile(bad,'not frozen');
  await assert.rejects(buildImportValidation({baselinePath:bad,outputDir:root}));assert.equal(await readFile(path,'utf8'),'preserved existing entry');
});

test('native import copies chosen bytes and disposes its isolated validator on success and failure',async()=>{
  for(const fail of [false,true]) {
    let disposed=false,seen;
    const bytes=Buffer.from('{"type":"siren-project","state":{"diagrams":[]}}'),original=Buffer.from(bytes);
    const createValidator=async()=>{bytes.fill(0);return {validate:async(text,fileName)=>{seen={text,fileName};if(fail)throw Error('Private internal failure');return text;},dispose:async()=>{disposed=true;}};};
    const operation=validateImportedProject({bytes,fileName:'selected.siren'},{createValidator,isCurrent:()=>true});
    if(fail)await assert.rejects(operation,{code:'IMPORT_INVALID'});else assert.equal(await operation,original.toString('utf8'));
    assert.equal(seen.text,original.toString('utf8'));assert.equal(seen.fileName,'selected.siren');assert.equal(disposed,true);
  }
});

test('native import refuses invalid UTF8 paths oversize or stale access before validator admission',async()=>{
  let created=0;const options={createValidator:async()=>{created++;throw Error('Unexpected validator');},isCurrent:()=>true};
  for(const input of [{bytes:Buffer.from([0xc3,0x28]),fileName:'bad.siren'},{bytes:Buffer.from('{}'),fileName:'C:\\private\\file.siren'},{bytes:Buffer.alloc(64*1024*1024+1),fileName:'big.siren'},{bytes:Buffer.from('{}'),fileName:'../file.siren'}])await assert.rejects(validateImportedProject(input,options));
  await assert.rejects(validateImportedProject({bytes:Buffer.from('{}'),fileName:'chosen.siren'},{...options,isCurrent:()=>false}),{code:'ACCESS_REFUSED'});assert.equal(created,0);
});

test('Lock during validation refuses publication and failed disposal never reports a valid import',async()=>{
  let current=true,disposed=false;
  await assert.rejects(validateImportedProject({bytes:Buffer.from('{}'),fileName:'chosen.siren'},{isCurrent:()=>current,createValidator:async()=>({validate:async()=>{current=false;return '{}';},dispose:async()=>{disposed=true;}})}),{code:'ACCESS_REFUSED'});assert.equal(disposed,true);
  await assert.rejects(validateImportedProject({bytes:Buffer.from('{}'),fileName:'chosen.siren'},{isCurrent:()=>true,createValidator:async()=>({validate:async()=> '{}',dispose:async()=>{throw Error('Still running');}})}),{code:'IMPORT_DISPOSAL_FAILED'});
});
