#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '2F2DA0BDA18427E3262EB97D06401723183D1938A09083654C64AFE791223030';
const EXPECTED_OUTPUT_SHA256 = '1B8279C4D0A04B52858DE26C76E5F8090F1555EE37BD280684632D40B7DC33AF';
const target = path.resolve(process.argv[2] || '');
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();

function countExact(text, needle) {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

function replaceExact(text, oldText, newText, expected = 1) {
  const count = countExact(text, oldText);
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${oldText.slice(0, 140)}`);
  return text.split(oldText).join(newText);
}

function main() {
  requireTrue(target && fs.existsSync(target), 'pass the HTML file to patch');
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(text,
`  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com; font-src data:; worker-src blob:; base-uri 'none'; form-action 'none';" />`,
`  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self' blob: https://cdn.jsdelivr.net; font-src data:; worker-src blob:; base-uri 'none'; form-action 'none';" />
  <script>
    (() => {
      const preferenceKey = 't-industries-siren-no-external-network';
      const queryChoice = new URLSearchParams(location.search).get('nointernet');
      let storedChoice = '';
      try { storedChoice = localStorage.getItem(preferenceKey) || ''; } catch (error) { /* query fallback remains available */ }
      const enabled = queryChoice === '1' || (queryChoice !== '0' && storedChoice === 'on');
      window.__SIREN_NO_EXTERNAL_NETWORK__ = enabled;
      if (!enabled) return;
      // A meta policy cannot be relaxed after parse. This second policy is added
      // synchronously, before resources load, so its intersection removes both
      // external grants while retaining the self-hosted Mermaid candidate.
      const strictPolicy = document.createElement('meta');
      strictPolicy.httpEquiv = 'Content-Security-Policy';
      strictPolicy.content = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self' blob:; font-src data:; worker-src blob:; base-uri 'none'; form-action 'none';";
      strictPolicy.dataset.sirenNoExternalNetwork = 'true';
      document.head.appendChild(strictPolicy);
    })();
  </script>`);

  text = replaceExact(text,
`    .field-hint { margin-top: 5px; color: var(--subtle); font-size: 10px; line-height: 1.4; }`,
`    .field-hint { margin-top: 5px; color: var(--subtle); font-size: 10px; line-height: 1.4; }
    .network-mode-control {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-top: 10px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--panel-alt) 78%, transparent);
      cursor: pointer;
    }
    .network-mode-control input { flex: 0 0 auto; margin: 2px 0 0; accent-color: var(--accent); }
    .network-mode-control strong { display: block; color: var(--text); font-size: 11px; line-height: 1.35; }
    .network-mode-control .field-hint { display: block; margin-top: 2px; }`);

  text = replaceExact(text,
`<span class="status-chip" id="inkChip" hidden><span class="status-dot"></span><span id="inkChipText"></span></span>
          <span class="status-chip" id="diagramTypeChip" data-state="info" role="button" tabindex="0" aria-label="Open diagram type controls"><span class="status-dot"></span><span id="diagramTypeText">Flowchart</span></span>`,
`<span class="status-chip" id="inkChip" hidden><span class="status-dot"></span><span id="inkChipText"></span></span>
          <span class="status-chip is-action" id="networkModeChip" data-state="info" role="button" tabindex="0"><span class="status-dot"></span><span id="networkModeText">External requests permitted</span></span>
          <span class="status-chip" id="diagramTypeChip" data-state="info" role="button" tabindex="0" aria-label="Open diagram type controls"><span class="status-dot"></span><span id="diagramTypeText">Flowchart</span></span>`);

  text = replaceExact(text,
`                  <div class="full"><label for="layoutEngineSelect">Layout engine</label><select id="layoutEngineSelect" aria-describedby="layoutEngineHint"><option value="dagre">Standard (offline)</option><option value="elk">ELK · online · dense diagrams</option></select><div class="field-hint" id="layoutEngineHint">Online option. ELK fetches about 500 KB from jsDelivr when first selected. It cannot load offline; SIREN falls back to Standard, so the same diagram may be arranged differently on another machine without a connection.</div></div>`,
`                  <div class="full"><label for="layoutEngineSelect">Layout engine</label><select id="layoutEngineSelect" aria-describedby="layoutEngineHint"><option value="dagre">Standard (offline)</option><option value="elk">ELK · online · dense diagrams</option></select><div class="field-hint" id="layoutEngineHint">Online option. ELK fetches about 500 KB from jsDelivr when first selected. It cannot load offline; SIREN falls back to Standard, so the same diagram may be arranged differently on another machine without a connection.</div>
                    <label class="network-mode-control" for="noExternalNetworkToggle"><input id="noExternalNetworkToggle" type="checkbox" aria-describedby="noExternalNetworkHint" /><span><strong>Block external requests</strong><span class="field-hint" id="noExternalNetworkHint" role="status" aria-live="polite">External requests are permitted. Changing this setting reloads SIREN.</span></span></label>
                  </div>`);

  text = replaceExact(text,
`      const CDN_MERMAID_SOURCES = [
        'https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js',
        'https://unpkg.com/mermaid@11.16.1/dist/mermaid.min.js'
      ];`,
`      const CDN_MERMAID_SOURCES = [
        'https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js'
      ];`);

  text = replaceExact(text,
`      function preferLocalMermaid() {
        try {
          if (/[?&]offline=1\\b/.test(location.search)) return true;
          return localStorage.getItem(LOCAL_MERMAID_KEY) === 'yes';`,
`      function preferLocalMermaid() {
        try {
          if (noExternalNetworkMode()) return true;
          if (/[?&]offline=1\\b/.test(location.search)) return true;
          return localStorage.getItem(LOCAL_MERMAID_KEY) === 'yes';`);

  text = replaceExact(text,
`        loadPersistedState();
        applyStateToControls();`,
`        loadPersistedState();
        // A remembered ELK choice cannot remain selected when its loader is
        // forbidden. Normalize before controls or the first render can claim ELK
        // while Mermaid is actually using Standard.
        if (noExternalNetworkMode() && state.layoutEngine === 'elk') state.layoutEngine = 'dagre';
        applyStateToControls();`);

  text = replaceExact(text,
`        setZoom(state.zoom || 100, false);
        updateStatusChips();
        updateDiagramTypeChip();
        refreshStyleClassControls();`,
`        setZoom(state.zoom || 100, false);
        updateStatusChips();
        updateNetworkModeUi();
        updateDiagramTypeChip();
        refreshStyleClassControls();`);

  text = replaceExact(text,
`          'diskFileChip','diskFileText','copyMarkdownButton','workspaceSearchButton','batchButton','recentShapes','moreShapesButton','layoutEngineSelect',`,
`          'diskFileChip','diskFileText','copyMarkdownButton','workspaceSearchButton','batchButton','recentShapes','moreShapesButton','layoutEngineSelect','noExternalNetworkToggle','noExternalNetworkHint','networkModeChip','networkModeText',`);

  text = replaceExact(text,
`        el.layoutEngineSelect.addEventListener('change', applyLayoutEngineChoice);`,
`        el.layoutEngineSelect.addEventListener('change', applyLayoutEngineChoice);
        el.noExternalNetworkToggle?.addEventListener('change', () => setNoExternalNetworkMode(el.noExternalNetworkToggle.checked));
        const toggleNetworkMode = () => setNoExternalNetworkMode(!noExternalNetworkMode());
        el.networkModeChip?.addEventListener('click', toggleNetworkMode);
        el.networkModeChip?.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleNetworkMode(); }
        });`);

  text = replaceExact(text,
`      /* ---------------- ELK layout ---------------- */

      let elkLoadState = 'idle';`,
`      /* ---------------- ELK layout ---------------- */

      const NO_EXTERNAL_NETWORK_KEY = 't-industries-siren-no-external-network';

      function noExternalNetworkMode() {
        return window.__SIREN_NO_EXTERNAL_NETWORK__ === true;
      }

      function updateNetworkModeUi() {
        const enabled = noExternalNetworkMode();
        if (el.noExternalNetworkToggle) el.noExternalNetworkToggle.checked = enabled;
        if (el.noExternalNetworkHint) {
          el.noExternalNetworkHint.textContent = enabled
            ? 'No external requests. Full local renderer available. ELK cannot be fetched in this mode. Changing this setting reloads SIREN.'
            : 'External requests are permitted. ELK may fetch about 500 KB from jsDelivr on first use. Changing this setting reloads SIREN.';
        }
        if (el.networkModeChip) {
          const text = enabled ? 'No external requests · Full local renderer' : 'External requests permitted';
          el.networkModeChip.dataset.state = enabled ? 'good' : 'info';
          el.networkModeText.textContent = text;
          el.networkModeChip.title = enabled
            ? 'SIREN cannot make external requests. Activate to permit optional online features after reload.'
            : 'Optional online features are permitted. Activate to block every external request after reload.';
          el.networkModeChip.setAttribute('aria-label', text + '. ' + (enabled ? 'Permit' : 'Block') + ' external requests after reload.');
        }
      }

      async function setNoExternalNetworkMode(enabled) {
        enabled = Boolean(enabled);
        if (enabled === noExternalNetworkMode()) { updateNetworkModeUi(); return; }
        const previousEngine = state.layoutEngine;
        const previousSelect = el.layoutEngineSelect?.value || 'dagre';
        if (enabled && state.layoutEngine === 'elk') {
          state.layoutEngine = 'dagre';
          if (el.layoutEngineSelect) el.layoutEngineSelect.value = 'dagre';
        }
        await saveState();
        if (el.saveStateChip?.dataset.state !== 'good') {
          state.layoutEngine = previousEngine;
          if (el.layoutEngineSelect) el.layoutEngineSelect.value = previousSelect;
          updateNetworkModeUi();
          showToast('The network mode was not changed because this workspace could not be saved safely.', 'error');
          return;
        }
        let preferenceStored = false;
        try {
          localStorage.setItem(NO_EXTERNAL_NETWORK_KEY, enabled ? 'on' : 'off');
          preferenceStored = localStorage.getItem(NO_EXTERNAL_NETWORK_KEY) === (enabled ? 'on' : 'off');
        } catch (error) { preferenceStored = false; }
        const destination = new URL(location.href);
        if (preferenceStored) destination.searchParams.delete('nointernet');
        else destination.searchParams.set('nointernet', enabled ? '1' : '0');
        location.replace(destination.href);
      }

      let elkLoadState = 'idle';`);

  text = replaceExact(text,
`          if (!ok) {
            state.layoutEngine = 'dagre';
            el.layoutEngineSelect.value = 'dagre';
            showToast('The ELK layout engine could not be loaded (it needs internet on first use). Staying on the standard engine.', 'error');
          } else {`,
`          if (!ok) {
            state.layoutEngine = 'dagre';
            el.layoutEngineSelect.value = 'dagre';
            if (noExternalNetworkMode()) {
              showToast('ELK cannot be fetched while No external requests is on. Staying on the Standard layout.', 'error');
              scheduleSave();
              return;
            }
            showToast('The ELK layout engine could not be loaded (it needs internet on first use). Staying on the standard engine.', 'error');
          } else {`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue(countExact(text, 'https://unpkg.com') === 0, 'unused unpkg grant/fallback remains');
  requireTrue(countExact(text, "strictPolicy.dataset.sirenNoExternalNetwork = 'true';") === 1, 'strict policy bootstrap missing');
  requireTrue(countExact(text, "const LOCAL_MERMAID_SRC = './mermaid.min.js';") === 1, 'local Mermaid path was not preserved exactly');
  requireTrue(countExact(text, "'https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js'") === 1, 'jsDelivr Mermaid fallback changed unexpectedly');
  requireTrue(countExact(text, 'id="noExternalNetworkToggle"') === 1, 'network mode control missing');
  requireTrue(countExact(text, 'id="networkModeChip"') === 1, 'network mode status chip missing');
  requireTrue(countExact(text, 'function noExternalNetworkMode()') === 1, 'network mode runtime helper missing');
  requireTrue(countExact(text, 'ELK cannot be fetched while No external requests is on.') === 1, 'honest ELK refusal missing');
  requireTrue(countExact(text, 'const APP_VERSION =') === countExact(original, 'const APP_VERSION ='), 'APP_VERSION structure changed');
  requireTrue(countExact(text, 'const CHANGELOG =') === countExact(original, 'const CHANGELOG ='), 'CHANGELOG structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') {
    requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  }
  const temporary = path.join(path.dirname(target), `.r12bb-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R12_BB applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
