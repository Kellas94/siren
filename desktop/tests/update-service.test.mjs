import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startUpdateFeed } from './fixtures/update-feed.mjs';
import { UpdateService } from '../src/updates/service.mjs';
import { GitHubTransport } from '../src/updates/github.mjs';
import { hashOwnedFile } from '../src/updates/download.mjs';

const root = () => mkdtemp(join(tmpdir(), 'siren-updates-'));
test('real anonymous release discovery stages only a complete signed package and an independently readable receipt', async () => {
  const feed = await startUpdateFeed();
  try {
    const dir = await root(); const service = new UpdateService({ root: dir, config: feed.config, currentVersion: '1.131.0', transport: feed.transport, now: () => feed.now });
    const checks = await Promise.all([service.checkForUpdates(), service.checkForUpdates()]);
    assert.equal(checks[0].phase, 'available'); assert.equal(feed.control.apiCalls, 1);
    assert.equal((await service.downloadUpdate()).phase, 'ready');
    assert.ok(service.receiptPath); const receipt = JSON.parse(await readFile(service.receiptPath));
    assert.equal(receipt.phase, 'verified');
    const staged = join(dirname(service.receiptPath), receipt.package);
    assert.deepEqual(await readFile(staged), feed.packageBytes);
    assert.deepEqual(await hashOwnedFile(staged, feed.packageBytes.length), { bytes: receipt.packageBytes, sha256: receipt.packageSha256 });
    assert.equal(feed.control.requests.some(r => r.authorization !== null), false);
    assert.equal(service.getUpdate().phase, 'ready');
    assert.equal((await readdir(dir)).includes('App'), false, 'staging cannot install or replace the current application');
  } finally { await feed.close(); }
});

test('404, rate limit, server outage, draft and prerelease never report current', async () => {
  const feed = await startUpdateFeed();
  try {
    for (const status of [404, 429, 503]) {
      feed.control.apiStatus = status;
      const before = feed.control.apiCalls;
      const service = new UpdateService({ root: await root(), config: feed.config, currentVersion: '1.131.0', transport: feed.transport });
      assert.equal((await service.checkForUpdates()).phase, 'error'); assert.notEqual(service.getUpdate().errorCode, null);
      assert.equal(feed.control.apiCalls, before + 1, 'negative HTTP oracle must actually reach the feed');
    }
    feed.control.apiStatus = 200;
    for (const key of ['draft', 'prerelease']) {
      feed.release[key] = true;
      const service = new UpdateService({ root: await root(), config: feed.config, currentVersion: '1.131.0', transport: feed.transport });
      assert.equal((await service.checkForUpdates()).phase, 'error'); feed.release[key] = false;
    }
    const unconfigured = new UpdateService({ root: await root(), config: { ...feed.config, repository: null }, currentVersion: '1.131.0' });
    assert.equal((await unconfigured.checkForUpdates()).phase, 'unconfigured');
  } finally { await feed.close(); }
});

test('HTTP success with a short or corrupt body never produces a ready receipt', async () => {
  const feed = await startUpdateFeed();
  try {
    for (const body of ['truncated', 'corrupt']) {
      feed.control.body = body;
      const service = new UpdateService({ root: await root(), config: feed.config, currentVersion: '1.131.0', transport: feed.transport, now: () => feed.now });
      assert.equal((await service.checkForUpdates()).phase, 'available');
      const result = await service.downloadUpdate(); assert.equal(result.phase, 'error'); assert.equal(service.receiptPath, null);
    }
  } finally { await feed.close(); }
});

test('cancel stops an actual paused response without admitting it or switching the application', async () => {
  const feed = await startUpdateFeed();
  try {
    feed.control.body = 'paused';
    const service = new UpdateService({ root: await root(), config: feed.config, currentVersion: '1.131.0', transport: feed.transport, now: () => feed.now });
    assert.equal((await service.checkForUpdates()).phase, 'available');
    const pending = service.downloadUpdate();
    const until = Date.now() + 2000;
    while (service.getUpdate().bytesReceived === 0 && Date.now() < until) await delay(10);
    assert.equal(service.getUpdate().bytesReceived, 8); service.cancelUpdate();
    assert.equal((await pending).errorCode, 'CANCELLED'); assert.equal(service.receiptPath, null);
  } finally { await feed.close(); }
});

test('durable high-water refuses rollback and corrupt trust state without silently resetting', async () => {
  const feed = await startUpdateFeed();
  try {
    const dir = await root();
    const options = { root: dir, config: feed.config, currentVersion: '1.131.0', transport: feed.transport, now: () => feed.now };
    assert.equal((await new UpdateService(options).checkForUpdates()).phase, 'available');
    feed.manifest.sequence = 6;
    assert.equal((await new UpdateService(options).checkForUpdates()).phase, 'error');
    const path = join(dir, 'Updates', 'high-water.json'); await writeFile(path, '{CORRUPT');
    assert.equal((await new UpdateService(options).checkForUpdates()).errorCode, 'TRUST_STATE_INVALID');
    assert.equal(await readFile(path, 'utf8'), '{CORRUPT');
  } finally { await feed.close(); }
});

test('production transport refuses arbitrary hosts, HTTP, credentials, unsafe TLS and redirected private destinations', async () => {
  const transport = new GitHubTransport({ fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://untrusted.example/private' } }) });
  for (const url of ['http://github.com/file', 'https://127.0.0.1/file', 'https://github.com.evil.example/file', 'https://token@github.com/file', 'https://github.com:444/file']) assert.throws(() => transport.validate(url), /refused/i);
  await assert.rejects(transport.request('https://github.com/publisher/file'), /refused/i);
});

test('automatic discovery waits for online status and durably runs at most once per 24 hours without downloading', async () => {
  const feed = await startUpdateFeed();
  try {
    const dir = await root(); let now = feed.now;
    const options = { root: dir, config: feed.config, currentVersion: '1.131.0', transport: feed.transport, now: () => now };
    const service = new UpdateService(options);
    assert.equal((await service.automaticCheck({ online: false })).phase, 'idle'); assert.equal(feed.control.apiCalls, 0);
    assert.equal((await service.automaticCheck({ online: true })).phase, 'available'); assert.equal(feed.control.apiCalls, 1);
    assert.equal(service.receiptPath, null);
    now += 86400000 - 1;
    await new UpdateService(options).automaticCheck({ online: true }); assert.equal(feed.control.apiCalls, 1);
    now++;
    await new UpdateService(options).automaticCheck({ online: true }); assert.equal(feed.control.apiCalls, 2);
  } finally { await feed.close(); }
});
