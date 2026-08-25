#!/usr/bin/env python3
"""SIREN agent-docs Package 1 — Identity & Structure.

Adds, for `doc.type === 'agent-spec'` only (docs stay generic otherwise):
  - doc.agent {schema, agentId, agentVersion, platform, environment, oversight, data}
    with sanitizeAgentMeta + nextAgentId + one-time adopt-from-settings seed
  - doc.governanceReview (5 fixed product-neutral questions, mechanical outcome,
    trail line via the existing recordTrail machinery)
  - block.role markers ('purpose' | 'boundaries' | 'capabilities' | 'test-cases'),
    "Mark as…" entry in the block tool row, role tag, agent-spec template seeding
  - the compact agent summary strip (pure projection — stores nothing)
  - importer copy-through for agent/governanceReview/releases + duplicate-ID info note
  - duplicate keeps `agent`, clears `releases`/`governanceReview`
  - register meta line + two wpFilter options
Seams honoured: latestApprovedRelease is defined here (real once releases exist);
`agentDrift` / `sanitizeAgentReleases` / a Releases panel are consumed via runtime
typeof guards so the releases/drift package can land before or after this one.

Usage: python fix_agentdocs_identity.py <target.html>
Anchor-guarded: every splice re-finds its anchor by unique code text; any anchor
that is not found exactly once aborts the whole run (file untouched). Patches
whose own marker already exists are skipped (safe re-run / concurrent landing).
Atomic write (temp file + os.replace).
"""
import os
import sys
import tempfile

# Shared-schema constants this package embeds (blueprint §2). If another package
# already landed the sanitisers, these exact strings must be present — otherwise
# the schema has forked and we abort rather than build against a drifted shape.
SCHEMA_ASSERTS = [
    "['always', 'conditional', 'no', 'unknown']",
    "['yes', 'no', 'possible', 'unknown']",
    "['purpose', 'boundaries', 'capabilities', 'test-cases']",
]

CSS_ANCHOR = "    .wp-doc-meta { font-size: 11px; color: var(--subtle); padding: 0 22px 6px; display: flex; gap: 14px; flex-wrap: wrap; }"

CSS_NEW = CSS_ANCHOR + """
    .wp-agent-strip { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 2px 22px 8px; font-size: 12px; }
    .wp-agent-strip .wp-agent-collapse { background: none; border: 0; color: var(--muted); cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 2px 4px; }
    .wp-agent-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px; border: 1px solid var(--border-strong); border-radius: 999px;
      background: var(--pill-bg); color: var(--pill-text); font: inherit; font-size: 11.5px;
    }
    button.wp-agent-chip { cursor: pointer; }
    button.wp-agent-chip:hover { background: var(--secondary); }
    .wp-agent-chip .wp-agent-chip-label { font-weight: 800; letter-spacing: .05em; text-transform: uppercase; font-size: 9.5px; color: var(--muted); }
    .wp-agent-drift { flex-basis: 100%; color: var(--warning); background: var(--warning-bg); border: 1px solid var(--warning); border-radius: var(--radius-sm); padding: 5px 10px; font-size: 12px; }
    .wp-role-tag {
      justify-self: start;
      font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
      color: var(--pill-text); background: var(--pill-bg);
      border: 1px solid var(--border-strong); border-radius: 999px; padding: 2px 9px;
    }
    .wp-list-item .wp-item-agent { font-size: 11px; color: var(--subtle); display: flex; gap: 7px; }
    .wp-agent-dialog { max-width: 640px; }
    .wp-agent-dialog textarea { width: 100%; font: inherit; font-size: 12px; padding: 6px 8px; resize: vertical; }
    .wp-agent-dialog .settings-grid h3 { margin: 8px 0 0; font-size: 13px; }
    .wp-gov-q { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 11px; display: grid; gap: 6px; margin-top: 8px; }
    .wp-gov-q p { margin: 0; font-size: 12.5px; }
    .wp-gov-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .wp-gov-row select { font: inherit; font-size: 12px; padding: 5px 7px; }
    .wp-gov-row input { flex: 1; min-width: 200px; font: inherit; font-size: 12px; padding: 5px 8px; }
    .wp-gov-outcome { font-weight: 700; margin-top: 10px; }"""

STRIP_MARKUP_ANCHOR = '            <div class="wp-doc-meta"><span id="wpRef"></span><span id="wpUpdated"></span><span class="wp-signoff" id="wpSignoff" hidden></span></div>'
STRIP_MARKUP_NEW = STRIP_MARKUP_ANCHOR + """
            <div class="wp-agent-strip" id="wpAgentStrip" hidden></div>"""

FILTER_MARKUP_ANCHOR = '          <option value="unlinked">Not linked yet</option>'
FILTER_MARKUP_NEW = FILTER_MARKUP_ANCHOR + """
          <option value="agent-released">Agents: approved release</option>
          <option value="agent-drift">Agents: changed since release</option>"""

LIMITS_ANCHOR = """        settingValue: 4000,
        settingRows: 80
      };"""
LIMITS_NEW = """        settingValue: 4000,
        settingRows: 80,
        agentFreeText: 2000
      };"""

BLOCK_ROLE_ANCHOR = """          if (!clean.rows.length) {
            clean.rows = [
              { key: 'Model', value: '' },
              { key: 'Temperature', value: '' },
              { key: 'Tools / plugins', value: '' },
              { key: 'Knowledge sources', value: '' },
              { key: 'Trigger', value: '' }
            ];
          }
        }
        return clean;
      }"""
