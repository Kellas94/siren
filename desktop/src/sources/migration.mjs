import { randomUUID } from 'node:crypto';
import { digest } from '../projects/atomic.mjs';
import { validId } from '../projects/paths.mjs';
import { commitManifest, sourceReferenceKey } from './manifest.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const error = code => Object.assign(new Error(code), { code });
const pointer = ref => ({ sourceId: ref.sourceId, version: ref.version, sha256: ref.sha256 });
const setOwn = (target, key, value) => Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });

/** Remap native pointers; legacy row/source/agent/release identities are untouched. */
export function remapSourceReferences(metadata, mapping) {
  let visited = 0;
  const lookup = key => mapping instanceof Map ? mapping.get(key) : mapping?.[key];
  function walk(value, depth = 0) {
    if (++visited > 1000000 || depth > 64) throw error('INVALID_MANIFEST_METADATA');
    if (Array.isArray(value)) return value.map(child => walk(child, depth + 1));
    if (!object(value)) return value;
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'sourceRef' || key === 'baseSourceRef') {
        const ref = lookup(sourceReferenceKey(child));
        if (!ref) throw error('UNKNOWN_SOURCE_REFERENCE');
        setOwn(result, key, pointer(ref));
      } else if (key === 'storage' && object(child)) {
        setOwn(result, key, {});
        for (const [storageKey, stored] of Object.entries(child)) {
          if (typeof stored === 'string') {
            let parsed;
            try { parsed = JSON.parse(stored); } catch { setOwn(result[key], storageKey, stored); continue; }
            const transformed = walk(parsed, depth + 1);
            const serialized = JSON.stringify(transformed);
            setOwn(result[key], storageKey, serialized === JSON.stringify(parsed) ? stored : serialized);
          } else setOwn(result[key], storageKey, walk(stored, depth + 1));
        }
      } else setOwn(result, key, walk(child, depth + 1));
    }
    return result;
  }
  return walk(metadata);
}

