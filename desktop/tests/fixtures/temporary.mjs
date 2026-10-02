import { mkdtemp as createTemporaryDirectory, realpath } from 'node:fs/promises';

// Test-owned directories only. Windows CI's TEMP may use an 8.3 name; hand the
// native APIs a canonical fixture root without relaxing product path checks.
export async function mkdtemp(prefix) {
  return realpath(await createTemporaryDirectory(prefix));
}