BLOCK_ROLE_NEW = """          if (!clean.rows.length) {
            clean.rows = [
              { key: 'Model', value: '' },
              { key: 'Temperature', value: '' },
              { key: 'Tools / plugins', value: '' },
              { key: 'Knowledge sources', value: '' },
              { key: 'Trigger', value: '' }
            ];
          }
        }
        // Agent-structure marker (agent extension): survives on any block of an
        // agent-spec, whitelist-read; unknown values are dropped, not stored.
        if (typeof block.role === 'string') {
          const role = block.role.trim().toLowerCase();
          if (['purpose', 'boundaries', 'capabilities', 'test-cases'].includes(role)) clean.role = role;
          else delete block.role;
        }
        return clean;
      }"""

CORE_ANCHOR = "      function sanitizeWorkpapers(list, report) {"

CORE_NEW = r"""      /* ==========================================================================
         Agent extension - identity, oversight, data boundaries, governance.
         Shared schema (agent-docs blueprint, section 2): doc.agent,
         doc.governanceReview, block.role. Every field is optional; an absent
         field IS the legacy (schema-1) reading - no migration pass, no dirtying
         of stored documents. Everything here renders only when
         doc.type === 'agent-spec'; Narrative, Control and Note stay untouched.
         ========================================================================== */

      const AGENT_OVERSIGHT_MODES = ['always', 'conditional', 'no', 'unknown'];
      const AGENT_OVERSIGHT_LABELS = { always: 'Always', conditional: 'Conditional', no: 'No', unknown: 'Unknown' };
      const AGENT_DATA_FLAGS = ['yes', 'no', 'possible', 'unknown'];
      const AGENT_DATA_FLAG_LABELS = { yes: 'Yes', no: 'No', possible: 'Possible', unknown: 'Unknown' };
      const AGENT_BLOCK_ROLES = ['purpose', 'boundaries', 'capabilities', 'test-cases'];
      const AGENT_BLOCK_ROLE_LABELS = { purpose: 'Purpose', boundaries: 'Boundaries', capabilities: 'Capabilities', 'test-cases': 'Test cases' };

      function agentEnumRead(value, allowed, fallback) {
        const clean = String(value == null ? '' : value).trim().toLowerCase();
        return allowed.includes(clean) ? clean : fallback;
      }

      /* Generous reads, strict writes, never throws - the sanitizeReview house style. */
      function sanitizeAgentMeta(raw) {
        const meta = raw && typeof raw === 'object' ? raw : {};
        const oversight = meta.oversight && typeof meta.oversight === 'object' ? meta.oversight : {};
        const data = meta.data && typeof meta.data === 'object' ? meta.data : {};
        const free = value => String(value == null ? '' : value).slice(0, WP_LIMITS.agentFreeText);
        return {
          schema: 1,
          agentId: String(meta.agentId == null ? '' : meta.agentId).trim().slice(0, 40),
          agentVersion: String(meta.agentVersion == null ? '' : meta.agentVersion).trim().slice(0, 40),
          platform: String(meta.platform == null ? '' : meta.platform).slice(0, 80),
          environment: String(meta.environment == null ? '' : meta.environment).slice(0, 120),
          oversight: {
            mode: agentEnumRead(oversight.mode, AGENT_OVERSIGHT_MODES, 'unknown'),
            how: free(oversight.how),
            exceptions: free(oversight.exceptions)
          },
          data: {
            types: free(data.types),
            confidential: agentEnumRead(data.confidential, AGENT_DATA_FLAGS, 'unknown'),
            personal: agentEnumRead(data.personal, AGENT_DATA_FLAGS, 'unknown'),
            sensitive: agentEnumRead(data.sensitive, AGENT_DATA_FLAGS, 'unknown'),
            restrictions: free(data.restrictions)
          }
        };
      }

      /* Fixed in code, never stored - answers reference them as q1..q5. */
      const GOVERNANCE_QUESTIONS = [
        ['q1', "Do the agent's outputs get used without a person reviewing each result first?"],
        ['q2', 'Does the agent receive or produce confidential, personal or otherwise sensitive data?'],
        ['q3', 'Could an incorrect output plausibly cause a wrong decision or a reporting error before it would be caught?'],
        ['q4', "Can the agent's operational definition (prompt, knowledge, code, settings) change outside a recorded release?"],
        ['q5', 'Is any part of how the agent actually runs undocumented in this specification?']
      ];
      const GOVERNANCE_OUTCOME_LABELS = {
        '': 'Not assessed',
        'no-enhanced-review': 'No enhanced review indicated',
        'enhanced-review-recommended': 'Enhanced review recommended',
        'assessment-incomplete': 'Assessment incomplete'
      };

      function governanceOutcomeFor(answers) {
        const byId = new Map((answers || []).map(entry => [entry && entry.id, entry && entry.answer]));
        const all = GOVERNANCE_QUESTIONS.map(pair => byId.get(pair[0]) || '');
        if (all.some(answer => !answer || answer === 'unclear')) return 'assessment-incomplete';
        return all.some(answer => answer === 'yes') ? 'enhanced-review-recommended' : 'no-enhanced-review';
      }

      function sanitizeGovernanceReview(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const list = Array.isArray(raw.answers) ? raw.answers : [];
        const answers = GOVERNANCE_QUESTIONS.map(pair => {
          const found = list.find(entry => entry && entry.id === pair[0]) || {};
          return {
            id: pair[0],
            answer: agentEnumRead(found.answer, ['yes', 'no', 'unclear'], ''),
            rationale: String(found.rationale == null ? '' : found.rationale).slice(0, 1000)
          };
        });
        const touched = answers.some(entry => entry.answer || entry.rationale)
          || Boolean(raw.reviewedAt) || Boolean(raw.reviewedBy);
        return {
          schema: 1,
          answers,
          // The outcome is mechanical; recomputing it on every read keeps an
          // imported file from claiming a summary its own answers do not support.
          outcome: touched ? governanceOutcomeFor(answers) : '',
          reviewedBy: String(raw.reviewedBy || '').slice(0, 80),
          reviewedAt: String(raw.reviewedAt || '').slice(0, 40)
        };
      }

      /* Logical agent identity - stable across versions of one agent, separate
         from doc.id (storage) and doc.ref (register number). Mirrors
         nextWorkpaperRef: first free AG-NNN. */
      function nextAgentId() {
        const used = new Set();
        (state.workpapers || []).forEach(doc => {
          const id = doc && doc.agent && typeof doc.agent === 'object' ? String(doc.agent.agentId || '').toUpperCase() : '';
          if (id) used.add(id);
        });
        for (let index = 1; index <= MAX_WORKPAPERS + 1; index += 1) {
          const id = 'AG-' + String(index).padStart(3, '0');
          if (!used.has(id)) return id;
        }
        return 'AG-' + Date.now().toString(36).toUpperCase();
      }

      /* Selectors - the only way UI code reads these fields (blueprint seam). */
      function agentMeta(doc) {
        return doc && doc.type === 'agent-spec' && doc.agent && typeof doc.agent === 'object' ? doc.agent : null;
      }

      function latestApprovedRelease(doc) {
        const releases = doc && Array.isArray(doc.releases) ? doc.releases : [];
        return releases.find(release => release && release.status === 'approved') || null;
      }

      function governanceOutcome(doc) {
        const review = doc && doc.governanceReview && typeof doc.governanceReview === 'object' ? doc.governanceReview : null;
        return review ? String(review.outcome || '') : '';
      }

      function adoptableAgentVersion(doc) {
        for (const block of doc.blocks || []) {
          if (!block || block.kind !== 'settings') continue;
          const row = (block.rows || []).find(entry => String((entry && entry.key) || '').trim().toLowerCase() === 'agent version');
          if (row && String(row.value || '').trim()) return String(row.value).trim().slice(0, 40);
        }
        return '';
      }

      /* Legacy specs are never auto-assigned at load; identity arrives on this
         click. When a settings row already says "Agent version", its value is
         adopted once - the settings row itself is never written back to. */
      function assignAgentIdentity(doc) {
        const meta = sanitizeAgentMeta(doc.agent);
        meta.agentId = nextAgentId();
        let adopted = '';
        if (!meta.agentVersion) {
          adopted = adoptableAgentVersion(doc);
          if (adopted) meta.agentVersion = adopted;
        }
        doc.agent = meta;
        touchWorkpaper(doc);
        renderWorkpapers();
        showToast('Agent ID ' + meta.agentId + ' assigned'
          + (adopted ? ' — version ' + adopted + ' adopted from the settings block' : '') + '.', 'success');
      }

      /* The summary strip is a pure projection: it stores nothing, and deleting
         it would lose no data. One quiet line until clicked. */
      function renderAgentStrip(doc) {
        const strip = document.getElementById('wpAgentStrip');
        if (!strip) return;
        if (!doc || doc.type !== 'agent-spec') { strip.hidden = true; strip.replaceChildren(); return; }
        strip.hidden = false;
        strip.replaceChildren();
        const collapsed = Boolean(state.workpaperView.agentStripCollapsed);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'wp-agent-collapse';
        toggle.textContent = (collapsed ? '▸' : '▾') + ' Agent';
        toggle.title = collapsed ? 'Show the agent summary' : 'Collapse the agent summary';
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.addEventListener('click', () => {
          state.workpaperView.agentStripCollapsed = !collapsed;
          scheduleSave();
          renderAgentStrip(doc);
        });
        strip.appendChild(toggle);
        const chip = (label, value, title, onClick) => {
          const node = document.createElement(onClick ? 'button' : 'span');
          if (onClick) { node.type = 'button'; node.addEventListener('click', onClick); }
          node.className = 'wp-agent-chip';
          if (label) {
            const tag = document.createElement('span');
            tag.className = 'wp-agent-chip-label';
            tag.textContent = label;
            node.appendChild(tag);
          }
          node.appendChild(document.createTextNode(value));
          if (title) node.title = title;
          strip.appendChild(node);
          return node;
        };
        const agent = agentMeta(doc);
        if (agent && agent.agentId) {
          chip('', agent.agentId + (agent.agentVersion ? ' · v' + agent.agentVersion : ''),
            'Agent identity — click to edit ID, version, platform, oversight and data boundaries',
            () => openAgentDetailsDialog(doc));
        } else {
          chip('', 'No agent ID — assign',
            'Assign a logical agent ID (stable across versions of this agent)',
            () => assignAgentIdentity(doc));
        }
        if (collapsed) return;
        chip('Owner', doc.owner || '—', 'Document owner — edited in the header field above');
        if (agent && (agent.platform || agent.environment)) {
          chip('Runs on', [agent.platform, agent.environment].filter(Boolean).join(' · '),
            'Platform and environment', () => openAgentDetailsDialog(doc));
        }
        const review = sanitizeReview(doc.review);
        chip('Document', (REVIEW_LABELS[doc.status] || 'Draft')
          + (doc.status === 'approved' && review.decidedBy ? ' · ' + review.decidedBy : ''),
          'State of this document’s review — the release state of the agent itself is separate');
        const release = latestApprovedRelease(doc);
        const releasesButton = document.getElementById('wpReleasesButton');
        const fingerprintBit = release && release.fingerprint && release.fingerprint.package
          ? ' · ' + String(release.fingerprint.package).slice(0, 12) + '…' : '';
        chip('Release', release ? 'R' + (release.seq || '?') + ' approved' + fingerprintBit : 'No approved release',
          release ? 'Latest approved release of the agent' : 'No release of this agent has been approved yet',
          releasesButton ? () => releasesButton.click() : null);
        if (agent) {
          chip('Human review', AGENT_OVERSIGHT_LABELS[agent.oversight.mode] || 'Unknown',
            'Human oversight of the agent’s outputs', () => openAgentDetailsDialog(doc));
        }
        chip('Governance', GOVERNANCE_OUTCOME_LABELS[governanceOutcome(doc)] || 'Not assessed',
          'Governance review (documentation aid — not a legal assessment)', () => openGovernanceDialog(doc));
        if (typeof agentDrift === 'function') {
          const drift = agentDrift(doc);
          if (drift) {
            const line = document.createElement('div');
            line.className = 'wp-agent-drift';
            const part = drift.promptChanged && drift.knowledgeChanged ? 'prompt and knowledge changed'
              : drift.promptChanged ? 'prompt changed'
              : drift.knowledgeChanged ? 'knowledge changed' : 'configuration changed';
            line.textContent = 'Operational definition changed since approved release. Review / re-testing may be required. (' + part + ')';
            strip.appendChild(line);
          }
        }
      }

      /* One modest dialog is the only editor for agent.* fields. Values go in
         via .value assignment, never string-built into markup. */
      function openAgentDetailsDialog(doc) {
        const meta = sanitizeAgentMeta(doc.agent);
        const dialog = document.createElement('dialog');
        dialog.className = 'wp-agent-dialog';
        dialog.setAttribute('aria-label', 'Agent details');
        dialog.innerHTML =
          '<div class="dialog-header"><h2>Agent details</h2>'
          + '<button class="btn ghost icon" type="button" data-f="close" aria-label="Close agent details">×</button></div>'
          + '<div class="dialog-body"><div class="settings-grid">'
          + '<div><label>Agent ID</label><input type="text" maxlength="40" data-f="agentId" placeholder="AG-001" /></div>'
          + '<div><label>Agent version</label><input type="text" maxlength="40" data-f="agentVersion" placeholder="e.g. 3.4" /></div>'
          + '<div><label>Platform</label><input type="text" maxlength="80" data-f="platform" placeholder="e.g. Microsoft 365 Copilot" /></div>'
          + '<div><label>Environment</label><input type="text" maxlength="120" data-f="environment" placeholder="e.g. Agent Builder, tenant sandbox" /></div>'
          + '<div class="full"><h3>Human oversight</h3></div>'
          + '<div><label>Outputs reviewed by a person</label><select data-f="oversightMode"></select></div>'
          + '<div class="full"><label>How review happens / when it is required</label><textarea rows="2" data-f="oversightHow"></textarea></div>'
          + '<div class="full"><label>What is not reviewed / exceptions</label><textarea rows="2" data-f="oversightExceptions"></textarea></div>'
          + '<div class="full"><h3>Data boundaries</h3></div>'
          + '<div class="full"><label>Designed input / output data types</label><textarea rows="2" data-f="dataTypes"></textarea></div>'
          + '<div><label>Confidential data</label><select data-f="dataConfidential"></select></div>'
          + '<div><label>Personal data</label><select data-f="dataPersonal"></select></div>'
          + '<div><label>Sensitive data</label><select data-f="dataSensitive"></select></div>'
          + '<div class="full"><label>Handling restrictions</label><textarea rows="2" data-f="dataRestrictions"></textarea></div>'
          + '</div></div>'
          + '<div class="dialog-footer"><button class="btn ghost" type="button" data-f="cancel">Cancel</button>'
          + '<button class="btn" type="button" data-f="save">Save agent details</button></div>';
        const field = name => dialog.querySelector('[data-f="' + name + '"]');
        const modeSelect = field('oversightMode');
        AGENT_OVERSIGHT_MODES.forEach(mode => {
          const option = document.createElement('option');
          option.value = mode;
          option.textContent = AGENT_OVERSIGHT_LABELS[mode];
          modeSelect.appendChild(option);
        });
        ['dataConfidential', 'dataPersonal', 'dataSensitive'].forEach(name => {
          const select = field(name);
          AGENT_DATA_FLAGS.forEach(flag => {
            const option = document.createElement('option');
            option.value = flag;
            option.textContent = AGENT_DATA_FLAG_LABELS[flag];
            select.appendChild(option);
          });
        });
        field('agentId').value = meta.agentId;
        field('agentVersion').value = meta.agentVersion || adoptableAgentVersion(doc);
        field('platform').value = meta.platform;
        field('environment').value = meta.environment;
        field('oversightMode').value = meta.oversight.mode;
        field('oversightHow').value = meta.oversight.how;
        field('oversightExceptions').value = meta.oversight.exceptions;
        field('dataTypes').value = meta.data.types;
        field('dataConfidential').value = meta.data.confidential;
        field('dataPersonal').value = meta.data.personal;
        field('dataSensitive').value = meta.data.sensitive;
        field('dataRestrictions').value = meta.data.restrictions;
        const done = () => { closeDialog(dialog); dialog.remove(); };
        field('save').addEventListener('click', () => {
          doc.agent = sanitizeAgentMeta({
            schema: 1,
            agentId: field('agentId').value,
            agentVersion: field('agentVersion').value,
            platform: field('platform').value,
            environment: field('environment').value,
            oversight: {
              mode: field('oversightMode').value,
              how: field('oversightHow').value,
              exceptions: field('oversightExceptions').value
            },
            data: {
              types: field('dataTypes').value,
              confidential: field('dataConfidential').value,
              personal: field('dataPersonal').value,
              sensitive: field('dataSensitive').value,
              restrictions: field('dataRestrictions').value
            }
          });
          touchWorkpaper(doc);
          done();
          renderWorkpapers();
          showToast('Agent details saved.', 'success');
        });
        field('cancel').addEventListener('click', done);
        field('close').addEventListener('click', done);
        dialog.addEventListener('close', () => dialog.remove());
        document.body.appendChild(dialog);
        showDialog(dialog);
      }

      /* Documentation aid, never a verdict: the outcome is a mechanical summary
         of the five answers, recorded on the document's existing review trail. */
      function openGovernanceDialog(doc) {
        const existing = sanitizeGovernanceReview(doc.governanceReview || {});
        const dialog = document.createElement('dialog');
        dialog.className = 'wp-agent-dialog';
        dialog.setAttribute('aria-label', 'Governance review');
        dialog.innerHTML =
          '<div class="dialog-header"><h2>Governance review</h2>'
          + '<button class="btn ghost icon" type="button" data-f="close" aria-label="Close governance review">×</button></div>'
          + '<div class="dialog-body">'
          + '<p class="field-hint">Documentation aid — not a legal assessment. The answers describe how the agent is used; the outcome is a mechanical summary of them and nothing more.</p>'
          + '<div data-f="questions"></div>'
          + '<div class="wp-gov-outcome" data-f="outcome"></div>'
          + '<div class="settings-grid" style="margin-top:10px;">'
          + '<div><label>Reviewed by</label><input type="text" maxlength="80" data-f="reviewedBy" placeholder="Your name — signs the trail" /></div>'
          + '<div><label>Last recorded</label><div class="review-state" data-f="reviewedAt">—</div></div>'
          + '</div></div>'
          + '<div class="dialog-footer"><button class="btn ghost" type="button" data-f="cancel">Cancel</button>'
          + '<button class="btn" type="button" data-f="save">Record governance review</button></div>';
        const field = name => dialog.querySelector('[data-f="' + name + '"]');
        const host = field('questions');
        const controls = [];
        GOVERNANCE_QUESTIONS.forEach((pair, index) => {
          const wrap = document.createElement('div');
          wrap.className = 'wp-gov-q';
          const text = document.createElement('p');
          text.textContent = (index + 1) + '. ' + pair[1];
          const row = document.createElement('div');
          row.className = 'wp-gov-row';
          const select = document.createElement('select');
          select.setAttribute('aria-label', 'Answer to question ' + (index + 1));
          [['', '— Not answered'], ['yes', 'Yes'], ['no', 'No'], ['unclear', 'Unclear']].forEach(entry => {
            const option = document.createElement('option');
            option.value = entry[0];
            option.textContent = entry[1];
            select.appendChild(option);
          });
          const rationale = document.createElement('input');
          rationale.type = 'text';
          rationale.maxLength = 1000;
          rationale.placeholder = 'Rationale (optional)';
          rationale.setAttribute('aria-label', 'Rationale for question ' + (index + 1));
          const stored = existing.answers.find(entry => entry.id === pair[0]);
          select.value = stored ? stored.answer : '';
          rationale.value = stored ? stored.rationale : '';
          row.append(select, rationale);
          wrap.append(text, row);
          host.appendChild(wrap);
          controls.push({ id: pair[0], select, rationale });
        });
        const collect = () => controls.map(entry => ({
          id: entry.id, answer: entry.select.value, rationale: entry.rationale.value
        }));
        const outcomeLine = field('outcome');
        const refreshOutcome = () => {
          const answered = collect().some(entry => entry.answer || entry.rationale);
          const outcome = answered ? governanceOutcomeFor(collect()) : '';
          outcomeLine.textContent = 'Outcome: ' + GOVERNANCE_OUTCOME_LABELS[outcome];
        };
        controls.forEach(entry => entry.select.addEventListener('change', refreshOutcome));
        refreshOutcome();
        field('reviewedBy').value = existing.reviewedBy || currentReviewer();
        field('reviewedAt').textContent = existing.reviewedAt
          ? formatDate(existing.reviewedAt) + (existing.reviewedBy ? ' · ' + existing.reviewedBy : '')
          : '—';
        const done = () => { closeDialog(dialog); dialog.remove(); };
        field('save').addEventListener('click', () => {
          const name = String(field('reviewedBy').value || '').trim();
          if (!name) { showToast('Enter your name so the trail can be signed.', 'error'); field('reviewedBy').focus(); return; }
          setCurrentReviewer(name);
          const record = sanitizeGovernanceReview({
            schema: 1,
            answers: collect(),
            reviewedBy: name,
            reviewedAt: new Date().toISOString()
          });
          doc.governanceReview = record;
          // Same trail, same signature machinery as every other recorded action.
          recordTrail(doc, 'Governance review recorded', GOVERNANCE_OUTCOME_LABELS[record.outcome]);
          touchWorkpaper(doc);
          done();
          renderWorkpapers();
          showToast('Governance review recorded — ' + GOVERNANCE_OUTCOME_LABELS[record.outcome] + '.', 'success');
        });
        field('cancel').addEventListener('click', done);
        field('close').addEventListener('click', done);
        dialog.addEventListener('close', () => dialog.remove());
        document.body.appendChild(dialog);
        showDialog(dialog);
      }

"""

