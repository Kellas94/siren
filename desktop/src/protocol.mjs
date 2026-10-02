import { realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';

const refused = () => new Error('Local resource refused');
export async function resolveLocalResource({ url, rendererRoot }) {
  // Inspect the raw path: URL parsing normalizes traversal before validation.
  if (typeof url !== 'string' || url.length > 4096) throw refused();
  const raw = /^siren:\/\/app(\/[^?#]*)(?:[?#].*)?$/.exec(url);
  if (!raw) throw refused();
  let path;
  try { path = decodeURIComponent(raw[1]); } catch { throw refused(); }
  const segments = path.slice(1).split('/');
  if (!segments.length || segments.some(s => !s || s === '.' || s === '..' || /[%\\:\x00-\x1f<>"|?*]/.test(s))) throw refused();
  // Serve only the built renderer. This is not a general file-reading API.
  if (segments.length !== 1 || segments[0] !== 'app.html') throw refused();
  const root = await realpath(rendererRoot);
  const target = await realpath(resolve(root, ...segments));
  const rel = relative(root, target);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep) || !rel) throw refused();
  if (!(await stat(target)).isFile()) throw refused();
  return target;
}
