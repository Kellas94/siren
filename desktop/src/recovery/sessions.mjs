import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicWrite } from '../projects/atomic.mjs';
import { readOwnedBytes } from '../projects/io.mjs';
import { RecoveryStore } from './checkpoints.mjs';

export class SessionJournal {
  #records = Promise.resolve();
  constructor(root, { now = () => Date.now(), inspectProcess = async () => undefined } = {}) { this.root = root; this.now = now; this.inspectProcess = inspectProcess; }
  async path() { return join(await new RecoveryStore(this.root).directory(), 'sessions.json'); }
  async read() {
    try {
      const raw = (await readOwnedBytes(await this.path(), 4 * 1024 * 1024)).toString('utf8');
      const journal = JSON.parse(raw);
      if (journal.schema !== 1 || !Array.isArray(journal.events) || journal.events.length > 10000 || journal.events.some(e => !e || !['opened', 'ready', 'clean-close'].includes(e.event) || typeof e.sessionId !== 'string' || !e.sessionId || e.sessionId.length > 128 || typeof e.version !== 'string' || e.version.length > 128 || !Number.isFinite(Date.parse(e.at)) || !Number.isSafeInteger(e.processIdentity?.pid) || e.processIdentity.pid <= 0 || typeof e.processIdentity.path !== 'string' || !e.processIdentity.path || e.processIdentity.path.length > 32768 || typeof e.processIdentity.startedAt !== 'string' || !e.processIdentity.startedAt || e.processIdentity.startedAt.length > 128)) throw new Error('Invalid session journal');
      return journal;
    } catch (error) { if (error.code === 'ENOENT') return { schema: 1, events: [] }; throw error; }
  }
  recordSession(input) {
    // Read/update/replace/readback is one transaction. Another ready/close
    // event may not read stale history or replace a file still being verified.
    const operation = this.#records.then(() => this.#recordSession(input));
    this.#records = operation.catch(() => {});
    return operation;
  }
  async #recordSession({ event, sessionId, version, processIdentity }) {
    if (!['opened', 'ready', 'clean-close'].includes(event) || !sessionId || !Number.isSafeInteger(processIdentity?.pid) || typeof processIdentity.path !== 'string' || typeof processIdentity.startedAt !== 'string') throw new Error('Invalid session identity');
    let journal;
    try { journal = await this.read(); }
    catch {
      const path = await this.path(); const raw = await readOwnedBytes(path, 4 * 1024 * 1024);
      await atomicWrite(join(await new RecoveryStore(this.root).directory(), `sessions-damaged-${randomUUID()}.json`), raw);
      journal = { schema: 1, events: [] };
    }
    journal.events = journal.events.filter(e => Date.parse(e.at) >= this.now() - 7 * 24 * 3600000).slice(-999);
    journal.events.push({ event, sessionId, version, processIdentity, at: new Date(this.now()).toISOString() });
    await atomicWrite(await this.path(), Buffer.from(JSON.stringify(journal)));
  }
  async inspectStartup() {
    let journal;
    try { journal = await this.read(); } catch { return { mode: 'readonly', reason: 'Session journal damaged; explicit recovery required' }; }
    const closed = new Set(journal.events.filter(e => e.event === 'clean-close').map(e => e.sessionId));
    let dead = 0;
    for (const e of journal.events.filter(e => e.event === 'opened' && !closed.has(e.sessionId) && Date.parse(e.at) >= this.now() - 300000)) {
      let actual;
      try { actual = await this.inspectProcess(e.processIdentity.pid); } catch { return { mode: 'readonly', reason: 'Cannot verify previous process identity' }; }
      if (actual === undefined) return { mode: 'readonly', reason: 'Cannot verify previous process identity' };
      if (actual && actual.path === e.processIdentity.path && actual.startedAt === e.processIdentity.startedAt) continue;
      dead++;
    }
    return dead >= 3 ? { mode: 'recovery', reason: 'Three unclean starts within five minutes' } : { mode: 'normal', reason: null };
  }
}
