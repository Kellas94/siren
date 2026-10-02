import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('package source allowlist refuses credentials, tests, development issuer, original source baseline and source maps', async () => {
  const { allowedAppFile } = await import('../scripts/package.mjs');
  for (const path of ['src/main.mjs', 'src/account/oidc.mjs', 'src/account/credentials.mjs', 'src/recovery/checkpoints.mjs', 'generated/app.html', 'node_modules/jose/dist/webapi/index.js', 'node_modules/jose/LICENSE.md']) assert.equal(allowedAppFile(path, new Set(['jose'])), true, path);
  for (const path of ['src/account/test-oidc.mjs', 'tests/fixtures/issuer.mjs', 'baseline/R78.html', 'Data/credentials.bin', '.env', 'node_modules/jose/dist/index.js.map', 'node_modules/electron/dist/electron.exe', 'source/secret.mjs', 'src/account/secret.mjs', 'src/../account/secret.mjs']) assert.equal(allowedAppFile(path, new Set(['jose'])), false, path);
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
