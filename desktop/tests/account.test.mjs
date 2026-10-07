import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { readdir } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const issued = Date.parse('2026-10-02T12:00:00Z');
const seconds = value => Math.floor(value / 1000);
async function signed({ claims = {}, key, kid = 'test-key' } = {}) {
  const pair = key || await generateKeyPair('EdDSA', { extractable: true });
  const token = await new SignJWT({ product: 'siren', installationId: 'test-installation', ...claims }).setProtectedHeader({ alg: 'EdDSA', kid }).setIssuer('https://test-issuer.example').setAudience('siren-desktop-activation').setSubject('test-account').setIssuedAt(seconds(issued)).setExpirationTime(seconds(issued + 30 * 86400000)).sign(pair.privateKey);
  return { token, keys: { 'test-key': await exportJWK(pair.publicKey) }, pair };
}

test('signed offline activation lasts exactly 30 days and stops at the expiry boundary', async () => {
  const { verifyPermit } = await import('../src/account/permit.mjs');
  const fixture = await signed(); const input = { signedPermit: fixture.token, keys: fixture.keys, installationId: 'test-installation', issuer: 'https://test-issuer.example', lastSeenTime: issued };
  assert.equal((await verifyPermit({ ...input, now: Date.parse('2026-11-01T11:59:59Z') })).state, 'offline');
  const expired = await verifyPermit({ ...input, now: Date.parse('2026-11-01T12:00:00Z') });
  assert.equal(expired.state, 'reauth-required'); assert.equal(expired.recoveryOnly, true);
});

test('wrong signature, installation, key or product never grants activation; overlong permits are refused', async () => {
  const { verifyPermit } = await import('../src/account/permit.mjs');
  const fixture = await signed(); const base = { signedPermit: fixture.token, keys: fixture.keys, installationId: 'test-installation', issuer: 'https://test-issuer.example', now: issued + 1000, lastSeenTime: issued };
  const other = await signed();
  for (const input of [{ ...base, installationId: 'other-installation' }, { ...base, keys: other.keys }, { ...base, keys: {} }, { ...base, issuer: 'https://wrong-issuer.example' }, { ...base, signedPermit: fixture.token.slice(0, -5) + 'AAAAA' }]) assert.equal((await verifyPermit(input)).ok, false);
  const badProduct = await signed({ claims: { product: 'different' } });
  assert.equal((await verifyPermit({ ...base, signedPermit: badProduct.token, keys: badProduct.keys })).ok, false);
  const overlong = await new SignJWT({ product: 'siren', installationId: 'test-installation' }).setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' }).setIssuer(base.issuer).setAudience('siren-desktop-activation').setSubject('test-account').setIssuedAt(seconds(issued)).setExpirationTime(seconds(issued + 31 * 86400000)).sign(fixture.pair.privateKey);
  assert.equal((await verifyPermit({ ...base, signedPermit: overlong })).ok, false);
});

test('clock rollback beyond five minutes requires online revalidation while retaining owned-data recovery', async () => {
  const { verifyPermit } = await import('../src/account/permit.mjs');
  const fixture = await signed();
  const state = await verifyPermit({ signedPermit: fixture.token, keys: fixture.keys, installationId: 'test-installation', issuer: 'https://test-issuer.example', now: issued + 60000, lastSeenTime: issued + 7 * 60000 });
  assert.equal(state.state, 'reauth-required'); assert.equal(state.recoveryOnly, true);
  const { canPerform } = await import('../src/account/access.mjs');
  assert.equal(canPerform({ state, action: 'export', owned: true }), true);
  assert.equal(canPerform({ state, action: 'workspace', owned: true, startedBeforeExpiry: true }), true);
  assert.equal(canPerform({ state, action: 'workspace', owned: true, startedBeforeExpiry: false }), false);
  assert.equal(canPerform({ state, action: 'create', owned: true }), false);
});

test('unavailable OS-protected storage keeps credentials in memory and creates no plaintext file', async () => {
  const { CredentialStore } = await import('../src/account/credentials.mjs');
  const root = await mkdtemp(join(tmpdir(), 'siren-account-'));
  const storage = { isEncryptionAvailable: () => false };
  const credentials = new CredentialStore(root, storage);
  await credentials.write({ refreshToken: 'TEST_REFRESH_SECRET', signedPermit: 'TEST_PERMIT' });
  assert.equal((await credentials.read()).refreshToken, 'TEST_REFRESH_SECRET');
  assert.equal((await new CredentialStore(root, storage).read()), null);
  assert.deepEqual(await readdir(root), []);
  await credentials.clear(); assert.equal(await credentials.read(), null);
});
