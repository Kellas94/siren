import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { writeFile, readFile } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
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

test('validated login waits for old-account persistence before replacing credentials and permissions', async () => {
  const { signedPermit, config } = await fixture('account-B');
  const root = await mkdtemp(join(tmpdir(), 'siren-account-switch-'));
  const credentials = new CredentialStore(root, { isEncryptionAvailable: () => false });
  await credentials.write({ installationId: 'installation-A', accountId: 'account-A', lastSeenTime: now });
  const service = new AccountService({ config, credentials, now: () => now, openBrowser: async () => {} });
  service.accountId = 'account-A'; service.policy.update({ state: 'online', recoveryOnly: false }); service.policy.opened('owned-A');
  service.login.beginLogin = async () => ({ accessToken: 'controlled-test-token', claims: { sub: 'account-B' } });
  service.entitlement = async () => signedPermit;
  const failed = await service.beginLogin({ beforeCommit: async () => { throw new Error('Old account disk save failed'); } });
  assert.equal(failed.ok, false); assert.equal((await credentials.read()).accountId, 'account-A');
  assert.equal(service.accountId, 'account-A'); assert.equal(service.policy.started.has('owned-A'), true);
  let release, reached;
  const entered = new Promise(resolve => { reached = resolve; });
  const operation = service.beginLogin({ beforeCommit: async () => { reached(); await new Promise(resolve => { release = resolve; }); } });
  await entered; assert.equal((await credentials.read()).accountId, 'account-A'); assert.equal(service.accountId, 'account-A');
  release(); assert.equal((await operation).state, 'online'); assert.equal((await credentials.read()).accountId, 'account-B');
  assert.equal(service.accountId, 'account-B'); assert.equal(service.policy.started.size, 0);
});

for (const transition of ['login', 'logout']) {
  test(`a delayed old-account timestamp write cannot undo ${transition}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'siren-account-cache-race-'));
    // A persisted owned test codec exercises real files, not DPAPI qualification.
    const codec = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from('TEST_CODEC:' + value), decryptString: bytes => bytes.toString('utf8').slice(11) };
    const credentials = new CredentialStore(root, codec);
    const pair = await generateKeyPair('EdDSA', { extractable: true });
    const config = { issuer: 'https://issuer.example', clientId: 'fixture', entitlementEndpoint: 'https://issuer.example/permit', permitIssuer: 'https://issuer.example', permitKeys: { root: await exportJWK(pair.publicKey) } };
    const permit = account => new SignJWT({ product: 'siren', installationId: 'installation' }).setSubject(account).setIssuer(config.issuer).setAudience('siren-desktop-activation').setProtectedHeader({ alg: 'EdDSA', kid: 'root' }).setIssuedAt(now / 1000).setExpirationTime(now / 1000 + 30 * 86400).sign(pair.privateKey);
    await credentials.write({ accountId: 'A', installationId: 'installation', signedPermit: await permit('A'), lastSeenTime: now });
    const service = new AccountService({ config, credentials, now: () => now, openBrowser: async () => {} });
    await service.getAccess(); service.lastPersist = 0;
    service.login.beginLogin = async () => ({ accessToken: 'CONTROLLED', claims: { sub: 'B' } });
    const permitB = await permit('B'); service.entitlement = async () => permitB;
    let entered, release; const reached = new Promise(resolve => { entered = resolve; });
    const actualWrite = credentials.write.bind(credentials);
    credentials.write = async record => { if (record.accountId === 'A') { entered(); await new Promise(resolve => { release = resolve; }); } return actualWrite(record); };
    const oldAccess = service.getAccess(); await reached;
    let completed = false;
    const operation = (transition === 'login' ? service.beginLogin() : service.logout()).then(result => { completed = true; return result; });
    // Drive enough of the controlled commit path to detect premature completion.
    await new Promise(resolve => setTimeout(resolve, 30));
    try { assert.equal(completed, false, 'Account transition waits for an already-started credential write'); }
    finally { release(); }
    await oldAccess; const result = await operation;
    const memory = await credentials.read(); const disk = await new CredentialStore(root, codec).read();
    assert.equal(memory?.accountId ?? null, transition === 'login' ? 'B' : null);
    assert.equal(disk?.accountId ?? null, transition === 'login' ? 'B' : null);
    assert.equal(result.state, transition === 'login' ? 'online' : 'unactivated');
    await service.getAccess(); assert.equal(service.accountId, transition === 'login' ? 'B' : null);
  });
}
