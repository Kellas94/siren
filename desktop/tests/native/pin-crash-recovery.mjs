import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile, readdir, lstat, realpath, copyFile } from 'node:fs/promises';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { extractFile } from '@electron/asar';
import { launchDesktop, unlockDesktop, waitForDesktopStartup } from './drive.mjs';
import { inspectWindowsProcess } from '../../src/recovery/processes.mjs';
import { hashOwnedFile } from '../../src/updates/download.mjs';

// Actual SIREN entry/PIN IPC only. No canary, crypto instrumentation, reset,
// injected bootstrap, storage adapter or worker command is used by this probe.
const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--package' && args[1]), 'Use pin-crash-recovery.mjs [--package PREVIEW_ROOT]');
const packageRoot = args.length ? resolve(args[1]) : null;
const evidence = join(desktop, 'evidence', 'pin-crash-recovery', new Date().toISOString().replaceAll(':', '-'));
await mkdir(evidence, { recursive: true });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixturePin = '4826'; // Synthetic fixture secret; never included in a receipt/log.
const inputPaths = [
  'package.json', 'package-lock.json', 'scripts/package.mjs',
  'src/start.mjs', 'src/main.mjs', 'src/preload.cjs',
  'src/account/local-pin.mjs', 'src/account/pin-protection.mjs',
  'src/account/pin-worker.mjs', 'src/account/pin-protocol.mjs',
  'src/projects/atomic.mjs', 'src/projects/io.mjs', 'src/projects/paths.mjs',
  'src/recovery/processes.mjs', 'src/recovery/native-process.mjs',
  'native/generated/process-identity.json', 'native/generated/process-identity.exe',
  'generated/build.json', 'generated/home.html',
  'tests/native/drive.mjs', 'tests/native/condition.mjs', 'tests/native/pointer.mjs',
  'tests/native/pin-crash-recovery.mjs', 'node_modules/electron/dist/electron.exe',
];
const captureInputs = async () => Object.fromEntries(await Promise.all(inputPaths.map(async path => [path, await hashOwnedFile(join(desktop, path), 1024 ** 3)])));
const result = {
  status: 'ADVERSE', mode: packageRoot ? 'packaged' : 'development', cases: [],
  scope: 'Fresh owned profiles; actual normal SIREN entry and native PIN API; one restart per case. Process termination only, not power loss, OS reboot, other-user or release qualification.',
};
const writeResult = () => writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
const contained = (root, path) => path === root || (!relative(root, path).startsWith('..' + sep) && !relative(root, path).startsWith(sep) && relative(root, path) !== '..');

async function ordinary(path, directory) {
  const info = await lstat(path);
  assert.ok(!info.isSymbolicLink() && (directory ? info.isDirectory() : info.isFile()), 'Owned ordinary path required');
  assert.equal((await realpath(path)).toLowerCase(), resolve(path).toLowerCase(), 'Resolved path must retain owned identity');
  return info;
}

// A package case copies App plus its original BUILD identity, never existing Data.
// Each copied runtime file is read back against a closed, bounded input manifest.
async function packageInventory(root) {
  await ordinary(root, true);
  const files = []; let total = 0;
  const visit = async directory => {
    await ordinary(directory, true);
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name), info = await lstat(path);
      assert.ok(contained(root, path) && !info.isSymbolicLink(), 'Package descendant refused');
      if (info.isDirectory()) await visit(path);
      else {
        await ordinary(path, false); total += info.size;
        assert.ok(files.length < 1000 && total <= 1024 ** 3, 'Package inventory budget exceeded');
        files.push({ path: relative(root, path), ...await hashOwnedFile(path, 1024 ** 3) });
      }
    }
  };
  await visit(join(root, 'App'));
  files.push({ path: 'BUILD-IDENTITY.json', ...await hashOwnedFile(join(root, 'BUILD-IDENTITY.json'), 1024 ** 2) });
  return files;
}

async function copiedPackage(caseRoot, inventory, receipt) {
  const target = join(caseRoot, 'owned-preview'); await mkdir(target);
  for (const file of inventory) {
    const destination = join(target, file.path);
    assert.ok(contained(target, destination), 'Copy target refused');
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(packageRoot, file.path), destination, 1);
    assert.deepEqual(await hashOwnedFile(destination, 1024 ** 3), { bytes: file.bytes, sha256: file.sha256 }, 'Copied runtime bytes must match closed source');
  }
  const executable = join(target, receipt.appRelativePath);
  const archive = join(dirname(executable), 'resources', 'app.asar');
  assert.deepEqual(await hashOwnedFile(archive, 1024 ** 3), receipt.appArchive);
  assert.deepEqual(await hashOwnedFile(executable, 1024 ** 3), receipt.runtimeBinary);
  const metadata = JSON.parse(extractFile(archive, 'package.json').toString('utf8'));
  assert.equal(metadata.main, 'src/start.mjs', 'Copied package must use the normal new entry');
  const data = join(target, 'Data'); await mkdir(data);
  return { data, executable, packaged: true, copiedRoot: target, archive, sourceCommit: receipt.sourceCommit };
}

