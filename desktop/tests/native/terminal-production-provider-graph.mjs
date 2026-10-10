// Source-only production provider prerequisite. Import does no I/O or loading.
// This dedicated two-package contract deliberately does not import the historical
// five-package candidate validator or resolve any dependency executable.
import { lstat, opendir, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const SCHEMA = 'siren-terminal-production-provider-graph/v1';
const MANIFEST = {
  name: 'siren-terminal-provider', version: '0.1.0-dev.1', private: true,
  description: 'Pinned private production Terminal provider resource; candidate qualification required',
  dependencies: { 'node-pty': '1.1.0' }
};
// Exact inspected old lock records, deliberately selected into a new root.
const RECORDS = {
  'node_modules/node-addon-api': {
    version: '7.1.1', resolved: 'https://registry.npmjs.org/node-addon-api/-/node-addon-api-7.1.1.tgz',
    integrity: 'sha512-5m3bsyrjFWE1xf7nz7YXdN4udnVtXK6/Yfgn5qnahL6bCkf2yKt4k3nuTKAtT4r3IG8JNR2ncsIMdZuAzJjHQQ==', license: 'MIT'
  },
  'node_modules/node-pty': {
    version: '1.1.0', resolved: 'https://registry.npmjs.org/node-pty/-/node-pty-1.1.0.tgz',
    integrity: 'sha512-20JqtutY6JPXTUnL0ij1uad7Qe1baT46lyolh2sSENDd4sTzKZ4nmAFkeAARDKwmlLjPx6XKRlwRUxwjOy+lUg==',
    hasInstallScript: true, license: 'MIT', dependencies: { 'node-addon-api': '^7.1.0' }
  }
};
const ROOT = { name: MANIFEST.name, version: MANIFEST.version, dependencies: MANIFEST.dependencies };
const RUNTIME = ['prebuilds/win32-x64/conpty.node', 'prebuilds/win32-x64/conpty_console_list.node', 'lib/index.js', 'lib/windowsTerminal.js', 'lib/terminal.js', 'lib/eventEmitter2.js', 'lib/utils.js', 'lib/windowsPtyAgent.js', 'lib/windowsConoutConnection.js', 'lib/shared/conout.js', 'lib/worker/conoutSocketWorker.js', 'lib/conpty_console_list_agent.js'];
const LIMITS = Object.freeze({ files: 1024, fileBytes: 16 * 1024 * 1024, totalBytes: 96 * 1024 * 1024, directories: 1024, depth: 64 });
const fail = message => { throw new Error(`TERMINAL_PRODUCTION_PROVIDER_GRAPH_REFUSED: ${message}`); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (actual, expected) => isDeepStrictEqual(actual, expected);

function validateLock(lock, installed = false) {
  const expected = { name: MANIFEST.name, version: MANIFEST.version, lockfileVersion: 3, requires: true, packages: installed ? RECORDS : { '': ROOT, ...RECORDS } };
  if (!same(lock, expected)) fail(`${installed ? 'installation ' : ''}lock package/root/version/resolved/integrity/record mismatch`);
}

/** Pure data validation before provisioning. It grants no installation authority. */
export function validateTerminalProductionProviderLock({ manifest, lock } = {}) {
  if (!same(manifest, MANIFEST)) fail('production root manifest/dependency mismatch');
  validateLock(lock);
  return { schema: 'siren-terminal-production-provider-lock/v1', admitted: false, packageNames: ['node-addon-api', 'node-pty'] };
}

function packageRoot(packagePath) {
  if (typeof packagePath !== 'string' || !path.isAbsolute(packagePath)) fail('packagePath must be an absolute production package.json path');
  if (packagePath.includes('\0')) fail('NUL in packagePath');
  if (path.basename(packagePath) !== 'package.json') fail('packagePath must name package.json');
  if (packagePath.split(/[\\/]/).some(part => part === '.' || part === '..')) fail('traversal root refused');
  if (process.platform === 'win32' && (!/^[A-Za-z]:[\\/]/.test(packagePath) || packagePath.slice(2).includes(':'))) fail('Windows device/UNC/alternate data stream root refused');
  return path.dirname(path.resolve(packagePath));
}

// Node lstat catches symlinks and junctions, not all native reparse tags. Repeated
// checks detect ordinary mutations but do not close ancestor check/use races.
async function checkAncestors(target) {
  const parsed = path.parse(target); let cursor = parsed.root;
  const parts = target.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (let i = -1; i < parts.length; i++) {
    if (i >= 0) cursor = path.join(cursor, parts[i]);
    const stat = await lstat(cursor, { bigint: true });
    if (stat.isSymbolicLink()) fail(`Node-visible link/reparse refused: ${cursor}`);
    if (i < parts.length - 1 && !stat.isDirectory()) fail(`non-directory ancestor: ${cursor}`);
    if (i === parts.length - 1) return stat;
  }
  return lstat(parsed.root, { bigint: true });
}
const stable = (a, b) => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'nlink'].every(key => a[key] === b[key]);

function exactText(bytes, label) {
  try {
    const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (!Buffer.from(value, 'utf8').equals(bytes)) fail(`non-roundtrip UTF-8: ${label}`);
    return value;
  } catch (error) { fail(`invalid exact UTF-8 ${label}: ${error.message}`); }
}

function json(bytes, label) {
  try {
    const text = exactText(bytes, label); const value = JSON.parse(text);
    if (!object(value)) fail(`JSON object required: ${label}`);
    // JSON.parse discards duplicate records. Walk already-validated JSON tokens
    // to refuse duplicates, including escaped aliases, in every nested object.
    const stack = [];
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '{' || char === '[') stack.push(char === '{' ? new Set() : null);
      else if (char === '}' || char === ']') stack.pop();
      else if (char === '"') {
        const start = i++;
        while (i < text.length) { if (text[i] === '\\') i += 2; else if (text[i] === '"') break; else i++; }
        let next = i + 1; while (/\s/.test(text[next] ?? '') && next < text.length) next++;
        if (text[next] === ':') {
          const key = JSON.parse(text.slice(start, i + 1)); const keys = stack.at(-1);
          if (!keys || keys.has(key)) fail(`duplicate JSON record: ${label}/${key}`);
          keys.add(key);
        }
      }
    }
    return value;
  } catch (error) { fail(`invalid JSON ${label}: ${error.message}`); }
}

