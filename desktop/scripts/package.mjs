import { mkdir, copyFile, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createPackage, listPackage } from '@electron/asar';
import { buildRenderer } from '../build/renderer.mjs';
import { buildInventory } from './inventory.mjs';
import { hashOwnedFile } from '../src/updates/download.mjs';

const runtimeFiles = new Set(['chrome_100_percent.pak','chrome_200_percent.pak','d3dcompiler_47.dll','dxcompiler.dll','dxil.dll','electron.exe','ffmpeg.dll','icudtl.dat','LICENSE','LICENSES.chromium.html','resources.pak','snapshot_blob.bin','v8_context_snapshot.bin','version','vk_swiftshader_icd.json','vk_swiftshader.dll','vulkan-1.dll']);
const sourceFiles = new Set(['src/main.mjs','src/preload.cjs','src/data-root.mjs','src/ipc.mjs','src/protocol.mjs','src/publisher-config.mjs',
  ...['access','credentials','local-pin','oidc','permit','service'].map(n=>`src/account/${n}.mjs`),
  ...['atomic','budgets','domain-validation','import-validation','import-validator-window','io','migration','paths','selection','store'].map(n=>`src/projects/${n}.mjs`),
  ...['access','checkpoints','diagnostics','processes','sessions'].map(n=>`src/recovery/${n}.mjs`),
  ...['manifest','metrics','migration','readers','read-ipc','recovery','repository','text-model','ipc','analysis','diff-worker'].map(n=>`src/sources/${n}.mjs`),
  ...['contracts','entries','authority','service','project-copies','source-import','document-create','continue','transition-receipts','store','catalog','resolver','ipc'].map(n=>`src/navigation/${n}.mjs`),
  ...['readiness','registry','geometry','factory','entities','ipc','coordinator','primary','docs','domain','source-bridge','source-reads','source-analysis','working-sources','code-docs','docs-reads','docs-sources','docs-edits','diagram-reads','diagram-edits','diagram-export','diagram-vector-render','catalog','home-admission','readonly-seals','control','source-barrier','presentation','presentation-deck','presentation-render','presentation-ipc'].map(n=>`src/windows/${n}.mjs`), 'src/windows/preload.cjs','src/windows/presentation-preload.cjs',
  ...['download','github','manifest','service'].map(n=>`src/updates/${n}.mjs`)]);