WIRING_ANCHOR = """          };
          return raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.assign(raw, clean) : clean;"""
WIRING_NEW = """          };
          if (clean.type === 'agent-spec') {
            // Agent extension fields are optional; absence = legacy. Present
            // fields are sanitised in place. On non-agent docs any such foreign
            // fields ride through untouched (no silent loss) but never render.
            if (doc.agent != null) clean.agent = sanitizeAgentMeta(doc.agent);
            if (doc.governanceReview != null) {
              const governance = sanitizeGovernanceReview(doc.governanceReview);
              if (governance) clean.governanceReview = governance;
            }
            if (doc.releases != null && typeof sanitizeAgentReleases === 'function') {
              clean.releases = sanitizeAgentReleases(doc.releases, report);
            }
          }
          return raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.assign(raw, clean) : clean;"""

CREATE_ANCHOR = """        doc.ref = nextWorkpaperRef();
        state.workpapers.push(doc);"""
CREATE_NEW = """        doc.ref = nextWorkpaperRef();
        if (type === 'agent-spec') {
          // Logical agent identity - stable across versions, separate from the
          // workpaper id and the register ref.
          doc.agent = sanitizeAgentMeta({ agentId: nextAgentId() });
        }
        state.workpapers.push(doc);"""

COPILOT_ANCHOR = "        doc.title = model.name.slice(0, 120);"
COPILOT_NEW = """        doc.title = model.name.slice(0, 120);
        if (doc.agent && !doc.agent.platform) {
          // Record the export's stated flavour when detectable - observed data
          // about the imported artifact, not a product default.
          const hint = (String((parsed && parsed.$schema) || '') + JSON.stringify(Object.keys(parsed || {}))).toLowerCase();
          if (hint.includes('copilot') || hint.includes('declarative')) doc.agent.platform = 'Microsoft 365 Copilot';
        }"""

