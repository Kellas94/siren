// Isolated test evidence only. Nothing here loads or admits a candidate package.
import { lstat, readdir, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const SCHEMA = 'siren-terminal-candidate-graph/v1';
const VERSIONS = Object.freeze({ '@xterm/addon-fit': '0.11.0', '@xterm/addon-search': '0.16.0', '@xterm/xterm': '6.0.0', 'node-addon-api': '7.1.1', 'node-pty': '1.1.0' });
const TOP = Object.freeze({ '@xterm/xterm': '6.0.0', '@xterm/addon-fit': '0.11.0', '@xterm/addon-search': '0.16.0', 'node-pty': '1.1.0' });
const RUNTIME = Object.freeze(['prebuilds/win32-x64/conpty.node', 'prebuilds/win32-x64/conpty_console_list.node', 'lib/index.js', 'lib/windowsTerminal.js', 'lib/terminal.js', 'lib/eventEmitter2.js', 'lib/utils.js', 'lib/windowsPtyAgent.js', 'lib/windowsConoutConnection.js', 'lib/shared/conout.js', 'lib/worker/conoutSocketWorker.js', 'lib/conpty_console_list_agent.js']);
const LIMITS = Object.freeze({ files: 1024, fileBytes: 16 * 1024 * 1024, totalBytes: 96 * 1024 * 1024, directories: 1024, depth: 64 });
const fail = message => { throw new Error(`TERMINAL_CANDIDATE_GRAPH_REFUSED: ${message}`); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slash = value => value.split(path.sep).join('/');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameMap = (actual, expected) => object(actual) && isDeepStrictEqual(Object.entries(actual).sort(), Object.entries(expected).sort());

function packageRoot(packagePath) {
  if (typeof packagePath !== 'string' || !path.isAbsolute(packagePath)) fail('packagePath must be an absolute candidate package.json path');
  if (packagePath.includes('\0') || path.basename(packagePath) !== 'package.json') fail('packagePath must name package.json');
  // Avoid drive-relative, UNC/device paths, ADS and lexical traversal ambiguity.
  if (process.platform === 'win32' && (!/^[A-Za-z]:[\\/]/.test(packagePath) || packagePath.slice(2).includes(':'))) fail('refused Windows root or alternate data stream');
  if (packagePath.split(/[\\/]/).some(part => part === '.' || part === '..')) fail('refused traversal root');
  return path.dirname(path.resolve(packagePath));
}

// lstat catches Node-visible symbolic links and Windows junctions. It cannot
// prove all Windows reparse tags absent or close ancestor check/use races.
async function checkAncestors(target) {
  const parsed = path.parse(target);
  let cursor = parsed.root;
  const parts = target.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (let i = -1; i < parts.length; i++) {
    if (i >= 0) cursor = path.join(cursor, parts[i]);
    const stat = await lstat(cursor, { bigint: true });
    if (stat.isSymbolicLink()) fail(`link/reparse path refused: ${cursor}`);
    if (i < parts.length - 1 && !stat.isDirectory()) fail(`non-directory ancestor: ${cursor}`);
    if (i === parts.length - 1) return stat;
  }
  return lstat(parsed.root, { bigint: true });
}

function stable(a, b) {
  return ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'nlink'].every(key => a[key] === b[key]);
}

function text(bytes, label) {
  try {
    // ignoreBOM preserves a leading BOM as data in the exact notice text.
    const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (!Buffer.from(value, 'utf8').equals(bytes)) fail(`non-roundtrip UTF-8: ${label}`);
    return value;
  } catch (error) { fail(`invalid exact UTF-8 ${label}: ${error.message}`); }
}

function json(bytes, label) {
  try { const value = JSON.parse(text(bytes, label)); if (!object(value)) fail(`object required: ${label}`); return value; }
  catch (error) { fail(`invalid JSON ${label}: ${error.message}`); }
}

function validateGraph(manifest, lock) {
  if (!sameMap(manifest.dependencies, TOP) || manifest.name !== 'siren-terminal-isolated-candidate' || manifest.private !== true || manifest.type !== 'module' || Object.keys(manifest).sort().join(',') !== 'dependencies,name,private,type') fail('unknown root manifest graph');
  if (lock.name !== manifest.name || lock.lockfileVersion !== 3 || lock.requires !== true || !object(lock.packages)) fail('unknown lock metadata');
  const expectedKeys = ['', ...Object.keys(VERSIONS).map(name => `node_modules/${name}`)].sort();
  if (!isDeepStrictEqual(Object.keys(lock.packages).sort(), expectedKeys)) fail('unknown lock package graph');
  if (lock.packages[''].name !== manifest.name || !sameMap(lock.packages[''].dependencies, TOP)) fail('root lock dependency mismatch');
  for (const [name, version] of Object.entries(VERSIONS)) {
    const entry = lock.packages[`node_modules/${name}`];
    if (!object(entry) || entry.version !== version) fail(`unknown lock version: ${name}`);
    const resolved = `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`;
    if (entry.resolved !== resolved || typeof entry.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(entry.integrity) || entry.license !== 'MIT' || entry.link === true) fail(`unknown lock identity: ${name}`);
    if (!sameMap(entry.dependencies ?? {}, name === 'node-pty' ? { 'node-addon-api': '^7.1.0' } : {})) fail(`unknown locked dependencies: ${name}`);
    if (!sameMap(entry.optionalDependencies ?? {}, {})) fail(`unknown optional dependencies: ${name}`);
  }
}

function role(name, relativePath) {
  // utils.loadNativeModule searches these directories too. They must never be
  // described as unselected while potentially replacing the two recorded files.
  if (name === 'node-pty' && /^(?:build\/(?:release|debug)|lib\/build\/(?:release|debug)|lib\/prebuilds\/win32-x64)\/(?:conpty|conpty_console_list)\.node(?:\.(?:js|json|node))?(?:\/|$)/i.test(relativePath)) fail(`alternate native shadow path: ${relativePath}`);
  if (name === 'node-pty' && RUNTIME.includes(relativePath)) return relativePath.endsWith('.node') ? 'selected-candidate-native-opaque' : 'selected-candidate-runtime-helper';
  if (/\.(node|exe|dll|so|dylib|a|lib|o|obj|pdb|bin|wasm)$/i.test(relativePath)) return 'unselected-binary';
  if (name === 'node-addon-api') return 'build-surface';
  return 'installed-candidate-file';
}

/** Capture a fixed isolated candidate graph as inert local bytes, never load it. */
export async function captureTerminalCandidateGraph({ packagePath } = {}) {
  const root = packageRoot(packagePath);
  const rootStat = await checkAncestors(root);
  if (!rootStat.isDirectory()) fail('candidate root is not a directory');
  const budget = { files: 0, bytes: 0, directories: 0 };
  const snapshots = [];
  const directories = [];
  async function read(relativePath) {
    const target = path.join(root, ...relativePath.split('/'));
    const before = await checkAncestors(target);
    if (!before.isFile() || before.nlink !== 1n) fail(`nonregular or hard-linked file: ${relativePath}`);
    if (++budget.files > LIMITS.files || before.size > BigInt(LIMITS.fileBytes) || budget.bytes + Number(before.size) > LIMITS.totalBytes) fail(`read budget exceeded: ${relativePath}`);
    // NOFOLLOW also protects the final path component where Node/OS supports it.
    const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let bytes;
    try {
      const opened = await handle.stat({ bigint: true });
      if (!opened.isFile() || !stable(before, opened)) fail(`file changed before read: ${relativePath}`);
      bytes = Buffer.alloc(Number(before.size));
      let offset = 0;
      while (offset < bytes.length) { const chunk = await handle.read(bytes, offset, bytes.length - offset, offset); if (!chunk.bytesRead) fail(`file shortened during read: ${relativePath}`); offset += chunk.bytesRead; }
      const tail = Buffer.alloc(1); if ((await handle.read(tail, 0, 1, bytes.length)).bytesRead) fail(`file grew during read: ${relativePath}`);
      if (!stable(before, await handle.stat({ bigint: true }))) fail(`file changed during read: ${relativePath}`);
    } finally { await handle.close(); }
    if (!stable(before, await checkAncestors(target))) fail(`file changed after read: ${relativePath}`);
    budget.bytes += bytes.length;
    snapshots.push({ target, before });
    return { entry: { relativePath, bytes: bytes.length, sha256: sha(bytes) }, bytes };
  }
  async function entries(relativePath, depth = 0) {
    if (depth > LIMITS.depth || ++budget.directories > LIMITS.directories) fail('directory traversal budget exceeded');
    const target = path.join(root, ...relativePath.split('/'));
    const before = await checkAncestors(target);
    if (!before.isDirectory()) fail(`non-directory package root: ${relativePath}`);
    const names = (await readdir(target)).sort();
    directories.push(relativePath);
    snapshots.push({ target, before, names });
    return names;
  }
  const manifestFile = await read('package.json');
  const lockFile = await read('package-lock.json');
  const manifest = json(manifestFile.bytes, 'package.json');
  const lock = json(lockFile.bytes, 'package-lock.json');
  validateGraph(manifest, lock);
  const modules = await entries('node_modules');
  if (!isDeepStrictEqual(modules.filter(name => name !== '.package-lock.json'), ['@xterm', 'node-addon-api', 'node-pty'])) fail('unexpected node_modules root');
  const scopes = await entries('node_modules/@xterm');
  if (!isDeepStrictEqual(scopes, ['addon-fit', 'addon-search', 'xterm'])) fail('unexpected scoped dependency root');
  const installationMetadata = [];
  if (modules.includes('.package-lock.json')) installationMetadata.push((await read('node_modules/.package-lock.json')).entry);
  const packages = [], notices = [], selectedRuntime = [], selectedNative = [], unselectedBinaries = [], buildSurface = [];
  let installedBytes = 0;
  for (const [name, version] of Object.entries(VERSIONS)) {
    const prefix = `node_modules/${name}`;
    const files = [];
    const buffers = new Map();
    async function walk(relative, depth) {
      for (const child of await entries(relative, depth)) {
        // Reject Windows ADS/ambiguous aliases as well as every link, before read.
        if (child.includes(':') || /[. ]$/.test(child)) fail(`ambiguous installed path: ${child}`);
        const file = `${relative}/${child}`;
        // Node also resolves .node-named directories and extension fallbacks.
        // Refuse the candidate before deciding whether to recurse into it.
        const candidateRole = role(name, file.slice(prefix.length + 1));
        const stat = await checkAncestors(path.join(root, ...file.split('/')));
        if (stat.isDirectory()) await walk(file, depth + 1);
        else {
          const { entry, bytes } = await read(file);
          entry.role = candidateRole;
          files.push(entry); buffers.set(file.slice(prefix.length + 1), bytes); installedBytes += entry.bytes;
        }
      }
    }
    await walk(prefix, 0);
    files.sort((a, b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0);
    if (!buffers.has('package.json')) fail(`missing package manifest: ${name}`);
    const pkg = json(buffers.get('package.json'), `${name}/package.json`);
    if (pkg.name !== name || pkg.version !== version || pkg.license !== 'MIT') fail(`unknown installed package version/license: ${name}`);
    // The actual test worker requires node-pty by package name. Pin the inspected
    // CommonJS entry instead of merely recording metadata that could escape the
    // captured graph or override the fixed lib/index.js runtime candidate.
    if (name === 'node-pty' && (pkg.main !== './lib/index.js' || ['exports', 'type', 'imports'].some(key => Object.hasOwn(pkg, key)))) fail('node-pty entry resolution mismatch');
    if (!sameMap(pkg.dependencies ?? {}, name === 'node-pty' ? { 'node-addon-api': '^7.1.0' } : {}) || !sameMap(pkg.optionalDependencies ?? {}, {}) || !sameMap(pkg.peerDependencies ?? {}, {})) fail(`unknown installed dependency graph: ${name}`);
    const requiredNotices = name === 'node-pty' ? ['LICENSE', 'deps/winpty/LICENSE'] : [name === 'node-addon-api' ? 'LICENSE.md' : 'LICENSE'];
    for (const noticePath of requiredNotices) {
      if (!buffers.has(noticePath)) fail(`missing primary license: ${name}/${noticePath}`);
      const entry = files.find(file => file.relativePath === `${prefix}/${noticePath}`);
      const exactText = text(buffers.get(noticePath), entry.relativePath);
      if (!exactText.trim()) fail(`empty primary license: ${entry.relativePath}`);
      notices.push({ ...entry, text: exactText });
    }
    if (name === 'node-pty') for (const runtimePath of RUNTIME) {
      const entry = files.find(file => file.relativePath === `${prefix}/${runtimePath}`);
      if (!entry || !entry.bytes) fail(`missing required runtime artifact: ${runtimePath}`);
      selectedRuntime.push({ ...entry });
      if (runtimePath.endsWith('.node')) selectedNative.push({ ...entry });
    }
    for (const entry of files) {
      if (entry.role === 'unselected-binary') unselectedBinaries.push({ ...entry });
      if (name === 'node-addon-api') buildSurface.push({ ...entry });
    }
    packages.push({ name, version, resolved: lock.packages[prefix].resolved, integrity: lock.packages[prefix].integrity, manifest: pkg, files });
  }
  // Recheck names and lstat identities to detect ordinary concurrent mutation;
  // this is deliberately not represented as a native handle closed-world proof.
  for (const snapshot of snapshots) {
    if (!stable(snapshot.before, await checkAncestors(snapshot.target))) fail(`changed filesystem snapshot: ${snapshot.target}`);
    if (snapshot.names && !isDeepStrictEqual(snapshot.names, (await readdir(snapshot.target)).sort())) fail(`changed directory membership: ${snapshot.target}`);
  }
  return {
    schema: SCHEMA, admitted: false, packagePath: path.join(root, 'package.json'),
    rootManifest: { ...manifestFile.entry, text: text(manifestFile.bytes, 'package.json'), metadata: manifest },
    lock: { ...lockFile.entry, text: text(lockFile.bytes, 'package-lock.json'), metadata: lock },
    installationMetadata, packages, directories: directories.sort(), notices,
    selectedRuntime, selectedNative, unselectedBinaries, buildSurface,
    selection: { platform: 'win32', architecture: 'x64', backend: 'OS-inbox ConPTY', useConpty: true, useConptyDll: false, sourceResolution: 'fixed paths from inspected node-pty 1.1.0 source; candidate evidence only, not actual load selection' },
    summary: { installedFiles: packages.reduce((sum, pkg) => sum + pkg.files.length, 0), installedBytes, readFiles: budget.files, readBytes: budget.bytes },
    limits: { ...LIMITS },
    buildProvenance: { status: 'unknown', upstreamCompiler: 'unknown', compilerFlags: 'unknown', headers: 'unknown', sourceToPrebuildAttestation: 'unknown', note: 'Lock identity is recorded; npm tarball reconstruction, signing and actual build provenance require separate evidence.' },
    boundaries: { nativeExecution: false, packageCodeExecuted: false, network: false, securityAudit: false, latestVersionCheck: false, legalAdmission: false, productAllowedList: false, asarQualified: false, filesystemGuarantee: 'Best-effort pure fs lstat/open/fstat and repeated membership checks; Node-visible symlinks/junctions/hardlinks are refused. Check/use races and Windows non-symlink reparse tags are not closed-world proven by native handles.' }
  };
}

/** Re-read the original fixed root; differences throw, never become success. */
export async function recheckTerminalCandidateGraph({ packagePath, receipt } = {}) {
  if (!object(receipt) || receipt.schema !== SCHEMA || receipt.admitted !== false) fail('invalid receipt schema/admission');
  const current = await captureTerminalCandidateGraph({ packagePath });
  if (!isDeepStrictEqual(current, receipt)) fail('receipt mismatch: changed, extra or missing captured graph bytes/metadata/directories');
  return { schema: SCHEMA, unchanged: true, admitted: false, installedFiles: current.summary.installedFiles };
}
