# -*- coding: utf-8 -*-
"""
SIREN agent-docs package 3: knowledge roles + reasoning effort, the empty-test-run
fix + "No test runs recorded.", testCaseId/agentVersion on runs, section navigation,
and the export round-trip of every field this package adds.

Usage:  python fix_agentdocs_knowledge.py <target.html>

House rules honoured:
  - every step re-finds its anchor by unique literal text, never by line number;
  - a step whose work is already present (marker found) is skipped, so the script
    is idempotent and safe next to concurrent edits by other workflows;
  - a step whose anchor is missing AND whose marker is missing aborts the whole
    run before anything is written (abort-on-drift);
  - the write is atomic: temp file in the same directory, then os.replace.
"""
import io
import os
import sys
import tempfile

if len(sys.argv) != 2:
    print('usage: fix_agentdocs_knowledge.py <target.html>')
    sys.exit(2)

TARGET = sys.argv[1]
with io.open(TARGET, 'r', encoding='utf-8') as handle:
    text = handle.read()

applied = []
skipped = []
failures = []


def step(name, marker, anchor, replacement, count=1):
    """Replace `anchor` with `replacement` unless `marker` is already present."""
    global text
    if marker in text:
        skipped.append(name)
        return
    hits = text.count(anchor)
    if hits != count:
        failures.append('%s: anchor found %d time(s), expected %d' % (name, hits, count))
        return
    text = text.replace(anchor, replacement, count)
    if marker not in text:
        failures.append('%s: marker missing after replacement (bad step definition)' % name)
        return
    applied.append(name)


# ---------------------------------------------------------------- S1 · CSS ----
step(
    'S1 css',
    '.wp-runs-empty',
    "    .wp-run-summary { font-size: 11.5px; color: var(--muted); white-space: nowrap; }\n",
    "    .wp-run-summary { font-size: 11.5px; color: var(--muted); white-space: nowrap; }\n"
    "    .wp-runs-empty { margin: 2px 0 8px; font-size: 12.5px; color: var(--muted); font-style: italic; }\n"
    "    .wp-run-head input.wp-run-case, .wp-run-head input.wp-run-version { flex: 0 1 110px; min-width: 70px; }\n"
    "    .wp-prompt-head input.wp-effort-note { flex: 1 1 220px; font-size: 11.5px; color: var(--muted); }\n"
    "    .wp-section-label { border: 0; background: none; font: inherit; font-size: 11.5px; color: var(--muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; padding: 4px 6px; }\n"
    "    .wp-section-label:hover { color: var(--text); }\n"
    "    .wp-block { scroll-margin-top: 58px; }\n"
    "    #wpContentsSep { margin-left: auto; }\n",
)

# --------------------------------------------------------- S2 · WP_LIMITS ----
step(
    'S2 wp-limits',
    'reasoningEffort: 400',
    "        settingValue: 4000,\n        settingRows: 80\n      };",
    "        settingValue: 4000,\n        settingRows: 80,\n        reasoningEffort: 400\n      };",
)

# --------------------------------------- S3 · sanitize prompt: effort note ----
step(
    'S3 sanitize-prompt-effort',
    "'the prompt');\n          clean.reasoningEffort",
    "          clean.text = cut(block.text, WP_LIMITS.promptText, 'the prompt');\n"
    "          clean.updatedAt = typeof block.updatedAt === 'string' ? block.updatedAt : '';",
    "          clean.text = cut(block.text, WP_LIMITS.promptText, 'the prompt');\n"
    "          clean.reasoningEffort = cut(block.reasoningEffort, WP_LIMITS.reasoningEffort, 'a reasoning-effort note');\n"
    "          clean.updatedAt = typeof block.updatedAt === 'string' ? block.updatedAt : '';",
)

# ---------------------------- S4 · sanitize knowledge: row role + effort ------
step(
    'S4 sanitize-knowledge-role',
    'role: normalizeKnowledgeRole(row?.role),',
    "            notes: cut(row?.notes, WP_LIMITS.knowledgeNotes, 'source notes'),\n"
    "            content: cut(row?.content, WP_LIMITS.knowledgeContent, 'a knowledge source')\n"
    "          }));",
    "            role: normalizeKnowledgeRole(row?.role),\n"
    "            notes: cut(row?.notes, WP_LIMITS.knowledgeNotes, 'source notes'),\n"
    "            content: cut(row?.content, WP_LIMITS.knowledgeContent, 'a knowledge source')\n"
    "          }));\n"
    "          clean.reasoningEffort = cut(block.reasoningEffort, WP_LIMITS.reasoningEffort, 'a reasoning-effort note');",
)

