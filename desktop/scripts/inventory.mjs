import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { parseStrictJson, validPackagePath } from '../src/updates/manifest.mjs';
import { readOwnedBytes } from '../src/projects/io.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const hasClass = (node, name) => node.attrs?.some(a => a.name === 'class' && a.value.split(/\s+/).includes(name));
const descendants = node => [node, ...(node.childNodes || []).flatMap(descendants)];
const exactFields = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === fields.split(',').sort().join(',');
async function supplementalNotices(desktopRoot, version, chromiumNotice) {
  let provenance;
  try { provenance = parseStrictJson(await readOwnedBytes(join(desktopRoot, 'licenses', 'provenance.json'), 65536)); }
  catch (error) { if (error.code === 'ENOENT') return []; throw new Error('Supplemental notice provenance refused', { cause: error }); }
  if (!exactFields(provenance, 'schema,electronVersion,chromiumNoticeSha256,notices') || provenance.schema !== 1 || provenance.electronVersion !== version || provenance.chromiumNoticeSha256 !== digest(chromiumNotice) || !Array.isArray(provenance.notices) || provenance.notices.length > 20) throw new Error('Supplemental notice runtime binding refused');
  const result = []; const identities = new Set();
  for (const notice of provenance.notices) {
    const id = `${notice.name}:${notice.reference}`;
    if (!exactFields(notice, 'name,reference,version,revision,source,file,sha256') || typeof notice.name !== 'string' || typeof notice.reference !== 'string' || !/^[0-9a-f]{40}$/.test(notice.revision) || typeof notice.version !== 'string' || typeof notice.source !== 'string' || typeof notice.file !== 'string' || notice.file.includes('/') || !validPackagePath(notice.file) || !/^[0-9a-f]{64}$/.test(notice.sha256) || identities.has(id)) throw new Error('Supplemental notice identity refused');
    const source = new URL(notice.source);
    if (source.protocol !== 'https:' || source.hostname !== 'github.com' || source.port || source.search || source.hash || source.username || source.password || !source.pathname.includes(`/${notice.revision}/`)) throw new Error('Supplemental notice source refused');
    const bytes = await readOwnedBytes(join(desktopRoot, 'licenses', notice.file), 131072);
    if (bytes.length < 50 || digest(bytes) !== notice.sha256) throw new Error('Supplemental notice bytes refused');
    identities.add(id); result.push({ ...notice, notice: `notices/${notice.file}` });
  }
  return result;
}
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
  const version = (await readFile(join(electronRoot, 'version'), 'utf8')).trim();
  const supplements = await supplementalNotices(desktopRoot, version, chromiumNotice);
  for (const supplement of supplements) {
    const entry = unresolvedNotices.find(n => n.name === supplement.name && n.reference === supplement.reference);
    if (!entry) throw new Error('Supplemental notice does not match a runtime reference');
    components[entry.noticeIndex].noticeKind = 'supplemental-text';
    components[entry.noticeIndex].supplementalNotice = supplement;
    unresolvedNotices.splice(unresolvedNotices.indexOf(entry), 1);
  }
  return { schema: 1, scope: 'Development runtime inventory; embedded renderer and legal qualification still pending', npm, electron: { version, notice: 'LICENSE', noticeSha256: digest(electronNotice) }, chromium: { notice: 'LICENSES.chromium.html', noticeSha256: digest(chromiumNotice), components, unresolvedNotices, supplementalNotices: supplements }, releaseQualified: false };
}
