import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { Script } from 'node:vm';
import { performance } from 'node:perf_hooks';
import { inspectWindowsProcess } from '../src/recovery/processes.mjs';
import { SessionJournal } from '../src/recovery/sessions.mjs';

const runNative = promisify(execFile);

// Execute the actual source function. Only its external process boundary adds
// controlled startup latency; options, query, PID and native result stay real.
async function delayedInspector(delayMs, observations) {
  const source = await readFile(new URL('../src/recovery/processes.mjs', import.meta.url), 'utf8');
  const marker = 'export async function inspectWindowsProcess(';
  assert.equal(source.split(marker).length, 2, 'The source function extraction must remain exact');
  const functionSource = source.slice(source.indexOf(marker)).replace('export ', '');
  const run = async (file, args, options) => {
    assert.equal(file, 'powershell.exe');
    assert.deepEqual(Array.from(args).slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command']);
    assert.match(args[3], /^\[Console\]::OutputEncoding/);
    const began = performance.now();
    const observation = { delayMs, deadlineMs: options.timeout, completed: false };
    observations.push(observation);
    try {
      const native = await runNative(file, [...args.slice(0, 3), `Start-Sleep -Milliseconds ${delayMs}; ${args[3]}`], options);
      observation.completed = true; observation.stdoutBytes = Buffer.byteLength(native.stdout);
      return native;
    } catch (error) {
      observation.error = { code: error.code, killed: error.killed, signal: error.signal };
      throw error;
    } finally { observation.elapsedMs = performance.now() - began; }
  };
  return new Script(`(${functionSource})`, { filename: 'actual-inspectWindowsProcess-with-owned-native-latency' }).runInNewContext({ run, process });
}

test('real Windows identity survives six-second native startup and remains fail-closed on bounded cancellation', { skip: process.platform !== 'win32', timeout: 60000 }, async () => {
  const evidence = resolve('evidence', `process-identity-deadline-${new Date().toISOString().replaceAll(':', '-')}`);
  await mkdir(evidence, { recursive: true });
  const root = await realpath(await mkdtemp(join(tmpdir(), 'siren-process-deadline-')));
  const folder = join(root, 'Știință-日本-Україна-😀'); await mkdir(folder);
  const executable = join(folder, 'node.exe'); await copyFile(process.execPath, executable);
  const child = spawn(executable, ['-e', 'console.log(JSON.stringify({path:process.execPath}));setInterval(()=>{},1000)'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  const result = { completed: false, scope: 'Controlled native PowerShell startup latency, exact actual Unicode child identity and bounded unknown-to-readonly. Not a CI20-cause diagnosis.', observations: [] };
  try {
    const [bytes] = await once(child.stdout, 'data');
    const expected = JSON.parse(bytes.toString('utf8').trim());
    const initialBegan=performance.now(),initialFailures=[];
    const first = await inspectWindowsProcess(child.pid,{onFailure:failure=>initialFailures.push(failure)});
    result.initialInspection={elapsedMs:performance.now()-initialBegan,deadlineMs:10000,observed:first!==undefined,failures:initialFailures,child:{pid:child.pid,exitCode:child.exitCode,signalCode:child.signalCode}};
    assert.equal(first?.pid, child.pid); assert.equal(first.path, expected.path); assert.match(first.startedAt, /^\d{4}-\d{2}-\d{2}T/);
    result.identity = first;
    const slower = await delayedInspector(6000, result.observations);
    const failures = [];
    const observed = await slower(child.pid, { onFailure: failure => failures.push(failure) });
    result.slowFailureDiagnostics = failures;
    result.slowChild = { exitCode: child.exitCode, signalCode: child.signalCode };
    assert.equal(child.exitCode, null); assert.equal(child.signalCode, null);
    if (!observed) {
      result.identityAfterSlowFailure = await inspectWindowsProcess(child.pid);
      assert.deepEqual(result.identityAfterSlowFailure, first, 'Cancelled query must not be mistaken for death of the owned fixture child');
    }
    assert.equal(observed?.pid, child.pid, 'A live owned Unicode child must remain identifiable after six seconds of controlled native startup latency');
    assert.equal(observed.path, expected.path); assert.equal(observed.startedAt, first.startedAt);
    assert.deepEqual(JSON.parse(JSON.stringify(observed)), first);
    assert.equal(result.observations[0].completed, true);
    const cancelled = await delayedInspector(12000, result.observations);
    const cancellationFailures = [];
    assert.equal(await cancelled(child.pid, { onFailure: failure => cancellationFailures.push(failure) }), undefined, 'A real cancelled native query must remain unknown');
    result.cancellationDiagnostics = cancellationFailures;
    assert.equal(cancellationFailures.length, 1); assert.equal(cancellationFailures[0].killed, true); assert.equal(cancellationFailures[0].signal, 'SIGTERM');
    assert.equal(result.observations.at(-1).error?.killed, true);
    assert.equal(child.exitCode, null); assert.equal(child.signalCode, null);
    const journal = new SessionJournal(root, { inspectProcess: cancelled });
    await journal.recordSession({ event: 'opened', sessionId: 'slow-unicode-owner', version: 'owned-test', processIdentity: first });
    assert.equal((await journal.inspectStartup()).mode, 'readonly', 'Unknown actual process observation cannot establish normal writable startup');
    assert.equal(result.observations.at(-1).error?.killed, true);
    assert.equal(child.exitCode, null); assert.equal(child.signalCode, null);
    assert.deepEqual(await inspectWindowsProcess(child.pid), first, 'The same child remains live with an unchanged identity after native query cancellations');
    result.completed = true;
  } catch (error) { result.error = String(error.stack || error); throw error; }
  finally {
    child.kill(); await exited;
    await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  }
});
