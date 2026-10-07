import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { inspectWindowsProcess } from '../src/recovery/processes.mjs';
import { SessionJournal } from '../src/recovery/sessions.mjs';

test('real Windows process identity preserves Unicode executable paths and stable creation time', { skip: process.platform !== 'win32', timeout: 30000 }, async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'siren-process-identity-')));
  const folder = join(root, 'Știință-日本');
  await mkdir(folder);
  const executable = join(folder, 'node.exe');
  await copyFile(process.execPath, executable);
  const child = spawn(executable, ['-e', 'console.log(JSON.stringify({path:process.execPath}));setInterval(()=>{},1000)'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  try {
    const [bytes] = await once(child.stdout, 'data');
    const expected = JSON.parse(bytes.toString('utf8').trim());
    const first = await inspectWindowsProcess(child.pid, { onFailure: failure => console.error('OWNED_PROCESS_IDENTITY_FAILURE ' + JSON.stringify({ pid: child.pid, ...failure })) });
    assert.equal(first?.pid, child.pid);
    assert.equal(first.path, expected.path, 'An altered path cannot identify the actual owned process');
    assert.match(first.startedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(await inspectWindowsProcess(child.pid), first);
    const journal = new SessionJournal(root, { inspectProcess: inspectWindowsProcess });
    await journal.recordSession({ event: 'opened', sessionId: 'unicode-owner', version: 'test', processIdentity: first });
    assert.equal((await journal.inspectStartup()).mode, 'normal');
  } finally {
    child.kill();
    await exited;
  }
  assert.equal(await inspectWindowsProcess(child.pid), null);
});
