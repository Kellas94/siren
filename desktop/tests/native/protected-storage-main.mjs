import { app, safeStorage } from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { CredentialStore } from '../../src/account/credentials.mjs';

const started=performance.now(),phase=name=>console.log(JSON.stringify({phase:name,elapsedMs:performance.now()-started}));phase('module-started');
// Diagnostic-only delegation: actual native calls, arguments, return values and
// the parent's original deadline/oracles remain unchanged. Log numeric timings,
// never credentials, plaintext, ciphertext or user paths.
let operation=0;
const timed=(name,work)=>{const id=++operation,start=performance.now();phase(name+'-started-'+id);try{return work();}finally{console.log(JSON.stringify({phase:name+'-finished-'+id,elapsedMs:performance.now()-started,durationMs:performance.now()-start}));}};
const measuredStorage={
  isEncryptionAvailable:()=>timed('native-availability',()=>safeStorage.isEncryptionAvailable()),
  encryptString:value=>timed('native-encrypt',()=>safeStorage.encryptString(value)),
  decryptString:value=>timed('native-decrypt',()=>safeStorage.decryptString(value))
};
class MeasuredCredentialStore extends CredentialStore {
  async path(options){const id=++operation,start=performance.now();phase('credential-path-started-'+id);try{return await super.path(options);}finally{console.log(JSON.stringify({phase:'credential-path-finished-'+id,elapsedMs:performance.now()-started,durationMs:performance.now()-start}));}}
}
const ownedRoot=process.argv.find(value=>value.startsWith('--siren-owned-probe='));
const evidence = ownedRoot?resolve(ownedRoot.slice('--siren-owned-probe='.length)):resolve('evidence', `protected-storage-${new Date().toISOString().replaceAll(':', '-')}`); await mkdir(evidence, { recursive: true });phase('evidence-created');
await mkdir(join(evidence, 'profile')); app.setPath('userData', join(evidence, 'profile'));
app.whenReady().then(async () => {
  phase('electron-ready');
  const root = await mkdtemp(join(evidence, 'data-'));
  const record = { accountId: 'SYNTHETIC_ACCOUNT', signedPermit: 'SYNTHETIC_PERMIT', refreshToken: 'SYNTHETIC_REFRESH_SECRET_α' };
  const store = new MeasuredCredentialStore(root, measuredStorage);phase('encrypt-started'); const saved = await store.write(record);phase('encrypted-file-written');
  assert.equal(safeStorage.isEncryptionAvailable(), true, 'Current-user DPAPI must actually be available for this scoped proof');
  assert.equal(saved.persisted, true);
  phase('ciphertext-inspection-started');const bytes = await readFile(join(root, 'Account', 'credentials.bin'));phase('ciphertext-inspection-finished');
  for (const value of Object.values(record)) assert.equal(bytes.includes(Buffer.from(value)), false);
  phase('fresh-decrypt-started');assert.deepEqual(await new MeasuredCredentialStore(root, measuredStorage).read(), record);phase('fresh-decrypt-verified');
  phase('logout-removal-started');await store.clear(); assert.equal(await new MeasuredCredentialStore(root, measuredStorage).read(), null);phase('logout-removal-verified');
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Actual current Windows user Electron safeStorage/DPAPI; encrypted file, fresh-store decrypt and logout removal. Other-PC/user portability remains unqualified.', electron: process.versions.electron, ciphertextBytes: bytes.length }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));phase('exit-requested'); app.exit(0);
}).catch(error => { console.error(error.message); app.exit(1); });
