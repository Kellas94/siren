import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createCipheriv, createDecipheriv, scrypt } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp } from './fixtures/temporary.mjs';
import { LocalPinAccess } from '../src/account/local-pin.mjs';

// Explicit external OS-storage test double, with actual authenticated encryption.
// Product scrypt, owned filesystem validation, writes and readback are never mocked.
function protectedStorage() {
  const key = randomBytes(32);
  return {
    available: true, failEncrypt: false,
    isEncryptionAvailable() { return this.available; },
    encryptString(text) { if (this.failEncrypt) throw new Error('External protected storage unavailable'); const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); const bytes = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]); },
    decryptString(bytes) { const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(12, 28)); return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'); },
  };
}
async function fixture({ storage = protectedStorage(), now = () => 1790956800000 } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'siren-local-pin-'));
  const access = new LocalPinAccess(root, storage, { now }); await access.initialize();
  return { root, storage, access, path: join(root, 'Access/local-pin.bin'), now };
}
async function configured(options) {
  const f = await fixture(options); assert.equal((await f.access.setup({ pin: '0317', confirmation: '0317' })).ok, true); return f;
}
async function restart(f) { const access = new LocalPinAccess(f.root, f.storage, { now: f.now }); await access.initialize(); return access; }

test('fresh local access configures a four-digit PIN only after encrypted native persistence, and restart locks', async () => {
  const f = await fixture();
  assert.deepEqual(f.access.state(), { configured: false, pinLength: null, unlocked: false, available: true, blocked: false, retryAfterMs: 0 });
  assert.equal((await f.access.setup({ pin: '0317', confirmation: '0317' })).ok, true);
  assert.equal(f.access.state().configured, true); assert.equal(f.access.state().unlocked, true); assert.equal(f.access.state().pinLength, 4);
  const bytes = await readFile(f.path), record = JSON.parse(f.storage.decryptString(bytes));
  assert.equal(record.kdf, 'scrypt'); assert.match(record.salt, /^[a-f0-9]{32}$/); assert.match(record.verifier, /^[a-f0-9]{64}$/);
  assert.equal((await promisify(scrypt)('0317', Buffer.from(record.salt, 'hex'), 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })).toString('hex'), record.verifier, 'Persisted verifier must actually be scrypt of the PIN and salt');
  for (const field of ['pin', 'confirmation', 'currentPin', 'newPin']) assert.equal(Object.hasOwn(record, field), false);
  assert.equal(bytes.toString('utf8').includes('"verifier"'), false);
  const again = await restart(f); assert.equal(again.state().unlocked, false); assert.equal(again.state().pinLength, 4);
  assert.equal((await again.unlock({ pin: '0317' })).ok, true);
});

test('setup accepts six digits, rejects all other forms and confirmation mismatch without creating a record', async () => {
  const f = await fixture();
  for (const pin of ['', '123', '12345', '1234567', '1'.repeat(100000), '１２３４', ' 0317', 317, null]) assert.equal((await f.access.setup({ pin, confirmation: pin })).ok, false);
  assert.equal((await f.access.setup({ pin: '0317', confirmation: '9999' })).ok, false);
  await assert.rejects(readFile(f.path), { code: 'ENOENT' });
  assert.equal((await f.access.setup({ pin: '001927', confirmation: '001927' })).ok, true); assert.equal(f.access.state().pinLength, 6);
});

test('same synthetic PIN has independent random salts and persisted verifiers in two installations', async () => {
  const a = await configured(), b = await configured();
  const one = JSON.parse(a.storage.decryptString(await readFile(a.path))), two = JSON.parse(b.storage.decryptString(await readFile(b.path)));
  assert.notEqual(one.salt, two.salt); assert.notEqual(one.verifier, two.verifier);
});

test('five wrong PINs persist a 30-second cooldown across restart and successful unlock resets attempts', async () => {
  let time = 1790956800000; const f = await configured({ now: () => time }); f.access.lock();
  for (let i = 0; i < 4; i++) { const result = await f.access.unlock({ pin: '9999' }); assert.equal(result.ok, false); assert.equal(result.code, 'WRONG_PIN'); }
  const fifth = await f.access.unlock({ pin: '9999' }); assert.equal(fifth.ok, false); assert.equal(fifth.retryAfterMs, 30000);
  assert.equal(f.access.state().blocked, true); assert.equal(f.access.state().unlocked, false);
  const again = await restart(f); assert.equal(again.state().retryAfterMs, 30000);
  const original = await readFile(f.path); assert.equal((await again.unlock({ pin: '0317' })).ok, false); assert.deepEqual(await readFile(f.path), original);
  time += 29999; assert.equal(again.state().retryAfterMs, 1); assert.equal((await again.unlock({ pin: '0317' })).ok, false);
  time++; assert.equal((await again.unlock({ pin: '0317' })).ok, true); assert.equal(again.state().blocked, false);
  again.lock(); assert.equal((await again.unlock({ pin: '9999' })).code, 'WRONG_PIN'); assert.equal(again.state().retryAfterMs, 0);
});

