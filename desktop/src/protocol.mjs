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
  const appEntry = segments.length === 1 && segments[0] === 'app.html';
  const homeEntry = url === 'siren://app/home.html';
  const viewEntry = segments.length === 2 && segments[0] === 'windows' && ['code.html', 'docs.html', 'diagram.html','presenter.html','audience.html'].includes(segments[1])
    && /^siren:\/\/app\/windows\/(?:code|docs|diagram|presenter|audience)\.html\?windowId=[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(url);
  const shellAsset=['siren://app/assets/shell.js','siren://app/assets/shell.css'].includes(url);
  if (!appEntry && !homeEntry && !viewEntry && !shellAsset) throw refused();
  const root = await realpath(rendererRoot);
  const target = await realpath(resolve(root, ...segments));
  const rel = relative(root, target);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep) || !rel) throw refused();
  if (!(await stat(target)).isFile()) throw refused();
  return target;
}