IMPORT_ANCHOR = """        if (raw.owner) doc.owner = String(raw.owner).slice(0, 80);
        doc.status = normalizeWorkpaperStatus(raw.status);"""
IMPORT_NEW = """        if (raw.owner) doc.owner = String(raw.owner).slice(0, 80);
        doc.status = normalizeWorkpaperStatus(raw.status);
        const notes = [];
        if (doc.type === 'agent-spec') {
          // The fresh doc built above would silently drop the agent-extension
          // fields; copy them through the sanitisers (no silent loss).
          if (raw.agent != null) {
            doc.agent = sanitizeAgentMeta(raw.agent);
          } else {
            // Legacy file: never invent identity for an imported specification.
            delete doc.agent;
          }
          if (raw.governanceReview != null) {
            const governance = sanitizeGovernanceReview(raw.governanceReview);
            if (governance) doc.governanceReview = governance;
          }
          if (raw.releases != null) {
            doc.releases = typeof sanitizeAgentReleases === 'function'
              ? sanitizeAgentReleases(raw.releases, report)
              : structuredCloneSafe(raw.releases);
          }
          const importedId = doc.agent && doc.agent.agentId;
          if (importedId) {
            const twin = state.workpapers.find(other => other !== doc && other.type === 'agent-spec'
              && other.agent && typeof other.agent === 'object' && other.agent.agentId === importedId);
            // Info, not error: versions of one logical agent are legitimate.
            if (twin) notes.push('Agent ID ' + importedId + ' is also used by ' + twin.ref + ' — same logical agent has multiple documents.');
          }
        }"""

