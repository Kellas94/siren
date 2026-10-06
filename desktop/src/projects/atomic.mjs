import { open, rename, readFile, unlink } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { ownedDirectory, ownedFile } from './paths.mjs';
import { readOwnedBytes } from './io.mjs';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function atomicWrite(path, bytes, { fault = async () => {}, selection = false, replace = rename, cleanupPending = false } = {}) {
  await ownedDirectory(dirname(path));
  const temporary = join(dirname(path), `pending-${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  let committed = false;
  try {
    try {
      await handle.writeFile(bytes);
      await fault(selection ? 'before-select-flush' : 'before-flush');
      await handle.sync();
      await fault(selection ? 'after-select-flush' : 'after-flush');
    } finally { await handle.close(); }
    await ownedDirectory(dirname(path));
    // Existing pointers must be ordinary owned files; never replace a junction/link.
    try { await ownedFile(path); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    await fault(selection ? 'before-select' : 'before-rename');
    await replace(temporary, path);
    committed = true;
    await fault(selection ? 'after-select' : 'after-rename');
    const readback = await readOwnedBytes(path, bytes.byteLength);
    if (!Buffer.from(bytes).equals(readback)) throw new Error('Durable readback mismatch');
    return digest(readback);
  } catch (error) {
    // Appearance opts in; project/recovery staging semantics stay unchanged.
    // Never enumerate stages, delete a destination, or follow a replaced link.
    if (cleanupPending === true && !committed) {
      try { await ownedDirectory(dirname(path)); await unlink(await ownedFile(temporary)); }
      catch { /* Preserve the original refusal if exact owned cleanup is unavailable. */ }
    }
    throw error;
  }
}

const activeWriters = new Set();
export async function exclusiveWriter(directory, body, { ownerIdentity = { pid: process.pid }, inspectProcess } = {}) {
  await ownedDirectory(directory);
  const key = directory.toLowerCase();
  const busy = () => Object.assign(new Error('Another writer owns this project; recovery required if identity is unknown'), { code: 'WRITER_BUSY' });
  if (activeWriters.has(key)) throw busy();
  activeWriters.add(key);
  const path = join(directory, 'writer.lock');
  let handle;
  try {
    try { handle = await open(path, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (!inspectProcess || !ownerIdentity.path || !ownerIdentity.startedAt) throw busy();
      const original = await readOwnedBytes(path, 65536);
      let prior;
      try { prior = JSON.parse(original); } catch { throw busy(); }
      if (!Number.isSafeInteger(prior.pid) || typeof prior.path !== 'string' || typeof prior.startedAt !== 'string') throw busy();
      const actual = await inspectProcess(prior.pid);
      if (actual === undefined || (actual && actual.path === prior.path && actual.startedAt === prior.startedAt)) throw busy();
      // Main also owns Electron's distribution/data-root single-instance lock.
      // Within this process activeWriters serializes the reclaim/open sequence.
      if (!(await readOwnedBytes(path, 65536)).equals(original)) throw busy();
      await unlink(path); handle = await open(path, 'wx', 0o600);
    }
    await handle.writeFile(JSON.stringify(ownerIdentity)); await handle.sync(); return await body();
  } finally {
    try { if (handle) { await handle.close(); await unlink(await ownedFile(path)); } }
    finally { activeWriters.delete(key); }
  }
}
