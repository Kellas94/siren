import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestIssuer } from './fixtures/oidc-issuer.mjs';

async function browser(url, mutate = null) {
  const response = await fetch(url, { redirect: 'manual' });
  const callback = new URL(response.headers.get('location'));
  if (mutate) mutate(callback);
  await fetch(callback);
  return callback;
}

test('controlled real HTTP issuer enforces PKCE S256 and one-use callback/code; tokens stay in main-side result', async () => {
  const { createTestOidcLogin } = await import('../src/account/test-oidc.mjs');
  const issuer = await startTestIssuer(); let callback;
  try {
    const login = createTestOidcLogin({ issuer: issuer.issuer, clientId: 'test-siren-client', openBrowser: async url => { callback = await browser(url); } });
    const result = await login.beginLogin();
    assert.equal(result.claims.sub, 'test-account'); assert.equal(result.accessToken, 'TEST_ACCESS_TOKEN');
    assert.equal(issuer.requests[0].code_challenge_method, 'S256'); assert.equal(issuer.requests[0].code_challenge.length, 43);
    await assert.rejects(fetch(callback, { signal: AbortSignal.timeout(2000) }));
  } finally { await issuer.close(); }
});

test('state/nonce/audience/signature mismatch and denied consent cannot become a logged-in result', async () => {
  const { createTestOidcLogin } = await import('../src/account/test-oidc.mjs');
  for (const options of [{ mutate: u => u.searchParams.set('state', 'wrong') }, { nonce: 'wrong' }, { audience: 'wrong' }, { signature: 'wrong' }, { denied: true }]) {
    const issuer = await startTestIssuer(options);
    try {
      const login = createTestOidcLogin({ issuer: issuer.issuer, clientId: 'test-siren-client', openBrowser: url => browser(url, options.mutate) });
      await assert.rejects(login.beginLogin(), /login|authorization/i);
    } finally { await issuer.close(); }
  }
});

test('production login refuses insecure issuer configuration and does not open a browser', async () => {
  const { OidcLogin } = await import('../src/account/oidc.mjs');
  let opened = false;
  const login = new OidcLogin({ issuer: 'http://127.0.0.1:1234', clientId: 'siren-client', openBrowser: async () => { opened = true; } });
  await assert.rejects(login.beginLogin(), /HTTPS|configuration/i); assert.equal(opened, false);
});

test('the actual 180-second callback deadline closes the owned listener without granting login', { timeout: 200000 }, async () => {
  const { createTestOidcLogin } = await import('../src/account/test-oidc.mjs');
  const issuer = await startTestIssuer(); let redirect;
  try {
    const login = createTestOidcLogin({ issuer: issuer.issuer, clientId: 'test-siren-client', openBrowser: async url => { redirect = new URL(url).searchParams.get('redirect_uri'); } });
    const started = Date.now(); await assert.rejects(login.beginLogin(), /timeout/i);
    assert.ok(Date.now() - started >= 180000);
    await assert.rejects(fetch(redirect, { signal: AbortSignal.timeout(2000) }));
  } finally { await issuer.close(); }
});
