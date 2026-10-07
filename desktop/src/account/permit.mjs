import { decodeProtectedHeader, importJWK, importSPKI, jwtVerify } from 'jose';
import { failure } from '../ipc.mjs';

const DAY = 86400;
export async function verifyPermit({ signedPermit, keys, installationId, issuer, expectedAccount, now = Date.now(), lastSeenTime = now }) {
  if (typeof signedPermit !== 'string' || signedPermit.length > 65536 || typeof installationId !== 'string' || !issuer) return failure('PERMIT_INVALID', 'Activation permit is unavailable or invalid');
  try {
    const header = decodeProtectedHeader(signedPermit);
    if (header.alg !== 'EdDSA' || typeof header.kid !== 'string' || !Object.hasOwn(keys, header.kid)) throw new Error('Unknown key');
    const configured = keys[header.kid];
    const key = typeof configured === 'string' ? await importSPKI(configured, 'EdDSA') : await importJWK(configured, 'EdDSA');
    const { payload } = await jwtVerify(signedPermit, key, { issuer, audience: 'siren-desktop-activation', algorithms: ['EdDSA'], currentDate: new Date(now), requiredClaims: ['iat', 'exp', 'sub'] });
    if (payload.product !== 'siren' || payload.installationId !== installationId || typeof payload.sub !== 'string' || !payload.sub || (expectedAccount && payload.sub !== expectedAccount) || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || payload.exp <= payload.iat || payload.exp - payload.iat > 30 * DAY || payload.iat * 1000 > now + 300000) throw new Error('Invalid entitlement');
    const offlineUntil = new Date(payload.exp * 1000).toISOString();
    if (!Number.isFinite(now) || !Number.isFinite(lastSeenTime) || now < lastSeenTime - 300000) return { state: 'reauth-required', offlineUntil, recoveryOnly: true };
    return { state: 'offline', offlineUntil, recoveryOnly: false };
  } catch (error) {
    if (error.code === 'ERR_JWT_EXPIRED') return { state: 'reauth-required', offlineUntil: null, recoveryOnly: true };
    return failure('PERMIT_INVALID', 'Activation permit signature, issuer, account or installation is invalid');
  }
}