export function allowedAppFile(path, production) {
  if (sourceFiles.has(path)) return true;
  if (typeof path !== 'string' || path.split('/').some(p => !p || p === '.' || p === '..') || path.includes('\\') || /(?:\.map|\.d\.ts|\.log|\.pem|\.key)$/.test(path) || /(?:^|\/)(?:\.env[^/]*|credentials[^/]*|test-[^/]*|[^/]*\.test\.[^/]*)$/.test(path)) return false;
  if (path === 'package.json' || path === 'generated/app.html' || path === 'generated/home.html' || path === 'generated/build.json' || path === 'generated/import-validation.html' || path==='generated/presentation-render.html' || path==='generated/diagram-vector.html' || path==='generated/code-analysis-worker.cjs' || ['generated/windows/code.html','generated/windows/docs.html','generated/windows/diagram.html','generated/windows/presenter.html','generated/windows/audience.html'].includes(path)) return true;
  if (path.startsWith('src/')) return false;
  const match = path.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)\/(.+)$/);
  return !!match && production.has(match[1]) && /\.(?:js|mjs|cjs|json)$|(?:^|\/)LICENSE(?:\.md|\.txt)?$/i.test(match[2]);
}
async function walk(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error('Package links refused');
    if (entry.isDirectory()) files.push(...await walk(join(directory, entry.name), path)); else if (entry.isFile()) files.push(path); else throw new Error('Package special file refused');
  }
  return files;
}
export async function collectApplicationInputs(desktopRoot, production) {
  const candidates = ['package.json','generated/app.html','generated/home.html','generated/build.json','generated/import-validation.html','generated/presentation-render.html','generated/diagram-vector.html','generated/code-analysis-worker.cjs','generated/windows/code.html','generated/windows/docs.html','generated/windows/diagram.html','generated/windows/presenter.html','generated/windows/audience.html', ...(await walk(join(desktopRoot, 'src'))).map(p => 'src/' + p)];
  for (const packageName of production) candidates.push(...(await walk(join(desktopRoot, 'node_modules', packageName))).map(p => `node_modules/${packageName}/` + p));
  return candidates.filter(path => allowedAppFile(path, production));
}
export async function buildDevelopmentPackage({ desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'), sourceCommit }) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('Committed source identity required');
  const identity = JSON.parse(await readFile(join(desktopRoot, 'package.json'), 'utf8'));
  const renderer = await buildRenderer({ baselinePath: join(desktopRoot, 'baseline/R78.html'), outputDir: join(desktopRoot, 'generated') });
  const electronRoot = join(desktopRoot, 'node_modules/electron/dist');
  const inventory = await buildInventory({ desktopRoot, electronRoot });
  const production = new Set(inventory.npm.map(p => p.name));
  const previewRoot = join(desktopRoot, 'dist', `development-${randomUUID()}`); const source = join(desktopRoot, 'dist', `.build-input-${randomUUID()}`); const version = '0.1.0';
  const app = join(previewRoot, 'App', 'versions', version); await mkdir(app, { recursive: true }); await mkdir(source);
  const included = await collectApplicationInputs(desktopRoot, production);
  for (const path of included) { await mkdir(dirname(join(source, path)), { recursive: true }); await copyFile(join(desktopRoot, path), join(source, path)); }
  // Runtime binaries are copied unchanged, never patched/re-signed or represented as a qualified launcher.
  for (const entry of await readdir(electronRoot, { withFileTypes: true })) {
    if (entry.name === 'resources') continue;
    if (entry.name === 'locales' && entry.isDirectory()) { for (const path of await walk(join(electronRoot, 'locales'))) { if (!/^[a-zA-Z0-9_-]+\.pak$/.test(path)) throw new Error('Runtime locale refused'); await mkdir(join(app, 'locales'), { recursive: true }); await copyFile(join(electronRoot, 'locales', path), join(app, 'locales', path)); } continue; }
    if (!entry.isFile() || !runtimeFiles.has(entry.name)) throw new Error('Unidentified runtime file');
    await copyFile(join(electronRoot, entry.name), join(app, entry.name));
  }
  await rename(join(app, 'electron.exe'), join(app, 'SIREN.exe')); await mkdir(join(app, 'resources'));
  const archivePath = join(app, 'resources', 'app.asar'); await createPackage(source, archivePath);
  const archiveEntries = listPackage(archivePath, { isPack: false }).map(path => path.replaceAll('\\', '/').replace(/^\//, ''));
  for (const path of sourceFiles) if (!archiveEntries.includes(path)) throw new Error('Required runtime module missing from archive');
  for (const path of included.filter(path => path.startsWith('generated/'))) if (!archiveEntries.includes(path)) throw new Error('Required generated entry missing from archive');
  if (archiveEntries.some(path => !sourceFiles.has(path) && /(?:test-oidc|(?:^|\/)tests\/|(?:^|\/)baseline\/|\.map$|credentials|\.env)/i.test(path))) throw new Error('Development input leaked into application archive');
  await writeFile(join(app, 'SIREN-RUNTIME-INVENTORY.json'), JSON.stringify(inventory, null, 2));
  for (const notice of inventory.chromium.supplementalNotices) {
    await mkdir(join(app, 'notices'), { recursive: true });
    const destination = join(app, 'notices', notice.file);
    await copyFile(join(desktopRoot, 'licenses', notice.file), destination);
    const copied = await hashOwnedFile(destination, 131072);
    if (copied.sha256 !== notice.sha256) throw new Error('Copied supplemental notice changed');
  }
  const binary = await hashOwnedFile(join(app, 'SIREN.exe'), 1024 ** 3); const originalBinary = await hashOwnedFile(join(electronRoot, 'electron.exe'), 1024 ** 3);
  if (binary.sha256 !== originalBinary.sha256) throw new Error('Runtime binary changed during copying');
  const receipt = { schema: 1, kind: 'development-preview', releaseAdmitted: false, sourceCommit, desktopVersion: identity.version, rendererVersion: '1.131.0', renderer, electron: inventory.electron.version, dataSchema: 1, appRelativePath: `App/versions/${version}/SIREN.exe`, appArchive: await hashOwnedFile(archivePath, 1024 ** 3), runtimeBinary: binary, inventoryQualified: false, launcherQualified: false, accountConfigured: false, updatesConfigured: false };
  await writeFile(join(previewRoot, 'BUILD-IDENTITY.json'), JSON.stringify(receipt, null, 2));
  await writeFile(join(previewRoot, 'README.txt'), 'SIREN desktop development preview. Not a production portable release.\nOpen App/versions/0.1.0/SIREN.exe to inspect the prototype.\nProjects/recovery/profile are created in Data outside App. Production activation/feed and the update launcher are not configured or qualified. No general portability/security/licensing admission is claimed.\n');
  return { previewRoot, appPath: join(app, 'SIREN.exe'), receipt };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(await buildDevelopmentPackage({ sourceCommit: process.argv[2] })));
