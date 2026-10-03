import { MAX_WORKSPACE_BYTES } from '../projects/budgets.mjs';
import { validId as sourceId } from '../projects/paths.mjs';

const workspaceKey = 't-industries-siren-v23-state';
const docId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const empty = () => ({ code: [], docs: [] });

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function own(value, key) {
  if (!value || typeof value !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function parse(json) {
  if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > MAX_WORKSPACE_BYTES) throw new Error('Invalid native workspace');
  const value = JSON.parse(json);
  if (!object(value)) throw new Error('Invalid native workspace');
  return value;
}

function activeWorkspace(bag) {
  const storage = own(bag, 'storage');
  if (object(storage) && Object.hasOwn(storage, workspaceKey)) return parse(own(storage, workspaceKey));
  // A desktop storage bag is not an import state or direct workspace. Never
  // recover authority from its old cache, backup or unrelated fallback fields.
  if (own(bag, 'kind') === 'siren-desktop') throw new Error('Missing primary workspace');
  if (Object.hasOwn(bag, 'state')) {
    const state = own(bag, 'state');
    if (!object(state)) throw new Error('Invalid imported workspace');
    return state;
  }
  return bag;
}

/** Consumes a native snapshot already verified by ProjectStore. This is an ID
 * roster, not manifest/blob verification or renderer authorization. It never
 * traverses source text, releases, drafts, provenance or other storage keys.
 */
export function workspaceEntities(snapshot) {
  try {
    if (!object(snapshot)) return empty();
    const schema = own(snapshot, 'schema');
    if (schema !== 1 && schema !== 2) return empty();
    const workspace = activeWorkspace(parse(own(snapshot, 'json')));
    const code = new Set();
    if (schema === 2) {
      const refs = own(snapshot, 'sourceRefs');
      const length = own(refs, 'length');
      // Matches the source manifest's existing finite reference-count budget.
      if (Array.isArray(refs) && Number.isSafeInteger(length) && length <= 65536) {
        for (let index = 0; index < length; index++) {
          const ref = own(refs, String(index));
          if (!object(ref)) continue;
          const id = own(ref, 'sourceId');
          const version = own(ref, 'version');
          const sha256 = own(ref, 'sha256');
          if (sourceId(id) && Number.isSafeInteger(version) && version >= 1
            && typeof sha256 === 'string' && /^[a-f0-9]{64}$/.test(sha256)) code.add(id);
        }
      }
    }
    const docs = new Set();
    const workpapers = own(workspace, 'workpapers');
    if (Array.isArray(workpapers)) {
      for (let index = 0; index < own(workpapers, 'length'); index++) {
        const paper = own(workpapers, String(index));
        if (!object(paper)) continue;
        const id = own(paper, 'id');
        if (docId(id)) docs.add(id);
      }
    }
    return { code: [...code], docs: [...docs] };
  } catch {
    return empty();
  }
}
