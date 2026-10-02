import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, access, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Removing baseline verification would emit an app built from unknown bytes.
test('wrong baseline refuses before creating any renderer output', async () => {
  const { buildRenderer } = await import('../build/renderer.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'siren-shell-'));
  const baselinePath = join(dir, 'base.html');
  const outputDir = join(dir, 'generated');
  await writeFile(baselinePath, '<html>unexpected</html>');
  await assert.rejects(buildRenderer({ baselinePath, expectedSha256: '0'.repeat(64), outputDir }), /baseline/i);
  await assert.rejects(access(outputDir));
});

test('CSP hashes the script after HTML tokenization, including NULL and CRLF normalization', async () => {
  const { buildRenderer } = await import('../build/renderer.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'siren-csp-'));
  const baselinePath = join(dir, 'base.html');
  const source = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src none"><script>const text="\u0000";\r\n</script>';
  await writeFile(baselinePath, source);
  const outputDir = join(dir, 'output');
  await buildRenderer({ baselinePath, outputDir, expectedSha256: createHash('sha256').update(source).digest('hex') });
  const expected = createHash('sha256').update('const text="\ufffd";\n').digest('base64');
  const output = await readFile(join(outputDir, 'app.html'), 'utf8');
  assert.ok(output.includes(`'sha256-${expected}'`));
  assert.equal(output.includes("script-src 'unsafe-inline'"), false);
});

// Ignoring raw traversal or decoding twice can turn an app URL into native file access.
test('local protocol serves app bytes but refuses hostile raw paths', async () => {
  const { resolveLocalResource } = await import('../src/protocol.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'siren-protocol-'));
  await writeFile(join(dir, 'app.html'), 'EXPECTED APP');
  assert.equal(await readFile(await resolveLocalResource({ url: 'siren://app/app.html', rendererRoot: dir }), 'utf8'), 'EXPECTED APP');
  for (const url of ['siren://app/../secret', 'siren://app/%2e%2e/secret', 'siren://app/%252e%252e/secret', 'siren://other/app.html', 'https://app/app.html', 'siren://app/C:/secret', 'siren://app/app.html%00']) {
    await assert.rejects(resolveLocalResource({ url, rendererRoot: dir }), /refused/i, url);
  }
});

// Following a junction inside rendererRoot would bypass apparent containment.
test('local protocol rejects renderer symlink escapes', async () => {
  const { resolveLocalResource } = await import('../src/protocol.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'siren-link-'));
  const inside = join(dir, 'inside'); const outside = join(dir, 'outside');
  await mkdir(inside); await mkdir(outside); await writeFile(join(outside, 'app.html'), 'PRIVATE');
  await symlink(outside, join(inside, 'escape'), 'junction');
  await assert.rejects(resolveLocalResource({ url: 'siren://app/escape/app.html', rendererRoot: inside }), /refused/i);
});

// A subframe/remote sender or malformed payload must never reach a privileged service.
test('IPC rejects remote/subframe senders and malformed save requests before dispatch', async () => {
  const { invokeDesktop } = await import('../src/ipc.mjs');
  let writes = 0;
  const services = { saveProject: async () => { writes++; return { ok: true, revision: 1, sha256: 'a'.repeat(64) }; } };
  const context = { senderUrl: 'siren://app/app.html', isMainFrame: true };
  const valid = { projectId: 'project-1', baseRevision: 0, json: '{}', purpose: 'workspace' };
  for (const sender of [{ senderUrl: 'https://attacker.example', isMainFrame: true }, { ...context, isMainFrame: false }]) {
    assert.equal((await invokeDesktop({ method: 'saveProject', payload: valid, context: sender, services })).ok, false);
  }
  for (const payload of [{ ...valid, projectId: '../secret' }, { ...valid, baseRevision: -1 }, { ...valid, path: 'C:/secret' }, { ...valid, purpose: 'exec' }]) {
    assert.equal((await invokeDesktop({ method: 'saveProject', payload, context, services })).ok, false);
  }
  assert.equal(writes, 0);
  assert.equal((await invokeDesktop({ method: 'saveProject', payload: valid, context, services })).ok, true);
  assert.equal(writes, 1);
  assert.equal((await invokeDesktop({ method: 'exec', payload: 'calc.exe', context, services })).ok, false);
});

test('an unusable portable data root requires explicit choice; cancel never redirects silently', async () => {
  const { chooseDataRoot } = await import('../src/data-root.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'siren-root-'));
  const unusable = join(dir, 'readonly'); await writeFile(unusable, 'ORIGINAL');
  let choices = 0;
  assert.equal(await chooseDataRoot({ preferred: unusable, choose: async () => { choices++; return null; } }), null);
  assert.equal(choices, 1);
  assert.equal(await readFile(unusable, 'utf8'), 'ORIGINAL');
  const selected = join(dir, 'selected');
  assert.equal(await chooseDataRoot({ preferred: unusable, choose: async () => selected }), selected);
});
