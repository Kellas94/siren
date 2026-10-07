# SIREN Flows — proposed product direction

Date: 7 October 2026. Author: /root. User request: ready-made automated flows inside SIREN, so the application can help users accomplish work across its capabilities. This is a proposal and requirement record, not an implemented workflow engine or an approved architectural specification.

## Intended result

A user should be able to choose an outcome, understand the steps, inspect the results and keep the useful changes without learning every SIREN control first. Start with a small set of understandable playbooks. Local, predictable operations work without an AI key. Optional AI explanations and suggestions appear only when the user configures the optional integration; AI remains the previously agreed later workstream.

## First four playbooks

| Flow | Inputs | Proposed local result | Optional AI contribution |
| --- | --- | --- | --- |
| Document this script | Selected source and exact version | Structural outline, supported static diagram, linked Docs draft and an explicit list of analysis limits | Plain-language explanation, suggested questions and draft narrative |
| Compare versions | Two selected source versions | Existing comparison, changed symbols where analysis supports them, linked review draft | Explain probable impact; distinguish inference from observed behavior |
| Check this project | Explicitly selected project scope | Source-reference/link checks, supported Mermaid validation, findings with locations | Explain findings and suggest changes for review |
| Prepare a presentation | Selected Docs, diagrams and ordering | Proposed presentation sequence and editable draft | Suggested story, titles and speaker notes |

These are product targets, not a claim that all underlying native functions are already available. Inventory qualified commands first and disable unsupported steps with a clear explanation. Syntax validity does not establish semantic correctness. Code is not executed by the document/check flows. Running tests or a debugger requires an explicit execution step, a selected environment and the Terminal/Debug process authority.

## Placement and interaction

Offer **Flows** through Home's action area and global Find/command search, plus a relevant contextual action in Code, Docs, Diagrams and Present. Avoid another permanent navigation column. Use a compact themed panel with a few large outcome choices; show advanced options only when needed. A running flow shows its steps, selected project/source version, progress and a result preview. A user can leave the panel and return to it without losing draft work.

For each step, show what it will read, produce or change in ordinary language. Results open in the appropriate existing workspace. Drafts remain drafts until an explicit Save/Apply; export and external transmission are separate actions. Read-only/recovery views can inspect results but cannot execute or mutate. Keep review and explanation useful for non-programmers without presenting generated prose as proof.

## Execution and evidence

Use a small native-owned sequence of typed, allowlisted SIREN commands for the first playbooks. Do not add a general-purpose workflow framework before the concrete command inventory demonstrates a need. No renderer-provided shell commands, arbitrary JavaScript, imported workflow execution or automatic package installation.

Each run records its author/initiator, flow version, selected input identities, step status, actual result and any omissions. Preserve distinctions between static analysis, actual execution and AI-generated suggestions. A coordinator-produced summary is never labeled an independent reviewer verdict. Failed or skipped steps cannot silently become PASS because an output file exists.

Freeze or version-check inputs for each step; if the source changes, offer re-evaluation instead of applying stale results. Saves use the existing domain/CAS authority, preserve unrelated project data and detect conflicts. Repeated inspection steps may reuse a matching result; mutation and execution steps require explicit idempotency receipts. Never replay a shell command or debugger launch automatically after a crash.

Cancel stops scheduling new steps and retains useful drafts with their incomplete status. Lock fences new user commands, hides project content/results and respects the established Terminal policy: already running commands continue, while no new input is accepted. Define the treatment of pending local analysis and future network requests in the written specification before implementing the runner; do not infer authorization to start another step while locked.

## AI and data boundary

Without a configured key, hide AI-specific actions and keep local playbooks usable. Before any future remote request, show the selected source/context scope and the destination; imported code, comments and Docs content are untrusted inputs, never authority to invoke tools or disclose unrelated files. Store keys through the qualified native credential boundary, never project files or renderer storage. Precise provider/model, privacy, retention, request-size and cost behavior belongs to the later approved AI integration design.

## Delivery order and acceptance

1. Finish current native parity/defects and the real Terminal process foundation. Inventory which existing commands can support each playbook.
2. Present a written Flows specification and implementation plan, including cancellation, Lock, conflict handling and recovery. This research does not approve those artifacts in advance.
3. Implement one deterministic, read-only local playbook first; qualify exact inputs/results and stale-source/Lock behavior before adding draft saves or execution.
4. Add the other local playbooks and a polished themed entry point. Validate discoverability, keyboard operation, accessible progress and detached-window return paths.
5. Add optional AI assistance only after the separate key/provider design and qualification. Custom user-authored flows, triggers, unattended schedules and autonomous correction are later proposals.

Acceptance needs actual native and separate portable-copy tests, including failure halfway, cancellation, crash/restart, conflict, large inputs and locked/readonly windows. A rendered mockup or successful happy path alone does not qualify the feature.

Related: [Code debugger proposal](2026-10-07-siren-code-debugger.md), [approved Terminal design](../superpowers/specs/2026-10-03-siren-terminal-design.md), [Terminal implementation plan](../superpowers/plans/2026-10-03-siren-terminal.md).
