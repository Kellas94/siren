import { createServer } from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { randomUUID, createHash } from 'node:crypto';

// Controlled test issuer only. No production users, keys, or service configuration.
export async function startTestIssuer({ nonce = 'correct', audience = 'correct', signature = 'correct', denied = false } = {}) {
  const pair = await generateKeyPair('RS256'); const different = await generateKeyPair('RS256');
  const jwk = await exportJWK(pair.publicKey); jwk.kid = 'test-rsa'; jwk.alg = 'RS256'; jwk.use = 'sig';
  const codes = new Map(); const requests = []; let issuer;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, issuer);
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (url.pathname === '/.well-known/openid-configuration') return json(200, { issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token', jwks_uri: issuer + '/jwks', response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'] });
    if (url.pathname === '/jwks') return json(200, { keys: [jwk] });
    if (url.pathname === '/authorize') {
      requests.push(Object.fromEntries(url.searchParams));
      if (url.searchParams.get('code_challenge_method') !== 'S256' || !url.searchParams.get('state') || !url.searchParams.get('nonce')) return json(400, { error: 'invalid_request' });
      const callback = new URL(url.searchParams.get('redirect_uri'));
      callback.searchParams.set('state', url.searchParams.get('state'));
      if (denied) callback.searchParams.set('error', 'access_denied');
      else {
        const code = randomUUID();
        codes.set(code, { challenge: url.searchParams.get('code_challenge'), nonce: url.searchParams.get('nonce'), clientId: url.searchParams.get('client_id'), redirect: callback.origin + callback.pathname });
        callback.searchParams.set('code', code);
      }
      res.writeHead(302, { location: callback.href }); return res.end();
    }
    if (url.pathname === '/token') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const form = new URLSearchParams(Buffer.concat(chunks).toString());
      const code = form.get('code'); const details = codes.get(code); codes.delete(code);
      if (!details || details.challenge !== createHash('sha256').update(form.get('code_verifier') || '').digest('base64url') || form.get('redirect_uri') !== details.redirect) return json(400, { error: 'invalid_grant' });
      const idToken = await new SignJWT({ nonce: nonce === 'correct' ? details.nonce : 'WRONG_NONCE' }).setProtectedHeader({ alg: 'RS256', kid: 'test-rsa' }).setIssuer(issuer).setAudience(audience === 'correct' ? details.clientId : 'wrong-client').setSubject('test-account').setIssuedAt().setExpirationTime('5m').sign(signature === 'correct' ? pair.privateKey : different.privateKey);
      return json(200, { token_type: 'Bearer', access_token: 'TEST_ACCESS_TOKEN', refresh_token: 'TEST_REFRESH_TOKEN', expires_in: 300, id_token: idToken });
    }
    json(404, { error: 'not_found' });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${server.address().port}`;
  return { issuer, requests, close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