FINISH_CALL_ANCHOR = """        finishWorkpaperImport(doc, { report, sourceName: sourceName || fileName, sourceChars,
          diagrams: made.created, skippedDiagrams: made.skipped, splits: prepared.splits });"""
FINISH_CALL_NEW = """        finishWorkpaperImport(doc, { report, sourceName: sourceName || fileName, sourceChars,
          diagrams: made.created, skippedDiagrams: made.skipped, splits: prepared.splits, notes });"""

FINISH_NOTES_ANCHOR = """          splits: Number(info.splits) || 0,
          trimmed"""
FINISH_NOTES_NEW = """          splits: Number(info.splits) || 0,
          notes: Array.isArray(info.notes) ? info.notes.slice(0, 10).map(note => String(note).slice(0, 220)) : [],
          trimmed"""

REPORT_NOTES_ANCHOR = "          if (report.splits) line(report.splits + ' source' + (report.splits === 1 ? ' was' : 's were') + ' longer than one row holds and arrived split into numbered parts — nothing was cut', 'wp-import-ok');"
REPORT_NOTES_NEW = REPORT_NOTES_ANCHOR + """
          (report.notes || []).forEach(note => line(note, 'wp-import-ok'));"""

DUP_ANCHOR = "          clone.status = 'draft';"
DUP_NEW = """          clone.status = 'draft';
          if (clone.type === 'agent-spec') {
            // Same logical agent, presumably drafting the next version; the
            // release record and any signed governance assessment stay with
            // the original document.
            delete clone.releases;
            delete clone.governanceReview;
          }"""

