import * as client from 'openid-client';
import { OidcLogin } from './oidc.mjs';

// Explicitly excluded from a production package. There is no renderer-configurable switch.
class TestOidcLogin extends OidcLogin {
  validateIssuer() {
    const issuer = new URL(this.issuer);
    if (issuer.protocol !== 'http:' || issuer.hostname !== '127.0.0.1' || issuer.username || issuer.password || !this.clientId) throw new Error('Controlled test issuer must use numeric loopback');
    return issuer;
  }
  discoveryOptions() { return { execute: [client.allowInsecureRequests, client.enableNonRepudiationChecks] }; }
}
export const createTestOidcLogin = options => new TestOidcLogin(options);