# ------------------------------------- S5 · normalizeKnowledgeRole helper -----
step(
    'S5 normalize-knowledge-role',
    'function normalizeKnowledgeRole(value)',
    "      function normalizeWorkpaperType(value) {\n"
    "        const type = String(value == null ? '' : value).trim().toLowerCase().replace(/\\s+/g, '-');\n"
    "        return ['agent-spec', 'narrative', 'control', 'note'].includes(type) ? type : 'narrative';\n"
    "      }",
    "      function normalizeWorkpaperType(value) {\n"
    "        const type = String(value == null ? '' : value).trim().toLowerCase().replace(/\\s+/g, '-');\n"
    "        return ['agent-spec', 'narrative', 'control', 'note'].includes(type) ? type : 'narrative';\n"
    "      }\n"
    "\n"
    "      /* Knowledge-source roles arrive from models and hand-written JSON in every\n"
    "         casing; read them generously, keep the enum strict. Unknown values fall\n"
    "         back to unset - never invented, never guessed. */\n"
    "      function normalizeKnowledgeRole(value) {\n"
    "        const role = String(value == null ? '' : value).trim().toLowerCase().replace(/\\s+/g, '-');\n"
    "        return ['operational', 'code', 'test-spec', 'setup', 'supporting', 'reference'].includes(role) ? role : '';\n"
    "      }",
)

# ------------------- S6 · sanitize testruns: new fields + empty-row filter ----
step(
    'S6 sanitize-testruns',
    "testCaseId: String(row?.testCaseId || '').slice(0, 40)",
    "          clean.rows = wpCutList(block.rows, 200, kind, 'test runs', report).map(row => ({\n"
    "            at: String(row?.at || '').slice(0, 40),\n"
    "            input: cut(row?.input, WP_LIMITS.testrunInput, 'a test run input'),\n"
    "            output: cut(row?.output, WP_LIMITS.testrunOutput, 'a test run output'),\n"
    "            verdict: ['pass', 'fail', 'partial', 'not-run'].includes(row?.verdict) ? row.verdict : 'not-run',\n"
    "            notes: cut(row?.notes, 4000, 'test run notes'),\n"
    "            by: String(row?.by || '').slice(0, 80)\n"
    "          }));\n"
    "          if (!clean.rows.length) clean.rows = [{ at: '', input: '', output: '', verdict: 'not-run', notes: '', by: '' }];",
    "          clean.rows = wpCutList(block.rows, 200, kind, 'test runs', report).map(row => ({\n"
    "            at: String(row?.at || '').slice(0, 40),\n"
    "            input: cut(row?.input, WP_LIMITS.testrunInput, 'a test run input'),\n"
    "            output: cut(row?.output, WP_LIMITS.testrunOutput, 'a test run output'),\n"
    "            verdict: ['pass', 'fail', 'partial', 'not-run'].includes(row?.verdict) ? row.verdict : 'not-run',\n"
    "            notes: cut(row?.notes, 4000, 'test run notes'),\n"
    "            by: String(row?.by || '').slice(0, 80),\n"
    "            testCaseId: String(row?.testCaseId || '').slice(0, 40),\n"
    "            agentVersion: String(row?.agentVersion || '').slice(0, 40)\n"
    "          // An all-empty not-run row is a placeholder, not evidence: keeping it made\n"
    "          // the log claim \"1 run\" over nothing. Any filled field - a date, a planned\n"
    "          // tester, a test-case id - makes the row real, and real rows are kept.\n"
    "          })).filter(row => row.verdict !== 'not-run'\n"
    "            || [row.at, row.input, row.output, row.notes, row.by, row.testCaseId, row.agentVersion].some(Boolean));",
)

# ------------------------------- S7 · knowledge-row seeds gain role: '' -------
step(
    'S7 knowledge-row-seeds',
    "{ name: '', fileType: 'txt', notes: '', content: '', role: '' }",
    "{ name: '', fileType: 'txt', notes: '', content: '' }",
    "{ name: '', fileType: 'txt', notes: '', content: '', role: '' }",
    count=4,
)

# ---------------- S8 · run remove handler stops re-seeding a placeholder ------
step(
    'S8 run-remove-no-reseed',
    'An emptied log stays empty',
    "          remove.addEventListener('click', () => {\n"
    "            block.rows.splice(rowIndex, 1);\n"
    "            if (!block.rows.length) block.rows.push({ at: '', input: '', output: '', verdict: 'not-run', notes: '', by: '' });\n"
    "            touchWorkpaper(doc);\n"
    "            renderWorkpaperBlocks(doc);\n"
    "          });",
    "          remove.addEventListener('click', () => {\n"
    "            block.rows.splice(rowIndex, 1);\n"
    "            // An emptied log stays empty - the blank state below says so. Re-seeding\n"
    "            // a placeholder here is what made \"1 run\" appear over no evidence.\n"
    "            touchWorkpaper(doc);\n"
    "            renderWorkpaperBlocks(doc);\n"
    "          });",
)

# ---------------------- S9 · run summary goes quiet over an empty log ---------
step(
    'S9 run-summary-blank',
    'summary.textContent = block.rows.length',
    "        summary.textContent = `${block.rows.length} run${block.rows.length === 1 ? '' : 's'} \u00b7 ${counts.pass} pass \u00b7 ${counts.partial} partial \u00b7 ${counts.fail} fail`;",
    "        summary.textContent = block.rows.length\n"
    "          ? `${block.rows.length} run${block.rows.length === 1 ? '' : 's'} \u00b7 ${counts.pass} pass \u00b7 ${counts.partial} partial \u00b7 ${counts.fail} fail`\n"
    "          : '';",
)