DUP_TOAST_ANCHOR = "          showToast('Workpaper duplicated.', 'success');"
DUP_TOAST_NEW = """          showToast(clone.type === 'agent-spec' && ((Array.isArray(doc.releases) && doc.releases.length) || doc.governanceReview)
            ? 'Workpaper duplicated — releases and the governance review stay with the original.'
            : 'Workpaper duplicated.', 'success');"""

TEMPLATE_ANCHOR = """            { kind: 'heading', level: 2, text: 'Purpose and scope' },
            { kind: 'text', html: '' },
            { kind: 'heading', level: 2, text: 'Agent prompt' },"""
TEMPLATE_NEW = """            { kind: 'heading', level: 2, text: 'Purpose and scope' },
            { kind: 'text', html: '', role: 'purpose' },
            { kind: 'heading', level: 2, text: 'Scope and boundaries' },
            { kind: 'text', html: '', role: 'boundaries' },
            { kind: 'heading', level: 2, text: 'Capabilities' },
            { kind: 'table', headerRow: true, rows: [['Capability', 'Description', 'Limits'], ['', '', '']], role: 'capabilities' },
            { kind: 'heading', level: 2, text: 'Agent prompt' },"""

STRIP_CALL_ANCHOR = """        renderWorkpaperLinks(doc);
        if (el.wpImportPanel) el.wpImportPanel.hidden = true;"""
