import { randomUUID } from 'node:crypto';
import { OidcLogin } from './oidc.mjs';
import { verifyPermit } from './permit.mjs';
import { AccessPolicy } from './access.mjs';
import { failure } from '../ipc.mjs';

const unactivated = () => ({ state: 'unactivated', offlineUntil: null, recoveryOnly: true });
export class AccountService {
  constructor({ config, credentials, openBrowser, now = () => Date.now() }) {
    this.config = config; this.credentials = credentials; this.now = now; this.policy = new AccessPolicy(); this.accountId = null; this.lastPersist = 0;
    this.login = new OidcLogin({ issuer: config.issuer, clientId: config.clientId, openBrowser });
  }
  configured() { return !!(this.config.issuer && this.config.clientId && this.config.entitlementEndpoint && this.config.permitIssuer && Object.keys(this.config.permitKeys).length); }
  async getAccess() {
    if (!this.configured()) { this.policy.update(unactivated()); return this.policy.state; }
    const record = await this.credentials.read();
    if (!record?.signedPermit || !record.installationId || !record.accountId) { this.policy.update(unactivated()); return this.policy.state; }
    if (record.revoked) { this.policy.update({ state: 'revoked', offlineUntil: null, recoveryOnly: true }); return this.policy.state; }
    const verified = await verifyPermit({ signedPermit: record.signedPermit, keys: this.config.permitKeys, installationId: record.installationId, expectedAccount: record.accountId, issuer: this.config.permitIssuer, now: this.now(), lastSeenTime: record.lastSeenTime });
    const state = verified.ok === false ? { state: 'reauth-required', offlineUntil: null, recoveryOnly: true } : verified;
    this.policy.update(state); this.accountId = record.accountId;
    if (this.now() - this.lastPersist >= 60000) {
      record.lastSeenTime = Math.max(record.lastSeenTime || 0, this.now());
      try { await this.credentials.write(record); this.lastPersist = this.now(); } catch { /* protected cache failure never changes project data */ }
    }
    return state;
  }
  async entitlement({ accessToken, installationId }) {
    const url = new URL(this.config.entitlementEndpoint); const issuer = new URL(this.config.issuer);
    if (url.protocol !== 'https:' || url.origin !== issuer.origin || url.username || url.password || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('Entitlement HTTPS configuration refused');
    const response = await fetch(url, { method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ product: 'siren', installationId }), signal: AbortSignal.timeout(15000) });
    if (response.status === 403) throw Object.assign(new Error('Entitlement revoked'), { code: 'ENTITLEMENT_REVOKED' });
    if (!response.ok) throw new Error('Entitlement request failed');
    const chunks = []; let length = 0;
    for await (const chunk of response.body) { length += chunk.byteLength; if (length > 131072) throw new Error('Entitlement response too large'); chunks.push(chunk); }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof data.signedPermit !== 'string') throw new Error('No signed entitlement');
    return data.signedPermit;
  }
  async beginLogin() {
    if (!this.configured()) return failure('ACCOUNT_NOT_CONFIGURED', 'The production account service is not configured in this prototype');
    try {
      const login = await this.login.beginLogin();
      const previous = await this.credentials.read(); const installationId = previous?.installationId || randomUUID();
      const signedPermit = await this.entitlement({ accessToken: login.accessToken, installationId });
      const state = await verifyPermit({ signedPermit, keys: this.config.permitKeys, installationId, expectedAccount: login.claims.sub, issuer: this.config.permitIssuer, now: this.now(), lastSeenTime: this.now() });
      if (state.ok === false || state.recoveryOnly) return failure('ENTITLEMENT_INVALID', 'The server did not return a valid 30-day activation');
      const record = { installationId, accountId: login.claims.sub, signedPermit, refreshToken: login.refreshToken, lastSeenTime: this.now(), lastOnlineAt: this.now() };
      await this.credentials.write(record);
      this.accountId = record.accountId; this.policy.accountSwitch(); this.policy.update({ ...state, state: 'online' });
      return this.policy.state;
    } catch { return failure('LOGIN_FAILED', 'Login or activation did not complete; local projects remain available for recovery/export'); }
  }
  async canPerform({ action, projectId, owned }) {
    await this.getAccess(); return this.policy.canPerform({ action, projectId, owned });
  }
  async logout() {
    await this.credentials.clear(); this.accountId = null; this.policy.accountSwitch(); this.policy.update(unactivated()); return this.policy.state;
  }
}
