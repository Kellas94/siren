import { opendir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ownedDirectory, ownedFile, validId } from '../projects/paths.mjs';
import { normalizeRecord } from './contracts.mjs';

/** Metadata-only Home discovery. Existence is cached availability, never proof
 * of a healthy revision. A chosen project is verified by its domain owner. */
export class ProjectCatalog {
  constructor(root) {this.root=resolve(root);}
  async available(projects,projectId) {
    try {
      await ownedDirectory(projects);
      const directory=await ownedDirectory(join(projects,projectId));
      await ownedFile(join(directory,'current.json'));return 'cached';
    } catch {return 'missing';}
  }
  async list(input) {
    const record=normalizeRecord(input);
    await ownedDirectory(this.root);
    const projects=join(this.root,'Projects');
    const summaries=[],seen=new Set();
    for(const entry of [...record.entries].sort((a,b)=>b.visitedAt.localeCompare(a.visitedAt)).slice(0,12)) {
      summaries.push({projectId:entry.projectId,label:entry.label,availability:await this.available(projects,entry.projectId),lastVisited:entry.visitedAt});
      seen.add(entry.projectId);
    }
    if(summaries.length===12)return summaries;
    try {await ownedDirectory(projects);}catch(cause){if(cause.code==='ENOENT')return summaries;throw cause;}
    // Bounded native discovery prevents an oversized filesystem directory from
    // turning the lightweight Home response into a full project scan.
    let scanned=0;
    for await(const entry of await opendir(projects)) {
      if(++scanned>4096)break;
      if(!entry.isDirectory() || !validId(entry.name) || seen.has(entry.name))continue;
      const availability=await this.available(projects,entry.name);
      if(availability!=='cached')continue;
      summaries.push({projectId:entry.name,label:'Local project',availability});seen.add(entry.name);
      if(summaries.length===12)break;
    }
    return summaries;
  }
}
