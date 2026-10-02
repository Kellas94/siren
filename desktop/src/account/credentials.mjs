import { mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { ownedDirectory, ownedFile } from '../projects/paths.mjs';
import { atomicWrite } from '../projects/atomic.mjs';
import { readOwnedBytes } from '../projects/io.mjs';

export class CredentialStore {
  constructor(root, safeStorage) { this.root = root; this.safeStorage = safeStorage; this.memory = null; }
  protected() { return this.safeStorage.isEncryptionAvailable(); }
  async path({ create = false } = {}) {
    await ownedDirectory(this.root);
    const dir = join(this.root, 'Account');
    if (create) { try { await mkdir(dir); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
    await ownedDirectory(dir); return join(dir, 'credentials.bin');
  }
  async write(record) {
    if (!this.protected()) { this.memory = structuredClone(record); return { persisted: false }; }
    const encrypted = this.safeStorage.encryptString(JSON.stringify(record));
    if (!Buffer.isBuffer(encrypted)) throw new Error('Protected storage did not produce encrypted bytes');
    await atomicWrite(await this.path({ create: true }), encrypted);
    this.memory = structuredClone(record);
    return { persisted: true };
  }
  async read() {
    if (this.memory) return structuredClone(this.memory);
    if (!this.protected()) return null;
    try { return JSON.parse(this.safeStorage.decryptString(await readOwnedBytes(await this.path(), 1024 * 1024))); }
    catch { return null; }
  }
  async clear() {
    this.memory = null;
    try { await unlink(await ownedFile(await this.path())); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}
