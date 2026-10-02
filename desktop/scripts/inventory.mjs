import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const hasClass = (node, name) => node.attrs?.some(a => a.name === 'class' && a.value.split(/\s+/).includes(name));
const descendants = node => [node, ...(node.childNodes || []).flatMap(descendants)];
export async function buildInventory({ desktopRoot, electronRoot }) {
  const lock = JSON.parse(await readFile(join(desktopRoot, 'package-lock.json'), 'utf8')); const npm = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path || entry.dev) continue;
    if (!/^node_modules\/(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(path)) throw new Error('Unqualified nested production dependency');
    const directory = join(desktopRoot, path); const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    if (metadata.version !== entry.version || metadata.license !== entry.license || !['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0'].includes(metadata.license)) throw new Error('Unqualified dependency license/version');
    const files = (await readdir(directory)).filter(n => /^licen[cs]e(?:\.md|\.txt)?$/i.test(n));
    if (files.length !== 1) throw new Error('Dependency license notice missing or ambiguous');
    const notice = await readFile(join(directory, files[0])); if (notice.length < 50) throw new Error('Dependency notice incomplete');
    npm.push({ name: metadata.name, version: metadata.version, license: metadata.license, notice: `${path}/${files[0]}`, noticeSha256: digest(notice), integrity: entry.integrity || null });
  }
  const electronNotice = await readFile(join(electronRoot, 'LICENSE'));
  const chromiumNotice = await readFile(join(electronRoot, 'LICENSES.chromium.html')); const components = []; const unresolvedNotices = [];
  for (const product of descendants(parse(chromiumNotice.toString('utf8'))).filter(n => hasClass(n, 'product'))) {
    const nodes = descendants(product); const title = nodes.find(n => hasClass(n, 'title')); const license = nodes.find(n => hasClass(n, 'license')); const homepage = nodes.find(n => hasClass(n, 'homepage'));
    const name = title ? text(title).trim() : ''; const licenseText = license ? text(license).trim() : '';
    if (!name || !licenseText) throw new Error('Chromium component notice missing');
    // Some upstream notices contain only a relative reference (e.g. better_any).
    // Preserve that exact reference; do not invent its license or call it complete.
    const referenceOnly = /^\.\.?\/[\w./-]+$/.test(licenseText);
    if (!referenceOnly && licenseText.length < 25) throw new Error('Chromium component notice incomplete');
    if (referenceOnly) unresolvedNotices.push({ name, reference: licenseText, noticeIndex: components.length });
    const url = homepage ? descendants(homepage).find(n => n.tagName === 'a')?.attrs.find(a => a.name === 'href')?.value : null;
    components.push({ name, homepage: url || null, licenseTextSha256: digest(Buffer.from(licenseText)), notice: 'LICENSES.chromium.html', noticeIndex: components.length, noticeKind: referenceOnly ? 'unresolved-reference' : 'text' });
  }
  if (!components.length) throw new Error('Chromium component notices missing');
  return { schema: 1, scope: 'Development runtime inventory; embedded renderer and legal qualification still pending', npm, electron: { version: (await readFile(join(electronRoot, 'version'), 'utf8')).trim(), notice: 'LICENSE', noticeSha256: digest(electronNotice) }, chromium: { notice: 'LICENSES.chromium.html', noticeSha256: digest(chromiumNotice), components, unresolvedNotices }, releaseQualified: false };
}
