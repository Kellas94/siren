(() => {
  const boot = window.sirenDesktopBootstrap; const bridge = window.sirenDesktop;
  if (!bridge) return;
  let panel = null; let status = null; let updateState = null;
  const button = (parent, id, text, action) => {
    const element = document.createElement('button'); element.id = id; element.type = 'button'; element.className = 'btn ghost compact'; element.textContent = text;
    element.addEventListener('click', () => Promise.resolve(action()).catch(() => { if (status) status.textContent = 'The operation did not complete. Your local data was retained.'; }));
    parent.append(element); return element;
  };
  const message = value => { if (status) status.textContent = value; };
  function updateView(state) {
    if (!state || typeof state.phase !== 'string') return;
    updateState = state;
    const text = { unconfigured: 'Updates are not configured for this development build.', idle: 'Check for a signed SIREN update.', checking: 'Checking for updates…', current: 'This version is up to date.', available: `SIREN ${state.version} is available.`, downloading: `Downloading SIREN ${state.version} · ${Math.round(100 * state.bytesReceived / Math.max(1, state.totalBytes || 1))}%`, ready: `SIREN ${state.version} has been downloaded and verified. Installation is not yet qualified in this development build.`, applying: 'Preparing to restart…', error: state.errorCode === 'CANCELLED' ? 'Download cancelled. Your current version is unchanged.' : 'Updates could not be checked or downloaded. Try again.' };
    message(text[state.phase] || 'Update status unavailable.');
    const download = document.getElementById('desktopDownloadUpdate'); if (download) download.disabled = state.phase !== 'available';
    const cancel = document.getElementById('desktopCancelUpdate'); if (cancel) cancel.disabled = !['checking', 'downloading'].includes(state.phase);
  }
  function showDesktop() {
    if (panel?.open) return;
    panel = document.createElement('dialog'); panel.id = 'desktopControlsPanel'; panel.className = 'desktop-recovery-panel'; panel.setAttribute('aria-labelledby', 'desktopControlsTitle');
    const title = document.createElement('h2'); title.id = 'desktopControlsTitle'; title.textContent = 'SIREN Desktop'; panel.append(title);
    const intro = document.createElement('p'); intro.textContent = 'Your projects stay on this computer. Account, updates and recovery are also available from Help and Find.'; panel.append(intro);
    const controls = document.createElement('div'); controls.className = 'desktop-controls'; panel.append(controls);
    button(controls, 'desktopOpenProject', 'Open / import project…', async () => { const result = await bridge.pickProject(); if (result?.project || result?.recoveryRequired) location.reload(); else message(result.message); });
    button(controls, 'desktopExportProject', 'Export saved backup…', async () => { if (boot?.snapshot) { const result = await bridge.exportProject(boot.snapshot.project.id); message(result.ok ? 'The saved backup was exported.' : result.message); } else message('Choose a project first, or export a verified recovery point.'); });
    button(controls, 'desktopRecovery', 'Disaster Recovery…', async () => { panel.close(); await showRecovery(); });
    button(controls, 'desktopLogin', 'Account status', async () => { const state = await bridge.getAccess(); message(`Account: ${state.state}\nOffline activation until: ${state.offlineUntil ? new Date(state.offlineUntil).toLocaleString() : 'not activated'}\nThe production account service is not configured yet.`); });
    button(controls, 'desktopAccountSignIn', 'Sign in…', async () => { const result = await bridge.beginLogin(); if (result.ok === false) message(result.message); else location.reload(); });
    button(controls, 'desktopLogout', 'Sign out', async () => { const result = await bridge.logout(); if (result.ok === false) message(result.message); else location.reload(); });
    button(controls, 'desktopCheckUpdates', 'Check for Updates', async () => updateView(await bridge.checkForUpdates()));
    button(controls, 'desktopDownloadUpdate', 'Download update', async () => updateView(await bridge.downloadUpdate()));
    button(controls, 'desktopCancelUpdate', 'Cancel update', () => bridge.cancelUpdate());
    button(controls, 'desktopGuide', 'Desktop guide', showGuide);
    button(controls, 'desktopExportDiagnostics', 'Export diagnostics…', async () => { const result = await bridge.exportDiagnostics(); message(result.ok ? 'Diagnostic summary exported. No project content, paths or credentials were included.' : result.message); });
    button(controls, 'desktopQuit', 'Quit SIREN', () => bridge.requestClose());
    status = document.createElement('p'); status.className = 'desktop-state'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); panel.append(status);
    button(panel, 'desktopCloseControls', 'Done', () => panel.close());
    panel.addEventListener('close', () => { panel.remove(); panel = null; status = null; }, { once: true }); document.body.append(panel); panel.showModal();
    updateView(updateState || { phase: 'idle' });
    document.getElementById('desktopCloseControls').focus();
  }
  function showGuide() {
    message('Local projects\nOpen an owned project or explicitly import a complete .siren export. Nothing is imported automatically from a browser profile. Export saved backup contains the last committed desktop workspace; use the regular Export → Project (.siren) for a portable exchange file.\n\nRecovery\nVerified saved revisions, private drafts and unacknowledged work can be opened as new project copies. The damaged original stays intact. Code drafts remain private until you explicitly save them in Docs.\n\nAccount and updates\nAn online account will activate 30 days of offline work. Read, recovery and export remain available after expiry. Signed updates can be checked without login; download never means installed. This development build has no production account service or update feed.\n\nScale\nExisting Code limits still apply. Hundreds of thousands of lines are a later development target.');
  }
  window.sirenDesktopCommand = async id => {
    const allowed = new Set(['desktopOpenProject', 'desktopExportProject', 'desktopLogin', 'desktopCheckUpdates', 'desktopRecovery', 'desktopGuide']);
    if (!allowed.has(id)) return;
    if (id === 'desktopRecovery') { if (panel?.open) panel.close(); await showRecovery(); return; }
    showDesktop(); document.getElementById(id)?.click();
  };
  async function showRecovery() {
    const previous = document.getElementById('desktopRecoveryPanel'); if (previous?.open) return;
    const projectId = boot?.snapshot?.project.id || boot?.recoveryProjectId;
    const state = projectId ? await bridge.getRecovery(projectId) : null;
    const dialog = document.createElement('dialog'); dialog.className = 'desktop-recovery-panel'; dialog.id = 'desktopRecoveryPanel'; dialog.setAttribute('aria-labelledby', 'desktopRecoveryTitle');
    const title = document.createElement('h2'); title.id = 'desktopRecoveryTitle'; title.textContent = 'Disaster Recovery'; dialog.append(title);
    const description = document.createElement('p'); description.textContent = state?.points?.length ? 'Open a verified copy as a new project. The original and private Code drafts are preserved.' : 'No verified recovery point is available. Existing damaged data is retained; choose a project or export a known point.'; dialog.append(description);
    if (boot?.reason || state?.reason) { const reason = document.createElement('p'); reason.textContent = boot?.reason || state.reason; dialog.append(reason); }
    for (const point of state?.points || []) {
      const row = document.createElement('div'); row.className = 'desktop-recovery-row'; row.dataset.pointId = point.id;
      const caption = document.createElement('span'); caption.textContent = `${point.kind === 'emergency' ? 'Unacknowledged work' : point.kind} · revision ${point.revision} · ${new Date(point.createdAt).toLocaleString()}`; row.append(caption);
      button(row, `recover-${point.id}`, 'Open recovered copy', async () => { const result = await bridge.restoreRecovery(point.id); if (result?.project) location.reload(); else description.textContent = result?.message || 'Recovery did not complete'; });
      button(row, `export-${point.id}`, 'Export', () => bridge.exportRecovery(point.id)); dialog.append(row);
    }
    for (const point of state?.damagedPoints || []) {
      const row = document.createElement('div'); row.className = 'desktop-recovery-row';
      const caption = document.createElement('span'); caption.textContent = 'Damaged original — not a verified project'; row.append(caption);
      button(row, `export-damaged-${point.id}`, 'Export damaged original', () => bridge.exportRecovery(point.id)); dialog.append(row);
    }
    const close = button(dialog, 'desktopCloseRecovery', 'Done', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove(), { once: true }); document.body.append(dialog); dialog.showModal(); close.focus();
  }
  const mount = () => {
    const guide = document.querySelector('#guideDialog .dialog-body');
    if (guide) {
      const section = document.createElement('section'); section.className = 'guide-section'; section.id = 'guideDesktopSection';
      const heading = document.createElement('h3'); heading.textContent = 'Your local desktop workspace'; section.append(heading);
      for (const text of ['Desktop opens local projects and explicitly imports complete .siren exports. Export saved backup keeps the committed desktop workspace; the regular Project (.siren) export is the exchange file. No browser profile is imported automatically.', 'Disaster Recovery opens verified saved revisions, private drafts and unacknowledged work as new project copies. The original remains intact. Code changes stay private until you explicitly Save to Docs.', 'An online activation will allow 30 days offline. Recovery and export remain available after expiry. Check for Updates verifies a public signed package; downloading is separate from installation. This development build has no production account service or update installer. Existing Code size limits remain unchanged.']) {
        const paragraph = document.createElement('p'); paragraph.textContent = text; section.append(paragraph);
      }
      button(section, 'guideOpenDesktop', 'Open Desktop', () => { document.getElementById('guideDialog').close(); showDesktop(); });
      guide.prepend(section);
    }
    const bar = document.createElement('aside'); bar.id = 'desktopBar'; bar.setAttribute('aria-label', 'Local desktop project');
    const label = document.createElement('span'); label.id = 'desktopProjectLabel'; label.textContent = `Local · ${boot?.snapshot?.project.label || 'Choose a project'} · Development build`; bar.append(label);
    button(bar, 'desktopOptions', 'Desktop…', showDesktop); document.body.append(bar);
    bridge.onStatus(event => {
      if (event?.kind === 'updates') updateView(event.state);
      if (event?.kind === 'safety' && event.readonly === true) { window.sirenDesktopApplySafety?.(event); message(event.reason); }
    });
    bridge.onCommand(id => { void window.sirenDesktopCommand(id); });
    document.addEventListener('keydown', event => {
      if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'q') { event.preventDefault(); event.stopImmediatePropagation(); void bridge.requestClose(); }
    }, true);
    if (boot?.mode && boot.mode !== 'normal') { document.body.classList.add('desktop-recovery-mode'); void showRecovery().then(() => window.sirenDesktopReady?.()); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
