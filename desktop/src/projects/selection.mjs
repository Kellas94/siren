import { validId } from './paths.mjs';

// Only a folder explicitly chosen and validated by the native owner reaches here.
// Damaged contents do not erase its session capability to inspect recovery.
export async function openOwnedSelection({ projectId, projects, grants, selected, recoverySelected }) {
  if (!validId(projectId)) throw new Error('Project selection refused');
  await projects.directory(projectId);
  let snapshot;
  try { snapshot = await projects.readProject(projectId); }
  catch {
    grants.add(projectId);
    await recoverySelected(projectId);
    return { ok: false, code: 'RECOVERY_REQUIRED', message: 'The chosen project is damaged. Open a verified recovered copy; the original was retained.', recoveryRequired: true };
  }
  return selected(snapshot);
}