async function profileMetadata(data) {
  const names = ['Access/local-pin.bin', 'Access/PinProtection/Local State', 'Access/PinProtection/Preferences', 'Local State', 'Preferences'];
  const files = {};
  for (const name of names) {
    const path = join(data, name);
    try {
      await ordinary(path, false);
      files[name] = { exists: true, ...await hashOwnedFile(path, name === 'Access/local-pin.bin' ? 16384 : 65536) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      files[name] = { exists: false, bytes: null, sha256: null };
    }
  }
  return files;
}

function publicPinState(value) {
  assert.ok(value && ['configured', 'unlocked', 'available', 'blocked'].every(name => typeof value[name] === 'boolean'));
  assert.ok(value.pinLength === null || value.pinLength === 4 || value.pinLength === 6);
  assert.ok(Number.isSafeInteger(value.retryAfterMs) && value.retryAfterMs >= 0);
  return Object.fromEntries(['configured', 'pinLength', 'unlocked', 'available', 'blocked', 'retryAfterMs'].map(name => [name, value[name]]));
}

async function reservePort() {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}

// Read-only main inspector: PID/profile/executable equality only. It never
// imports application classes, reads protected bytes or calls safeStorage.
async function observeMain(port, pid, config) {
  let target; const until = Date.now() + 15000;
  while (Date.now() < until) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })).json()).find(target => target.type === 'node');
      if (target) break;
    } catch { /* bounded discovery only */ }
    await delay(100);
  }
  assert.ok(target, 'Owned main inspector unavailable');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let timer;
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('OWNED_INSPECTOR_TIMEOUT')), 10000);
      ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true });
    });
    clearTimeout(timer);
    const request = expression => new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('OWNED_INSPECTOR_TIMEOUT')), 10000);
      ws.addEventListener('message', event => {
        const reply = JSON.parse(event.data); if (reply.id !== 1) return;
        clearTimeout(timer);
        if (reply.error || reply.result?.exceptionDetails) reject(new Error('OWNED_INSPECTOR_REFUSED'));
        else resolve(reply.result.result.value);
      });
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
    const electron = `process.getBuiltinModule('module').createRequire(${JSON.stringify(join(desktop, 'src/start.mjs'))})('electron')`;
    const observed = await request(`(()=>{const e=${electron},p=process.getBuiltinModule('path'),same=(a,b)=>p.resolve(a).toLowerCase()===p.resolve(b).toLowerCase();return {pid:process.pid,userDataMatches:same(e.app.getPath('userData'),${JSON.stringify(config.data)}),sessionDataMatches:same(e.app.getPath('sessionData'),${JSON.stringify(config.data)}),executableMatches:same(process.execPath,${JSON.stringify(config.executable)}),ready:e.app.isReady(),packaged:e.app.isPackaged,electron:process.versions.electron};})()`);
    assert.equal(observed.pid, pid); assert.ok(observed.userDataMatches && observed.sessionDataMatches && observed.executableMatches && observed.ready);
    assert.equal(observed.packaged, config.packaged);
    return observed;
  } finally { clearTimeout(timer); ws.close(); }
}

