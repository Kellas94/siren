import test from 'node:test';
import assert from 'node:assert/strict';

const context = { desktopVersion: '0.1.0-dev.1', rendererVersion: '1.131.0', electron: '44.5.1', chromium: '152.0.7977.130', node: '24.16.0', platform: 'win32', arch: 'x64', osRelease: '10.0.26200', mode: 'recovery', accountState: 'unactivated', updatePhase: 'unconfigured', projectCount: 2, verifiedPointCount: 11, damagedPointCount: 1 };
test('manual diagnostics are an allowlist with no project labels, source, account identity, path or credentials', async () => {
  const { buildDiagnostics } = await import('../src/recovery/diagnostics.mjs');
  const report = buildDiagnostics({ ...context, projectLabel: 'PRIVATE_DOC', source: 'PRIVATE_PYTHON', path: 'C:/PRIVATE_USER', accountId: 'PRIVATE_ACCOUNT', refreshToken: 'PRIVATE_TOKEN' });
  const json = JSON.stringify(report);
  for (const secret of ['PRIVATE_DOC', 'PRIVATE_PYTHON', 'PRIVATE_USER', 'PRIVATE_ACCOUNT', 'PRIVATE_TOKEN']) assert.equal(json.includes(secret), false);
  assert.equal(report.counts.verifiedPoints, 11); assert.equal(report.runtime.electron, '44.5.1');
});
test('diagnostic leakage admission rejects planted fields and token-like text even under an allowed runtime field', async () => {
  const { buildDiagnostics, validateDiagnostics } = await import('../src/recovery/diagnostics.mjs');
  const report = buildDiagnostics(context);
  assert.throws(() => validateDiagnostics({ ...report, refreshToken: 'PRIVATE_TOKEN' }), /diagnostic/i);
  assert.throws(() => buildDiagnostics({ ...context, electron: 'Bearer PRIVATE_TOKEN' }), /diagnostic/i);
  assert.throws(() => validateDiagnostics({ ...report, counts: { ...report.counts, source: 'PRIVATE_PYTHON' } }), /diagnostic/i);
});
