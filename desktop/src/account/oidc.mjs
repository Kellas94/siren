import * as client from 'openid-client';
import { createServer } from 'node:http';

export const CALLBACK_TIMEOUT_MS = 180000;
export class OidcLogin {
  constructor({ issuer, clientId, openBrowser }) { this.issuer = issuer; this.clientId = clientId; this.openBrowser = openBrowser; this.running = false; }
  validateIssuer() {
    const issuer = new URL(this.issuer);
    if (issuer.protocol !== 'https:' || issuer.username || issuer.password || !this.clientId || typeof this.openBrowser !== 'function') throw new Error('HTTPS login configuration required');
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('HTTPS verification cannot be disabled');
    return issuer;
  }
  discoveryOptions() { return { execute: [client.enableNonRepudiationChecks] }; }
  async discover(issuer) {
    const limitedFetch = async (url, options) => {
      const destination = new URL(url);
      if (destination.origin !== issuer.origin) throw new Error('Login endpoint origin refused');
      const response = await fetch(url, { ...options, redirect: 'error', signal: options?.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
      const reader = response.body?.getReader(); const chunks = []; let size = 0;
      if (reader) for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1024 * 1024) { await reader.cancel(); throw new Error('Login response too large'); } chunks.push(value); }
      return new Response(Buffer.concat(chunks), { status: response.status, headers: response.headers });
    };
    const options = { ...this.discoveryOptions(), timeout: 15, [client.customFetch]: limitedFetch };
    const configuration = await client.discovery(issuer, this.clientId, { token_endpoint_auth_method: 'none' }, client.None(), options);
    configuration[client.customFetch] = limitedFetch;
    const metadata = configuration.serverMetadata();
    for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) if (!metadata[key] || new URL(metadata[key]).origin !== issuer.origin) throw new Error('Login endpoint configuration refused');
    return configuration;
  }
  async beginLogin() {
    if (this.running) throw new Error('Login already in progress');
    const issuer = this.validateIssuer(); this.running = true;
    let listener; let timer;
    try {
      const config = await this.discover(issuer);
      const state = client.randomState(); const nonce = client.randomNonce();
      const verifier = client.randomPKCECodeVerifier(); const challenge = await client.calculatePKCECodeChallenge(verifier);
      let resolveCallback; let rejectCallback; let consumed = false; let redirect;
      const callback = new Promise((resolve, reject) => { resolveCallback = resolve; rejectCallback = reject; });
      callback.catch(() => {}); // Callback rejection may precede openBrowser's resolution.
      listener = createServer((req, res) => {
        if (consumed || req.method !== 'GET' || typeof req.url !== 'string' || req.url.length > 8192 || req.headers.host !== new URL(redirect).host) { res.writeHead(400); res.end('Login request refused'); return; }
        const url = new URL(req.url, redirect);
        if (url.pathname !== '/callback' || url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length > 1 || url.searchParams.get('state') !== state) {
          consumed = true; res.writeHead(400); res.end('Login request refused'); rejectCallback(new Error('Authorization state refused')); return;
        }
        consumed = true; res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }); res.end('Return to SIREN to see the login result.'); resolveCallback(url);
      });
      await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
      redirect = `http://127.0.0.1:${listener.address().port}/callback`;
      timer = setTimeout(() => { consumed = true; rejectCallback(new Error('Login callback timeout after 180 seconds')); }, CALLBACK_TIMEOUT_MS);
      const url = client.buildAuthorizationUrl(config, { response_type: 'code', redirect_uri: redirect, scope: 'openid profile', state, nonce, code_challenge: challenge, code_challenge_method: 'S256' });
      await this.openBrowser(url.href);
      const response = await callback;
      const tokens = await client.authorizationCodeGrant(config, response, { pkceCodeVerifier: verifier, expectedState: state, expectedNonce: nonce, idTokenExpected: true });
      const claims = tokens.claims();
      if (!claims?.sub || !tokens.access_token) throw new Error('Login identity unavailable');
      // Private main-process result. Account service returns only AccessState through IPC.
      return { claims, accessToken: tokens.access_token, refreshToken: tokens.refresh_token || null };
    } catch (error) { if (/timeout/i.test(error.message)) throw new Error('Login callback timeout after 180 seconds'); throw new Error('Login or authorization failed'); }
    finally {
      clearTimeout(timer);
      if (listener) { listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve)); }
      this.running = false;
    }
  }
}
