import { app, safeStorage } from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { CredentialStore } from '../../src/account/credentials.mjs';

const started=performance.now(),phase=name=>console.log(JSON.stringify({phase:name,elapsedMs:performance.now()-started}));phase('module-started');
const ownedRoot=process.argv.find(value=>value.startsWith('--siren-owned-probe='));
const evidence = ownedRoot?resolve(ownedRoot.slice('--siren-owned-probe='.length)):resolve('evidence', `protected-storage-${new Date().toISOString().replaceAll(':', '-')}`); await mkdir(evidence, { recursive: true });phase('evidence-created');
await mkdir(join(evidence, 'profile')); app.setPath('userData', join(evidence, 'profile'));
app.whenReady().then(async () => {
  phase('electron-ready');
  const root = await mkdtemp(join(evidence, 'data-'));
  const record = { accountId: 'SYNTHETIC_ACCOUNT', signedPermit: 'SYNTHETIC_PERMIT', refreshToken: 'SYNTHETIC_REFRESH_SECRET_α' };
  const store = new CredentialStore(root, safeStorage);phase('encrypt-started'); const saved = await store.write(record);phase('encrypted-file-written');
  assert.equal(safeStorage.isEncryptionAvailable(), true, 'Current-user DPAPI must actually be available for this scoped proof');
  assert.equal(saved.persisted, true);
  const bytes = await readFile(join(root, 'Account', 'credentials.bin'));
  for (const value of Object.values(record)) assert.equal(bytes.includes(Buffer.from(value)), false);
  assert.deepEqual(await new CredentialStore(root, safeStorage).read(), record);phase('fresh-decrypt-verified');
  await store.clear(); assert.equal(await new CredentialStore(root, safeStorage).read(), null);phase('logout-removal-verified');
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Actual current Windows user Electron safeStorage/DPAPI; encrypted file, fresh-store decrypt and logout removal. Other-PC/user portability remains unqualified.', electron: process.versions.electron, ciphertextBytes: bytes.length }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));phase('exit-requested'); app.exit(0);
}).catch(error => { console.error(error.message); app.exit(1); });
