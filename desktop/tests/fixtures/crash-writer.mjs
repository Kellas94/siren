import { ProjectStore } from '../../src/projects/store.mjs';
const [root, projectId, phase, json] = process.argv.slice(2);
const store = new ProjectStore(root, { fault: async step => {
  if (step !== phase) return;
  process.send({ phase, pid: process.pid });
  await new Promise(() => {});
} });
await store.saveProject({ projectId, baseRevision: 1, json, purpose: 'workspace' });
process.exit(0);