# ------------------- S10 · run rows gain Test case / Agent version inputs -----
step(
    'S10 run-row-inputs',
    "const caseId = document.createElement('input');",
    "          when.addEventListener('input', () => { row.at = when.value.slice(0, 40); touchWorkpaper(doc); });\n"
    "          const verdict = document.createElement('select');",
    "          when.addEventListener('input', () => { row.at = when.value.slice(0, 40); touchWorkpaper(doc); });\n"
    "          const caseId = document.createElement('input');\n"
    "          caseId.type = 'text';\n"
    "          caseId.className = 'wp-run-case';\n"
    "          caseId.placeholder = 'Test case';\n"
    "          caseId.title = 'Which test case this run exercised - e.g. a row of the test-case table';\n"
    "          caseId.value = row.testCaseId || '';\n"
    "          caseId.setAttribute('aria-label', 'Test case this run exercised');\n"
    "          caseId.addEventListener('input', () => { row.testCaseId = caseId.value.slice(0, 40); touchWorkpaper(doc); });\n"
    "          const runVersion = document.createElement('input');\n"
    "          runVersion.type = 'text';\n"
    "          runVersion.className = 'wp-run-version';\n"
    "          runVersion.placeholder = 'Agent version';\n"
    "          runVersion.title = 'Which version of the agent this run exercised';\n"
    "          runVersion.value = row.agentVersion || '';\n"
    "          runVersion.setAttribute('aria-label', 'Agent version this run exercised');\n"
    "          runVersion.addEventListener('input', () => { row.agentVersion = runVersion.value.slice(0, 40); touchWorkpaper(doc); });\n"
    "          const verdict = document.createElement('select');",
)

step(
    'S11 run-row-append',
    'line.append(when, caseId, runVersion, verdict, by, remove);',
    "          line.append(when, verdict, by, remove);",
    "          line.append(when, caseId, runVersion, verdict, by, remove);",
)

# --------------------- S12 · blank state above + Run, new-run field seeds -----
step(
    'S12 run-blank-state',
    "empty.className = 'wp-runs-empty';",
    "        const add = document.createElement('button');\n"
    "        add.type = 'button';\n"
    "        add.className = 'btn secondary compact';\n"
    "        add.textContent = '+ Run';",
    "        // An empty log says so in words. \"1 run\" over a placeholder was worse\n"
    "        // than silence; this is the honest blank state instead.\n"
    "        if (!block.rows.length) {\n"
    "          const empty = document.createElement('p');\n"
    "          empty.className = 'wp-runs-empty';\n"
    "          empty.textContent = 'No test runs recorded.';\n"
    "          grid.appendChild(empty);\n"
    "        }\n"
    "        const add = document.createElement('button');\n"
    "        add.type = 'button';\n"
    "        add.className = 'btn secondary compact';\n"
    "        add.textContent = '+ Run';",
)

step(
    'S13 run-add-seeds',
    "agentVersion: String((doc.agent && doc.agent.agentVersion) || '').slice(0, 40)",
    "          block.rows.push({\n"
    "            at: `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`,\n"
    "            input: '', output: '', verdict: 'not-run', notes: '',\n"
    "            by: state.workpaperView.commentAuthor || ''\n"
    "          });",
    "          block.rows.push({\n"
    "            at: `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`,\n"
    "            input: '', output: '', verdict: 'not-run', notes: '',\n"
    "            by: state.workpaperView.commentAuthor || '',\n"
    "            testCaseId: '',\n"
    "            // A run exercises the agent version that exists when it is logged.\n"
    "            agentVersion: String((doc.agent && doc.agent.agentVersion) || '').slice(0, 40)\n"
    "          });",
)

# ----------------------- S14 · role vocabulary next to WP_KNOWLEDGE_TYPES -----
step(
    'S14 knowledge-roles-const',
    'const WP_KNOWLEDGE_ROLES = [',
    "        ['other', 'Other']\n      ];",
    "        ['other', 'Other']\n      ];\n"
    "\n"
    "      /* What a source IS to the agent: Operational Knowledge and Code define its\n"
    "         behaviour; the rest documents it. This formalises the roles the notes\n"
    "         column already improvises (\"Operational Knowledge - ...\", \"Supporting\n"
    "         documentation only - ...\"). Absent = legacy = unset. */\n"
    "      const WP_KNOWLEDGE_ROLES = [\n"
    "        ['', '\\u2014'],\n"
    "        ['operational', 'Operational Knowledge'],\n"
    "        ['code', 'Code'],\n"
    "        ['test-spec', 'Test Specification'],\n"
    "        ['setup', 'Setup Documentation'],\n"
    "        ['supporting', 'Supporting Documentation'],\n"
    "        ['reference', 'Reference']\n"
    "      ];\n"
    "\n"
    "      function knowledgeRoleLabel(role) {\n"
    "        const entry = WP_KNOWLEDGE_ROLES.find(([value]) => value === role);\n"
    "        return entry && entry[0] ? entry[1] : '\\u2014';\n"
    "      }",
)

