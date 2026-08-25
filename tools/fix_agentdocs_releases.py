# -*- coding: utf-8 -*-
"""
WP-B — Agent releases & integrity for the SIREN Docs workspace.

Adds, for agent-spec documents only:
  * agentOperationalCanon(doc) — canonical serialisation of the operational
    definition (agent meta, oversight, data boundaries, prompts, settings,
    capability tables, purpose/boundary texts, operational knowledge rows);
  * computeAgentFingerprint(doc) — WebCrypto SHA-256 over the canon, with
    prompt/knowledge sub-hashes (no eval, no network, CSP untouched);
  * a Releases panel (wp-changes-panel family) with capture / approve /
    discard-draft / read-only snapshot viewing; releases stored newest-first
    on doc.releases, capped at 60;
  * release approval routed through the EXISTING review dialog — same signed
    reviewer name, same open-review-note gate, same review.trail (and so the
    same audit-trail CSV); approving one release supersedes the previous;
  * operational-change detection: live package hash compared against the
    latest approved release on document open and on the existing 350 ms edit
    scan; on mismatch the exact line
    "Operational definition changed since approved release. Review /
     re-testing may be required." is shown with a prompt/knowledge/
    configuration sub-hint. No workflow attached; a new approved release
    clears it naturally;
  * HTML/Word (and so PDF), Markdown and Excel exports gain an "Agent
    releases" section — empty for generic docs, whose exports stay
    byte-identical.

Seam discipline (blueprint §5): sanitisers and importer copy-through belong
to WP-A. The shared selectors agentMeta / nextAgentId / latestApprovedRelease
are emitted here ONLY if the target does not already define them (WP-A may
land before or after this patch); agentDrift(doc) is exported for WP-C.

Anchor-guarded: every anchor is re-found by content at run time, must be
unique, and any drift aborts before a byte is written. Atomic replace.

Usage: python fix_agentdocs_releases.py <target.html>
"""
import io
import os
import sys

# ---------------------------------------------------------------------------
# Shared-schema constants (blueprint §2.1) — embedded so a fork is loud.
RELEASE_FIELDS = ['id', 'seq', 'version', 'status', 'createdAt', 'createdBy',
                  'approvedAt', 'approvedBy', 'notes', 'testingRef',
                  'fingerprint', 'snapshot']
RELEASE_STATUSES = ['draft', 'approved', 'superseded']
CANON_KEYS = ['canon', 'agentId', 'agentVersion', 'platform', 'environment',
              'oversight', 'data', 'prompts', 'settings', 'capabilities',
              'boundaries', 'knowledge']


def abort(message):
    sys.stderr.write('ABORT: %s\n' % message)
    sys.exit(2)


def find_once(hay, needle, label):
    index = hay.find(needle)
    if index < 0:
        abort('anchor missing: %s' % label)
    if hay.find(needle, index + 1) >= 0:
        abort('anchor not unique: %s' % label)
    return index


def insert_after(src, anchor, payload, label):
    index = find_once(src, anchor, label)
    end = index + len(anchor)
    return src[:end] + payload + src[end:]


def insert_before(src, anchor, payload, label):
    index = find_once(src, anchor, label)
    return src[:index] + payload + src[index:]


def replace_once(src, anchor, replacement, label):
    index = find_once(src, anchor, label)
    return src[:index] + replacement + src[index + len(anchor):]


