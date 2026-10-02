import { createHash, createPublicKey, verify } from 'node:crypto';
import { parseTree } from 'jsonc-parser';

export const MAX_METADATA_BYTES = 1024 * 1024;
export const MAX_PACKAGE_BYTES = 2 * 1024 ** 3;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fields = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === expected.split(',').sort().join(',');
export function versionParts(version) {
  if (typeof version !== 'string' || !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version)) throw new Error('Invalid stable semver');
  const parts = version.split('.').map(Number);
  if (parts.some(n => !Number.isSafeInteger(n))) throw new Error('Semver overflow');
  return parts;
}
export function compareVersions(a, b) {
  const left = versionParts(a); const right = versionParts(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  return 0;
}
export function parseStrictJson(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_METADATA_BYTES) throw new Error('Metadata size refused');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const errors = []; const tree = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
  if (errors.length || !tree) throw new Error('Invalid strict JSON');
  const visit = node => {
    if (node.type === 'object') {
      const names = new Set();
      for (const property of node.children || []) {
        const key = property.children[0].value;
        if (names.has(key)) throw new Error('Duplicate JSON field');
        names.add(key);
      }
    }
    for (const child of node.children || []) visit(child);
  };
  visit(tree); return JSON.parse(text);
}
export function validPackagePath(path) {
  if (typeof path !== 'string' || !path || path.length > 240 || !/^[a-zA-Z0-9._ /-]+$/.test(path)) return false;
  const parts = path.split('/');
  return parts.every(p => p && p !== '.' && p !== '..' && !/[. ]$/.test(p) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)) && !/^(data|projects|recovery|account)(\/|$)/i.test(path);
}
export function verifyManifest({ bytes, signature, config, currentVersion, lastSequence = null, now = Date.now() }) {
  const manifest = parseStrictJson(bytes);
  if (!fields(manifest, 'schema,product,channel,version,platform,arch,dataSchema,sequence,expiresAt,minAllowedVersion,keyId,asset,files')) throw new Error('Manifest fields refused');
  if (typeof manifest.keyId !== 'string' || !Object.hasOwn(config.trustedKeys, manifest.keyId)) throw new Error('Unknown publisher key');
  const pem = config.trustedKeys[manifest.keyId];
  if (typeof pem !== 'string' || !pem.startsWith('-----BEGIN PUBLIC KEY-----')) throw new Error('Public publisher key required');
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ed25519' || !Buffer.isBuffer(signature) || signature.length !== 64 || !verify(null, bytes, key, signature)) throw new Error('Publisher signature refused');
  if (manifest.schema !== 1 || manifest.product !== 'siren' || manifest.channel !== 'stable' || config.channel !== 'stable' || manifest.platform !== 'win32' || manifest.arch !== 'x64' || manifest.dataSchema !== 1) throw new Error('Unsupported update target/schema');
  versionParts(currentVersion); versionParts(manifest.version); versionParts(manifest.minAllowedVersion);
  if (!Number.isSafeInteger(now) || typeof manifest.expiresAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(manifest.expiresAt) || !Number.isFinite(Date.parse(manifest.expiresAt)) || new Date(manifest.expiresAt).toISOString() !== manifest.expiresAt || Date.parse(manifest.expiresAt) <= now) throw new Error('Expired or invalid update lifetime');
  if (!Number.isSafeInteger(manifest.sequence) || manifest.sequence < 1) throw new Error('Invalid update sequence');
  if (compareVersions(manifest.version, manifest.minAllowedVersion) < 0) throw new Error('Release violates minimum version');
  const manifestSha256 = createHash('sha256').update(bytes).digest('hex');
  if (lastSequence) {
    if (!Number.isSafeInteger(lastSequence.sequence) || !hash(lastSequence.manifestSha256)) throw new Error('Invalid sequence high-water state');
    if (manifest.sequence < lastSequence.sequence || (manifest.sequence === lastSequence.sequence && manifestSha256 !== lastSequence.manifestSha256)) throw new Error('Replayed or conflicting update sequence');
    if (compareVersions(manifest.minAllowedVersion, lastSequence.minAllowedVersion) < 0 || compareVersions(manifest.version, lastSequence.minAllowedVersion) < 0) throw new Error('Update lowers trusted minimum version');
  }
  const limit = Math.min(config.maxPackageBytes, MAX_PACKAGE_BYTES);
  if (!Number.isSafeInteger(limit) || limit < 1 || !fields(manifest.asset, 'name,bytes,sha256') || manifest.asset.name !== `SIREN-${manifest.version}-windows-x64.zip` || !Number.isSafeInteger(manifest.asset.bytes) || manifest.asset.bytes < 1 || manifest.asset.bytes > limit || !hash(manifest.asset.sha256)) throw new Error('Package identity/size refused');
  if (!Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 50000) throw new Error('File count refused');
  const paths = new Set(); let extracted = 0;
  for (const file of manifest.files) {
    if (!fields(file, 'path,bytes,sha256') || !validPackagePath(file.path) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !hash(file.sha256)) throw new Error('Package file refused');
    const lower = file.path.toLowerCase();
    if (paths.has(lower)) throw new Error('Duplicate or case-colliding file');
    paths.add(lower); extracted += file.bytes;
    if (!Number.isSafeInteger(extracted) || extracted > MAX_PACKAGE_BYTES) throw new Error('Extracted package size refused');
  }
  for (const path of paths) {
    let parent = path;
    while (parent.includes('/')) { parent = parent.slice(0, parent.lastIndexOf('/')); if (paths.has(parent)) throw new Error('File/directory collision'); }
  }
  if (!paths.has('siren.exe')) throw new Error('SIREN executable missing');
  return { manifest, manifestSha256, assetUrl: null };
}