# ------------------------------ S15 · role select in the knowledge row --------
step(
    'S15 knowledge-role-select',
    "role.className = 'wp-knowledge-role';",
    "          type.value = row.fileType;\n"
    "          type.addEventListener('change', () => { row.fileType = type.value; touchWorkpaper(doc); });",
    "          type.value = row.fileType;\n"
    "          type.addEventListener('change', () => { row.fileType = type.value; touchWorkpaper(doc); });\n"
    "          const role = document.createElement('select');\n"
    "          role.className = 'wp-knowledge-role';\n"
    "          role.setAttribute('aria-label', 'Role of this knowledge source');\n"
    "          role.title = 'What this source is to the agent: Operational Knowledge and Code define behaviour; the rest document it';\n"
    "          WP_KNOWLEDGE_ROLES.forEach(([value, label]) => {\n"
    "            const option = document.createElement('option');\n"
    "            option.value = value;\n"
    "            option.textContent = label;\n"
    "            role.appendChild(option);\n"
    "          });\n"
    "          role.value = normalizeKnowledgeRole(row.role);\n"
    "          role.addEventListener('change', () => { row.role = role.value; touchWorkpaper(doc); });",
)

step(
    'S16 knowledge-role-append',
    'line.append(name, type, role, notes, copyRow, remove);',
    "          line.append(name, type, notes, copyRow, remove);",
    "          line.append(name, type, role, notes, copyRow, remove);",
)

# --------------------- S17 · effort inputs on knowledge and prompt heads ------
step(
    'S17 knowledge-effort-input',
    "'Reasoning-effort note for this knowledge block'",
    "        tag.textContent = 'Knowledge';\n"
    "        head.appendChild(tag);",
    "        tag.textContent = 'Knowledge';\n"
    "        head.appendChild(tag);\n"
    "        const effort = document.createElement('input');\n"
    "        effort.type = 'text';\n"
    "        effort.className = 'wp-effort-note';\n"
    "        effort.placeholder = \"Reasoning-effort note (optional, e.g. 'run at high reasoning effort')\";\n"
    "        effort.title = 'How this knowledge is meant to be reasoned over, in your words. Optional; never invented.';\n"
    "        effort.value = block.reasoningEffort || '';\n"
    "        effort.setAttribute('aria-label', 'Reasoning-effort note for this knowledge block');\n"
    "        effort.addEventListener('input', () => { block.reasoningEffort = effort.value.slice(0, WP_LIMITS.reasoningEffort); touchWorkpaper(doc); });\n"
    "        head.appendChild(effort);",
)

step(
    'S18 prompt-effort-input',
    "'Reasoning-effort note for this prompt'",
    "        head.append(tag, label, model, copy);",
    "        const effort = document.createElement('input');\n"
    "        effort.type = 'text';\n"
    "        effort.className = 'wp-effort-note';\n"
    "        effort.placeholder = \"Reasoning-effort note (optional, e.g. 'run at high reasoning effort')\";\n"
    "        effort.title = 'How hard the model is asked to think when running this prompt, in your words. Optional; never invented.';\n"
    "        effort.value = block.reasoningEffort || '';\n"
    "        effort.setAttribute('aria-label', 'Reasoning-effort note for this prompt');\n"
    "        effort.addEventListener('input', () => { block.reasoningEffort = effort.value.slice(0, WP_LIMITS.reasoningEffort); touchWorkpaper(doc); });\n"
    "        head.append(tag, label, model, effort, copy);",
)

# ------------------------------------------- S19 · HTML/Word/PDF export -------
step(
    'S19 export-html-prompt',
    'const effort = block.reasoningEffort ? `<p><em>Reasoning effort: ${esc(block.reasoningEffort)}</em></p>` : \'\';\n            return `<div class="kind-tag">PROMPT</div>',
    "          if (block.kind === 'prompt') {\n"
    "            return `<div class=\"kind-tag\">PROMPT</div><div class=\"prompt\"><div class=\"prompt-head\"><strong>${esc(block.label)}</strong>${block.model ? ` \\u00b7 ${esc(block.model)}` : ''}</div><pre>${esc(block.text)}</pre></div>`;\n"
    "          }",
    "          if (block.kind === 'prompt') {\n"
    "            const effort = block.reasoningEffort ? `<p><em>Reasoning effort: ${esc(block.reasoningEffort)}</em></p>` : '';\n"
    "            return `<div class=\"kind-tag\">PROMPT</div>${effort}<div class=\"prompt\"><div class=\"prompt-head\"><strong>${esc(block.label)}</strong>${block.model ? ` \\u00b7 ${esc(block.model)}` : ''}</div><pre>${esc(block.text)}</pre></div>`;\n"
    "          }",
)

