import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { launchDesktop } from './drive.mjs';

// Candidate boundary test: inherited light-only token colors must not make
// Python strings/comments unreadable after selecting the dark theme.
const root = resolve(process.argv[2]);
const luminance = css => {
  const values = css.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
    const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
  });
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
};
const driver = await launchDesktop({ root, executable: resolve('node_modules/electron/dist/electron.exe') });
const result = { completed: false, themes: [] };
try {
  await driver.waitFor('typeof window.probe?.open === "function"');
  await driver.evaluate(`window.probe.open(${JSON.stringify('label = "test" # comment\n')})`);
  for (const dark of [true, false]) {
    await driver.evaluate(`window.probe.dark(${dark})`);
    await driver.waitFor('document.querySelectorAll(".cm-content span").length > 1');
    const tokens = await driver.evaluate(`Array.from(document.querySelectorAll('.cm-content span'),e=>({text:e.textContent,color:getComputedStyle(e).color,background:getComputedStyle(document.querySelector('.cm-editor')).backgroundColor}))`);
    for (const token of tokens) {
      const a = luminance(token.color), b = luminance(token.background);
      token.contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    }
    result.themes.push({ dark, tokens });
    assert.ok(tokens.some(t => t.text.includes('test')) && tokens.some(t => t.text.includes('comment')), 'Measure actual highlighted string and comment');
    for (const token of tokens) assert.ok(token.contrast >= 4.5, `Unreadable ${dark ? 'dark' : 'light'} token ${token.text}: ${token.contrast.toFixed(2)}:1`);
    await driver.screenshot(join(root, `theme-${dark ? 'dark' : 'light'}-contrast.png`));
  }
  result.completed = true;
} catch (error) { result.error = error.message; process.exitCode = 1; }
finally { await writeFile(join(root, `theme-${result.completed ? 'green' : 'red'}.json`), JSON.stringify(result, null, 2)); await driver.close(); console.log(JSON.stringify(result)); }