STRIP_CALL_NEW = """        renderWorkpaperLinks(doc);
        renderAgentStrip(doc);
        if (el.wpImportPanel) el.wpImportPanel.hidden = true;"""

MARK_AS_ANCHOR = "        actions.forEach(([glyph, label, run]) => {"
MARK_AS_NEW = """        if (doc.type === 'agent-spec') {
          actions.push(['⚑', "Mark this block as the agent's purpose, boundaries, capabilities or test cases", event => {
            openStructureMenu(event.currentTarget,
              [['', '(none)']].concat(AGENT_BLOCK_ROLES.map(role => [role, AGENT_BLOCK_ROLE_LABELS[role]])),
              block.role || '',
              value => {
                if (value) block.role = value; else delete block.role;
                touchWorkpaper(doc);
                renderWorkpaperBlocks(doc);
              });
          }]);
        }
        actions.forEach(([glyph, label, run]) => {"""

ROLE_TAG_ANCHOR = "        wrap.appendChild(buildWorkpaperBlockTools(doc, index));"
ROLE_TAG_NEW = """        wrap.appendChild(buildWorkpaperBlockTools(doc, index));
        if (doc.type === 'agent-spec' && block.role && AGENT_BLOCK_ROLE_LABELS[block.role]) {
          const roleTag = document.createElement('span');
          roleTag.className = 'wp-role-tag';
          roleTag.textContent = AGENT_BLOCK_ROLE_LABELS[block.role];
          roleTag.title = 'Marked as ' + AGENT_BLOCK_ROLE_LABELS[block.role] + ' — feeds the agent summary and the operational fingerprint';
          wrap.appendChild(roleTag);
        }"""

REGISTER_ANCHOR = """          item.append(title, meta);
          item.addEventListener('click', () => {"""
REGISTER_NEW = """          item.append(title, meta);
          if (doc.type === 'agent-spec') {
            const agent = agentMeta(doc);
            const release = latestApprovedRelease(doc);
            if ((agent && agent.agentId) || release) {
              const agentLine = document.createElement('span');
              agentLine.className = 'wp-item-agent';
              const bits = [];
              if (agent && agent.agentId) bits.push(agent.agentId);
              if (agent && agent.agentVersion) bits.push('v' + agent.agentVersion);
              bits.push(release ? 'R' + (release.seq || '?') + ' approved' : 'no release');
              if (typeof agentDrift === 'function' && agentDrift(doc)) {
                bits.push('● changed');
                agentLine.title = 'Operational definition changed since approved release. Review / re-testing may be required.';
              }
              agentLine.textContent = bits.join(' · ');
              item.appendChild(agentLine);
            }
          }
          item.addEventListener('click', () => {"""

TYPE_CHANGE_ANCHOR = """        if (el.wpType) el.wpType.addEventListener('change', () => {
          const doc = activeWorkpaper();
          if (!doc) return;
          doc.type = el.wpType.value;
          touchWorkpaper(doc);
          renderWorkpaperList();
        });"""
TYPE_CHANGE_NEW = """        if (el.wpType) el.wpType.addEventListener('change', () => {
          const doc = activeWorkpaper();
          if (!doc) return;
          doc.type = el.wpType.value;
          touchWorkpaper(doc);
          // The agent strip, role tags and Mark-as tools are conditioned on the
          // type; a type change must not leave them stale in the open pane.
          renderAgentStrip(doc);
          renderWorkpaperBlocks(doc);
          renderWorkpaperList();
        });"""

OWNER_INPUT_ANCHOR = """        if (el.wpOwner) el.wpOwner.addEventListener('input', () => {
          const doc = activeWorkpaper();
          if (!doc) return;
          doc.owner = el.wpOwner.value.slice(0, 80);
          touchWorkpaper(doc);
        });"""
OWNER_INPUT_NEW = """        if (el.wpOwner) el.wpOwner.addEventListener('input', () => {
          const doc = activeWorkpaper();
          if (!doc) return;
          doc.owner = el.wpOwner.value.slice(0, 80);
          touchWorkpaper(doc);
          renderAgentStrip(doc);
        });"""

STATUS_CHANGE_ANCHOR = """        if (el.wpStatus) el.wpStatus.addEventListener('change', () => {
          const doc = activeWorkpaper();
          if (!doc) return;
          doc.status = el.wpStatus.value;
          touchWorkpaper(doc);
          renderWorkpaperList();
        });"""
STATUS_CHANGE_NEW = """        if (el.wpStatus) el.wpStatus.addEventListener('change', () => {
          const doc = activeWorkpaper();
          if (!doc) return;
          doc.status = el.wpStatus.value;
          touchWorkpaper(doc);
          renderAgentStrip(doc);
          renderWorkpaperList();
        });"""

