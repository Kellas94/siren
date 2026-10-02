import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

test('package source allowlist refuses credentials, tests, development issuer, original source baseline and source maps', async () => {
  const { allowedAppFile } = await import('../scripts/package.mjs');
  for (const path of ['src/main.mjs', 'src/account/oidc.mjs', 'src/account/credentials.mjs', 'src/recovery/checkpoints.mjs', 'generated/app.html', 'node_modules/jose/dist/webapi/index.js', 'node_modules/jose/LICENSE.md']) assert.equal(allowedAppFile(path, new Set(['jose'])), true, path);
  for (const path of ['src/account/test-oidc.mjs', 'tests/fixtures/issuer.mjs', 'baseline/R78.html', 'Data/credentials.bin', '.env', 'node_modules/jose/dist/index.js.map', 'node_modules/electron/dist/electron.exe', 'source/secret.mjs', 'src/account/secret.mjs', 'src/../account/secret.mjs']) assert.equal(allowedAppFile(path, new Set(['jose'])), false, path);
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