test('invalid and oversized unlock input is generic, counted and never passed as an unbounded scrypt password', async () => {
  const f = await configured(); f.access.lock();
  const a = await f.access.unlock({ pin: '' }), b = await f.access.unlock({ pin: '1'.repeat(100000) }), c = await f.access.unlock({ pin: '9999' });
  assert.equal(a.code, 'WRONG_PIN'); assert.equal(b.code, a.code); assert.equal(c.message, a.message);
  const again = await restart(f); await again.unlock({ pin: '9999' }); const fifth = await again.unlock({ pin: '9999' }); assert.equal(fifth.retryAfterMs, 30000);
});

test('change requires unlocked session and current PIN, then rotates salt and rejects the previous PIN after restart', async () => {
  const f = await configured(); const original = await readFile(f.path); f.access.lock();
  assert.equal((await f.access.change({ currentPin: '0317', newPin: '001927', confirmation: '001927' })).ok, false); assert.deepEqual(await readFile(f.path), original);
  await f.access.unlock({ pin: '0317' });
  assert.equal((await f.access.change({ currentPin: '9999', newPin: '001927', confirmation: '001927' })).code, 'WRONG_PIN');
  assert.equal((await f.access.change({ currentPin: '0317', newPin: '001927', confirmation: '001926' })).ok, false);
  const before = JSON.parse(f.storage.decryptString(await readFile(f.path)));
  assert.equal((await f.access.change({ currentPin: '0317', newPin: '001927', confirmation: '001927' })).ok, true);
  const after = JSON.parse(f.storage.decryptString(await readFile(f.path))); assert.notEqual(after.salt, before.salt); assert.equal(f.access.state().pinLength, 6);
  const again = await restart(f); assert.equal((await again.unlock({ pin: '0317' })).ok, false); assert.equal((await again.unlock({ pin: '001927' })).ok, true);
});

test('wrong change attempts obey persisted cooldown and revoke the existing session at five failures', async () => {
  const f = await configured();
  for (let i = 0; i < 5; i++) assert.equal((await f.access.change({ currentPin: '9999', newPin: '001927', confirmation: '001927' })).ok, false);
  assert.equal(f.access.state().unlocked, false); assert.equal((await restart(f)).state().retryAfterMs, 30000);
});

test('verifyCurrent preserves an unlocked session after ordinary wrong PIN, resets attempts on correct PIN and never rotates its verifier', async () => {
  const f = await configured(); const original = JSON.parse(f.storage.decryptString(await readFile(f.path)));
  assert.equal((await f.access.verifyCurrent({ pin: '9999' })).code, 'WRONG_PIN');
  assert.equal(f.access.state().unlocked, true, 'Cancel after a wrong current PIN must retain an already unlocked session');
  assert.equal(JSON.parse(f.storage.decryptString(await readFile(f.path))).failures, 1);
  assert.equal((await f.access.verifyCurrent({ pin: '0317' })).ok, true);
  const after = JSON.parse(f.storage.decryptString(await readFile(f.path)));
  assert.equal(after.salt, original.salt); assert.equal(after.verifier, original.verifier); assert.equal(after.failures, 0);
  f.access.lock(); const bytes = await readFile(f.path);
  assert.equal((await f.access.verifyCurrent({ pin: '0317' })).code, 'PIN_LOCKED'); assert.deepEqual(await readFile(f.path), bytes);
});

test('verifyCurrent persists fifth-failure cooldown across restart and cannot report success after a lock or failed durable acknowledgement', async () => {
  const f = await configured();
  for (let i = 0; i < 5; i++) assert.equal((await f.access.verifyCurrent({ pin: '9999' })).ok, false);
  assert.equal(f.access.state().unlocked, false); assert.equal((await restart(f)).state().retryAfterMs, 30000);
  const good = await configured(); const before = await readFile(good.path);
  const pending = good.access.verifyCurrent({ pin: '0317' }); good.access.lock();
  assert.equal((await pending).ok, false); assert.deepEqual(await readFile(good.path), before);
  const failure = await configured(); const exact = await readFile(failure.path); failure.storage.failEncrypt = true;
  assert.equal((await failure.access.verifyCurrent({ pin: '0317' })).ok, false);
  assert.equal(failure.access.state().unlocked, false); assert.deepEqual(await readFile(failure.path), exact);
});

test('unavailable protected storage is failclosed and never creates a plaintext or memory-only activation', async () => {
  const storage = protectedStorage(); storage.available = false; const f = await fixture({ storage });
  assert.equal(f.access.state().available, false); assert.equal((await f.access.setup({ pin: '0317', confirmation: '0317' })).ok, false);
  assert.equal(f.access.state().unlocked, false); await assert.rejects(readFile(f.path), { code: 'ENOENT' });
});

