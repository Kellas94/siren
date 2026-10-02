import { validateWorkspace } from './store.mjs';

// Called only with bytes selected through the main process's explicit native Open dialog.
export function parseLegacyImport(bytes) {
  const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  validateWorkspace(json);
  const parsed = JSON.parse(json);
  if (parsed.kind === 'siren-desktop' && parsed.schema === 1 && parsed.storage && typeof parsed.storage === 'object' && typeof parsed.storage['t-industries-siren-v23-state'] === 'string') return json;
  const workspace = parsed.state && typeof parsed.state === 'object' ? parsed.state : parsed;
  if (!Array.isArray(workspace.diagrams) && typeof workspace.source !== 'string') throw new Error('Not a SIREN workspace export');
  if (!parsed.state) return json;
  const storage = { 't-industries-siren-v23-state': JSON.stringify(workspace) };
  const keys = { customTemplates: 't-industries-siren-v23-custom-templates', brandPresets: 't-industries-siren-v23-brand-presets', subflows: 't-industries-siren-v23-subflows', mapAssets: 't-industries-siren-v23-map-assets' };
  for (const [name, key] of Object.entries(keys)) if (parsed.libraries?.[name] && typeof parsed.libraries[name] === 'object') storage[key] = JSON.stringify(parsed.libraries[name]);
  return JSON.stringify({ kind: 'siren-desktop', schema: 1, storage });
}
