import { MAX_METADATA_BYTES, parseStrictJson, versionParts } from './manifest.mjs';

const allowedHosts = new Set(['api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
export class GitHubTransport {
  constructor({ fetchImpl = fetch } = {}) { this.fetchImpl = fetchImpl; }
  validate(url) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password || parsed.hash || !allowedHosts.has(parsed.hostname) || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('Update destination refused');
    return parsed.href;
  }
  async request(url, { signal } = {}) {
    let destination = this.validate(url);
    for (let redirect = 0; redirect <= 5; redirect++) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
      let response;
      try {
        response = await this.fetchImpl(destination, { redirect: 'manual', signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
          headers: { accept: destination.startsWith('https://api.github.com/') ? 'application/vnd.github+json' : 'application/octet-stream', 'user-agent': 'SIREN-Desktop-Updater', 'x-github-api-version': '2026-03-10', 'accept-encoding': 'identity' } });
      } finally { clearTimeout(timer); }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location || redirect === 5) throw new Error('Update redirect limit refused');
        destination = this.validate(new URL(location, destination).href); continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        const code = response.status === 429 || response.status === 403 ? 'RATE_LIMITED' : `HTTP_${response.status}`;
        throw Object.assign(new Error('Update service request failed'), { code, retryAfter: response.headers.get('retry-after')?.slice(0, 128) || null });
      }
      if (response.headers.get('content-encoding') && response.headers.get('content-encoding') !== 'identity') { await response.body?.cancel(); throw new Error('Encoded update body refused'); }
      return response;
    }
    throw new Error('Update redirect refused');
  }
}
export async function readResponse(response, limit, { signal, inactivityMs = 15000 } = {}) {
  if (!response.body) throw new Error('Empty update response');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      let timer; let removeAbort;
      const interrupted = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Update response timeout')), inactivityMs);
        if (signal) { const onAbort = () => reject(signal.reason || new Error('Update cancelled')); signal.addEventListener('abort', onAbort, { once: true }); removeAbort = () => signal.removeEventListener('abort', onAbort); }
      });
      let chunk;
      try { chunk = await Promise.race([reader.read(), interrupted]); } finally { clearTimeout(timer); removeAbort?.(); }
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) throw new Error('Update metadata exceeds limit');
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks, size);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function resolveGitHubRelease(config, { transport = new GitHubTransport(), signal } = {}) {
  signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  if (typeof config.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository) || config.channel !== 'stable') throw new Error('Publisher repository not configured');
  const response = await transport.request(`https://api.github.com/repos/${config.repository}/releases/latest`, { signal });
  const release = parseStrictJson(await readResponse(response, MAX_METADATA_BYTES, { signal }));
  if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== 'string' || !release.tag_name.startsWith('v') || !Array.isArray(release.assets)) throw new Error('Stable published release required');
  const version = release.tag_name.slice(1); versionParts(version);
  const base = `https://github.com/${config.repository}/releases/download/${release.tag_name}/`;
  const asset = name => {
    const matches = release.assets.filter(a => a.name === name);
    if (matches.length !== 1 || matches[0].state !== 'uploaded' || matches[0].browser_download_url !== base + name) throw new Error('Release asset identity refused');
    return matches[0];
  };
  const manifestAsset = asset('update-manifest.json'); const signatureAsset = asset('update-manifest.sig');
  const packageAsset = asset(`SIREN-${version}-windows-x64.zip`);
  const manifestBytes = await readResponse(await transport.request(manifestAsset.browser_download_url, { signal }), MAX_METADATA_BYTES, { signal });
  const signatureBytes = await readResponse(await transport.request(signatureAsset.browser_download_url, { signal }), 64, { signal });
  return { manifestBytes, signatureBytes, assetUrl: packageAsset.browser_download_url, version };
}