let haltedForCleanup = false;
try {
  result.inputs = await captureInputs();
  assert.equal(JSON.parse(await readFile(join(desktop, 'package.json'), 'utf8')).main, 'src/start.mjs');
  let receipt, inventory;
  if (packageRoot) {
    inventory = await packageInventory(packageRoot);
    receipt = JSON.parse(await readFile(join(packageRoot, 'BUILD-IDENTITY.json'), 'utf8'));
    assert.equal(receipt.kind, 'development-preview'); assert.equal(receipt.releaseAdmitted, false);
    assert.match(receipt.sourceCommit, /^[a-f0-9]{40}$/);
    assert.match(receipt.appRelativePath, /^App\/versions\/[0-9A-Za-z._-]+\/SIREN\.exe$/);
    assert.ok(contained(packageRoot, join(packageRoot, receipt.appRelativePath)));
    result.package = { sourceRoot: packageRoot, receipt, closedInputInventory: inventory, copyScope: 'App and BUILD-IDENTITY only; original Data is excluded' };
  }
  const repetitions = packageRoot ? 1 : 2;
  result.expectedCases = repetitions * 3;
  for (const kind of ['setup-abrupt', 'setup-lock-abrupt', 'setup-lock-graceful']) {
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      if (haltedForCleanup) break;
      const name = `${kind}-${repetition}`, caseRoot = join(evidence, name); await mkdir(caseRoot);
      const entry = { name, kind, repetition, status: 'ADVERSE', stage: 'prepare', restartCount: 0 };
      result.cases.push(entry); let driver, identity, config;
      const saveCase = () => writeFile(join(caseRoot, 'result.json'), JSON.stringify(entry, null, 2));
      const pinState = async () => publicPinState(await driver.evaluate('window.sirenDesktop.getPinState()'));
      const launch = async () => {
        const port = await reservePort();
        driver = await launchDesktop({ root: desktop, executable: config.executable, packaged: config.packaged, extraArgs: [...(config.packaged ? [] : [`--siren-test-root=${config.data}`]), `--inspect=127.0.0.1:${port}`] });
        identity = await inspectWindowsProcess(driver.pid);
        assert.ok(identity && identity.pid === driver.pid, 'Native owned process identity required');
        assert.equal(resolve(identity.path).toLowerCase(), config.executable.toLowerCase());
        await waitForDesktopStartup(driver);
        return { identity, profile: await observeMain(port, driver.pid, config) };
      };
      const closeOwned = async graceful => {
        assert.ok(identity, 'No kill without native owned identity');
        const observed = await inspectWindowsProcess(driver.pid);
        if (observed === null || observed && observed.startedAt !== identity.startedAt) {
          // Establish the controller child's exit before closing its inspector;
          // never send a kill to a PID that has already been reused.
          await driver.waitForExit();
          entry.runtimeOutputBytes = (entry.runtimeOutputBytes || 0) + Buffer.byteLength(driver.logs());
          await driver.close();
          driver = null; identity = null;
          return;
        }
        assert.deepEqual(observed, identity, 'Only original child identity may be closed');
        if (graceful) {
          await driver.evaluate('window.sirenDesktop.requestClose()').catch(() => {});
          await driver.waitForExit();
        }
        entry.runtimeOutputBytes = (entry.runtimeOutputBytes || 0) + Buffer.byteLength(driver.logs());
        const closingIdentity = identity;
        await driver.close();
        const current = await inspectWindowsProcess(closingIdentity.pid);
        assert.ok(current === null || current && current.startedAt !== closingIdentity.startedAt, 'Original child exit must be confirmed; unknown is not exit');
        driver = null; identity = null;
      };
      try {
        if (packageRoot) config = await copiedPackage(caseRoot, inventory, receipt);
        else {
          const data = join(caseRoot, 'owned-data'); await mkdir(data);
          config = { data, executable: join(desktop, 'node_modules/electron/dist/electron.exe'), packaged: false };
        }
        entry.dataRoot = config.data;
        entry.executableIdentity = await hashOwnedFile(config.executable, 1024 ** 3);
        if (config.packaged) entry.package = { sourceCommit: config.sourceCommit, archive: await hashOwnedFile(config.archive, 1024 ** 3), copiedBuildIdentity: await hashOwnedFile(join(config.copiedRoot, 'BUILD-IDENTITY.json'), 1024 ** 2) };
        entry.stage = 'first-launch'; entry.first = await launch();
        entry.beforeSetup = await pinState(); assert.equal(entry.beforeSetup.configured, false, 'Every case must start with a fresh profile');
        entry.stage = 'setup'; await unlockDesktop(driver, { pin: fixturePin, autoSetup: true, surface: 'home' });
        entry.setupAcknowledged = true; entry.afterSetup = await pinState(); assert.equal(entry.afterSetup.unlocked, true);
        if (kind !== 'setup-abrupt') {
          entry.stage = 'lock'; entry.lockAcknowledged = (await driver.evaluate('window.sirenDesktop.lockPin()'))?.ok === true;
          assert.equal(entry.lockAcknowledged, true); entry.afterLock = await pinState(); assert.equal(entry.afterLock.unlocked, false);
        }
        entry.beforeFirstCloseFiles = await profileMetadata(config.data);
        assert.ok(entry.beforeFirstCloseFiles['Access/local-pin.bin'].exists);
        assert.ok(entry.beforeFirstCloseFiles['Access/PinProtection/Local State'].exists, 'Dedicated protection profile must already be persisted at setup acknowledgement');
        entry.stage = 'first-close'; await closeOwned(kind === 'setup-lock-graceful');
        entry.afterFirstCloseFiles = await profileMetadata(config.data); await saveCase();
        entry.stage = 'restart'; entry.restartCount++; entry.restart = await launch();
        entry.beforeRestartUnlockState = await pinState(); entry.beforeRestartUnlockFiles = await profileMetadata(config.data);
        assert.equal(entry.beforeRestartUnlockState.configured, true); assert.equal(entry.beforeRestartUnlockState.unlocked, false);
        assert.deepEqual(entry.beforeRestartUnlockFiles['Access/local-pin.bin'], entry.beforeFirstCloseFiles['Access/local-pin.bin'], 'Restart must retain exact ciphertext before unlock can rewrite it');
        assert.ok(entry.beforeRestartUnlockFiles['Access/PinProtection/Local State'].exists, 'Restart must retain dedicated profile state before unlock');
        // Native profile metadata may legitimately change. Retain its hash at
        // each boundary without assuming the entire JSON file is immutable.
        entry.stage = 'restart-unlock'; entry.restartUnlockAcknowledged = false;
        await unlockDesktop(driver, { pin: fixturePin, autoSetup: false, surface: 'home' });
        entry.restartUnlockAcknowledged = true; entry.afterRestartUnlockState = await pinState();
        assert.equal(entry.afterRestartUnlockState.unlocked, true); assert.equal(entry.afterRestartUnlockState.pinLength, fixturePin.length);
        entry.afterRestartUnlockFiles = await profileMetadata(config.data);
        entry.status = 'COMPLETE'; entry.stage = 'finished';
      } catch (error) {
        entry.error = { category: 'OWNED_PIN_CRASH_CASE_FAILED', stage: entry.stage, assertion: error.name === 'AssertionError' };
        // Read only public state and bounded metadata; never retain a raw CDP
        // exception, expression, PIN payload, worker output or protected bytes.
        if (driver) {
          try { entry.failurePinState = await pinState(); } catch { entry.failurePinStateUnavailable = true; }
          try { entry.failureFiles = await profileMetadata(config.data); } catch { entry.failureMetadataUnavailable = true; }
        }
      } finally {
        await saveCase();
        if (driver) {
          try { await closeOwned(true); entry.cleanup = 'graceful'; }
          catch {
            try { await closeOwned(false); entry.cleanup = 'owned-abrupt'; }
            catch { entry.cleanup = 'OWNED_IDENTITY_OR_EXIT_UNCONFIRMED'; entry.status = 'ADVERSE'; haltedForCleanup = true; }
          }
        } else entry.cleanup = 'no-owned-process-open';
        if (config?.packaged) {
          try { assert.deepEqual(await hashOwnedFile(config.archive, 1024 ** 3), receipt.appArchive); assert.deepEqual(await hashOwnedFile(config.executable, 1024 ** 3), receipt.runtimeBinary); entry.copiedPackageUnchanged = true; }
          catch { entry.copiedPackageUnchanged = false; entry.status = 'ADVERSE'; }
        }
        await saveCase(); await writeResult();
        console.log(JSON.stringify({ evidence, name, status: entry.status, stage: entry.stage, restartCount: entry.restartCount, cleanup: entry.cleanup }));
      }
    }
  }
  if (packageRoot) {
    result.package.closedAfterInventory = await packageInventory(packageRoot);
    result.package.originalUnchanged = JSON.stringify(inventory) === JSON.stringify(result.package.closedAfterInventory);
    assert.equal(result.package.originalUnchanged, true, 'Original package inputs must remain unchanged');
  }
} catch { result.error = { category: 'OWNED_PIN_CRASH_HARNESS_FAILED' }; }
finally {
  try { result.afterInputs = await captureInputs(); result.inputsUnchanged = JSON.stringify(result.inputs) === JSON.stringify(result.afterInputs); }
  catch { result.inputsUnchanged = false; }
  result.status = !result.error && !haltedForCleanup && result.inputsUnchanged && result.cases.length === result.expectedCases && result.cases.every(entry => entry.status === 'COMPLETE' && entry.restartCount === 1 && entry.restartUnlockAcknowledged === true) ? 'COMPLETE' : 'ADVERSE';
  await writeResult();
  console.log(JSON.stringify({ evidence, status: result.status, cases: result.cases.length, expectedCases: result.expectedCases, inputsUnchanged: result.inputsUnchanged }));
  process.exitCode = result.status === 'COMPLETE' ? 0 : 1;
}