step(
    'S20 export-html-testruns',
    '<p><em>No test runs recorded.</em></p>',
    "          if (block.kind === 'testruns') {\n"
    "            const rows = (block.rows || []).map(row => `<tr><td>${esc(row.at || '\u2013')}</td>`\n"
    "              + `<td><span class=\"verdict verdict-${esc(row.verdict)}\">${esc(row.verdict.replace('-', ' '))}</span></td>`\n"
    "              + `<td><pre>${esc(row.input || '')}</pre></td><td><pre>${esc(row.output || '')}</pre></td>`\n"
    "              + `<td>${esc(row.notes || '')}${row.by ? `<br/><em>${esc(row.by)}</em>` : ''}</td></tr>`).join('');\n"
    "            return `<h3>${esc(block.label || 'Agent test runs')}</h3><table class=\"runs\"><thead><tr><th>When</th><th>Verdict</th><th>Input</th><th>Output</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`;\n"
    "          }",
    "          if (block.kind === 'testruns') {\n"
    "            const heading = `<h3>${esc(block.label || 'Agent test runs')}</h3>`;\n"
    "            if (!(block.rows || []).length) return `${heading}<p><em>No test runs recorded.</em></p>`;\n"
    "            const withCase = block.rows.some(row => row.testCaseId);\n"
    "            const withVersion = block.rows.some(row => row.agentVersion);\n"
    "            const rows = block.rows.map(row => `<tr><td>${esc(row.at || '\u2013')}</td>`\n"
    "              + (withCase ? `<td>${esc(row.testCaseId || '')}</td>` : '')\n"
    "              + (withVersion ? `<td>${esc(row.agentVersion || '')}</td>` : '')\n"
    "              + `<td><span class=\"verdict verdict-${esc(row.verdict)}\">${esc(row.verdict.replace('-', ' '))}</span></td>`\n"
    "              + `<td><pre>${esc(row.input || '')}</pre></td><td><pre>${esc(row.output || '')}</pre></td>`\n"
    "              + `<td>${esc(row.notes || '')}${row.by ? `<br/><em>${esc(row.by)}</em>` : ''}</td></tr>`).join('');\n"
    "            return `${heading}<table class=\"runs\"><thead><tr><th>When</th>${withCase ? '<th>Test case</th>' : ''}${withVersion ? '<th>Version</th>' : ''}<th>Verdict</th><th>Input</th><th>Output</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`;\n"
    "          }",
)

step(
    'S21 export-html-knowledge',
    'const withRole = block.rows.some(row => row.role);',
    "          if (block.kind === 'knowledge') {\n"
    "            const table = `<div class=\"kind-tag\">KNOWLEDGE</div><table class=\"settings\"><tr><th>Source</th><th>Type</th><th>Represents</th></tr>${block.rows.map(row =>\n"
    "              `<tr><td>${esc(row.name)}</td><td>${esc(row.fileType)}</td><td>${esc(row.notes)}</td></tr>`).join('')}</table>`;\n"
    "            const payloads = block.rows.filter(row => row.content.trim()).map(row =>\n"
    "              `<div class=\"prompt\"><div class=\"prompt-head\"><strong>${esc(row.name || 'Attachment')}</strong> \u00b7 ${esc(row.fileType)}</div><pre>${esc(row.content)}</pre></div>`).join('');\n"
    "            return table + payloads;\n"
    "          }",
    "          if (block.kind === 'knowledge') {\n"
    "            const withRole = block.rows.some(row => row.role);\n"
    "            const effort = block.reasoningEffort ? `<p><em>Reasoning effort: ${esc(block.reasoningEffort)}</em></p>` : '';\n"
    "            const table = `<div class=\"kind-tag\">KNOWLEDGE</div>${effort}<table class=\"settings\"><tr><th>Source</th><th>Type</th>${withRole ? '<th>Role</th>' : ''}<th>Represents</th></tr>${block.rows.map(row =>\n"
    "              `<tr><td>${esc(row.name)}</td><td>${esc(row.fileType)}</td>${withRole ? `<td>${esc(knowledgeRoleLabel(row.role))}</td>` : ''}<td>${esc(row.notes)}</td></tr>`).join('')}</table>`;\n"
    "            const payloads = block.rows.filter(row => row.content.trim()).map(row =>\n"
    "              `<div class=\"prompt\"><div class=\"prompt-head\"><strong>${esc(row.name || 'Attachment')}</strong> \u00b7 ${esc(row.fileType)}${row.role ? ` \u00b7 ${esc(knowledgeRoleLabel(row.role))}` : ''}</div><pre>${esc(row.content)}</pre></div>`).join('');\n"
    "            return table + payloads;\n"
    "          }",
)

