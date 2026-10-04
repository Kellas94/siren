import {appendFileSync, existsSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const isDocumentation = path => /^(?:[^/]+\.md|docs\/.+\.md|desktop\/(?:docs|reviews)\/.+\.md)$/.test(path);
const isPolicy = path => /^\.github\/(?:ci|workflows)\//.test(path);

export function classifyChanges(paths, hasDesktop) {
  if (!Array.isArray(paths) || paths.length === 0 || typeof hasDesktop !== 'boolean') throw new Error('Missing change scope');
  for (const path of paths) {
    if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\0') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '.')) throw new Error('Invalid change path');
  }
  const code = paths.filter(path => !isDocumentation(path));
  if (!hasDesktop && code.some(path => !isPolicy(path))) throw new Error('Application qualification unavailable: desktop is absent; legacy code needs a dedicated qualification before merge');
  const required = hasDesktop && code.length > 0;
  return {desktop:required, launcher:required};
}

export function requireQualification(results, outputs) {
  if (results?.scope !== 'success') throw new Error('SIREN qualification incomplete: change scope did not succeed');
  for (const job of ['desktop','launcher']) {
    if (!['true','false'].includes(outputs?.[job])) throw new Error(`SIREN qualification incomplete: invalid ${job} routing`);
    const expected = outputs[job] === 'true' ? 'success' : 'skipped';
    if (results[job] !== expected) throw new Error(`SIREN qualification incomplete: ${job}=${results[job]}; required=${expected}`);
  }
}

function run() {
  if (process.argv[2] === 'verify') {
    const results = JSON.parse(process.env.SIREN_JOB_RESULTS);
    const outputs = JSON.parse(process.env.SIREN_SCOPE_OUTPUTS);
    requireQualification(results, outputs);
    console.log(JSON.stringify({kind:'merge-qualification', results, required:outputs, releaseAdmitted:false}));
    return;
  }
  if (process.argv[2] !== 'scope') throw new Error('Use scope or verify');
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  let paths;
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    const base = event.pull_request?.base?.sha;
    const head = event.pull_request?.head?.sha;
    if (![base,head].every(sha => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha))) throw new Error('Missing exact PR revisions');
    // No path-count API limit; no rename elision; NUL separators preserve file names.
    paths = execFileSync('git', ['diff','--name-only','--no-renames','-z',base,head,'--'], {encoding:'utf8',maxBuffer:16*1024*1024}).split('\0').filter(Boolean);
  } else if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    paths = execFileSync('git', ['ls-files','-z'], {encoding:'utf8',maxBuffer:16*1024*1024}).split('\0').filter(Boolean);
  } else throw new Error('Unsupported qualification event');
  const hasDesktop = ['desktop/package.json','desktop/package-lock.json','desktop/src/main.mjs'].every(path => existsSync(path));
  const scope = classifyChanges(paths, hasDesktop);
  if (!process.env.GITHUB_OUTPUT) throw new Error('Missing job output target');
  appendFileSync(process.env.GITHUB_OUTPUT, `desktop=${scope.desktop}\nlauncher=${scope.launcher}\n`);
  console.log(JSON.stringify({kind:'merge-scope',hasDesktop,changedFiles:paths.length,required:scope,releaseAdmitted:false}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) run();
