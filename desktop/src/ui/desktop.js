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
  function showPinSettings(notice = '') {
    if (boot?.mode === 'locked' || document.getElementById('desktopPinSettingsPanel')) return;
    if (panel?.open) panel.close();
    const settings = document.createElement('dialog'); settings.id = 'desktopPinSettingsPanel'; settings.className = 'desktop-recovery-panel'; settings.setAttribute('aria-labelledby', 'desktopPinSettingsTitle');
    const title = document.createElement('h2'); title.id = 'desktopPinSettingsTitle'; title.textContent = 'Settings'; settings.append(title);
    const description = document.createElement('p'); description.textContent = 'Your PIN unlocks SIREN on this Windows installation. Changing it requires your current PIN.'; settings.append(description);
    const state = document.createElement('p'); state.setAttribute('role', 'status'); state.textContent = notice || 'Local access · No online account required'; settings.append(state);
    button(settings, 'desktopPinChange', 'Change PIN…', () => { settings.close(); return window.sirenDesktopShowPin('change'); });
    button(settings, 'desktopClosePinSettings', 'Done', () => settings.close());
    settings.addEventListener('close', () => settings.remove(), { once: true }); document.body.append(settings); settings.showModal();
  }
  window.sirenDesktopShowPinSettings = showPinSettings;
  const lockPin = async () => { const result = await bridge.lockPin(); if (result.ok) location.reload(); else message(result.message); };
  function showAccessScreen() {
    if (document.getElementById('desktopAccessScreen')) return;
    if (panel?.open) panel.close();
    const screen = document.createElement('dialog'); screen.id = 'desktopAccessScreen'; screen.className = 'desktop-access-screen';
    screen.setAttribute('aria-labelledby', 'desktopAccessTitle'); screen.setAttribute('aria-describedby', 'desktopAccessDescription');
    // Synthetic product illustrations only. Never read a locked project's content.
    const scene = document.createElement('div'); scene.className = 'desktop-access-scene'; scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML = `<div class="access-orbit access-orbit-one"></div><div class="access-orbit access-orbit-two"></div>
      <section class="access-art access-art-diagram"><span>DIAGRAMS</span><svg viewBox="0 0 300 180" fill="none"><path d="M65 60H150V120H235M150 60V25H235"/><rect x="15" y="40" width="100" height="40" rx="12"/><rect x="185" y="5" width="100" height="40" rx="12"/><rect x="185" y="100" width="100" height="40" rx="12"/><text x="65" y="65">Context</text><text x="235" y="30">Explore</text><text x="235" y="125">Create</text></svg><small>From ideas to connections</small></section>
      <section class="access-art access-art-code"><span>⌘ CODE</span><pre><b>def</b> explore(context):\n    <i>"""Make the idea clear."""</i>\n    steps = document(context)\n    <b>return</b> connect(steps)</pre><div class="access-code-lines"><i></i><i></i><i></i></div></section>
      <section class="access-art access-art-docs"><span>DOCS · AGENTS</span><h3>A shared understanding.</h3><div class="access-doc-lines"><i></i><i></i><i></i></div><div class="access-doc-tags">Context <span>→</span> Decisions <span>→</span> Evidence</div></section>
      <section class="access-art access-art-slides"><span>PRESENTATIONS</span><div class="access-slide"><small>01 / THE BIG PICTURE</small><h3>Ideas.<br>Made visible.</h3><div class="access-slide-chart"><i></i><i></i><i></i><i></i></div></div></section>`;
    screen.append(scene);
    const centre = document.createElement('div'); centre.className = 'desktop-access-centre'; screen.append(centre);
    const brand = document.createElement('div'); brand.className = 'desktop-access-brand'; brand.textContent = 'SIREN'; centre.append(brand);
    const title = document.createElement('h1'); title.id = 'desktopAccessTitle'; title.textContent = 'Your ideas, connected.'; centre.append(title);
    const description = document.createElement('p'); description.id = 'desktopAccessDescription'; description.textContent = 'Diagrams. Code. Documentation. Presentations.'; centre.append(description);
    const form = document.createElement('form'); form.className = 'desktop-access-form'; centre.append(form);
    const field = (id, caption, type) => {
      const label = document.createElement('label'); label.htmlFor = id;
      const text = document.createElement('span'); text.textContent = caption; label.append(text);
      const input = document.createElement('input'); input.id = id; input.type = type; input.required = true; label.append(input); form.append(label); return input;
    };
    const user = field('desktopAccessUser', 'Username', 'text'); user.value = 'tsinc'; user.autocomplete = 'username'; user.maxLength = 128; user.spellcheck = false;
    const pin = field('desktopAccessPin', 'PIN', 'password'); pin.inputMode = 'numeric'; pin.autocomplete = 'off'; pin.pattern = '[0-9]{4,12}'; pin.maxLength = 12; pin.minLength = 4; pin.placeholder = 'Enter your PIN';
    const submit = document.createElement('button'); submit.id = 'desktopAccessUnlock'; submit.type = 'submit'; submit.className = 'desktop-access-primary'; submit.textContent = 'Unlock workspace'; form.append(submit);
    const state = document.createElement('p'); state.id = 'desktopAccessStatus'; state.setAttribute('role', 'status'); state.setAttribute('aria-live', 'polite'); state.textContent = 'Design preview · PIN unlock is not configured yet.'; form.append(state);
    screen.addEventListener('keydown', event => {
      // Account fields must not invoke the workspace's keyboard commands.
      event.stopPropagation();
      if (event.key === 'Enter' && (event.target === pin || event.target === user)) { event.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', event => {
      event.preventDefault(); pin.value = '';
      state.textContent = 'PIN unlock is not configured yet. This preview does not activate your account.'; pin.focus();
    });
    const actions = document.createElement('div'); actions.className = 'desktop-access-actions'; centre.append(actions);
    button(actions, 'desktopAccessOnline', 'Activate online', async () => {
      pin.value = ''; const control = document.getElementById('desktopAccessOnline'); control.disabled = true;
      state.textContent = 'Opening secure account activation…';
      try { const result = await bridge.beginLogin(); if (result.ok === false) state.textContent = result.message; else location.reload(); }
      catch { state.textContent = 'Activation did not complete. Your local projects are retained.'; }
      finally { if (control.isConnected) control.disabled = false; }
    });
    button(actions, 'desktopAccessBack', 'Back to workspace', () => screen.close());
    const note = document.createElement('p'); note.className = 'desktop-access-note'; note.textContent = 'Development preview · Local projects stay on this computer.'; centre.append(note);
    screen.addEventListener('close', () => { pin.value = ''; screen.remove(); document.getElementById('desktopOptions')?.focus(); }, { once: true });
    document.body.append(screen); screen.showModal(); pin.focus();
  }
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
    const intro = document.createElement('p'); intro.textContent = 'Your projects stay on this computer. Settings, updates and recovery are also available from Help and Find.'; panel.append(intro);
    const controls = document.createElement('div'); controls.className = 'desktop-controls'; panel.append(controls);
    button(controls, 'desktopOpenProject', 'Open / import project…', async () => { const result = await bridge.pickProject(); if (result?.project || result?.recoveryRequired) location.reload(); else message(result.message); });
    button(controls, 'desktopExportProject', 'Export saved backup…', async () => { if (boot?.snapshot) { const result = await bridge.exportProject(boot.snapshot.project.id); message(result.ok ? 'The saved backup was exported.' : result.message); } else message('Choose a project first, or export a verified recovery point.'); });
    button(controls, 'desktopRecovery', 'Disaster Recovery…', async () => { panel.close(); await showRecovery(); });
    if (boot?.localAccess) {
      button(controls, 'desktopPinSettings', 'Settings…', showPinSettings);
      button(controls, 'desktopLockPin', 'Lock SIREN', lockPin);
    } else {
      button(controls, 'desktopLogin', 'Account status', async () => { const state = await bridge.getAccess(); message(`Account: ${state.state}\nOffline activation until: ${state.offlineUntil ? new Date(state.offlineUntil).toLocaleString() : 'not activated'}\nThe production account service is not configured yet.`); });
      button(controls, 'desktopAccountSignIn', 'Sign in / access preview…', showAccessScreen);
      button(controls, 'desktopLogout', 'Sign out', async () => { const result = await bridge.logout(); if (result.ok === false) message(result.message); else location.reload(); });
    }
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
    message('Local projects\nOpen an owned project or explicitly import a complete .siren export. Nothing is imported automatically from a browser profile. Export saved backup contains the last committed desktop workspace; use the regular Export → Project (.siren) for a portable exchange file.\n\nRecovery\nVerified saved revisions, private drafts and unacknowledged work can be opened as new project copies. The damaged original stays intact. Code drafts remain private until you explicitly save them in Docs.\n\nPIN and updates\nCreate a local 4- or 6-digit PIN on first launch. Change it from Settings using your current PIN. Lock SIREN saves acknowledged local changes before locking. Ctrl+, opens Settings; Ctrl+Alt+L locks SIREN. Online accounts and 30-day activation are deferred. Signed updates can be checked without login; download never means installed. This development build has no production account service or update feed.\n\nScale\nExisting Code limits still apply. Hundreds of thousands of lines are a later development target.');
  }
  window.sirenDesktopCommand = async id => {
    const allowed = new Set(['desktopOpenProject', 'desktopExportProject', 'desktopLogin', 'desktopPinSettings', 'desktopLockPin', 'desktopCheckUpdates', 'desktopRecovery', 'desktopGuide']);
    if (!allowed.has(id)) return;
    if (id === 'desktopPinSettings') { showPinSettings(); return; }
    if (id === 'desktopLockPin') { await lockPin(); return; }
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
    if (boot?.mode === 'locked') return;
    const guide = document.querySelector('#guideDialog .dialog-body');
    if (guide) {
      const section = document.createElement('section'); section.className = 'guide-section'; section.id = 'guideDesktopSection';
      const heading = document.createElement('h3'); heading.textContent = 'Your local desktop workspace'; section.append(heading);
      for (const text of ['Desktop opens local projects and explicitly imports complete .siren exports. Export saved backup keeps the committed desktop workspace; the regular Project (.siren) export is the exchange file. No browser profile is imported automatically.', 'Disaster Recovery opens verified saved revisions, private drafts and unacknowledged work as new project copies. The original remains intact. Code changes stay private until you explicitly Save to Docs.', 'Set up a local 4- or 6-digit PIN on first launch. Settings changes the PIN after current-PIN verification. Ctrl+, opens Settings and Ctrl+Alt+L saves and locks SIREN. Online accounts and 30-day activation are deferred. Check for Updates verifies a public signed package; downloading is separate from installation. This development build has no production account service or update installer. Existing Code size limits remain unchanged.']) {
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
    bridge.onCommand(id => { if (id === 'desktopPinSettings') showPinSettings(); else if (id === 'desktopLockPin') void lockPin(); else void window.sirenDesktopCommand(id); });
    document.addEventListener('keydown', event => {
      if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'q') { event.preventDefault(); event.stopImmediatePropagation(); void bridge.requestClose(); }
    }, true);
    if (boot?.mode && boot.mode !== 'normal') { const opening = document.getElementById('sirenIntroOverlay'); if (opening) opening.hidden = true; document.body.classList.add('desktop-recovery-mode'); void showRecovery().then(() => window.sirenDesktopReady?.()); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
