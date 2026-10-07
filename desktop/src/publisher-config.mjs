// Build-owned public configuration. Never read issuer/keys/feed from imported projects.
// Production admission refuses these unconfigured defaults.
export const publisherConfig = Object.freeze({
  account: Object.freeze({ issuer: null, clientId: null, entitlementEndpoint: null, permitIssuer: null, permitKeys: Object.freeze({}) }),
  updates: Object.freeze({ repository: null, channel: 'stable', trustedKeys: Object.freeze({}), maxPackageBytes: 2 * 1024 ** 3 }),
});
