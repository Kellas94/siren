import { open, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { ownedDirectory, ownedFile, childDirectory } from '../projects/paths.mjs';
import { atomicWrite } from '../projects/atomic.mjs';
import { GitHubTransport } from './github.mjs';
import { versionParts } from './manifest.mjs';

export async function hashOwnedFile(path, maximum) {
  const handle = await open(await ownedFile(path), 'r'); const hash = createHash('sha256'); let bytes = 0;
  try {
    if ((await handle.stat()).size > maximum) throw new Error('Staged file exceeds limit');
    const buffer = Buffer.alloc(65536);
    for (;;) { const chunk = await handle.read(buffer, 0, buffer.length, null); if (!chunk.bytesRead) break; bytes += chunk.bytesRead; if (bytes > maximum) throw new Error('Staged file grew beyond limit'); hash.update(buffer.subarray(0, chunk.bytesRead)); }
    return { bytes, sha256: hash.digest('hex') };
  } finally { await handle.close(); }
}
export async function downloadVerifiedUpdate({ update, manifestBytes, signatureBytes, stagingRoot, signal, onProgress = () => {}, transport = new GitHubTransport() }) {
  await ownedDirectory(resolve(stagingRoot));
  versionParts(update.manifest.version);
  const directory = join(resolve(stagingRoot), `${update.manifest.version}-${randomUUID()}`);
  await mkdir(directory); await ownedDirectory(directory);
  const path = join(directory, update.manifest.asset.name);
  const response = await transport.request(update.assetUrl, { signal });
  if (!response.body) throw new Error('Missing update body');
  const advertised = response.headers.get('content-length');
  if (advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) !== update.manifest.asset.bytes)) { await response.body.cancel(); throw new Error('Incomplete update length'); }
  const reader = response.body.getReader(); let file; let bytes = 0; const hash = createHash('sha256');
  try {
    file = await open(path, 'wx', 0o600);
    for (;;) {
      signal?.throwIfAborted(); let timer; let removeAbort;
      const interrupted = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Update download inactivity timeout')), 30000);
        if (signal) { const abort = () => reject(signal.reason || new Error('Update cancelled')); signal.addEventListener('abort', abort, { once: true }); removeAbort = () => signal.removeEventListener('abort', abort); }
      });
      let result;
      try { result = await Promise.race([reader.read(), interrupted]); } finally { clearTimeout(timer); removeAbort?.(); }
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > update.manifest.asset.bytes) throw new Error('Update body exceeds signed length');
      hash.update(result.value);
      // FileHandle.write may return a short write. Write the complete chunk before acknowledging progress.
      let offset = 0;
      while (offset < result.value.byteLength) { const written = await file.write(result.value, offset, result.value.byteLength - offset, null); if (!written.bytesWritten) throw new Error('Staged package write failed'); offset += written.bytesWritten; }
      onProgress(bytes, update.manifest.asset.bytes);
    }
    if (bytes !== update.manifest.asset.bytes || hash.digest('hex') !== update.manifest.asset.sha256) throw new Error('Incomplete or corrupt update package');
    await file.sync(); await file.close(); file = null;
    const readback = await hashOwnedFile(path, update.manifest.asset.bytes);
    if (readback.bytes !== bytes || readback.sha256 !== update.manifest.asset.sha256) throw new Error('Staged package readback failed');
    signal?.throwIfAborted();
    await atomicWrite(join(directory, 'update-manifest.json'), manifestBytes);
    await atomicWrite(join(directory, 'update-manifest.sig'), signatureBytes);
    const receipt = { schema: 1, phase: 'verified', version: update.manifest.version, manifestSha256: update.manifestSha256, package: update.manifest.asset.name, packageSha256: readback.sha256, packageBytes: readback.bytes };
    const receiptPath = join(directory, 'receipt.json');
    await atomicWrite(receiptPath, Buffer.from(JSON.stringify(receipt)));
    return { receiptPath };
  } finally { if (file) await file.close(); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
