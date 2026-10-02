import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { ownedDirectory } from '../projects/paths.mjs';
import { atomicWrite } from '../projects/atomic.mjs';
import { readOwnedBytes } from '../projects/io.mjs';

const derive = promisify(scrypt);
const KDF = Object.freeze({ N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const MAX_RECORD_BYTES = 16384;
const COOLDOWN_MS = 30000;
const validPin = value => typeof value === 'string' && /^(?:[0-9]{4}|[0-9]{6})$/.test(value);
const denied = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });
// Main owns a single-instance Data-root lock. This also serializes different
// LocalPinAccess instances in that process without leaving a crash-stale lockfile.
const queues = new Map();
function serial(key, body) {
  const previous = queues.get(key) || Promise.resolve();
  const operation = previous.then(body, body);
  const settled = operation.catch(() => {});
  queues.set(key, settled);
  settled.finally(() => { if (queues.get(key) === settled) queues.delete(key); });
  return operation;
}
function validateRecord(record) {
  const keys = ['schema', 'kdf', 'salt', 'verifier', 'pinLength', 'failures', 'blockedUntil'];
  if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).length !== keys.length || keys.some(key => !Object.hasOwn(record, key))
    || record.schema !== 1 || record.kdf !== 'scrypt' || typeof record.salt !== 'string' || typeof record.verifier !== 'string' || !/^[a-f0-9]{32}$/.test(record.salt) || !/^[a-f0-9]{64}$/.test(record.verifier)
    || ![4, 6].includes(record.pinLength) || !Number.isInteger(record.failures) || record.failures < 0 || record.failures > 5
    || !Number.isSafeInteger(record.blockedUntil) || record.blockedUntil < 0 || (record.failures === 5) !== (record.blockedUntil > 0)) throw new Error('Invalid protected PIN record');
  return record;
}