# ---------------------------------------------------- S22 · block digest ------
step(
    'S22 digest',
    ".join('\\n') : 'No test runs recorded.';",
    "        if (block.kind === 'prompt') return `${block.label || ''} ${block.model || ''}\\n${block.text || ''}`.trim();\n"
    "        if (block.kind === 'settings') return (block.rows || []).map(row => `${row.key}: ${row.value}`).join('\\n');\n"
    "        if (block.kind === 'knowledge') return (block.rows || []).map(row => `${row.name} (${row.fileType}) ${row.notes}\\n${row.content || ''}`.trim()).join('\\n');\n"
    "        if (block.kind === 'testruns') return (block.rows || []).map(row => `${row.at || '-'} \\u00b7 ${row.verdict} \\u00b7 ${row.input} \\u2192 ${row.output}${row.notes ? ' (' + row.notes + ')' : ''}`).join('\\n');",
    "        if (block.kind === 'prompt') return `${block.label || ''} ${block.model || ''}${block.reasoningEffort ? '\\nReasoning effort: ' + block.reasoningEffort : ''}\\n${block.text || ''}`.trim();\n"
    "        if (block.kind === 'settings') return (block.rows || []).map(row => `${row.key}: ${row.value}`).join('\\n');\n"
    "        if (block.kind === 'knowledge') return (block.reasoningEffort ? 'Reasoning effort: ' + block.reasoningEffort + '\\n' : '') + (block.rows || []).map(row => `${row.name} (${row.fileType}${row.role ? ' \\u00b7 ' + row.role : ''}) ${row.notes}\\n${row.content || ''}`.trim()).join('\\n');\n"
    "        if (block.kind === 'testruns') return (block.rows || []).length ? block.rows.map(row => `${row.at || '-'}${row.testCaseId ? ' \\u00b7 case ' + row.testCaseId : ''}${row.agentVersion ? ' \\u00b7 v' + row.agentVersion : ''} \\u00b7 ${row.verdict} \\u00b7 ${row.input} \\u2192 ${row.output}${row.notes ? ' (' + row.notes + ')' : ''}`).join('\\n') : 'No test runs recorded.';",
)

# ------------------------------------------------- S23 · Markdown export ------
step(
    'S23 markdown-prompt-knowledge',
    "lines.push('*Reasoning effort: ' + block.reasoningEffort + '*', '');",
    "          else if (block.kind === 'prompt') lines.push('### ' + (block.label || 'Agent instructions'), '', '```', block.text || '', '```', '');\n"
    "          else if (block.kind === 'settings') { (block.rows || []).forEach(row => lines.push('- **' + row.key + '**: ' + row.value)); lines.push(''); }\n"
    "          else if (block.kind === 'knowledge') { (block.rows || []).forEach(row => lines.push('- **' + row.name + '** (' + row.fileType + ') ' + row.notes)); lines.push(''); }",
    "          else if (block.kind === 'prompt') {\n"
    "            lines.push('### ' + (block.label || 'Agent instructions'), '');\n"
    "            if (block.reasoningEffort) lines.push('*Reasoning effort: ' + block.reasoningEffort + '*', '');\n"
    "            lines.push('```', block.text || '', '```', '');\n"
    "          }\n"
    "          else if (block.kind === 'settings') { (block.rows || []).forEach(row => lines.push('- **' + row.key + '**: ' + row.value)); lines.push(''); }\n"
    "          else if (block.kind === 'knowledge') {\n"
    "            if (block.reasoningEffort) lines.push('*Reasoning effort: ' + block.reasoningEffort + '*', '');\n"
    "            (block.rows || []).forEach(row => lines.push('- **' + row.name + '** (' + row.fileType + (row.role ? ' \u00b7 ' + row.role : '') + ') ' + row.notes));\n"
    "            lines.push('');\n"
    "          }",
)

step(
    'S24 markdown-testruns',
    "lines.push('No test runs recorded.', '');",
    "          else if (block.kind === 'testruns') {\n"
    "            lines.push('| When | Verdict | Input | Output | Notes |', '| --- | --- | --- | --- | --- |');\n"
    "            (block.rows || []).forEach(row => lines.push('| ' + [row.at, row.verdict, row.input, row.output, row.notes].map(cell => String(cell || '').replace(/[|\\n]/g, ' ')).join(' | ') + ' |'));\n"
    "            lines.push('');\n"
    "          }",
    "          else if (block.kind === 'testruns') {\n"
    "            if (!(block.rows || []).length) { lines.push('No test runs recorded.', ''); }\n"
    "            else {\n"
    "              const withCase = block.rows.some(row => row.testCaseId);\n"
    "              const withVersion = block.rows.some(row => row.agentVersion);\n"
    "              const heads = ['When'].concat(withCase ? ['Test case'] : []).concat(withVersion ? ['Version'] : []).concat(['Verdict', 'Input', 'Output', 'Notes']);\n"
    "              lines.push('| ' + heads.join(' | ') + ' |', '|' + heads.map(() => ' --- ').join('|') + '|');\n"
    "              block.rows.forEach(row => {\n"
    "                const cells = [row.at].concat(withCase ? [row.testCaseId] : []).concat(withVersion ? [row.agentVersion] : []).concat([row.verdict, row.input, row.output, row.notes]);\n"
    "                lines.push('| ' + cells.map(cell => String(cell || '').replace(/[|\\n]/g, ' ')).join(' | ') + ' |');\n"
    "              });\n"
    "              lines.push('');\n"
    "            }\n"
    "          }",
)

# ------------------------------------ S25 · AI template + Copilot import ------
step(
    'S25 template-knowledge-line',
    'role is optional and one of operational, code, test-spec, setup, supporting, reference',
    "            'knowledge: { kind, rows: [{ name, fileType, notes, content }] }; fileType is one of txt, pdf, docx, xlsx, site, python, other.',",
    "            'knowledge: { kind, rows: [{ name, fileType, notes, content, role }] }; fileType is one of txt, pdf, docx, xlsx, site, python, other; role is optional and one of operational, code, test-spec, setup, supporting, reference - leave it out if unsure.',",
)

