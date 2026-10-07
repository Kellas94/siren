import { createServer } from 'node:http';
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { GitHubTransport } from '../../src/updates/github.mjs';

export async function startUpdateFeed() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const packageBytes = Buffer.from('Synthetic complete package bytes — no production executable.\n'.repeat(8));
  const fileHash = createHash('sha256').update(packageBytes).digest('hex');
  const config = { repository: 'publisher/siren-binaries', channel: 'stable', trustedKeys: { root1: publicKey.export({ type: 'spki', format: 'pem' }) }, maxPackageBytes: 2 * 1024 ** 3 };
  const now = Date.parse('2026-10-02T12:00:00.000Z');
  const manifest = { schema: 1, product: 'siren', channel: 'stable', version: '1.132.0', platform: 'win32', arch: 'x64', dataSchema: 1, sequence: 7, expiresAt: '2026-10-09T12:00:00.000Z', minAllowedVersion: '1.131.0', keyId: 'root1', asset: { name: 'SIREN-1.132.0-windows-x64.zip', bytes: packageBytes.length, sha256: fileHash }, files: [{ path: 'SIREN.exe', bytes: packageBytes.length, sha256: fileHash }] };
  const base = `https://github.com/${config.repository}/releases/download/v1.132.0/`;
  const release = { draft: false, prerelease: false, tag_name: 'v1.132.0', assets: ['update-manifest.json', 'update-manifest.sig', manifest.asset.name].map(name => ({ name, state: 'uploaded', browser_download_url: base + name })) };
  const control = { apiStatus: 200, body: 'complete', requests: [], apiCalls: 0 };
  const server = createServer((req, res) => {
    control.requests.push({ path: req.url, authorization: req.headers.authorization || null });
    if (req.url.endsWith('/releases/latest')) {
      control.apiCalls++;
      res.writeHead(control.apiStatus, { 'content-type': 'application/json', 'retry-after': '60' }); res.end(JSON.stringify(release)); return;
    }
    if (req.url.endsWith('/update-manifest.json')) { res.end(JSON.stringify(manifest)); return; }
    if (req.url.endsWith('/update-manifest.sig')) { res.end(sign(null, Buffer.from(JSON.stringify(manifest)), privateKey)); return; }
    if (req.url.endsWith('.zip')) {
      res.writeHead(200, { 'content-length': packageBytes.length });
      if (control.body === 'truncated') { res.end(packageBytes.subarray(0, 8)); return; }
      if (control.body === 'corrupt') { res.end(Buffer.alloc(packageBytes.length, 0)); return; }
      if (control.body === 'paused') { res.write(packageBytes.subarray(0, 8)); return; }
      res.end(packageBytes); return;
    }
    res.writeHead(404); res.end('Not a fixture route');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  // Explicit test-only fetch mapping. Production still validates the original HTTPS destinations;
  // no localhost or TLS toggle is added to publisher configuration or production main.
  const transport = new GitHubTransport({ fetchImpl: (url, options) => fetch(origin + new URL(url).pathname, options) });
  return { config, now, manifest, release, control, transport, packageBytes,
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
