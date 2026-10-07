(() => {
  const bridge = window.sirenDesktop, boot = window.sirenDesktopBootstrap;
  if (!bridge || !boot) return;
  // The generated HTML starts held before controls are parsed. Release only
  // after the real native bootstrap identifies an unlocked/recovery session.
  if (boot.mode !== 'locked') delete document.documentElement.dataset.desktopLocked;
  if (!boot.localAccess) return;
  const make = (tag, parent, text, className) => {
    const e = document.createElement(tag); if (text) e.textContent = text;
    if (className) e.className = className; parent?.append(e); return e;
  };
  async function showPin(mode = 'unlock') {
    if (document.getElementById('desktopAccessScreen')) return;
    let access = await bridge.getPinState();
    let storageBlocked = access.blocked && !access.retryAfterMs;
    if (mode === 'unlock' && !access.configured) mode = 'setup';
    const screen = make('dialog', document.body, '', 'desktop-access-screen'); screen.id = 'desktopAccessScreen'; screen.dataset.mode = mode;
    screen.setAttribute('aria-labelledby', 'desktopAccessTitle');
    const scene = make('div', screen, '', 'desktop-access-scene'); scene.setAttribute('aria-hidden', 'true');
    // Decorative examples, never contents of a locked local project.
    scene.innerHTML = `<div class="access-orbit access-orbit-one"></div><div class="access-orbit access-orbit-two"></div>
      <section class="access-art access-art-diagram"><span>DIAGRAMS</span><svg viewBox="0 0 300 180" fill="none"><path d="M65 60H150V120H235M150 60V25H235"/><rect x="15" y="40" width="100" height="40" rx="12"/><rect x="185" y="5" width="100" height="40" rx="12"/><rect x="185" y="100" width="100" height="40" rx="12"/><text x="65" y="65">Context</text><text x="235" y="30">Explore</text><text x="235" y="125">Create</text></svg><small>From ideas to connections</small></section>
      <section class="access-art access-art-code"><span>⌘ CODE</span><pre><b>def</b> explore(context):\n    <i>"""Make the idea clear."""</i>\n    steps = document(context)\n    <b>return</b> connect(steps)</pre><div class="access-code-lines"><i></i><i></i><i></i></div></section>
      <section class="access-art access-art-docs"><span>DOCS · AGENTS</span><h3>A shared understanding.</h3><div class="access-doc-lines"><i></i><i></i><i></i></div><div class="access-doc-tags">Context <span>→</span> Decisions <span>→</span> Evidence</div></section>
      <section class="access-art access-art-slides"><span>PRESENTATIONS</span><div class="access-slide"><small>01 / THE BIG PICTURE</small><h3>Ideas.<br>Made visible.</h3><div class="access-slide-chart"><i></i><i></i><i></i><i></i></div></div></section>`;
    const centre = make('div', screen, '', 'desktop-access-centre desktop-pin-centre');
    make('div', centre, 'SIREN', 'desktop-access-brand');
    const title = make('h1', centre); title.id = 'desktopAccessTitle';
    const description = make('p', centre, 'Your ideas, connected.'); description.id = 'desktopAccessDescription';
    const form = make('form', centre, '', 'desktop-pin-form');
    const digits = make('div', form, '', 'desktop-pin-digits'); digits.id = 'desktopPinDigits'; digits.setAttribute('aria-hidden', 'true');
    const input = make('input', form, '', 'desktop-pin-input'); input.id = 'desktopAccessPin'; input.type = 'password'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.required = true;
    const state = make('p', form, '', 'desktop-pin-status'); state.id = 'desktopAccessStatus'; state.setAttribute('role', 'status'); state.setAttribute('aria-live', 'polite');
    const length = make('select', form); length.id = 'desktopPinLength'; length.setAttribute('aria-label', 'New PIN length');
    for (const n of [4, 6]) { const option = make('option', length, `${n}-digit PIN`); option.value = String(n); }
    length.value = String(mode === 'setup' ? 4 : access.pinLength || 4);
    const keypad = make('div', form, '', 'desktop-pin-keypad');
    let stage = mode === 'change' ? 'current' : mode === 'setup' ? 'new' : 'unlock';
    let count = access.pinLength || 4, previous = '', candidate = '', busy = false, retryUntil = 0, timer = null;
    const labels = ['', '', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
    const paint = () => {
      screen.dataset.stage = stage; count = stage === 'current' || stage === 'unlock' ? access.pinLength || 4 : Number(length.value);
      input.maxLength = count; input.minLength = count; input.setAttribute('aria-label', `${count}-digit PIN`);
      title.textContent = ({ current: 'Enter current PIN', new: 'Create your PIN', confirm: 'Confirm your PIN', unlock: 'Enter PIN' })[stage];
      length.hidden = stage !== 'new'; digits.replaceChildren();
      for (let i = 0; i < count; i++) { const dot = make('span', digits); dot.className = i < input.value.length ? 'is-filled' : ''; }
    };
    const controls = () => { for (const e of form.querySelectorAll('button,input,select')) e.disabled = busy || storageBlocked || !access.available || Date.now() < retryUntil; };
    const clear = () => { input.value = ''; paint(); };
    const fail = text => {
      clear(); state.textContent = text;
      digits.classList.remove('is-wrong'); void digits.offsetWidth; digits.classList.add('is-wrong'); input.focus();
    };
    const wait = delay => {
      retryUntil = Date.now() + delay; clearTimeout(timer);
      const tick = () => {
        if (!screen.isConnected) return;
        const left = Math.ceil((retryUntil - Date.now()) / 1000); controls();
        if (left > 0) { state.textContent = `Try again in ${left}s.`; timer = setTimeout(tick, 250); }
        else { state.textContent = 'Enter your PIN to continue.'; input.focus(); }
      }; tick();
    };
    const accept = async () => {
      if (busy || input.value.length !== count || Date.now() < retryUntil || storageBlocked || !access.available) return;
      const value = input.value; input.value = ''; busy = true; controls();
      try {
        if (stage === 'current') {
          const result = await bridge.verifyCurrentPin({ pin: value });
          if (!result.ok) {
            access = await bridge.getPinState();
            if (!access.unlocked) { location.reload(); return; }
            fail(result.message || 'Incorrect PIN.'); if (result.retryAfterMs) wait(result.retryAfterMs); return;
          }
          previous = value; stage = 'new'; state.textContent = 'Choose a new PIN.'; clear(); return;
        }
        if (stage === 'new') { candidate = value; stage = 'confirm'; state.textContent = 'Enter the same PIN again.'; clear(); return; }
        if (stage === 'confirm' && candidate !== value) {
          candidate = ''; stage = 'new'; fail('The PINs did not match. Choose your PIN again.'); return;
        }
        const result = stage === 'unlock' ? await bridge.unlockPin({ pin: value })
          : mode === 'change' ? await bridge.changePin({ currentPin: previous, newPin: candidate, confirmation: value })
          : await bridge.setupPin({ pin: candidate, confirmation: value });
        if (!result.ok) {
          candidate = ''; previous = ''; access = await bridge.getPinState();
          storageBlocked = access.blocked && !access.retryAfterMs;
          if (mode === 'change' && !access.unlocked) { location.reload(); return; }
          if (mode === 'setup' && access.configured) mode = 'unlock';
          stage = mode === 'change' ? 'current' : mode === 'setup' ? 'new' : 'unlock';
          fail(result.message || 'The operation did not complete.'); if (result.retryAfterMs) wait(result.retryAfterMs); return;
        }
        previous = ''; candidate = '';
        if (mode === 'change') { screen.close(); window.sirenDesktopShowPinSettings?.('PIN changed.'); }
        else { state.textContent = 'Opening your workspace…'; location.reload(); }
      } catch { fail('PIN access did not complete. Your local projects are retained.'); }
      finally { busy = false; controls(); if (screen.isConnected) input.focus(); }
    };
    const typeDigit = digit => { if (!busy && Date.now() >= retryUntil && input.value.length < count) { input.value += digit; paint(); input.focus(); if (input.value.length === count) void accept(); } };
    for (const n of [1,2,3,4,5,6,7,8,9]) {
      const key = make('button', keypad, '', 'desktop-pin-key'); key.type = 'button'; key.dataset.digit = String(n); key.setAttribute('aria-label', String(n));
      make('span', key, String(n)); make('small', key, labels[n] || '\u00a0'); key.addEventListener('click', () => typeDigit(String(n)));
    }
    make('span', keypad);
    const zero = make('button', keypad, '0', 'desktop-pin-key'); zero.type = 'button'; zero.dataset.digit = '0'; zero.setAttribute('aria-label', '0'); zero.addEventListener('click', () => typeDigit('0'));
    const remove = make('button', keypad, '⌫', 'desktop-pin-delete'); remove.id = 'desktopPinDelete'; remove.type = 'button'; remove.setAttribute('aria-label', 'Delete last digit');
    remove.addEventListener('click', () => { input.value = input.value.slice(0, -1); paint(); input.focus(); });
    const submit = make('button', form, 'Continue', 'desktop-pin-submit'); submit.id = 'desktopAccessUnlock'; submit.type = 'submit'; submit.tabIndex = -1;
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, count); paint(); if (input.value.length === count) void accept(); });
    length.addEventListener('change', clear); form.addEventListener('submit', event => { event.preventDefault(); void accept(); });
    screen.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape' && (mode !== 'change' || busy)) event.preventDefault();
      if (event.key === 'Enter') { event.preventDefault(); void accept(); }
    });
    screen.addEventListener('cancel', event => { if (mode !== 'change' || busy) event.preventDefault(); });
    // A cooldown disables the PIN input, so Escape can target document.body.
    // Protect the actual startup gate even when focus is outside the dialog.
    const guardEscape = event => {
      if (screen.open && event.key === 'Escape' && (mode !== 'change' || busy)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    document.addEventListener('keydown', guardEscape, true);
    const actions = make('div', centre, '', 'desktop-access-actions');
    const back = make('button', actions, mode === 'change' ? 'Cancel' : 'Quit SIREN', 'btn ghost compact'); back.id = 'desktopAccessBack'; back.type = 'button';
    back.addEventListener('click', () => { if (!busy) { if (mode === 'change') screen.close(); else void bridge.requestClose(); } });
    make('p', centre, 'Local PIN · Your projects stay on this computer.', 'desktop-access-note');
    screen.addEventListener('close', () => { previous = ''; candidate = ''; input.value = ''; clearTimeout(timer); document.removeEventListener('keydown', guardEscape, true); screen.remove(); document.getElementById('desktopOptions')?.focus(); }, { once: true });
    paint(); screen.showModal(); controls(); input.focus();
    if (!access.available || storageBlocked) state.textContent = 'Protected PIN storage is unavailable. Existing local data is retained.';
    else if (access.retryAfterMs > 0) wait(access.retryAfterMs);
    else state.textContent = stage === 'new' ? 'Choose a PIN for this installation.' : 'Use the keypad or your keyboard.';
  }
  window.sirenDesktopShowPin = showPin;
  const start = () => {
    if (boot.mode !== 'locked') return;
    // The frozen IIFE registers the opening callback in its own DOMContentLoaded.
    setTimeout(async () => {
      const played = window.sirenDesktopStartOpening?.();
      if (played) await new Promise(resolve => { const poll = () => document.getElementById('sirenIntroOverlay')?.hidden ? resolve() : setTimeout(poll, 25); poll(); });
      await showPin(); window.sirenDesktopReady?.();
    }, 0);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
