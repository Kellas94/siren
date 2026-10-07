import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const config = { repository: 'publisher/siren-binaries', channel: 'stable', trustedKeys: { root1: publicKey.export({ type: 'spki', format: 'pem' }) }, maxPackageBytes: 2 * 1024 ** 3 };
const now = Date.parse('2026-10-02T12:00:00.000Z');
const manifest = () => ({ schema: 1, product: 'siren', channel: 'stable', version: '1.132.0', platform: 'win32', arch: 'x64', dataSchema: 1, sequence: 7, expiresAt: '2026-10-09T12:00:00.000Z', minAllowedVersion: '1.131.0', keyId: 'root1', asset: { name: 'SIREN-1.132.0-windows-x64.zip', bytes: 300, sha256: 'a'.repeat(64) }, files: [{ path: 'SIREN.exe', bytes: 100, sha256: 'b'.repeat(64) }, { path: 'resources/app.asar', bytes: 200, sha256: 'c'.repeat(64) }] });
const signed = value => { const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)); return { bytes, signature: sign(null, bytes, privateKey) }; };
const verify = async (value, extra = {}) => (await import('../src/updates/manifest.mjs')).verifyManifest({ ...signed(value), config, currentVersion: '1.131.0', now, ...extra });

test('publisher signature verifies exact bytes; changed bytes, signature reuse and unknown key fail', async () => {
  const { verifyManifest } = await import('../src/updates/manifest.mjs');
  const input = signed(JSON.stringify(manifest(), null, 2));
  const accepted = verifyManifest({ ...input, config, currentVersion: '1.131.0', now });
  assert.equal(accepted.manifest.version, '1.132.0');
  assert.equal(accepted.manifestSha256, createHash('sha256').update(input.bytes).digest('hex'));
  assert.throws(() => verifyManifest({ ...input, bytes: Buffer.from(JSON.stringify(manifest())), config, currentVersion: '1.131.0', now }), /signature/i);
  assert.throws(() => verifyManifest({ ...input, signature: Buffer.alloc(64), config, currentVersion: '1.131.0', now }), /signature/i);
  const unknown = manifest(); unknown.keyId = 'untrusted'; await assert.rejects(verify(unknown), /key/i);
});

test('authenticated but unsafe metadata fails independently of a valid publisher signature', async t => {
  const cases = {
    expired: m => { m.expiresAt = '2026-10-02T12:00:00.000Z'; },
    product: m => { m.product = 'another'; }, arch: m => { m.arch = 'arm64'; }, channel: m => { m.channel = 'beta'; }, schema: m => { m.dataSchema = 2; },
    semver: m => { m.version = '01.132.0'; }, prerelease: m => { m.version = '1.132.0-beta'; }, overflow: m => { m.asset.bytes = Number.MAX_SAFE_INTEGER; },
    extractedOverflow: m => { m.files[0].bytes = 2 * 1024 ** 3; },
    duplicate: m => { m.files.push({ ...m.files[0] }); }, caseCollision: m => { m.files.push({ ...m.files[0], path: 'siren.EXE' }); }, prefixCollision: m => { m.files.push({ ...m.files[0], path: 'SIREN.exe/nested' }); },
    traversal: m => { m.files[1].path = 'resources/../secret'; }, reserved: m => { m.files[1].path = 'resources/CON.txt'; }, ADS: m => { m.files[1].path = 'resources/file:stream'; }, trailingDot: m => { m.files[1].path = 'resources/file.'; }, userData: m => { m.files[1].path = 'Data/credentials.bin'; },
    assetMismatch: m => { m.asset.name = 'arbitrary.zip'; }, floorAboveRelease: m => { m.minAllowedVersion = '2.0.0'; },
  };
  for (const [name, mutate] of Object.entries(cases)) await t.test(name, async () => { const value = manifest(); mutate(value); await assert.rejects(verify(value)); });
  await assert.rejects(verify(manifest(), { lastSequence: { sequence: 8, manifestSha256: 'd'.repeat(64), minAllowedVersion: '1.131.0' } }), /sequence/i);
  await assert.rejects(verify(manifest(), { lastSequence: { sequence: 7, manifestSha256: 'd'.repeat(64), minAllowedVersion: '1.131.0' } }), /sequence/i);
  await assert.rejects(verify(manifest(), { lastSequence: { sequence: 6, manifestSha256: 'd'.repeat(64), minAllowedVersion: '1.133.0' } }), /minimum/i);
});

test('duplicate JSON fields, comments, trailing commas and invalid UTF-8 are rejected before use', async () => {
  const { verifyManifest } = await import('../src/updates/manifest.mjs');
  for (const raw of [JSON.stringify(manifest()).replace('"schema":1', '"schema":1,"schema":1'), JSON.stringify(manifest()).replace('"schema":1', '"schema":1/*comment*/'), JSON.stringify(manifest()).replace('"schema":1', '"schema":1,'), JSON.stringify(manifest()).replace('"version":"1.132.0"', '"version":"1.132.0","version":"1.132.0"')]) await assert.rejects(verify(raw), /JSON|duplicate/i);
  const invalid = Buffer.concat([Buffer.from(JSON.stringify(manifest())), Buffer.from([0xff])]);
  assert.throws(() => verifyManifest({ bytes: invalid, signature: sign(null, invalid, privateKey), config, currentVersion: '1.131.0', now }), /UTF|encoding/i);
});
