import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { ownedDirectory, childDirectory } from '../projects/paths.mjs';
import { atomicWrite } from '../projects/atomic.mjs';
import { readOwnedBytes } from '../projects/io.mjs';
import { GitHubTransport, resolveGitHubRelease } from './github.mjs';
import { parseStrictJson, verifyManifest, compareVersions } from './manifest.mjs';
import { downloadVerifiedUpdate } from './download.mjs';

const initial = phase => ({ phase, version: null, bytesReceived: 0, totalBytes: null, errorCode: null });
export class UpdateService {
  constructor({ root, config, currentVersion, transport = new GitHubTransport(), now = () => Date.now(), onStatus = () => {} }) {
    this.root = root; this.config = config; this.currentVersion = currentVersion; this.transport = transport; this.now = now; this.onStatus = onStatus;
    this.state = initial(this.configured() ? 'idle' : 'unconfigured'); this.running = false; this.update = null; this.controller = null; this.receiptPath = null;
  }
  configured() { return typeof this.config.repository === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(this.config.repository) && Object.keys(this.config.trustedKeys).length > 0; }
  getUpdate() { return { ...this.state }; }
  status(value) { this.state = { ...this.state, ...value }; this.onStatus(this.getUpdate()); return this.getUpdate(); }
  async directory() {
    await ownedDirectory(this.root); const directory = join(this.root, 'Updates');
    try { await mkdir(directory); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    return ownedDirectory(directory);
  }
  async highWater(directory) {
    try {
      const record = parseStrictJson(await readOwnedBytes(join(directory, 'high-water.json'), 65536));
      if (record.schema !== 1 || record.repository !== this.config.repository || record.channel !== this.config.channel || !Number.isSafeInteger(record.lastSeenTime) || this.now() < record.lastSeenTime - 300000) throw new Error('Update trust state invalid');
      // verifyManifest validates sequence/hash/minimum together with the next signed manifest.
      return record;
    } catch (error) { if (error.code === 'ENOENT') return null; throw Object.assign(new Error('Update trust state damaged'), { code: 'TRUST_STATE_INVALID' }); }
  }
  async checkForUpdates() {
    if (!this.configured()) return this.status({ ...initial('unconfigured'), errorCode: 'PUBLISHER_NOT_CONFIGURED' });
    if (this.running || this.state.phase === 'ready') return this.getUpdate();
    this.running = true; this.controller = new AbortController(); this.update = null; this.receiptPath = null;
    this.status(initial('checking'));
    try {
      const directory = await this.directory(); const high = await this.highWater(directory);
      const release = await resolveGitHubRelease(this.config, { transport: this.transport, signal: this.controller.signal });
      const verified = verifyManifest({ bytes: release.manifestBytes, signature: release.signatureBytes, config: this.config, currentVersion: this.currentVersion, lastSequence: high, now: this.now() });
      if (verified.manifest.version !== release.version) throw new Error('Signed release tag mismatch');
      await atomicWrite(join(directory, 'high-water.json'), Buffer.from(JSON.stringify({ schema: 1, repository: this.config.repository, channel: this.config.channel, sequence: verified.manifest.sequence, manifestSha256: verified.manifestSha256, minAllowedVersion: verified.manifest.minAllowedVersion, lastSeenTime: Math.max(high?.lastSeenTime || 0, this.now()) })));
      this.update = { ...verified, assetUrl: release.assetUrl, manifestBytes: release.manifestBytes, signatureBytes: release.signatureBytes };
      return this.status({ phase: compareVersions(verified.manifest.version, this.currentVersion) > 0 ? 'available' : 'current', version: verified.manifest.version, bytesReceived: 0, totalBytes: verified.manifest.asset.bytes, errorCode: null });
    } catch (error) { return this.status({ phase: 'error', errorCode: this.controller.signal.aborted ? 'CANCELLED' : error.code || 'CHECK_FAILED' }); }
    finally { this.running = false; this.controller = null; }
  }
  async downloadUpdate() {
    if (this.running || this.state.phase === 'ready') return this.getUpdate();
    if (!this.update || this.state.phase !== 'available') return this.status({ phase: this.configured() ? 'error' : 'unconfigured', errorCode: 'NO_VERIFIED_UPDATE' });
    this.running = true; this.controller = new AbortController(); this.status({ phase: 'downloading', bytesReceived: 0, errorCode: null });
    try {
      // Revalidate signed lifetime and durable floor at download time, not just at discovery.
      const directory = await this.directory(); const high = await this.highWater(directory);
      verifyManifest({ bytes: this.update.manifestBytes, signature: this.update.signatureBytes, config: this.config, currentVersion: this.currentVersion, lastSequence: high, now: this.now() });
      const stagingRoot = await childDirectory(directory, 'staging', { create: true });
      const staged = await downloadVerifiedUpdate({ update: this.update, manifestBytes: this.update.manifestBytes, signatureBytes: this.update.signatureBytes, stagingRoot, signal: this.controller.signal, transport: this.transport, onProgress: (bytesReceived, totalBytes) => this.status({ bytesReceived, totalBytes }) });
      this.receiptPath = staged.receiptPath;
      return this.status({ phase: 'ready', errorCode: null });
    } catch (error) { this.receiptPath = null; return this.status({ phase: 'error', errorCode: this.controller.signal.aborted ? 'CANCELLED' : error.code || 'DOWNLOAD_FAILED' }); }
    finally { this.running = false; this.controller = null; }
  }
  cancelUpdate() { this.controller?.abort(new Error('Update cancelled by user')); return this.getUpdate(); }
  async automaticCheck({ online }) {
    if (!online || !this.configured() || this.autoRunning || this.running || this.state.phase === 'ready') return this.getUpdate();
    this.autoRunning = true;
    try {
      const directory = await this.directory(); const path = join(directory, 'automatic-check.json'); let previous = null;
      try {
        previous = parseStrictJson(await readOwnedBytes(path, 65536));
        if (previous.schema !== 1 || previous.repository !== this.config.repository || previous.channel !== this.config.channel || !Number.isSafeInteger(previous.lastAttemptAt)) throw new Error('Invalid automatic check state');
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (previous && this.now() - previous.lastAttemptAt < 86400000) return this.getUpdate();
      await atomicWrite(path, Buffer.from(JSON.stringify({ schema: 1, repository: this.config.repository, channel: this.config.channel, lastAttemptAt: this.now() })));
      return await this.checkForUpdates();
    } catch { return this.status({ phase: 'error', errorCode: 'AUTO_CHECK_FAILED' }); }
    finally { this.autoRunning = false; }
  }
}
