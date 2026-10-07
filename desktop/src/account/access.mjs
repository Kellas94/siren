export function canPerform({ state, action, owned = false, startedBeforeExpiry = false }) {
  if (['check-updates', 'login', 'logout'].includes(action)) return true;
  if (['read', 'export', 'recovery', 'restore'].includes(action)) return owned;
  const active = state && ['online', 'offline'].includes(state.state) && !state.recoveryOnly;
  if (action === 'create' || action === 'open-normal') return !!active;
  if (action === 'workspace') return owned && (!!active || startedBeforeExpiry);
  return false;
}

export class AccessPolicy {
  constructor(state = { state: 'unactivated', offlineUntil: null, recoveryOnly: true }) { this.state = state; this.started = new Set(); }
  update(state) { this.state = state; }
  opened(projectId) { if (canPerform({ state: this.state, action: 'open-normal' })) this.started.add(projectId); }
  canPerform({ action, projectId, owned = false }) { return canPerform({ state: this.state, action, owned, startedBeforeExpiry: this.started.has(projectId) }); }
  accountSwitch() { this.started.clear(); }
}