step(
    'S26 template-testruns-line',
    'testCaseId and agentVersion are optional references',
    "            'testruns: { kind, label, rows: [{ at, input, output, verdict, notes, by }] }; verdict is one of pass, partial, fail, not-run.',",
    "            'testruns: { kind, label, rows: [{ at, input, output, verdict, notes, by, testCaseId, agentVersion }] }; verdict is one of pass, partial, fail, not-run; testCaseId and agentVersion are optional references to the test-case table and the agent version exercised.',",
)

step(
    'S27 template-knowledge-example',
    "role: '', notes: '<what it is for>'",
    "              { kind: 'knowledge', rows: [{ name: '<file name>', fileType: 'txt', notes: '<what it is for>', content: '<the whole file>' }] },",
    "              { kind: 'knowledge', rows: [{ name: '<file name>', fileType: 'txt', role: '', notes: '<what it is for>', content: '<the whole file>' }] },",
)

step(
    'S28 template-no-placeholder-run',
    "{ kind: 'testruns', label: 'Agent test runs', rows: [] },",
    "              { kind: 'testruns', label: 'Agent test runs', rows: [{ at: '', input: '', output: '', verdict: 'not-run', notes: '', by: '' }] },",
    "              { kind: 'testruns', label: 'Agent test runs', rows: [] },",
)

step(
    'S29 copilot-no-placeholder-run',
    "blocks.push({ kind: 'testruns', label: 'Agent test runs', rows: [] });",
    "        blocks.push({ kind: 'testruns', label: 'Agent test runs', rows: [{ at: '', input: '', output: '', verdict: 'not-run', notes: 'Record each run of this agent here as audit evidence.', by: '' }] });",
    "        blocks.push({ kind: 'testruns', label: 'Agent test runs', rows: [] });",
)

# ------------------------------------------ S30 · Contents navigation ---------
NAV_CODE = (
    "      /* Contents: a large specification is a dozen screens tall, and the\n"
    "         scrollbar is not navigation. One popover in the existing struct-menu\n"
    "         family lists the headings, a jump lands with the same flash the comments\n"
    "         panel uses, and a quiet current-section label follows the reader.\n"
    "         Deliberately generic: any document with four or more headings gets it,\n"
    "         and it speaks no agent vocabulary. */\n"
    "      let wpContentsObserver = null;\n"
    "      let wpContentsScrollHook = null;\n"
    "\n"
    "      function workpaperHeadingEntries(doc) {\n"
    "        const found = [];\n"
    "        (doc.blocks || []).forEach((block, index) => {\n"
    "          if (block.kind === 'heading') found.push({ block, index });\n"
    "        });\n"
    "        return found.map((entry, at) => {\n"
    "          const next = found[at + 1];\n"
    "          return {\n"
    "            id: entry.block.id,\n"
    "            text: String(entry.block.text || '').trim() || 'Untitled section',\n"
    "            level: entry.block.level || 2,\n"
    "            blocks: (next ? next.index : (doc.blocks || []).length) - entry.index - 1\n"
    "          };\n"
    "        });\n"
    "      }\n"
    "\n"
    "      function jumpToWorkpaperBlock(blockId) {\n"
    "        const target = el.wpBlocks && el.wpBlocks.querySelector('[data-block-id=\"' + blockId + '\"]');\n"
    "        if (!target) return;\n"
    "        target.scrollIntoView({ block: 'start', behavior: 'smooth' });\n"
    "        target.classList.add('is-flashed');\n"
    "        setTimeout(() => target.classList.remove('is-flashed'), 1600);\n"
    "      }\n"
    "\n"
    "      function openWorkpaperContentsMenu(anchor) {\n"
    "        const doc = activeWorkpaper();\n"
    "        if (!doc) return;\n"
    "        const options = workpaperHeadingEntries(doc).map(entry => [entry.id,\n"
    "          '\\u2003'.repeat(Math.max(0, (entry.level || 2) - 1)) + entry.text\n"
    "          + ' \\u00b7 ' + entry.blocks + ' block' + (entry.blocks === 1 ? '' : 's')]);\n"
    "        if (!options.length) return;\n"
    "        openStructureMenu(anchor, options, '', jumpToWorkpaperBlock);\n"
    "      }\n"
    "\n"
    "      function renderWorkpaperContents(doc) {\n"
    "        const toolbar = document.getElementById('wpToolbar');\n"
    "        if (!toolbar) return;\n"
    "        let sep = toolbar.querySelector('#wpContentsSep');\n"
    "        let button = toolbar.querySelector('#wpContentsButton');\n"
    "        let label = toolbar.querySelector('#wpSectionLabel');\n"
    "        if (!button) {\n"
    "          sep = document.createElement('span');\n"
    "          sep.id = 'wpContentsSep';\n"
    "          sep.className = 'wp-tool-sep';\n"
    "          sep.setAttribute('aria-hidden', 'true');\n"
    "          button = document.createElement('button');\n"
    "          button.type = 'button';\n"
    "          button.id = 'wpContentsButton';\n"
    "          button.className = 'btn ghost compact';\n"
    "          button.textContent = '\\u2630 Contents';\n"
    "          button.title = 'Jump to a section of this document';\n"
    "          button.addEventListener('click', () => openWorkpaperContentsMenu(button));\n"
    "          label = document.createElement('button');\n"
    "          label.type = 'button';\n"
    "          label.id = 'wpSectionLabel';\n"
    "          label.className = 'wp-section-label';\n"
    "          label.title = 'The section you are reading - click to jump to another';\n"
    "          label.hidden = true;\n"
    "          label.addEventListener('click', () => openWorkpaperContentsMenu(label));\n"
    "          toolbar.append(sep, button, label);\n"
    "        }\n"
    "        if (wpContentsObserver) { wpContentsObserver.disconnect(); wpContentsObserver = null; }\n"
    "        const headings = workpaperHeadingEntries(doc);\n"
    "        const show = headings.length >= 4;\n"
    "        sep.hidden = !show;\n"
    "        button.hidden = !show;\n"
    "        label.hidden = true;\n"
    "        label.textContent = '';\n"
    "        if (!show) return;\n"
    "        const byId = new Map(headings.map(entry => [entry.id, entry]));\n"
    "        const nodes = [];\n"
    "        el.wpBlocks.querySelectorAll('.wp-block').forEach(node => {\n"
    "          if (byId.has(node.dataset.blockId)) nodes.push(node);\n"
    "        });\n"
    "        if (!nodes.length) return;\n"
    "        const scroller = el.wpDoc || document.getElementById('wpDoc');\n"
    "        const retitle = () => {\n"
    "          const top = scroller ? scroller.getBoundingClientRect().top : 0;\n"
    "          let pick = nodes[0];\n"
    "          nodes.forEach(node => { if (node.getBoundingClientRect().top <= top + 90) pick = node; });\n"
    "          const entry = byId.get(pick.dataset.blockId);\n"
    "          label.hidden = !entry;\n"
    "          if (entry) label.textContent = '\\u00a7 ' + entry.text;\n"
    "        };\n"
    "        // A heading crossing an edge of the pane is the moment the \"section you\n"
    "        // are in\" usually changes - the observer wakes there. A jump that lands a\n"
    "        // heading just below the top edge crosses nothing, so a light scroll hook\n"
    "        // (one rAF-throttled pass over 17 rectangles) keeps the label exact.\n"
    "        wpContentsObserver = new IntersectionObserver(retitle, { root: scroller || null, threshold: 0 });\n"
    "        nodes.forEach(node => wpContentsObserver.observe(node));\n"
    "        if (wpContentsScrollHook) wpContentsScrollHook.scroller.removeEventListener('scroll', wpContentsScrollHook.handler);\n"
    "        if (scroller) {\n"
    "          let pending = false;\n"
    "          const onScroll = () => {\n"
    "            if (pending) return;\n"
    "            pending = true;\n"
    "            requestAnimationFrame(() => { pending = false; retitle(); });\n"
    "          };\n"
    "          scroller.addEventListener('scroll', onScroll, { passive: true });\n"
    "          wpContentsScrollHook = { scroller, handler: onScroll };\n"
    "        }\n"
    "        retitle();\n"
    "      }\n"
    "\n"
)