function role(name, relative) {
  if (relative.split('/').some(part => part.toLowerCase() === 'node_modules')) fail(`nested dependency lookup tree: ${relative}`);
  if (name === 'node-pty') {
    if (/^(?:build\/(?:release|debug)|lib\/build\/(?:release|debug)|lib\/prebuilds\/win32-x64)\/(?:conpty|conpty_console_list)\.node(?:\.(?:js|json|node))?(?:\/|$)/i.test(relative) || /^prebuilds\/win32-x64\/(?:conpty|conpty_console_list)\.node\.(?:js|json|node)(?:\/|$)/i.test(relative)) fail(`alternate native lookup shadow: ${relative}`);
    if (RUNTIME.includes(relative)) return relative.endsWith('.node') ? 'selected-production-native-opaque' : 'selected-production-runtime-helper';
  }
  if (/\.(node|exe|dll|so|dylib|a|lib|o|obj|pdb|bin|wasm)$/i.test(relative)) return 'unselected-binary';
  return name === 'node-addon-api' ? 'build-surface' : 'installed-production-file';
}

function validateInstalled(pkg, name, record) {
  if (pkg.name !== name || pkg.version !== record.version || pkg.license !== 'MIT') fail(`installed package version/license mismatch: ${name}`);
  const expectedDependencies = name === 'node-pty' ? { 'node-addon-api': '^7.1.0' } : {};
  for (const [key, expected] of [['dependencies', expectedDependencies], ['optionalDependencies', {}], ['peerDependencies', {}]]) {
    if (!same(Object.hasOwn(pkg, key) ? pkg[key] : {}, expected)) fail(`installed package dependency graph mismatch: ${name}/${key}`);
  }
  if (['workspaces', 'bundledDependencies', 'bundleDependencies'].some(key => Object.hasOwn(pkg, key))) fail(`unknown installed package dependency surface: ${name}`);
  if (name === 'node-pty' && (pkg.main !== './lib/index.js' || ['exports', 'type', 'imports'].some(key => Object.hasOwn(pkg, key)))) fail('node-pty CommonJS entry resolution mismatch');
}

