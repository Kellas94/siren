import { lstat, realpath, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export const validId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(id);
export async function ownedDirectory(path, { create = false } = {}) {
  const expected = resolve(path);
  if (create) await mkdir(expected, { recursive: false });
  const info = await lstat(expected);
  if (!info.isDirectory() || info.isSymbolicLink() || (await realpath(expected)).toLowerCase() !== expected.toLowerCase()) throw new Error('Project path refused');
  return expected;
}
export async function childDirectory(parent, name, { create = false } = {}) {
  if (!validId(name)) throw new Error('Project path refused');
  await ownedDirectory(parent);
  const child = join(parent, name);
  if (create) {
    try { await mkdir(child); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  return ownedDirectory(child);
}
export async function ownedFile(path) {
  const expected = resolve(path);
  const info = await lstat(expected);
  if (!info.isFile() || info.isSymbolicLink() || (await realpath(expected)).toLowerCase() !== expected.toLowerCase()) throw new Error('Project file refused');
  return expected;
}