step(
    'S30 contents-nav-functions',
    'function renderWorkpaperContents(doc)',
    "      function renderWorkpaperBlocks(doc) {",
    NAV_CODE + "      function renderWorkpaperBlocks(doc) {",
)

step(
    'S31 contents-nav-call',
    'renderWorkpaperContents(doc);\n      }',
    "        el.wpBlocks.appendChild(buildWorkpaperInserter(doc.blocks.length));\n"
    "        refreshWorkpaperChangeMarkers(doc);\n"
    "      }",
    "        el.wpBlocks.appendChild(buildWorkpaperInserter(doc.blocks.length));\n"
    "        refreshWorkpaperChangeMarkers(doc);\n"
    "        renderWorkpaperContents(doc);\n"
    "      }",
)

# ----------------------------------------------------------- finish -----------
if failures:
    print('ABORT - the file has drifted; nothing was written.')
    for line in failures:
        print('  ' + line)
    sys.exit(2)

# Post-conditions: never ship legal-verdict language; keep CSP text untouched is
# implicit (no step goes near the <meta http-equiv> region).
for banned in ('EU AI ACT COMPLIANT', 'NON-COMPLIANT'):
    if banned in text:
        print('ABORT - banned string "%s" would be present; nothing was written.' % banned)
        sys.exit(2)

directory = os.path.dirname(os.path.abspath(TARGET)) or '.'
fd, temp_path = tempfile.mkstemp(prefix='.siren_patch_', suffix='.html', dir=directory)
try:
    with io.open(fd, 'w', encoding='utf-8', newline='') as handle:
        handle.write(text)
    os.replace(temp_path, TARGET)
except Exception:
    try:
        os.unlink(temp_path)
    except OSError:
        pass
    raise

print('OK %s' % TARGET)
print('applied (%d): %s' % (len(applied), ', '.join(applied) or '-'))
print('skipped-already-present (%d): %s' % (len(skipped), ', '.join(skipped) or '-'))