FILTER_FN_ANCHOR = "        if (filter === 'unlinked') return !doc.links.length;"
FILTER_FN_NEW = """        if (filter === 'unlinked') return !doc.links.length;
        if (filter === 'agent-released') return doc.type === 'agent-spec' && Boolean(latestApprovedRelease(doc));
        if (filter === 'agent-drift') return doc.type === 'agent-spec' && typeof agentDrift === 'function' && Boolean(agentDrift(doc));"""

PATCHES = [
    # (name, already-applied marker, anchor, replacement)
    ('css-strip', '.wp-agent-strip {', CSS_ANCHOR, CSS_NEW),
    ('markup-strip', 'id="wpAgentStrip"', STRIP_MARKUP_ANCHOR, STRIP_MARKUP_NEW),
    ('markup-filter', 'value="agent-released"', FILTER_MARKUP_ANCHOR, FILTER_MARKUP_NEW),
    ('wp-limits', 'agentFreeText:', LIMITS_ANCHOR, LIMITS_NEW),
    ('block-role-read', '// Agent-structure marker', BLOCK_ROLE_ANCHOR, BLOCK_ROLE_NEW),
    ('core-section', 'function sanitizeAgentMeta(', CORE_ANCHOR, CORE_NEW + CORE_ANCHOR),
    ('sanitize-wiring', 'clean.agent = sanitizeAgentMeta(doc.agent);', WIRING_ANCHOR, WIRING_NEW),
    ('create-seed', "doc.agent = sanitizeAgentMeta({ agentId: nextAgentId() });", CREATE_ANCHOR, CREATE_NEW),
    ('copilot-platform', "doc.agent.platform = 'Microsoft 365 Copilot';", COPILOT_ANCHOR, COPILOT_NEW),
    ('import-copy-through', 'never invent identity for an imported specification', IMPORT_ANCHOR, IMPORT_NEW),
    ('import-finish-call', 'splits: prepared.splits, notes });', FINISH_CALL_ANCHOR, FINISH_CALL_NEW),
    ('finish-notes', 'notes: Array.isArray(info.notes)', FINISH_NOTES_ANCHOR, FINISH_NOTES_NEW),
    ('report-notes', "(report.notes || []).forEach(note => line(note, 'wp-import-ok'));", REPORT_NOTES_ANCHOR, REPORT_NOTES_NEW),
    ('duplicate-clear', 'delete clone.releases;', DUP_ANCHOR, DUP_NEW),
    ('duplicate-toast', 'releases and the governance review stay with the original', DUP_TOAST_ANCHOR, DUP_TOAST_NEW),
    ('template-roles', "role: 'boundaries' },", TEMPLATE_ANCHOR, TEMPLATE_NEW),
    ('strip-call', 'renderAgentStrip(doc);\n        if (el.wpImportPanel)', STRIP_CALL_ANCHOR, STRIP_CALL_NEW),
    ('mark-as-menu', 'AGENT_BLOCK_ROLES.map(role =>', MARK_AS_ANCHOR, MARK_AS_NEW),
    ('role-tag', "roleTag.className = 'wp-role-tag';", ROLE_TAG_ANCHOR, ROLE_TAG_NEW),
    ('register-line', "agentLine.className = 'wp-item-agent';", REGISTER_ANCHOR, REGISTER_NEW),
    ('filter-fn', "if (filter === 'agent-released')", FILTER_FN_ANCHOR, FILTER_FN_NEW),
    ('type-change-rerender', 'renderAgentStrip(doc);\n          renderWorkpaperBlocks(doc);', TYPE_CHANGE_ANCHOR, TYPE_CHANGE_NEW),
    ('owner-input-strip', 'touchWorkpaper(doc);\n          renderAgentStrip(doc);\n        });', OWNER_INPUT_ANCHOR, OWNER_INPUT_NEW),
    ('status-change-strip', "doc.status = el.wpStatus.value;\n          touchWorkpaper(doc);\n          renderAgentStrip(doc);", STATUS_CHANGE_ANCHOR, STATUS_CHANGE_NEW),
]


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: fix_agentdocs_identity.py <target.html>')
    path = sys.argv[1]
    with open(path, encoding='utf-8', newline='') as handle:
        text = handle.read()

    # Shared-schema discipline: if another package already landed the sanitisers,
    # its enum whitelists must match ours exactly, or the schema has forked.
    if 'function sanitizeAgentMeta(' in text:
        for token in SCHEMA_ASSERTS:
            if token not in text:
                raise SystemExit('ABORT (schema drift): sanitizeAgentMeta exists but shared enum '
                                 + token + ' is missing — another package landed a different shape.')

    applied, skipped = [], []
    for name, marker, anchor, replacement in PATCHES:
        if marker in text:
            skipped.append(name)
            continue
        count = text.count(anchor)
        if count != 1:
            raise SystemExit('ABORT (anchor drift): "' + name + '" anchor found '
                             + str(count) + ' times (need exactly 1). File left untouched.')
        text = text.replace(anchor, replacement)
        applied.append(name)

    # Safety gates the whole feature is bound by.
    for banned in ('EU AI ACT COMPLIANT', 'NON-COMPLIANT'):
        if banned in text:
            raise SystemExit('ABORT: banned string "' + banned + '" would ship. File left untouched.')
    if text.count('new Function') != 0:
        raise SystemExit('ABORT: "new Function" present in output. File left untouched.')

    directory = os.path.dirname(os.path.abspath(path)) or '.'
    fd, tmp = tempfile.mkstemp(dir=directory, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as handle:
            handle.write(text)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    print('applied: ' + (', '.join(applied) if applied else '(none)'))
    if skipped:
        print('skipped (already present): ' + ', '.join(skipped))


if __name__ == '__main__':
    main()
