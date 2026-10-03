import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp } from './fixtures/temporary.mjs';
import { buildRenderer } from '../build/renderer.mjs';
import { resolveLocalResource } from '../src/protocol.mjs';
import { allowedAppFile } from '../scripts/package.mjs';
import { nativeViewFactory } from '../src/windows/factory.mjs';

test('renderer emits only data-free hashed role entrypoints and exact packaged modules', async () => {
  const root = await mkdtemp(join(tmpdir(), 'siren-window-entry-'));
  const baseline = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src none"><script>const test=1;</script>';
  const baselinePath = join(root, 'baseline.html'); await writeFile(baselinePath, baseline);
  await buildRenderer({ baselinePath, outputDir: root, expectedSha256: createHash('sha256').update(baseline).digest('hex') });
  for (const role of ['code', 'docs']) {
    const html = await readFile(join(root, 'windows', `${role}.html`), 'utf8');
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
    assert.ok(html.includes(`'sha256-${createHash('sha256').update(script).digest('base64')}'`));
    assert.equal(/sirenDesktopBootstrap|createSirenDesktopStore|localStorage|sourceText|codeFiles/.test(html), false);
    assert.equal(html.includes("script-src 'unsafe-inline'"), false);
    const url = `siren://app/windows/${role}.html?windowId=12345678-1234-4234-8234-123456789abc`;
    assert.equal(await readFile(await resolveLocalResource({ url, rendererRoot: root }), 'utf8'), html);
    assert.equal(allowedAppFile(`generated/windows/${role}.html`, new Set()), true);
  }
  for (const path of ['src/windows/registry.mjs','src/windows/ipc.mjs','src/windows/factory.mjs','src/windows/geometry.mjs','src/windows/entities.mjs','src/windows/preload.cjs']) assert.equal(allowedAppFile(path, new Set()), true, path);
  for (const url of ['siren://app/windows/code.html','siren://app/windows/code.html?windowId=forged', 'siren://app/windows/code.html?windowId=12345678-1234-4234-8234-123456789abc&role=docs', 'siren://app/windows/../app.html','siren://app/windows/%2e%2e/app.html','siren://app/windows/other.html?windowId=12345678-1234-4234-8234-123456789abc']) await assert.rejects(resolveLocalResource({ url, rendererRoot: root }));
});

test('native role factory remains hidden and denies navigation, subframes, popups and webviews', async () => {
  let window;
  class Boundary extends EventEmitter {
    destroyed = false;
    constructor(options) { super(); this.options = options; this.webContents = new EventEmitter(); this.webContents.mainFrame = { url: '' }; this.webContents.getURL = () => this.webContents.mainFrame.url; this.webContents.isDestroyed = () => this.destroyed; this.webContents.setWindowOpenHandler = callback => { this.popup = callback; }; window = this; }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
    async loadURL(url) { this.webContents.mainFrame.url = url; }
  }
  const create = nativeViewFactory({ BrowserWindow: Boundary, displays: () => [{ id: 1, workArea: { x: -800, y: 40, width: 800, height: 600 } }], preload: '/owned/preload.cjs' });
  const windowId = '12345678-1234-4234-8234-123456789abc';
  const result = await create({ role: 'code', windowId, mainFrameUrl: `siren://app/windows/code.html?windowId=${windowId}` });
  assert.equal(result, window); assert.equal(window.options.show, false); assert.equal(Object.hasOwn(window.options, 'parent'), false); assert.equal(Object.hasOwn(window.options, 'modal'), false);
  assert.deepEqual(window.options.webPreferences, { preload: '/owned/preload.cjs', sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true });
  assert.deepEqual(window.popup(), { action: 'deny' });
  for (const name of ['will-navigate','will-frame-navigate','will-attach-webview']) { let prevented = false; window.webContents.emit(name, { url: 'https://external.invalid', isMainFrame: false, preventDefault() { prevented = true; } }); assert.equal(prevented, true); }
  await assert.rejects(create({ role: 'audience', windowId, mainFrameUrl: `siren://app/windows/audience.html?windowId=${windowId}` }), e => e.code === 'REQUEST_REFUSED');
});
