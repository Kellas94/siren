import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AccountService } from '../src/account/service.mjs';
import { CredentialStore } from '../src/account/credentials.mjs';

const now = Date.parse('2026-10-02T12:00:00.000Z');
async function fixture(sub = 'account-A') {
  const pair = await generateKeyPair('EdDSA', { extractable: true });
  const signedPermit = await new SignJWT({ product: 'siren', installationId: 'installation-A' }).setSubject(sub).setIssuer('https://issuer.example').setAudience('siren-desktop-activation').setProtectedHeader({ alg: 'EdDSA', kid: 'root1' }).setIssuedAt(now / 1000).setExpirationTime(now / 1000 + 30 * 86400).sign(pair.privateKey);
  return { signedPermit, config: { issuer: 'https://issuer.example', clientId: 'siren-desktop', entitlementEndpoint: 'https://issuer.example/permit', permitIssuer: 'https://issuer.example', permitKeys: { root1: await exportJWK(pair.publicKey) } } };
}
test('main service revalidates account binding, expiry, started-work permission and logout without browser/token exposure', async () => {
  const { signedPermit, config } = await fixture(); const dir = await mkdtemp(join(tmpdir(), 'siren-account-service-'));
  const credentials = new CredentialStore(dir, { isEncryptionAvailable: () => false });
  await credentials.write({ accountId: 'account-A', installationId: 'installation-A', signedPermit, refreshToken: 'PRIVATE_REFRESH_FIXTURE', lastSeenTime: now });
  let current = now; const service = new AccountService({ config, credentials, now: () => current, openBrowser: async () => { throw new Error('offline test must not open browser'); } });
  assert.equal((await service.getAccess()).state, 'offline'); service.policy.opened('owned-A');
  assert.equal(await service.canPerform({ action: 'workspace', projectId: 'owned-A', owned: true }), true);
  current = now + 30 * 86400000;
  const expired = await service.getAccess(); assert.equal(expired.recoveryOnly, true); assert.equal(JSON.stringify(expired).includes('PRIVATE_REFRESH_FIXTURE'), false);
  assert.equal(await service.canPerform({ action: 'create' }), false);
  assert.equal(await service.canPerform({ action: 'workspace', projectId: 'owned-A', owned: true }), true);
  assert.equal(await service.canPerform({ action: 'workspace', projectId: 'new-B', owned: true }), false);
  await service.logout(); assert.equal(await credentials.read(), null); assert.equal(await service.canPerform({ action: 'workspace', projectId: 'owned-A', owned: true }), false);
  assert.equal(await service.canPerform({ action: 'export', projectId: 'owned-A', owned: true }), true);
  await credentials.write({ accountId: 'account-B', installationId: 'installation-A', signedPermit, lastSeenTime: now }); current = now;
  assert.equal((await service.getAccess()).recoveryOnly, true, 'An account cannot borrow another account signed activation');
});

test('failed protected persistence does not secretly activate memory credentials after reporting login failure', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'siren-credentials-failure-')); await writeFile(join(dir, 'Account'), 'not a directory');
  const credentials = new CredentialStore(dir, { isEncryptionAvailable: () => true, encryptString: () => Buffer.from('ciphertext'), decryptString: () => 'unused' });
  await assert.rejects(credentials.write({ signedPermit: 'SHOULD_NOT_ACTIVATE' }));
  assert.equal(await credentials.read(), null);
  assert.equal(await readFile(join(dir, 'Account'), 'utf8'), 'not a directory');
});

test('unconfigured production login returns a precise unavailable result and does not open a system browser', async () => {
  const { config } = await fixture(); let opened = false;
  const service = new AccountService({ config: { ...config, issuer: null }, credentials: { read: async () => null }, openBrowser: async () => { opened = true; } });
  assert.equal((await service.beginLogin()).code, 'ACCOUNT_NOT_CONFIGURED'); assert.equal(opened, false);
  assert.equal((await service.getAccess()).state, 'unactivated');
});
