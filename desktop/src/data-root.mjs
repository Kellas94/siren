import { mkdir, open, unlink, realpath, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function writableDataRoot(path) {
  const target = resolve(path);
  await mkdir(target, { recursive: true });
  if ((await lstat(target)).isSymbolicLink()) throw new Error('Reparse data root refused');
  const canonical = await realpath(target);
  if (canonical.toLowerCase() !== target.toLowerCase()) throw new Error('Aliased data root refused');
  const probe = join(target, `.siren-write-probe-${randomUUID()}`);
  const handle = await open(probe, 'wx', 0o600);
  try { await handle.writeFile('SIREN root probe'); await handle.sync(); } finally { await handle.close(); await unlink(probe); }
  return target;
}

export async function chooseDataRoot({ preferred, choose }) {
  let candidate = preferred;
  for (;;) {
    try { return await writableDataRoot(candidate); }
    catch { candidate = await choose(); if (!candidate) return null; }
  }
}