export async function migrateLegacySources({ snapshot, repository, projects, recovery }) {
  let created;
  const originalProjectId = snapshot?.project?.id;
  try {
    if (snapshot?.schema !== 1 || !validId(originalProjectId) || typeof snapshot.json !== 'string' ||
        digest(Buffer.from(snapshot.json)) !== snapshot.sha256) throw error('INVALID_LEGACY_SNAPSHOT');
    const metadata = JSON.parse(snapshot.json);
    if (!object(metadata)) throw error('INVALID_LEGACY_SNAPSHOT');
    // This new project's initial copy retains all attempted work if any later
    // source import fails. The original project's directory is never written.
    created = await projects.createProject({ label: `${snapshot.project.label.slice(0, 175)} — migrated`, json: snapshot.json, purpose: 'migration' });
    const projectId = created.project.id;
    const sources = new Map();
    const sourceRefs = [];
    const legacyRefs = new Map();
    const workspaceRefs = new Map();
    let primaryRefs;
    const legacyBytes = new Map();
    const mapping = {};
    async function extract(text, identity, provenance) {
      if (typeof text !== 'string' || !text.isWellFormed()) throw error('INVALID_LEGACY_UNICODE');
      const bytes = Buffer.from(text);
      const key = JSON.stringify([identity, digest(bytes)]);
      if (sources.has(key)) return sources.get(key);
      const ref = await repository.importSource({ projectId, bytes, provenance });
      sources.set(key, ref); sourceRefs.push(ref); legacyBytes.set(ref.sourceId, text);
      return ref;
    }
    const provenance = (kind, values) => Object.fromEntries(Object.entries({ kind, ...values }).filter(([, value]) => value !== undefined));
    const legacyKey = ref => JSON.stringify(ref);
    const register = (legacy, ref, local) => {
      const key = legacyKey(legacy);
      if (local) local.set(key, ref);
      if (!legacyRefs.has(key) || local === primaryRefs) {
        legacyRefs.set(key, ref); mapping[key] = pointer(ref);
      }
    };
    const workspaces = [];
    const draftGroups = [];
    let visited = 0;
    function collect(value, path = [], depth = 0) {
      if (++visited > 1000000 || depth > 64) throw error('INVALID_LEGACY_SNAPSHOT');
      if (Array.isArray(value)) { for (let index = 0; index < value.length; index++) collect(value[index], [...path, index], depth + 1); return; }
      if (!object(value)) return;
      if (Array.isArray(value.workpapers) || Array.isArray(value.codeFiles) || object(value.codeWorkspace)) workspaces.push({ value, path });
      if (object(value.codeWorkspace) && Array.isArray(value.codeWorkspace.drafts)) draftGroups.push({ drafts: value.codeWorkspace.drafts, path: [...path, 'codeWorkspace', 'drafts'], workspace: value });
      for (const [key, child] of Object.entries(value)) {
        if (key === 'storage' && object(child)) {
          for (const [storageKey, stored] of Object.entries(child)) {
            if (typeof stored !== 'string') continue;
            let parsed; try { parsed = JSON.parse(stored); } catch { continue; }
            if (!object(parsed) && !Array.isArray(parsed)) continue;
            const location = [...path, 'storage', storageKey];
            // Keep the original bag shape. Serialize after extraction completes.
            storageValues.push({ storage: child, key: storageKey, parsed, before: JSON.stringify(parsed) });
            if (storageKey === 'siren-code-drafts-v1' && Array.isArray(parsed)) draftGroups.push({ drafts: parsed, path: location });
            collect(parsed, location, depth + 1);
          }
        } else collect(child, [...path, key], depth + 1);
      }
    }
    const storageValues = [];
    collect(metadata);
    for (const workspace of workspaces) workspaceRefs.set(workspace.value, new Map());
    const primary = workspaces.find(workspace => workspace.path.at(-1) === 't-industries-siren-v23-state') ?? workspaces[0];
    primaryRefs = primary ? workspaceRefs.get(primary.value) : null;
    for (const { value, path } of workspaces) {
      const local = workspaceRefs.get(value);
      for (const [docIndex, doc] of (value.workpapers ?? []).entries()) {
        if (!object(doc)) throw error('INVALID_LEGACY_SOURCE');
        for (const [blockIndex, block] of (doc.blocks ?? []).entries()) {
          if (block.kind !== 'knowledge') continue;
          for (const [rowIndex, row] of (block.rows ?? []).entries()) {
            if (typeof row.content !== 'string') continue;
            const owner = row.sourceId ?? row.id;
            const identity = ['docs', owner ?? [...path, docIndex, blockIndex, rowIndex], doc.agent?.agentId ?? null, row.releaseId ?? null];
            const ref = await extract(row.content, identity, provenance('docs', { documentId: doc.id, blockId: block.id, rowId: row.id, legacySourceId: row.sourceId, agentId: doc.agent?.agentId, agentVersion: doc.agent?.version, releaseId: row.releaseId }));
            row.sourceRef = pointer(ref); delete row.content;
            register({ kind: 'docs', docId: doc.id, blockId: block.id, sourceId: owner }, ref, local);
          }
        }
        for (const [releaseIndex, release] of (doc.releases ?? []).entries()) {
          for (const [rowIndex, row] of (release.snapshot?.knowledge ?? []).entries()) {
            if (typeof row.content !== 'string') continue;
            const identity = ['release', doc.id ?? docIndex, release.id ?? releaseIndex, row.sourceId ?? row.id ?? rowIndex];
            const ref = await extract(row.content, identity, provenance('release', { documentId: doc.id, releaseId: release.id, releaseVersion: release.version, rowId: row.id, legacySourceId: row.sourceId, rowIndex, agentId: release.snapshot?.agent?.agentId }));
            row.sourceRef = pointer(ref); delete row.content;
            register({ kind: 'release', docId: doc.id, releaseId: release.id, rowIndex }, ref, local);
          }
        }
      }
    }
    for (const { value, path } of workspaces) {
      const local = workspaceRefs.get(value);
      for (const [fileIndex, file] of (value.codeFiles ?? []).entries()) {
        if (typeof file.content !== 'string') continue;
        const linked = file.linkedRef ? local.get(legacyKey(file.linkedRef)) : null;
        const ref = linked && file.content === '' ? linked : await extract(file.content, ['standalone', file.id ?? [...path, fileIndex]], provenance('standalone', { fileId: file.id, linkedRef: file.linkedRef }));
        file.sourceRef = pointer(ref); delete file.content;
        register({ kind: 'standalone', fileId: file.id }, ref, local);
      }
    }
    for (const { drafts, path, workspace } of draftGroups) {
      for (const [index, draft] of drafts.entries()) {
        if (!object(draft) || typeof draft.text !== 'string') throw error('INVALID_LEGACY_DRAFT');
        const linked = draft.ref ? (workspace ? workspaceRefs.get(workspace) : legacyRefs).get(legacyKey(draft.ref)) : null;
        let baseRef;
        if (typeof draft.base === 'string') {
          baseRef = linked && legacyBytes.get(linked.sourceId) === draft.base ? linked : await extract(draft.base, ['draft-base', draft.id ?? [...path, index]], provenance('draft-base', { draftId: draft.id, linkedRef: draft.ref }));
          draft.baseSourceRef = pointer(baseRef);
        }
        const ref = baseRef && legacyBytes.get(baseRef.sourceId) === draft.text ? baseRef : await extract(draft.text, ['draft', draft.id ?? [...path, index]], provenance('draft', { draftId: draft.id, linkedRef: draft.ref }));
        draft.sourceRef = pointer(ref); delete draft.text; delete draft.base;
        // Runtime snapshot undo arrays are not a persisted source authority.
        if (Object.hasOwn(draft, 'history')) throw error('UNSUPPORTED_LEGACY_DRAFT_HISTORY');
      }
    }
    for (const item of storageValues.reverse()) {
      const serialized = JSON.stringify(item.parsed);
      if (serialized !== item.before) item.storage[item.key] = serialized;
    }
    if (metadata.kind === 'siren-desktop') metadata.schema = 2;
    const committed = await commitManifest({ projects, repository, recovery, projectId, baseRevision: created.revision, sourceRefs, metadata, operationId: randomUUID() });
    if (!committed.ok) throw error(committed.code);
    const readback = await projects.readProject(projectId);
    if (readback.schema !== 2 || readback.sha256 !== committed.sha256 || readback.revision !== committed.revision) throw error('MIGRATION_READBACK_FAILED');
    return { ...committed, newProjectId: projectId, originalProjectId, originalSha256: snapshot.sha256, snapshot: readback, mapping };
  } catch (failure) {
    return { ok: false, code: 'MIGRATION_INCOMPLETE', reason: failure.code ?? 'MIGRATION_WRITE_FAILED', originalProjectId,
      ...(created ? { newProjectId: created.project.id, retained: true } : {}) };
  }
}