export class LocalPinAccess {
  #root; #storage; #now; #record = null; #initialized = false;
  #configured = false; #broken = false; #unlocked = false; #epoch = 0;
  constructor(root, safeStorage, { now = Date.now } = {}) {
    this.#root = resolve(root); this.#storage = safeStorage; this.#now = now;
  }
  #available() {
    try { return this.#storage?.isEncryptionAvailable() === true; } catch { return false; }
  }
  #time() {
    const time = this.#now();
    if (!Number.isSafeInteger(time) || time < 0 || time > Number.MAX_SAFE_INTEGER - COOLDOWN_MS) throw new Error('PIN clock unavailable');
    return time;
  }
  #fail() { this.#broken = true; this.#unlocked = false; }
  async #path(create = false) {
    await ownedDirectory(this.#root);
    const directory = join(this.#root, 'Access');
    if (create) { try { await mkdir(directory); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
    return join(await ownedDirectory(directory), 'local-pin.bin');
  }
  async #load() {
    if (this.#broken) return false;
    try { await ownedDirectory(this.#root); } catch { this.#fail(); return false; }
    try {
      const path = await this.#path();
      let bytes;
      try { bytes = await readOwnedBytes(path, MAX_RECORD_BYTES); }
      catch (error) {
        if (error.code === 'ENOENT' && !this.#configured) { this.#record = null; return true; }
        this.#configured = true; throw error;
      }
      this.#configured = true;
      if (!this.#available()) { this.#unlocked = false; return false; }
      const text = this.#storage.decryptString(bytes);
      if (typeof text !== 'string' || Buffer.byteLength(text) > 4096) throw new Error('Protected PIN payload refused');
      const record = validateRecord(JSON.parse(text));
      if (this.#record && (record.salt !== this.#record.salt || record.verifier !== this.#record.verifier)) this.#unlocked = false;
      this.#record = record;
      return true;
    } catch (error) {
      // A genuinely missing Access directory is fresh setup, never a corrupt
      // existing record's reset. Existing hostile or unreadable paths fail closed.
      if (error.code === 'ENOENT' && !this.#configured) { this.#record = null; return true; }
      this.#fail(); return false;
    }
  }
  async initialize() {
    return serial(this.#root.toLowerCase(), async () => {
      if (!this.#initialized) { await this.#load(); this.#initialized = true; }
      return this.state();
    });
  }
  state() {
    const available = this.#available();
    if (!available) this.#unlocked = false;
    let retryAfterMs = 0;
    try { retryAfterMs = Math.max(0, (this.#record?.blockedUntil || 0) - this.#time()); }
    catch { this.#fail(); }
    const blocked = !this.#initialized || this.#broken || !available || retryAfterMs > 0;
    if (blocked) this.#unlocked = false;
    return { configured: this.#configured, pinLength: this.#record?.pinLength ?? null, unlocked: this.#unlocked && !blocked, available, blocked, retryAfterMs };
  }
  lock() { this.#epoch++; this.#unlocked = false; }
  #guard() {
    const state = this.state();
    if (!this.#initialized || this.#broken || !state.available) return denied('PIN_STORAGE_UNAVAILABLE', 'Local PIN storage is unavailable. Existing data is retained.');
    if (state.retryAfterMs > 0) return denied('PIN_COOLDOWN', 'Too many attempts. Try again later.', { retryAfterMs: state.retryAfterMs });
    return null;
  }
  async #persist(record) {
    if (!this.#available()) throw new Error('Protected storage unavailable');
    const encrypted = this.#storage.encryptString(JSON.stringify(validateRecord(record)));
    if (!Buffer.isBuffer(encrypted) || encrypted.length === 0 || encrypted.length > MAX_RECORD_BYTES) throw new Error('Protected storage returned invalid bytes');
    await atomicWrite(await this.#path(true), encrypted);
    // Assign authority-bearing state only after flushed write and exact readback.
    this.#record = record; this.#configured = true;
  }
  async #matches(pin) {
    if (!validPin(pin)) return false;
    const actual = await derive(pin, Buffer.from(this.#record.salt, 'hex'), 32, KDF);
    return timingSafeEqual(actual, Buffer.from(this.#record.verifier, 'hex'));
  }
  async #wrong() {
    const time = this.#time();
    const failures = (this.#record.blockedUntil && time >= this.#record.blockedUntil ? 0 : this.#record.failures) + 1;
    await this.#persist({ ...this.#record, failures, blockedUntil: failures >= 5 ? time + COOLDOWN_MS : 0 });
    if (failures >= 5) this.#unlocked = false;
    return denied('WRONG_PIN', 'PIN incorrect.', failures >= 5 ? { retryAfterMs: COOLDOWN_MS } : {});
  }
  async #newRecord(pin) {
    const salt = randomBytes(16);
    const verifier = await derive(pin, salt, 32, KDF);
    return { schema: 1, kdf: 'scrypt', salt: salt.toString('hex'), verifier: verifier.toString('hex'), pinLength: pin.length, failures: 0, blockedUntil: 0 };
  }
  #operation(body) {
    const epoch = this.#epoch;
    return serial(this.#root.toLowerCase(), async () => {
      try {
        if (!this.#initialized) return denied('PIN_NOT_INITIALIZED', 'Local PIN access is not ready.');
        if (epoch !== this.#epoch) return denied('PIN_LOCKED', 'Local access was locked.');
        await this.#load();
        const refused = this.#guard(); if (refused) return refused;
        return await body(epoch);
      } catch { this.#fail(); return denied('PIN_STORAGE_UNAVAILABLE', 'Local PIN storage is unavailable. Existing data is retained.'); }
    });
  }
  setup(input = {}) {
    return this.#operation(async epoch => {
      if (this.#configured) return denied('PIN_ALREADY_CONFIGURED', 'A local PIN is already configured.');
      if (!validPin(input?.pin) || input.confirmation !== input.pin) return denied('INVALID_PIN', 'Use matching PINs containing exactly 4 or 6 digits.');
      const record = await this.#newRecord(input.pin);
      if (epoch !== this.#epoch) return denied('PIN_LOCKED', 'Local access was locked.');
      await this.#persist(record);
      if (epoch !== this.#epoch) return denied('PIN_LOCKED', 'Local access was locked.');
      this.#unlocked = true; return { ok: true };
    });
  }
  unlock(input = {}) {
    this.#unlocked = false;
    return this.#operation(async epoch => {
      if (!this.#record) return denied('PIN_NOT_CONFIGURED', 'Set up a local PIN first.');
      if (!await this.#matches(input?.pin)) return this.#wrong();
      if (epoch !== this.#epoch) return denied('PIN_LOCKED', 'Local access was locked.');
      await this.#persist({ ...this.#record, failures: 0, blockedUntil: 0 });
      if (epoch !== this.#epoch) return denied('PIN_LOCKED', 'Local access was locked.');
      this.#unlocked = true; return { ok: true };
    });
  }
  verifyCurrent(input = {}) {
    return this.#operation(async epoch => {
      if (!this.#record || !this.#unlocked) return denied('PIN_LOCKED', 'Unlock local access before verifying the current PIN.');
      if (!await this.#matches(input?.pin)) return this.#wrong();
      if (epoch !== this.#epoch) return denied('PIN_LOCKED', 'Local access was locked.');
      await this.#persist({ ...this.#record, failures: 0, blockedUntil: 0 });
      if (epoch !== this.#epoch) return denied('PIN_LOCKED', 'Local access was locked.');
      // This checks an existing session; it never creates or restores one.
      return { ok: true };
    });
  }
  change(input = {}) {
    return this.#operation(async epoch => {
      if (!this.#record || !this.#unlocked) return denied('PIN_LOCKED', 'Unlock local access before changing the PIN.');
      if (!validPin(input?.newPin) || input.confirmation !== input.newPin) return denied('INVALID_PIN', 'Use matching PINs containing exactly 4 or 6 digits.');
      if (!await this.#matches(input?.currentPin)) return this.#wrong();
      const record = await this.#newRecord(input.newPin);
      if (epoch !== this.#epoch) return denied('PIN_LOCKED', 'Local access was locked.');
      await this.#persist(record);
      if (epoch !== this.#epoch) return denied('PIN_LOCKED', 'Local access was locked.');
      this.#unlocked = true; return { ok: true };
    });
  }
}