def main():
    if len(sys.argv) != 2:
        abort('usage: python fix_agentdocs_releases.py <target.html>')
    target = sys.argv[1]
    if not os.path.isfile(target):
        abort('target not found: %s' % target)
    with io.open(target, 'r', encoding='utf-8') as handle:
        src = handle.read()

    # ---- guards -----------------------------------------------------------
    if 'wpReleasesButton' in src or 'agentOperationalCanon' in src:
        abort('WP-B markers already present — patch appears applied.')
    for token in ['sanitizeWorkpapers', 'applyReviewAction', 'recordTrail',
                  'buildWorkpaperExportHtml', 'workpaperMarkdown',
                  'docsSheetXml', 'refreshWorkpaperChangeMarkers']:
        if token not in src:
            abort('expected app primitive missing: %s' % token)
    # Seam assert: if WP-A's release sanitiser landed, its shape must carry
    # the shared field list — otherwise the schema forked and we stop.
    if 'sanitizeAgentReleases' in src:
        for field in ('testingRef', "'superseded'", 'fingerprint'):
            if field not in src:
                abort('WP-A sanitiser present but schema field %s missing — '
                      'shared schema drift, refusing to fork it.' % field)
    has_agent_meta = 'function agentMeta(' in src
    has_next_agent_id = 'function nextAgentId(' in src
    has_latest_approved = 'function latestApprovedRelease(' in src

    # ---- P1: head-row button ---------------------------------------------
    src = insert_after(
        src,
        '              <button class="btn ghost compact" id="wpChangesButton" type="button" title="Tracked changes: live edits this session, plus archived revisions with compare and restore">◷ Changes</button>',
        '\n              <button class="btn ghost compact" id="wpReleasesButton" type="button" hidden title="Agent releases: fingerprinted snapshots of the operational definition, approved through the same review dialog">⛿ Releases</button>',
        'P1 wpChangesButton markup')

    # ---- P2: panel markup -------------------------------------------------
    src = insert_after(
        src,
        '            <div class="wp-changes-panel" id="wpChangesPanel" hidden></div>',
        '\n            <div class="wp-changes-panel" id="wpReleasesPanel" hidden></div>',
        'P2 wpChangesPanel markup')

    # ---- P3: el id registry ----------------------------------------------
    src = replace_once(
        src,
        "'wpChangesButton','wpChangesPanel','wpCommentsButton'",
        "'wpReleasesButton','wpReleasesPanel','wpChangesButton','wpChangesPanel','wpCommentsButton'",
        'P3 el id list')

    # ---- P4: CSS ----------------------------------------------------------
    css = r'''
    #wpReleasesButton.has-live-changes { border-color: var(--warning); color: var(--warning); }
    .wp-release-drift { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; border: 1px solid var(--warning); border-radius: var(--radius-sm); color: var(--warning); padding: 7px 10px; font-size: 12px; }
    .wp-release-drift span { color: var(--muted); }
    .wp-release-hash { font: 11.5px/1.4 ui-monospace, Consolas, monospace; color: var(--muted); }
    .wp-release-status { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border: 1px solid var(--border); color: var(--subtle); }
    .wp-release-status[data-state="approved"] { color: var(--success); border-color: var(--success); }
    .wp-release-status[data-state="superseded"] { opacity: .65; }
    .wp-release-notes { display: grid; gap: 6px; margin-top: 6px; }
    .wp-release-notes input { font: inherit; font-size: 12px; padding: 5px 8px; }
    .wp-release-snapshot { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 10px; margin-top: 6px; display: grid; gap: 6px; font-size: 12px; }
    .wp-release-snapshot[hidden] { display: none; }
    .wp-release-snapshot pre { margin: 0; max-height: 220px; overflow: auto; white-space: pre-wrap; color: var(--code-text); background: var(--code-bg); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; font: 11.5px/1.45 ui-monospace, Consolas, monospace; }
    .wp-release-snapshot summary { cursor: pointer; color: var(--muted); }'''
    src = insert_after(
        src,
        '    .wp-changes-panel[hidden] { display: none; }',
        css,
        'P4 wp-changes-panel CSS')

    # ---- P5: panel toggle wiring -----------------------------------------
    src = replace_once(
        src,
        "          el.wpCommentsPanel.hidden = true;\n"
        "          if (el.wpChangesPanel.hidden) { renderWorkpaperChangesPanel(doc); el.wpChangesPanel.hidden = false; }",
        "          el.wpCommentsPanel.hidden = true;\n"
        "          if (el.wpReleasesPanel) el.wpReleasesPanel.hidden = true;\n"
        "          if (el.wpChangesPanel.hidden) { renderWorkpaperChangesPanel(doc); el.wpChangesPanel.hidden = false; }",
        'P5a changes handler')
    src = replace_once(
        src,
        "          el.wpChangesPanel.hidden = true;\n"
        "          if (el.wpCommentsPanel.hidden) { renderWorkpaperCommentsPanel(doc); el.wpCommentsPanel.hidden = false; }",
        "          el.wpChangesPanel.hidden = true;\n"
        "          if (el.wpReleasesPanel) el.wpReleasesPanel.hidden = true;\n"
        "          if (el.wpCommentsPanel.hidden) { renderWorkpaperCommentsPanel(doc); el.wpCommentsPanel.hidden = false; }",
        'P5b comments handler')
    src = replace_once(
        src,
        "          el.wpChangesPanel.hidden = true;\n"
        "          el.wpCommentsPanel.hidden = true;\n"
        "          if (el.wpImportPanel.hidden)",
        "          el.wpChangesPanel.hidden = true;\n"
        "          el.wpCommentsPanel.hidden = true;\n"
        "          if (el.wpReleasesPanel) el.wpReleasesPanel.hidden = true;\n"
        "          if (el.wpImportPanel.hidden)",
        'P5c import-report handler')
    releases_handler = r'''        if (el.wpReleasesButton) el.wpReleasesButton.addEventListener('click', () => {
          const doc = activeWorkpaper();
          if (!doc || doc.type !== 'agent-spec') return;
          el.wpChangesPanel.hidden = true;
          el.wpCommentsPanel.hidden = true;
          if (el.wpImportPanel) el.wpImportPanel.hidden = true;
          if (el.wpReleasesPanel.hidden) { renderWorkpaperReleasesPanel(doc); el.wpReleasesPanel.hidden = false; }
          else el.wpReleasesPanel.hidden = true;
        });
'''
    src = insert_before(
        src,
        "        if (el.wpCommentsButton) el.wpCommentsButton.addEventListener('click', () => {",
        releases_handler,
        'P5d releases handler mount')

    # ---- P6: release route inside applyReviewAction -----------------------
    release_route = r'''        /* An agent release rides this same dialog: the same signed name, the same
           gate on open review notes just above, and the same trail. It never moves
           the document's own review state — that stays a separate decision. */
        if (reviewSubjectKind === 'document' && pendingReleaseApproval) {
          if (nextState !== 'approved') {
            showToast('This dialog is speaking for a release — only Approve applies. Close it to review the document itself.', 'error');
            return;
          }
          setCurrentReviewer(name);
          const releaseNote = String(el.reviewNote.value || '').trim();
          applyReleaseApproval(subject, pendingReleaseApproval, name, releaseNote);
          pendingReleaseApproval = null;
          el.reviewNote.value = '';
          if (el.reviewDialog) el.reviewDialog.close();
          return;
        }
'''
    src = insert_before(
        src,
        '        setCurrentReviewer(name);',
        release_route,
        'P6 applyReviewAction splice')

    # ---- P7: drift refresh on the existing 350 ms scan pass ---------------
    src = insert_after(
        src,
        '        renderWorkpaperChangesButton(doc, edited);',
        '\n        refreshAgentDriftState(doc);',
        'P7 change-marker scan splice')

    # ---- P8: renderWorkpaperDocument mount --------------------------------
    src = insert_after(
        src,
        '        renderWorkpaperImportReport(doc, false);\n',
        '        renderWorkpaperReleasesButton(doc);\n'
        '        refreshAgentDriftState(doc);\n'
        '        if (el.wpReleasesPanel) {\n'
        "          if (doc.type !== 'agent-spec') el.wpReleasesPanel.hidden = true;\n"
        '          else if (!el.wpReleasesPanel.hidden) renderWorkpaperReleasesPanel(doc);\n'
        '        }\n',
        'P8 renderWorkpaperDocument splice')

    # ---- P9: HTML/Word export section -------------------------------------
    release_section = r'''
        /* Agent releases travel with the file. The expression is empty for generic
           documents and for agent specs without releases, so those exports stay
           byte-identical to the pre-release build. */
        const releaseSection = doc.type === 'agent-spec' && Array.isArray(doc.releases) && doc.releases.length ? (() => {
          const releaseRows = doc.releases.filter(release => release && typeof release === 'object').map(release => {
            const snapshot = release.snapshot && typeof release.snapshot === 'object' ? release.snapshot : null;
            const items = snapshot ? ['prompts', 'settings', 'capabilities', 'boundaries', 'knowledge'].reduce((sum, key) => sum + (Array.isArray(snapshot[key]) ? snapshot[key].length : 0), 0) : 0;
            const chars = snapshot ? JSON.stringify(snapshot).length : 0;
            const fp = release.fingerprint && release.fingerprint.package ? String(release.fingerprint.package) : '';
            const approvedCell = release.approvedBy ? `${esc(release.approvedBy)} · ${esc(new Date(release.approvedAt).toLocaleString())}` : '—';
            const noteCell = `${esc(release.notes || '')}${release.testingRef ? `${release.notes ? '<br/>' : ''}<em>Testing: ${esc(release.testingRef)}</em>` : ''}`
              + `${snapshot ? `${release.notes || release.testingRef ? '<br/>' : ''}<span style="color:#5a6b7d">Snapshot: ${items} item${items === 1 ? '' : 's'}, ${chars.toLocaleString('en-US')} characters</span>` : ''}`;
            return `<tr><td>R${esc(String(release.seq || ''))}</td><td>${esc(release.version || '—')}</td><td>${esc(release.status || '')}</td><td>${approvedCell}</td>`
              + `<td style="font:11px ui-monospace,Consolas,monospace;word-break:break-all">${esc(fp || '—')}</td><td>${noteCell}</td></tr>`;
          }).join('');
          return `<h2>Agent releases</h2><table><thead><tr><th>R</th><th>Version</th><th>Status</th><th>Approved</th><th>Package fingerprint (SHA-256)</th><th>Notes</th></tr></thead><tbody>${releaseRows}</tbody></table>`;
        })() : '';'''
    src = insert_after(
        src,
        r"        }).map((html, blockIndex) => html + commentHtml(doc.blocks[blockIndex].id)).join('\n');",
        release_section,
        'P9a export releaseSection const')
    src = replace_once(
        src,
        '</header>\n${body}\n<footer>Generated by T-Industries SIREN',
        "</header>\n${body}${releaseSection ? '\\n' + releaseSection : ''}\n<footer>Generated by T-Industries SIREN",
        'P9b export template body')

    # ---- P10: Markdown export section --------------------------------------
    md_start = find_once(src, 'function workpaperMarkdown(doc) {', 'P10 markdown fn')
    md_end = src.find('\n      function ', md_start)
    md_ret = src.find('        return lines.join(String.fromCharCode(10));', md_start)
    if md_ret < 0 or md_end < 0 or md_ret > md_end:
        abort('P10: return anchor not inside workpaperMarkdown')
    md_section = r'''        if (doc.type === 'agent-spec' && Array.isArray(doc.releases) && doc.releases.length) {
          lines.push('## Agent releases', '');
          lines.push('| R | Version | Status | Approved | Package fingerprint (SHA-256) | Notes |', '| --- | --- | --- | --- | --- | --- |');
          doc.releases.forEach(release => {
            if (!release || typeof release !== 'object') return;
            const cells = [
              'R' + (release.seq || ''),
              release.version || '',
              release.status || '',
              release.approvedBy ? release.approvedBy + ' ' + String(release.approvedAt || '').slice(0, 10) : '',
              release.fingerprint && release.fingerprint.package ? release.fingerprint.package : '',
              [release.notes, release.testingRef ? 'Testing: ' + release.testingRef : ''].filter(Boolean).join(' — ')
            ].map(cell => String(cell || '').replace(/[|\n]/g, ' '));
            lines.push('| ' + cells.join(' | ') + ' |');
          });
          lines.push('');
        }
'''
    src = src[:md_ret] + md_section + src[md_ret:]

    # ---- P11: Excel sheet rows ---------------------------------------------
    xlsx_anchor = (
        "        (doc.comments || []).forEach(comment => {\n"
        "          push('Comment', comment.author + ': ' + comment.text + (comment.resolved ? ' (resolved)' : ''), 0);\n"
        "        });")
    xlsx_section = r'''
        if (doc.type === 'agent-spec' && Array.isArray(doc.releases)) {
          doc.releases.forEach(release => {
            if (!release || typeof release !== 'object') return;
            const fp = release.fingerprint && release.fingerprint.package ? release.fingerprint.package : '';
            push('Release', 'R' + (release.seq || '') + ' · v' + (release.version || '—') + ' · ' + (release.status || '')
              + (release.approvedBy ? ' · approved by ' + release.approvedBy + ' ' + String(release.approvedAt || '').slice(0, 10) : '')
              + (fp ? ' · sha256 ' + fp : '')
              + (release.notes ? ' · ' + release.notes : '')
              + (release.testingRef ? ' · testing: ' + release.testingRef : ''), 0);
          });
        }'''
    src = insert_after(src, xlsx_anchor, xlsx_section, 'P11 docsSheetXml splice')

    # ---- P12: the WP-B section ---------------------------------------------
    seam_meta = '' if has_agent_meta else r'''
      /* Shared seam selector (blueprint §2.3) — superseded in place if WP-A's
         sanitised reader lands with the same name and shape. */
      function agentMeta(doc) {
        const raw = doc && doc.agent && typeof doc.agent === 'object' ? doc.agent : {};
        const over = raw.oversight && typeof raw.oversight === 'object' ? raw.oversight : {};
        const bounds = raw.data && typeof raw.data === 'object' ? raw.data : {};
        const enumOr = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
        return {
          agentId: String(raw.agentId || ''),
          agentVersion: String(raw.agentVersion || ''),
          platform: String(raw.platform || ''),
          environment: String(raw.environment || ''),
          oversight: {
            mode: enumOr(over.mode, ['always', 'conditional', 'no', 'unknown'], 'unknown'),
            how: String(over.how || ''),
            exceptions: String(over.exceptions || '')
          },
          data: {
            types: String(bounds.types || ''),
            confidential: enumOr(bounds.confidential, ['yes', 'no', 'possible', 'unknown'], 'unknown'),
            personal: enumOr(bounds.personal, ['yes', 'no', 'possible', 'unknown'], 'unknown'),
            sensitive: enumOr(bounds.sensitive, ['yes', 'no', 'possible', 'unknown'], 'unknown'),
            restrictions: String(bounds.restrictions || '')
          }
        };
      }
'''
    seam_next_id = '' if has_next_agent_id else r'''
      /* Shared seam (blueprint §3.1): first free AG-NNN across every document. */
      function nextAgentId() {
        const used = new Set();
        (state.workpapers || []).forEach(entry => {
          const id = entry && entry.agent && entry.agent.agentId;
          if (id) used.add(String(id));
        });
        for (let index = 1; index <= 999; index += 1) {
          const id = 'AG-' + String(index).padStart(3, '0');
          if (!used.has(id)) return id;
        }
        return 'AG-' + Date.now().toString(36).toUpperCase();
      }
'''
    seam_latest = '' if has_latest_approved else r'''
      /* Shared seam selector: releases are stored newest-first, so the first
         approved entry is the latest one. Null when nothing is approved. */
      function latestApprovedRelease(doc) {
        return agentReleases(doc).find(entry => entry.status === 'approved') || null;
      }
'''
    wpb_section = r'''
      /* ==========================================================================
         AGENT RELEASES AND INTEGRITY
         The operational definition of an agent — its prompt, operational
         knowledge, settings, capability tables, purpose/boundary texts and the
         typed oversight/data answers — is serialised canonically and hashed
         with WebCrypto SHA-256. A release freezes that definition; drift is
         detected by re-hashing, never by field-by-field rules. Approval runs
         through the existing review dialog so one trail carries everything.
         ========================================================================== */

      const AGENT_CANON_VERSION = 1;
      const AGENT_RELEASE_CAP = 60;
      const AGENT_DRIFT_SENTENCE = 'Operational definition changed since approved release. Review / re-testing may be required.';
''' + seam_meta + r'''
      function agentReleases(doc) {
        return doc && Array.isArray(doc.releases)
          ? doc.releases.filter(entry => entry && typeof entry === 'object')
          : [];
      }
''' + seam_next_id + seam_latest + r'''
      /* Same transformation the change digests use for prose: tags out,
         whitespace folded. Deterministic is the only requirement. */
      function agentBlockStripText(html) {
        return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      /* The canon's inputs, gathered in document order. Operational knowledge
         rows are those marked operational/code; a document where no knowledge
         row carries a role at all predates roles, and then EVERY row counts —
         over-inclusion is safe, silently dropping the code reference is not. */
      function agentOperationalParts(doc) {
        const meta = agentMeta(doc);
        const blocks = doc && Array.isArray(doc.blocks) ? doc.blocks : [];
        const prompts = [];
        const settings = [];
        const capabilities = [];
        const boundaries = [];
        const knowledge = [];
        const anyKnowledgeRole = blocks.some(block => block && block.kind === 'knowledge'
          && (block.rows || []).some(row => row && row.role));
        blocks.forEach(block => {
          if (!block || typeof block !== 'object') return;
          if (block.kind === 'prompt') {
            prompts.push({ label: String(block.label || ''), model: String(block.model || ''), text: String(block.text || ''), reasoningEffort: String(block.reasoningEffort || '') });
          } else if (block.kind === 'settings') {
            (block.rows || []).forEach(row => settings.push([String(row?.key || ''), String(row?.value || '')]));
          } else if (block.kind === 'table' && block.role === 'capabilities') {
            (block.rows || []).forEach(row => capabilities.push((Array.isArray(row) ? row : []).map(cell => String(cell || ''))));
          } else if (block.kind === 'text' && (block.role === 'boundaries' || block.role === 'purpose')) {
            boundaries.push(agentBlockStripText(block.html));
          } else if (block.kind === 'knowledge') {
            const effort = String(block.reasoningEffort || '');
            (block.rows || []).forEach(row => {
              if (!row || typeof row !== 'object') return;
              const role = String(row.role || '');
              if (anyKnowledgeRole && role !== 'operational' && role !== 'code') return;
              knowledge.push({ name: String(row.name || ''), role, fileType: String(row.fileType || ''), content: String(row.content || ''), reasoningEffort: effort });
            });
          }
        });
        return { meta, prompts, settings, capabilities, boundaries, knowledge };
      }

      /* Literal fixed key order, arrays in document order, strings exactly as
         stored, JSON.stringify with no whitespace: same input, same string,
         same hash — that is the entire contract. */
      function agentOperationalCanon(doc) {
        const parts = agentOperationalParts(doc);
        return JSON.stringify({
          canon: AGENT_CANON_VERSION,
          agentId: parts.meta.agentId,
          agentVersion: parts.meta.agentVersion,
          platform: parts.meta.platform,
          environment: parts.meta.environment,
          oversight: { mode: parts.meta.oversight.mode, how: parts.meta.oversight.how, exceptions: parts.meta.oversight.exceptions },
          data: { types: parts.meta.data.types, confidential: parts.meta.data.confidential, personal: parts.meta.data.personal, sensitive: parts.meta.data.sensitive, restrictions: parts.meta.data.restrictions },
          prompts: parts.prompts,
          settings: parts.settings,
          capabilities: parts.capabilities,
          boundaries: parts.boundaries,
          knowledge: parts.knowledge
        });
      }

      function agentCryptoAvailable() {
        return Boolean(window.crypto && crypto.subtle && crypto.subtle.digest);
      }

      function agentHashHex(text) {
        if (!agentCryptoAvailable()) return Promise.resolve('');
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)))
          .then(buffer => Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join(''));
      }

      /* Package hash over the whole canon; prompt and knowledge sub-hashes over
         the same arrays serialised alone, so the drift banner can say WHICH part
         moved without any diff bureaucracy. Never a fake or truncated hash: if
         WebCrypto is unavailable this returns null and callers say so. */
      async function computeAgentFingerprint(doc) {
        if (!agentCryptoAvailable()) return null;
        const parts = agentOperationalParts(doc);
        const [packageHash, promptHash, knowledgeHash] = await Promise.all([
          agentHashHex(agentOperationalCanon(doc)),
          agentHashHex(JSON.stringify({ canon: AGENT_CANON_VERSION, prompts: parts.prompts })),
          agentHashHex(JSON.stringify({ canon: AGENT_CANON_VERSION, knowledge: parts.knowledge }))
        ]);
        return { package: packageHash, prompt: promptHash, knowledge: knowledgeHash, canon: AGENT_CANON_VERSION };
      }

      /* The snapshot is a display-ready copy of exactly the canon's inputs, plus
         a per-knowledge-row hash so a later reader can see which file moved.
         No UI state, no comments, no links, no revisions, no other blocks. */
      async function buildAgentReleaseSnapshot(doc) {
        const parts = agentOperationalParts(doc);
        const knowledge = [];
        for (const row of parts.knowledge) {
          knowledge.push({ ...row, sha256: await agentHashHex(row.content) });
        }
        return {
          canon: AGENT_CANON_VERSION,
          agent: { agentId: parts.meta.agentId, agentVersion: parts.meta.agentVersion, platform: parts.meta.platform, environment: parts.meta.environment },
          oversight: { ...parts.meta.oversight },
          data: { ...parts.meta.data },
          prompts: parts.prompts,
          settings: parts.settings,
          capabilities: parts.capabilities,
          boundaries: parts.boundaries,
          knowledge
        };
      }

      /* A release needs an agent identity to belong to. Legacy specs get one at
         first capture; a hand-kept "Agent version" settings row seeds the typed
         version once, and the row itself is never touched. */
      function ensureAgentIdentityForRelease(doc) {
        doc.agent = doc.agent && typeof doc.agent === 'object' ? doc.agent : {};
        if (!doc.agent.schema) doc.agent.schema = 1;
        if (doc.agent.agentId) return false;
        doc.agent.agentId = nextAgentId();
        if (!doc.agent.agentVersion) {
          let adopted = '';
          (doc.blocks || []).forEach(block => {
            if (!block || block.kind !== 'settings') return;
            (block.rows || []).forEach(row => {
              if (!adopted && String(row?.key || '').trim().toLowerCase() === 'agent version') {
                adopted = String(row?.value || '').trim().slice(0, 40);
              }
            });
          });
          if (adopted) doc.agent.agentVersion = adopted;
        }
        return true;
      }

      async function captureAgentRelease(doc) {
        if (!doc || doc.type !== 'agent-spec') return;
        if (!agentCryptoAvailable()) { showToast('Fingerprint unavailable in this browser context.', 'error'); return; }
        const assigned = ensureAgentIdentityForRelease(doc);
        const fingerprint = await computeAgentFingerprint(doc);
        if (!fingerprint || !fingerprint.package) { showToast('Fingerprint unavailable in this browser context.', 'error'); return; }
        const snapshot = await buildAgentReleaseSnapshot(doc);
        if (agentOperationalCanon(doc).length > 5 * 1024 * 1024) {
          showToast('This release snapshot is over 5 MB. It was captured, but consider trimming knowledge payloads.', 'error');
        }
        if (!Array.isArray(doc.releases)) doc.releases = [];
        const seq = agentReleases(doc).reduce((max, entry) => Math.max(max, Number(entry.seq) || 0), 0) + 1;
        doc.releases.unshift({
          id: 'rel-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          seq,
          version: String(agentMeta(doc).agentVersion || '').slice(0, 40),
          status: 'draft',
          createdAt: new Date().toISOString(),
          createdBy: String(currentReviewer() || doc.owner || '').slice(0, 80),
          approvedAt: '',
          approvedBy: '',
          notes: '',
          testingRef: '',
          fingerprint,
          snapshot
        });
        if (doc.releases.length > AGENT_RELEASE_CAP) {
          doc.releases.length = AGENT_RELEASE_CAP;
          showToast('Release history holds ' + AGENT_RELEASE_CAP + ' entries — the oldest release was dropped.', 'error');
        }
        recordTrail(doc, 'Release R' + seq + ' captured', 'Package ' + fingerprint.package.slice(0, 12) + '…');
        touchWorkpaper(doc);
        refreshAgentDriftState(doc);
        renderWorkpaperReleasesButton(doc);
        if (el.wpReleasesPanel && !el.wpReleasesPanel.hidden) renderWorkpaperReleasesPanel(doc);
        showToast('Release R' + seq + ' captured as draft' + (assigned ? ' — assigned ' + doc.agent.agentId : '') + '.', 'success');
      }

      /* Approval is never taken here directly: the panel only opens the existing
         review dialog, and applyReviewAction routes the signed Approve to the
         release. Same name requirement, same open-review-note gate, one trail. */
      let pendingReleaseApproval = null;
      let releaseDialogHooked = false;

      function beginReleaseApproval(doc, releaseId) {
        if (!doc || activeWorkpaper() !== doc) return;
        const release = agentReleases(doc).find(entry => entry.id === releaseId);
        if (!release || release.status !== 'draft') return;
        if (!el.reviewDialog) { showToast('The review dialog is unavailable.', 'error'); return; }
        pendingReleaseApproval = releaseId;
        if (!releaseDialogHooked) {
          releaseDialogHooked = true;
          el.reviewDialog.addEventListener('close', () => { pendingReleaseApproval = null; });
        }
        openReviewDialog('document');
        if (el.reviewDialogTitle) el.reviewDialogTitle.textContent = 'Approve release R' + release.seq + ' — ' + (doc.ref || doc.title || 'document');
        if (el.reviewSubmitButton) el.reviewSubmitButton.disabled = true;
        if (el.reviewRejectButton) el.reviewRejectButton.disabled = true;
        if (el.reviewReopenButton) el.reviewReopenButton.disabled = true;
        if (el.reviewApproveButton) el.reviewApproveButton.disabled = false;
      }

      function applyReleaseApproval(doc, releaseId, name, note) {
        const release = agentReleases(doc).find(entry => entry.id === releaseId);
        if (!release) { showToast('That release is no longer here.', 'error'); return; }
        agentReleases(doc).forEach(entry => {
          if (entry !== release && entry.status === 'approved') {
            entry.status = 'superseded';
            recordTrail(doc, 'Release R' + entry.seq + ' superseded', 'Superseded by R' + release.seq);
          }
        });
        release.status = 'approved';
        release.approvedBy = String(name || '').slice(0, 80);
        release.approvedAt = new Date().toISOString();
        recordTrail(doc, 'Release R' + release.seq + ' approved', note);
        touchWorkpaper(doc);
        renderWorkpaperSignoff(doc);
        refreshAgentDriftState(doc);
        renderWorkpaperReleasesButton(doc);
        if (el.wpReleasesPanel && !el.wpReleasesPanel.hidden) renderWorkpaperReleasesPanel(doc);
        showToast('Release R' + release.seq + ' approved.', 'success');
      }

      /* ---------------- operational-change detection ----------------
         The classifier IS the canon: whatever changes it is operational, and
         nothing else is. The live hash is compared to the latest approved
         release on document open and after edits settle (the existing 350 ms
         scan). No workflow attached — a new approved release clears it. */
      const agentDriftCache = new Map();

      /* Exported to the summary strip and the register (WP-C):
         null, or { package, promptChanged, knowledgeChanged, configChanged }. */
      function agentDrift(doc) {
        if (!doc || doc.type !== 'agent-spec') return null;
        return agentDriftCache.get(doc.id) || null;
      }

      function agentDriftHint(drift) {
        if (!drift) return '';
        const parts = [];
        if (drift.promptChanged) parts.push('prompt changed');
        if (drift.knowledgeChanged) parts.push('knowledge changed');
        if (!parts.length) parts.push('configuration changed');
        return parts.join(' · ');
      }

      async function refreshAgentDriftState(doc) {
        if (!doc) return null;
        if (doc.type !== 'agent-spec') {
          /* An agent spec re-typed to a generic document keeps its data but must
             lose the agent surfaces at the next settle — the same conditioning
             the add-block menu applies. Without this, the Releases button and
             panel linger after a type switch until the next full re-render. */
          agentDriftCache.delete(doc.id);
          renderWorkpaperReleasesButton(doc);
          if (el.wpReleasesPanel && doc.id === state.workpaperView.activeId) el.wpReleasesPanel.hidden = true;
          return null;
        }
        if (!agentCryptoAvailable()) return null;
        const before = agentDriftCache.get(doc.id) || null;
        const approved = latestApprovedRelease(doc);
        let drift = null;
        if (approved && approved.fingerprint && approved.fingerprint.package) {
          const live = await computeAgentFingerprint(doc);
          if (!live) return before;
          if (live.package !== approved.fingerprint.package) {
            const promptChanged = live.prompt !== (approved.fingerprint.prompt || '');
            const knowledgeChanged = live.knowledge !== (approved.fingerprint.knowledge || '');
            drift = { package: live.package, promptChanged, knowledgeChanged, configChanged: !promptChanged && !knowledgeChanged };
          }
        }
        if (drift) agentDriftCache.set(doc.id, drift);
        else agentDriftCache.delete(doc.id);
        renderWorkpaperReleasesButton(doc);
        const changed = JSON.stringify(before) !== JSON.stringify(drift);
        if (changed && el.wpReleasesPanel && !el.wpReleasesPanel.hidden && doc.id === state.workpaperView.activeId) {
          renderWorkpaperReleasesPanel(doc);
        }
        return drift;
      }

      /* ---------------- the Releases surface ---------------- */

      function renderWorkpaperReleasesButton(doc) {
        if (!el.wpReleasesButton) return;
        const active = doc && doc.id === state.workpaperView.activeId ? doc : activeWorkpaper();
        if (!active || active.type !== 'agent-spec') { el.wpReleasesButton.hidden = true; return; }
        el.wpReleasesButton.hidden = false;
        const releases = agentReleases(active);
        const drift = agentDrift(active);
        let label = '⛿ Releases';
        if (releases.length) label += ' (' + releases.length + ')';
        if (drift) label += ' · ⚠';
        el.wpReleasesButton.textContent = label;
        el.wpReleasesButton.classList.toggle('has-live-changes', Boolean(drift));
        el.wpReleasesButton.title = drift
          ? AGENT_DRIFT_SENTENCE + ' (' + agentDriftHint(drift) + ')'
          : 'Agent releases: fingerprinted snapshots of the operational definition, approved through the same review dialog';
      }

      function renderAgentSnapshotInto(host, release) {
        host.replaceChildren();
        const snapshot = release && release.snapshot && typeof release.snapshot === 'object' ? release.snapshot : null;
        if (!snapshot) {
          const none = document.createElement('p');
          none.className = 'wp-changes-empty';
          none.textContent = 'No snapshot was captured with this release.';
          host.appendChild(none);
          return;
        }
        const line = (label, value) => {
          if (!value) return;
          const row = document.createElement('div');
          const strong = document.createElement('strong');
          strong.textContent = label + ': ';
          row.append(strong, document.createTextNode(value));
          host.appendChild(row);
        };
        const agent = snapshot.agent || {};
        line('Agent', [agent.agentId, agent.agentVersion ? 'v' + agent.agentVersion : '', agent.platform, agent.environment].filter(Boolean).join(' · '));
        const oversight = snapshot.oversight || {};
        line('Human oversight', [oversight.mode, oversight.how, oversight.exceptions].filter(Boolean).join(' · '));
        const bounds = snapshot.data || {};
        line('Data boundaries', ['types: ' + (bounds.types || '—'), 'confidential: ' + (bounds.confidential || 'unknown'), 'personal: ' + (bounds.personal || 'unknown'), 'sensitive: ' + (bounds.sensitive || 'unknown')].join(' · '));
        const fold = (summaryText, bodyText) => {
          const box = document.createElement('details');
          const summary = document.createElement('summary');
          summary.textContent = summaryText;
          const pre = document.createElement('pre');
          pre.textContent = bodyText;
          box.append(summary, pre);
          host.appendChild(box);
        };
        (snapshot.prompts || []).forEach(prompt => {
          fold('Prompt — ' + (prompt.label || 'Agent instructions') + (prompt.model ? ' · ' + prompt.model : '') + ' · ' + String(prompt.text || '').length.toLocaleString() + ' characters'
            + (prompt.reasoningEffort ? ' · ' + prompt.reasoningEffort : ''), String(prompt.text || ''));
        });
        if ((snapshot.settings || []).length) {
          fold('Settings — ' + snapshot.settings.length + ' row' + (snapshot.settings.length === 1 ? '' : 's'),
            snapshot.settings.map(row => (row[0] || '—') + ': ' + (row[1] || '')).join(String.fromCharCode(10)));
        }
        if ((snapshot.capabilities || []).length) {
          fold('Capabilities — ' + snapshot.capabilities.length + ' row' + (snapshot.capabilities.length === 1 ? '' : 's'),
            snapshot.capabilities.map(row => (Array.isArray(row) ? row : []).join(' | ')).join(String.fromCharCode(10)));
        }
        if ((snapshot.boundaries || []).length) {
          fold('Purpose and boundaries — ' + snapshot.boundaries.length + ' block' + (snapshot.boundaries.length === 1 ? '' : 's'),
            snapshot.boundaries.join(String.fromCharCode(10) + String.fromCharCode(10)));
        }
        (snapshot.knowledge || []).forEach(row => {
          const content = String(row.content || '');
          fold('Knowledge — ' + (row.name || 'unnamed') + (row.role ? ' · ' + row.role : '') + (row.fileType ? ' · ' + row.fileType : '')
            + ' · ' + content.length.toLocaleString() + ' characters' + (row.sha256 ? ' · sha256 ' + row.sha256.slice(0, 12) + '…' : ''),
            content.length > 20000 ? content.slice(0, 20000) + String.fromCharCode(10) + '… shown to 20,000 characters; the release stores and hashes the full payload.' : content);
        });
      }

      function buildAgentReleaseRow(doc, release) {
        const row = document.createElement('div');
        row.className = 'wp-changes-row';
        const head = document.createElement('div');
        head.className = 'wp-changes-row-head';
        const title = document.createElement('strong');
        title.textContent = 'R' + release.seq + (release.version ? ' · v' + release.version : '');
        const status = document.createElement('span');
        status.className = 'wp-release-status';
        status.dataset.state = release.status || 'draft';
        status.textContent = release.status || 'draft';
        const who = document.createElement('span');
        who.textContent = release.approvedBy
          ? (release.status === 'superseded' ? 'Was approved by ' : 'Approved by ') + release.approvedBy + ' · ' + new Date(release.approvedAt).toLocaleString()
          : 'Captured' + (release.createdBy ? ' by ' + release.createdBy : '') + ' · ' + new Date(release.createdAt).toLocaleString();
        const fingerprint = release.fingerprint && release.fingerprint.package ? String(release.fingerprint.package) : '';
        const hash = document.createElement('span');
        hash.className = 'wp-release-hash';
        hash.textContent = fingerprint ? fingerprint.slice(0, 12) + '…' : 'no fingerprint';
        hash.title = fingerprint;
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'btn ghost compact';
        copy.textContent = '⧉';
        copy.title = 'Copy the full package fingerprint';
        copy.disabled = !fingerprint;
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(fingerprint); showToast('Fingerprint copied.', 'success'); }
          catch (error) { showToast('Clipboard blocked by the browser.', 'error'); }
        });
        head.append(title, status, who, hash, copy);
        if (release.status === 'draft') {
          const approve = document.createElement('button');
          approve.type = 'button';
          approve.className = 'btn secondary compact';
          approve.textContent = 'Approve…';
          approve.title = 'Approve this release through the review dialog — signed into the same trail as document sign-offs';
          approve.addEventListener('click', () => beginReleaseApproval(doc, release.id));
          const discard = document.createElement('button');
          discard.type = 'button';
          discard.className = 'btn danger compact';
          discard.textContent = 'Discard';
          discard.title = 'Remove this draft. Approved releases are never removed.';
          discard.addEventListener('click', () => {
            requestConfirmation({
              title: 'Discard draft release R' + release.seq + '?',
              message: 'Only this draft record is removed — the document itself is untouched. Approved releases are never removed.',
              confirmText: 'Discard draft',
              action: () => {
                const index = Array.isArray(doc.releases) ? doc.releases.findIndex(entry => entry && entry.id === release.id) : -1;
                if (index < 0) return;
                doc.releases.splice(index, 1);
                recordTrail(doc, 'Release R' + release.seq + ' draft discarded', '');
                touchWorkpaper(doc);
                refreshAgentDriftState(doc);
                renderWorkpaperReleasesButton(doc);
                renderWorkpaperReleasesPanel(doc);
                showToast('Draft release discarded.', 'success');
              }
            });
          });
          head.append(approve, discard);
        }
        const view = document.createElement('button');
        view.type = 'button';
        view.className = 'btn ghost compact';
        view.textContent = 'Snapshot';
        view.title = 'What this release froze: prompts, settings, capabilities, boundaries and operational knowledge, with per-file hashes';
        head.append(view);
        row.appendChild(head);
        const details = document.createElement('div');
        details.className = 'wp-release-notes';
        if (release.status === 'draft') {
          const notes = document.createElement('input');
          notes.type = 'text';
          notes.placeholder = 'Release notes (what changed, why)';
          notes.setAttribute('aria-label', 'Release notes');
          notes.value = release.notes || '';
          notes.addEventListener('input', () => { release.notes = notes.value.slice(0, 2000); touchWorkpaper(doc); });
          const testing = document.createElement('input');
          testing.type = 'text';
          testing.placeholder = 'Testing reference (e.g. UAT table rows 1–48, runs of 2026-08-18)';
          testing.setAttribute('aria-label', 'Testing reference');
          testing.value = release.testingRef || '';
          testing.addEventListener('input', () => { release.testingRef = testing.value.slice(0, 200); touchWorkpaper(doc); });
          details.append(notes, testing);
        } else if (release.notes || release.testingRef) {
          const text = document.createElement('span');
          text.className = 'wp-changes-empty';
          text.textContent = [release.notes, release.testingRef ? 'Testing: ' + release.testingRef : ''].filter(Boolean).join(' · ');
          details.appendChild(text);
        }
        if (details.childNodes.length) row.appendChild(details);
        const snapshotHost = document.createElement('div');
        snapshotHost.className = 'wp-release-snapshot';
        snapshotHost.hidden = true;
        view.addEventListener('click', () => {
          if (!snapshotHost.hidden) { snapshotHost.hidden = true; return; }
          renderAgentSnapshotInto(snapshotHost, release);
          snapshotHost.hidden = false;
        });
        row.appendChild(snapshotHost);
        return row;
      }

      function renderWorkpaperReleasesPanel(doc) {
        if (!el.wpReleasesPanel) return;
        el.wpReleasesPanel.replaceChildren();
        if (!doc || doc.type !== 'agent-spec') return;
        const releases = agentReleases(doc);
        const drift = agentDrift(doc);
        if (drift) {
          const warn = document.createElement('div');
          warn.className = 'wp-release-drift';
          const sentence = document.createElement('strong');
          sentence.textContent = AGENT_DRIFT_SENTENCE;
          const hint = document.createElement('span');
          hint.textContent = agentDriftHint(drift);
          warn.append(sentence, hint);
          el.wpReleasesPanel.appendChild(warn);
        }
        const head = document.createElement('div');
        head.className = 'wp-changes-row-head';
        const summary = document.createElement('strong');
        const approved = latestApprovedRelease(doc);
        summary.textContent = releases.length
          ? releases.length + ' release' + (releases.length === 1 ? '' : 's') + (approved ? ' · R' + approved.seq + ' approved' : ' · none approved')
          : 'No releases yet';
        const capture = document.createElement('button');
        capture.type = 'button';
        capture.className = 'btn secondary compact';
        capture.textContent = '＋ Capture release';
        capture.title = 'Fingerprint the operational definition as it stands and record it as a draft release';
        capture.disabled = !agentCryptoAvailable();
        if (capture.disabled) capture.title = 'Fingerprint unavailable in this browser context.';
        capture.addEventListener('click', () => { captureAgentRelease(doc); });
        head.append(summary, capture);
        el.wpReleasesPanel.appendChild(head);
        if (!releases.length) {
          const empty = document.createElement('p');
          empty.className = 'wp-changes-empty';
          empty.textContent = 'No releases yet. Capturing one fingerprints the prompt, operational knowledge and settings exactly as they stand; approval then runs through the same review dialog as the document itself.';
          el.wpReleasesPanel.appendChild(empty);
          return;
        }
        releases.forEach(release => el.wpReleasesPanel.appendChild(buildAgentReleaseRow(doc, release)));
      }
'''
    src = insert_before(
        src,
        '      /* ---------------- conditional formatting UI ---------------- */',
        wpb_section + '\n',
        'P12 WP-B section mount')

    # ---- sanity ------------------------------------------------------------
    for token in ['agentOperationalCanon', 'computeAgentFingerprint',
                  'renderWorkpaperReleasesPanel', 'refreshAgentDriftState',
                  'pendingReleaseApproval', 'wpReleasesButton',
                  'AGENT_DRIFT_SENTENCE']:
        if token not in src:
            abort('post-check failed, token missing: %s' % token)
    forbidden = ['EU AI ACT COMPLIANT', 'NON-COMPLIANT']
    for phrase in forbidden:
        if phrase in src:
            abort('forbidden phrase present in output: %s' % phrase)

    tmp = target + '.wpb.tmp'
    with io.open(tmp, 'w', encoding='utf-8', newline='') as handle:
        handle.write(src)
    os.replace(tmp, target)
    emitted = [name for name, present in
               (('agentMeta', not has_agent_meta),
                ('nextAgentId', not has_next_agent_id),
                ('latestApprovedRelease', not has_latest_approved)) if present]
    print('OK: WP-B releases & integrity applied to %s' % target)
    print('    seam fallbacks emitted: %s' % (', '.join(emitted) or 'none (WP-A present)'))
    print('    release fields: %s' % ', '.join(RELEASE_FIELDS))
    print('    canon keys: %s' % ', '.join(CANON_KEYS))
    print('    statuses: %s' % ', '.join(RELEASE_STATUSES))


if __name__ == '__main__':
    main()