/** Inventory explicitly supplied production installation as inert local bytes. */
export async function captureTerminalProductionProviderGraph({ packagePath } = {}) {
  const root = packageRoot(packagePath); const rootStat = await checkAncestors(root);
  if (!rootStat.isDirectory()) fail('production root is not a directory');
  const budget = { files: 0, bytes: 0, directories: 0 };
  const snapshots = [{ target: root, before: rootStat }], directories = [];
  async function read(relativePath) {
    const target = path.join(root, ...relativePath.split('/')); const before = await checkAncestors(target);
    if (!before.isFile() || before.nlink !== 1n) fail(`nonregular or hard-linked file: ${relativePath}`);
    if (++budget.files > LIMITS.files || before.size > BigInt(LIMITS.fileBytes) || budget.bytes + Number(before.size) > LIMITS.totalBytes) fail(`file read budget exceeded: ${relativePath}`);
    const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); let bytes;
    try {
      const opened = await handle.stat({ bigint: true });
      if (!opened.isFile() || !stable(before, opened)) fail(`file changed before read: ${relativePath}`);
      bytes = Buffer.alloc(Number(before.size)); let offset = 0;
      while (offset < bytes.length) { const part = await handle.read(bytes, offset, bytes.length - offset, offset); if (!part.bytesRead) fail(`file shortened during read: ${relativePath}`); offset += part.bytesRead; }
      if ((await handle.read(Buffer.alloc(1), 0, 1, bytes.length)).bytesRead) fail(`file grew during read: ${relativePath}`);
      if (!stable(before, await handle.stat({ bigint: true }))) fail(`file changed during read: ${relativePath}`);
    } finally { await handle.close(); }
    if (!stable(before, await checkAncestors(target))) fail(`file changed after read: ${relativePath}`);
    budget.bytes += bytes.length; snapshots.push({ target, before });
    return { entry: { relativePath, bytes: bytes.length, sha256: sha(bytes) }, bytes };
  }
  async function namesAt(target) {
    const names = [], folded = new Set();
    for await (const item of await opendir(target, { bufferSize: 32 })) {
      const name = item.name;
      if (/[\x00-\x1f\x7f:\\]/.test(name) || /[. ]$/.test(name) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) fail(`ambiguous installed path: ${name}`);
      if (folded.has(name.toLowerCase())) fail(`ambiguous case-alias path: ${name}`);
      folded.add(name.toLowerCase()); names.push(name);
      if (names.length > LIMITS.files + LIMITS.directories) fail('directory entry budget exceeded');
    }
    return names.sort();
  }
  async function entries(relativePath, depth = 0) {
    if (depth > LIMITS.depth || ++budget.directories > LIMITS.directories) fail('directory/depth traversal budget exceeded');
    const target = path.join(root, ...relativePath.split('/')); const before = await checkAncestors(target);
    if (!before.isDirectory()) fail(`non-directory package root: ${relativePath}`);
    const names = await namesAt(target); snapshots.push({ target, before, names }); directories.push(relativePath); return names;
  }
  const manifestFile = await read('package.json'), lockFile = await read('package-lock.json');
  const manifest = json(manifestFile.bytes, 'package.json'), lock = json(lockFile.bytes, 'package-lock.json');
  validateTerminalProductionProviderLock({ manifest, lock });
  const modules = await entries('node_modules');
  if (!same(modules.filter(name => name !== '.package-lock.json'), ['node-addon-api', 'node-pty'])) fail('unexpected/unknown production node_modules package set');
  const installationMetadata = [];
  if (modules.includes('.package-lock.json')) {
    const hidden = await read('node_modules/.package-lock.json'); validateLock(json(hidden.bytes, 'node_modules/.package-lock.json'), true); installationMetadata.push(hidden.entry);
  }
  const packages = [], notices = [], selectedRuntime = [], selectedNative = [], unselectedBinaries = [], buildSurface = [];
  let installedBytes = 0;
  for (const [prefix, record] of Object.entries(RECORDS)) {
    const name = prefix.slice('node_modules/'.length); const files = [], buffers = new Map();
    async function walk(relative, depth) {
      for (const child of await entries(relative, depth)) {
        const file = `${relative}/${child}`, local = file.slice(prefix.length + 1); const candidateRole = role(name, local);
        const stat = await checkAncestors(path.join(root, ...file.split('/')));
        if (stat.isDirectory()) {
          if (name === 'node-pty' && RUNTIME.includes(local)) fail(`required runtime artifact is a directory/shadow: ${local}`);
          await walk(file, depth + 1);
        } else {
          const { entry, bytes } = await read(file); entry.role = candidateRole; files.push(entry); buffers.set(local, bytes); installedBytes += entry.bytes;
        }
      }
    }
    await walk(prefix, 0); files.sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0);
    if (!buffers.has('package.json')) fail(`missing installed package manifest: ${name}`);
    const pkg = json(buffers.get('package.json'), `${prefix}/package.json`); validateInstalled(pkg, name, record);
    for (const noticePath of name === 'node-pty' ? ['LICENSE', 'deps/winpty/LICENSE'] : ['LICENSE.md']) {
      if (!buffers.has(noticePath)) fail(`missing primary license notice: ${name}/${noticePath}`);
      const entry = files.find(item => item.relativePath === `${prefix}/${noticePath}`); const text = exactText(buffers.get(noticePath), entry.relativePath);
      if (!text.trim()) fail(`empty primary license notice: ${entry.relativePath}`); notices.push({ ...entry, text });
    }
    if (name === 'node-pty') for (const runtimePath of RUNTIME) {
      const entry = files.find(item => item.relativePath === `${prefix}/${runtimePath}`);
      if (!entry || !entry.bytes) fail(`missing required runtime artifact: ${runtimePath}`);
      selectedRuntime.push({ ...entry }); if (runtimePath.endsWith('.node')) selectedNative.push({ ...entry });
    }
    for (const entry of files) { if (entry.role === 'unselected-binary') unselectedBinaries.push({ ...entry }); if (name === 'node-addon-api') buildSurface.push({ ...entry }); }
    packages.push({ name, version: record.version, resolved: record.resolved, integrity: record.integrity, manifest: pkg, files });
  }
  for (const snapshot of snapshots) {
    if (!stable(snapshot.before, await checkAncestors(snapshot.target))) fail(`changed filesystem snapshot: ${snapshot.target}`);
    if (snapshot.names && !same(snapshot.names, await namesAt(snapshot.target))) fail(`changed directory membership: ${snapshot.target}`);
  }
  return {
    schema: SCHEMA, evidenceClass: 'SOURCE_ONLY', admitted: false, packagePath: path.join(root, 'package.json'),
    rootManifest: { ...manifestFile.entry, text: exactText(manifestFile.bytes, 'package.json'), metadata: manifest },
    lock: { ...lockFile.entry, text: exactText(lockFile.bytes, 'package-lock.json'), metadata: lock },
    installationMetadata, packages, directories: directories.sort(), notices, selectedRuntime, selectedNative, unselectedBinaries, buildSurface,
    selection: { platform: 'win32', architecture: 'x64', backend: 'OS-inbox ConPTY', useConpty: true, useConptyDll: false, sourceResolution: 'fixed inspected node-pty 1.1.0 paths; selection policy only, not proof of an actual native load' },
    summary: { installedFiles: packages.reduce((sum, pkg) => sum + pkg.files.length, 0), installedBytes, readFiles: budget.files, readBytes: budget.bytes }, limits: { ...LIMITS },
    buildProvenance: { status: 'unknown', upstreamCompiler: 'unknown', compilerFlags: 'unknown', headers: 'unknown', sourceToPrebuildAttestation: 'unknown', note: 'Pinned lock metadata and local hashes do not prove npm tarball reconstruction, signatures, or source-to-prebuild provenance.' },
    boundaries: { nativeExecution: false, packageCodeExecuted: false, network: false, securityAudit: false, latestVersionCheck: false, legalAdmission: false, productAllowedList: false, asarQualified: false, filesystemGuarantee: 'Best-effort Node fs lstat/open/fstat and repeated directory membership checks refuse Node-visible symlinks/junctions/hardlinks. Ancestor check/use races and non-symlink Windows reparse tags are not closed-world proven by native handles.' }
  };
}

/** Re-read the same explicit production root. Any receipt difference refuses. */
export async function recheckTerminalProductionProviderGraph({ packagePath, receipt } = {}) {
  if (!object(receipt) || receipt.schema !== SCHEMA || receipt.admitted !== false) fail('invalid receipt schema/admission');
  const current = await captureTerminalProductionProviderGraph({ packagePath });
  if (!same(current, receipt)) fail('receipt mismatch: changed, extra or missing graph bytes/metadata/directories');
  return { schema: SCHEMA, unchanged: true, admitted: false, installedFiles: current.summary.installedFiles };
}