test('corrupt, empty, oversized and undecryptable records refuse setup/reset and preserve exact original bytes', async () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from('not a protected record'), Buffer.alloc(20000, 7)]) {
    const f = await fixture(); await mkdir(join(f.root, 'Access'), { recursive: true }); await writeFile(f.path, bytes);
    const again = await restart(f); assert.equal(again.state().blocked, true); assert.equal(again.state().unlocked, false);
    assert.equal((await again.setup({ pin: '0317', confirmation: '0317' })).ok, false); assert.equal((await again.unlock({ pin: '0317' })).ok, false); assert.deepEqual(await readFile(f.path), bytes);
  }
  const f = await configured(); const original = await readFile(f.path); const foreign = new LocalPinAccess(f.root, protectedStorage()); await foreign.initialize();
  assert.equal(foreign.state().blocked, true); assert.equal((await foreign.setup({ pin: '0317', confirmation: '0317' })).ok, false); assert.deepEqual(await readFile(f.path), original);
});

test('successful verification cannot grant unlock/change when external encryption fails before durable write', async () => {
  const f = await configured(); f.access.lock(); const before = await readFile(f.path); f.storage.failEncrypt = true;
  assert.equal((await f.access.unlock({ pin: '0317' })).ok, false); assert.equal(f.access.state().unlocked, false); assert.deepEqual(await readFile(f.path), before);
  const again = await restart({ ...f, storage: Object.assign(f.storage, { failEncrypt: false }) }); await again.unlock({ pin: '0317' }); const beforeChange = await readFile(f.path); f.storage.failEncrypt = true;
  assert.equal((await again.change({ currentPin: '0317', newPin: '001927', confirmation: '001927' })).ok, false); assert.equal(again.state().unlocked, false); assert.deepEqual(await readFile(f.path), beforeChange);
  f.storage.failEncrypt = false; const final = await restart(f); assert.equal((await final.unlock({ pin: '0317' })).ok, true);
});

test('owned hostile record target refuses setup without touching the planted directory; existing setup never resets', async () => {
  const f = await fixture(); await mkdir(join(f.root, 'Access'), { recursive: true }); await mkdir(f.path); await writeFile(join(f.path, 'sentinel'), 'owned-hostile-fixture');
  assert.equal((await f.access.setup({ pin: '0317', confirmation: '0317' })).ok, false); assert.equal(f.access.state().unlocked, false); assert.equal(await readFile(join(f.path, 'sentinel'), 'utf8'), 'owned-hostile-fixture');
  const good = await configured(); const before = await readFile(good.path); assert.equal((await good.access.setup({ pin: '9999', confirmation: '9999' })).ok, false); assert.deepEqual(await readFile(good.path), before);
});

test('concurrent wrong attempts are serialized across instances so cooldown cannot lose increments', async () => {
  const f = await configured(); f.access.lock(); const second = await restart(f);
  const results = await Promise.all([f.access.unlock({ pin: '9999' }), second.unlock({ pin: '9999' }), f.access.unlock({ pin: '9999' }), second.unlock({ pin: '9999' }), f.access.unlock({ pin: '9999' })]);
  assert.ok(results.every(r => r.ok === false)); assert.equal((await restart(f)).state().retryAfterMs, 30000);
});

test('explicit lock cancels a queued setup/unlock without granting or rewriting the protected record', async () => {
  const fresh = await fixture(); const setup = fresh.access.setup({ pin: '0317', confirmation: '0317' }); fresh.access.lock();
  assert.equal((await setup).ok, false); assert.equal(fresh.access.state().configured, false); await assert.rejects(readFile(fresh.path), { code: 'ENOENT' });
  const f = await configured(); f.access.lock(); const before = await readFile(f.path);
  const unlock = f.access.unlock({ pin: '0317' }); f.access.lock();
  assert.equal((await unlock).ok, false); assert.equal(f.access.state().unlocked, false); assert.deepEqual(await readFile(f.path), before);
});

test('missing owned root and authenticated malformed payloads fail closed without implicit reset', async () => {
  const f = await fixture();
  const missing = new LocalPinAccess(join(f.root, 'missing-root'), f.storage); await missing.initialize(); assert.equal(missing.state().blocked, true);
  const good = await configured();
  const record = JSON.parse(good.storage.decryptString(await readFile(good.path)));
  for (const payload of [{ ...record, pinLength: 5 }, { ...record, salt: '' }, { ...record, failures: 5, blockedUntil: 0 }, { ...record, unexpected: true }]) {
    const bytes = good.storage.encryptString(JSON.stringify(payload)); await writeFile(good.path, bytes);
    const again = await restart(good); assert.equal(again.state().blocked, true); assert.equal((await again.setup({ pin: '0317', confirmation: '0317' })).ok, false); assert.deepEqual(await readFile(good.path), bytes);
  }
});
