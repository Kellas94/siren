import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

test('staged application includes the actual cold Home entry and every finite generated destination', async () => {
  const {collectApplicationInputs} = await import('../scripts/package.mjs');
  const root = await mkdtemp(join(tmpdir(), 'siren-package-entry-'));
  await mkdir(join(root, 'src'));
  const inputs = await collectApplicationInputs(root, new Set());
  for (const entry of ['generated/home.html', 'generated/app.html', 'generated/import-validation.html', 'generated/windows/code.html', 'generated/windows/docs.html','generated/code-analysis-worker.cjs','generated/diagram-vector.html']) assert.ok(inputs.includes(entry), 'Cannot boot or navigate the packaged application without ' + entry);
});

test('package source allowlist refuses credentials, tests, development issuer, original source baseline and source maps', async () => {
  const { allowedAppFile } = await import('../scripts/package.mjs');
  for (const path of ['src/main.mjs', 'src/account/oidc.mjs', 'src/account/credentials.mjs', 'src/projects/budgets.mjs', 'src/recovery/checkpoints.mjs', 'src/sources/manifest.mjs', 'src/sources/recovery.mjs', 'src/sources/repository.mjs', 'src/sources/metrics.mjs', 'src/sources/text-model.mjs', 'src/sources/migration.mjs', 'generated/app.html', 'node_modules/jose/dist/webapi/index.js', 'node_modules/jose/LICENSE.md']) assert.equal(allowedAppFile(path, new Set(['jose'])), true, path);
  for (const path of ['src/account/test-oidc.mjs', 'tests/fixtures/issuer.mjs', 'baseline/R78.html', 'Data/credentials.bin', '.env', 'node_modules/jose/dist/index.js.map', 'node_modules/electron/dist/electron.exe', 'source/secret.mjs', 'src/account/secret.mjs', 'src/../account/secret.mjs']) assert.equal(allowedAppFile(path, new Set(['jose'])), false, path);
});

test('every relative native module reachable from main is admitted by the package allowlist',async()=>{
  const {allowedAppFile}=await import('../scripts/package.mjs');
  const root=new URL('../',import.meta.url),seen=new Set();
  async function visit(url){
    const path=fileURLToPath(url).slice(fileURLToPath(root).length).replaceAll('\\','/');
    if(seen.has(path))return;seen.add(path);
    assert.equal(allowedAppFile(path,new Set()),true,'Required native dependency omitted: '+path);
    const text=await readFile(url,'utf8');
    for(const match of text.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)['"](\.[^'"]+)['"]/g))await visit(new URL(match[1],url));
  }
  await visit(new URL('../src/main.mjs',import.meta.url));
  assert.ok(seen.has('src/sources/readers.mjs'));
});

test('supplemental notices resolve only their exact runtime reference and verified bytes', async () => {
  const { buildInventory } = await import('../scripts/inventory.mjs');
  const root = await mkdtemp(join(tmpdir(), 'siren-supplement-'));
  const license = 'Controlled complete license text for an owned inventory test fixture.';
  const runtime = '<div class="product"><div class="title">better_any</div><div class="license">../LICENCE-Apache</div></div>';
  const hash = text => createHash('sha256').update(text).digest('hex');
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({ packages: { '': {} } }));
  await writeFile(join(root, 'LICENSE'), 'Electron MIT license'); await writeFile(join(root, 'version'), '44.5.1');
  await writeFile(join(root, 'LICENSES.chromium.html'), runtime); await mkdir(join(root, 'licenses'));
  await writeFile(join(root, 'licenses', 'better_any.txt'), license);
  const provenance = { schema: 1, electronVersion: '44.5.1', chromiumNoticeSha256: hash(runtime), notices: [{ name: 'better_any', reference: '../LICENCE-Apache', version: '0.2.1', revision: '6'.repeat(40), source: 'https://github.com/rrevenantt/better_any/blob/' + '6'.repeat(40) + '/LICENCE-Apache', file: 'better_any.txt', sha256: hash(license) }] };
  await writeFile(join(root, 'licenses', 'provenance.json'), JSON.stringify(provenance));
  const inventory = await buildInventory({ desktopRoot: root, electronRoot: root });
  assert.deepEqual(inventory.chromium.unresolvedNotices, []);
  assert.equal(inventory.chromium.supplementalNotices[0].sha256, hash(license));
  assert.equal(inventory.chromium.components[0].noticeKind, 'supplemental-text');
  assert.equal(inventory.releaseQualified, false, 'One resolved notice cannot grant release admission');
  const contaminated = structuredClone(provenance);
  contaminated.notices[0].privateCredential = 'TEST_SECRET_NOT_ALLOWED_IN_INVENTORY';
  await writeFile(join(root, 'licenses', 'provenance.json'), JSON.stringify(contaminated));
  await assert.rejects(buildInventory({ desktopRoot: root, electronRoot: root }), /supplement/i);
  await writeFile(join(root, 'licenses', 'provenance.json'), JSON.stringify(provenance));
  await writeFile(join(root, 'licenses', 'better_any.txt'), license + 'changed');
  await assert.rejects(buildInventory({ desktopRoot: root, electronRoot: root }), /supplement/i);
  await writeFile(join(root, 'licenses', 'better_any.txt'), license);
  provenance.chromiumNoticeSha256 = '0'.repeat(64);
  await writeFile(join(root, 'licenses', 'provenance.json'), JSON.stringify(provenance));
  await assert.rejects(buildInventory({ desktopRoot: root, electronRoot: root }), /runtime|supplement/i);
});

test('runtime inventory requires known production dependency licenses and all Chromium component notices', async () => {
  const { buildInventory } = await import('../scripts/inventory.mjs');
  const root = await mkdtemp(join(tmpdir(), 'siren-inventory-')); await mkdir(join(root, 'node_modules')); await mkdir(join(root, 'node_modules', 'sample'));
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({ packages: { '': {}, 'node_modules/sample': { version: '1.0.0', license: 'MIT' } } }));
  await writeFile(join(root, 'node_modules', 'sample', 'package.json'), '{"name":"sample","version":"1.0.0","license":"MIT"}');
  await assert.rejects(buildInventory({ desktopRoot: root, electronRoot: root }), /notice|license/i);
});

test('inventory preserves unresolved upstream license references without claiming distribution admission', async () => {
  const { buildInventory } = await import('../scripts/inventory.mjs');
  const root = await mkdtemp(join(tmpdir(), 'siren-license-reference-'));
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({ packages: { '': {} } }));
  await writeFile(join(root, 'LICENSE'), 'Electron MIT license'); await writeFile(join(root, 'version'), '44.5.1');
  const notice = '<div class="product"><div class="title">better_any</div><div class="license">../LICENCE-Apache</div></div>';
  await writeFile(join(root, 'LICENSES.chromium.html'), notice);
  const inventory = await buildInventory({ desktopRoot: root, electronRoot: root });
  assert.equal(inventory.releaseQualified, false);
  assert.equal(inventory.chromium.components[0].noticeKind, 'unresolved-reference');
  assert.deepEqual(inventory.chromium.unresolvedNotices, [{ name: 'better_any', reference: '../LICENCE-Apache', noticeIndex: 0 }]);
  await writeFile(join(root, 'LICENSES.chromium.html'), notice.replace('../LICENCE-Apache', ''));
  await assert.rejects(buildInventory({ desktopRoot: root, electronRoot: root }), /notice missing/);
});
