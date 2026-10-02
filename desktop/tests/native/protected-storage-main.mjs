import { app, safeStorage } from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { CredentialStore } from '../../src/account/credentials.mjs';

const evidence = resolve('evidence', `protected-storage-${new Date().toISOString().replaceAll(':', '-')}`); await mkdir(evidence, { recursive: true });
await mkdir(join(evidence, 'profile')); app.setPath('userData', join(evidence, 'profile'));
app.whenReady().then(async () => {
  const root = await mkdtemp(join(evidence, 'data-'));
  const record = { accountId: 'SYNTHETIC_ACCOUNT', signedPermit: 'SYNTHETIC_PERMIT', refreshToken: 'SYNTHETIC_REFRESH_SECRET_α' };
  const store = new CredentialStore(root, safeStorage); const saved = await store.write(record);
  assert.equal(safeStorage.isEncryptionAvailable(), true, 'Current-user DPAPI must actually be available for this scoped proof');
  assert.equal(saved.persisted, true);
  const bytes = await readFile(join(root, 'Account', 'credentials.bin'));
  for (const value of Object.values(record)) assert.equal(bytes.includes(Buffer.from(value)), false);
  assert.deepEqual(await new CredentialStore(root, safeStorage).read(), record);
  await store.clear(); assert.equal(await new CredentialStore(root, safeStorage).read(), null);
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Actual current Windows user Electron safeStorage/DPAPI; encrypted file, fresh-store decrypt and logout removal. Other-PC/user portability remains unqualified.', electron: process.versions.electron, ciphertextBytes: bytes.length }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence })); app.exit(0);
}).catch(error => { console.error(error.message); app.exit(1); });
