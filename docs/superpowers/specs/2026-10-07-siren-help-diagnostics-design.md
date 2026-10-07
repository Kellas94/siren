# SIREN Help & diagnostics

Date: 7 October 2026. Author: /root. Status: written specification for user review. The user approved the proposed structure in chat; this document has not yet been approved as an implementation specification.

## Purpose and accepted direction

Help a non-programmer understand an error, inspect what actually happened and choose an appropriate next step. The user requested a dictionary/manual inside SIREN, with explanations and logical diagrams. The accepted first stage is an offline searchable manual, direct access from errors, plain-language explanations, expandable technical details and resolution diagrams. It covers real SIREN errors first. Python/Terminal errors are included only when the application can identify them reliably. AI is optional later work and is not required for this module.

The interface follows the existing SIREN themes and compact desktop navigation. It must explain limits without implying that reading an article repaired the underlying problem.

## Placement and interaction

Add **Help & diagnostics** beside Quick guide in the existing Home Settings/help actions and in the shared native Help menu. Provide the same entry from the shared workspace help surface so the manual remains reachable from Docs, Code, Diagrams and Present. Retain Quick guide for learning features; the manual addresses problems. Do not add a permanent navigation column or another top-level work module.

Use a themed, keyboard-accessible manual panel: search and category filters on the left, article content on the right, with a single-column fallback for small desktop windows. Categories include project/open/save, sources/code, Docs, diagrams/export, Present/windows, PIN/recovery and updates. Terminal/debug entries clearly distinguish unavailable development capabilities from failures in a working shell.

Messages with an exact supported error identity expose **Explain error**. This opens the corresponding article with a short local context banner. The banner contains only allowlisted display data such as module, operation and a safe source line when available. It does not transmit or persist project text, logs or paths. A manual opened without an error remains a normal reference browser.

Escape closes the panel and returns focus to its initiator; search has a visible label; arrows/tab operate normal controls. The current article can be opened through a stable internal identifier. Lock closes and clears error context, keeps the manual inaccessible while locked and prevents a late error callback from reopening it. Read-only/recovery users can read help without acquiring write or execution authority. Audience receives no private context or troubleshooting UI.

## Article model and content policy

Each article contains an immutable ID, category, title, summary, source-scoped error mappings, observed meaning, possible causes, checks, recovery choices, data-loss implications, related articles and expandable technical references. Keep separate fields for what is known and what is merely possible. Use existing English product copy initially; do not introduce a second partial localization system.

Mappings use **namespace + operation + code** where needed. The same code (for example READONLY or ACCESS_REFUSED) can describe different boundaries; never map all raw strings globally to a single diagnosis. Match exact structured receipts from trusted SIREN adapters. Do not classify arbitrary stdout, stack traces, imported source or substrings as a proven error identity. Unknown codes get an honest generic article with the original bounded code shown as text, and no invented cause.

Content is shipped as a small versioned local data catalog. No remote fetch, external assets, runtime Markdown/HTML import or new dependency is required. Render plain text and a finite set of article components through existing DOM helpers, never innerHTML from an error. Source references record the module and the behavior used to author the article; developer references are expandable rather than primary copy. Tests detect mappings whose referenced receipt boundary or article target disappears.

First inventory actual user-facing receipt families before choosing the initial article count. Cover the highest-impact known failures with real source references; do not claim every exception in every dependency is explained. Installation/licensing/security claims must match the current qualified build, including unavailable update/login/native-Terminal features.

## Logical diagrams and safe actions

Represent resolution flows as bounded local node/edge data with decision, check and outcome types. Render an accessible native HTML/SVG flow with an equivalent ordered text path. The help system must remain useful when Mermaid rendering itself is broken, so resolution diagrams do not depend on Mermaid or external fonts. Select a decision to highlight the next check; reset returns to the start. A highlighted outcome is advice, not an execution result.

The initial manual performs no repair, shell execution, file deletion, PIN reset, project replacement or update installation. Existing safe navigation actions may reveal the relevant SIREN view only through its existing authorized bridge; unavailable actions stay explanatory. Copying a bounded technical summary is an explicit user action and excludes source text, credentials, raw environment and absolute paths. Do not automatically upload diagnostics or clipboard content.

Examples of wording: a save conflict means another saved version exists, so inspect it while retaining the draft; a source-size refusal means the current operation has a documented budget, not that the code is invalid; an unavailable Terminal guard means execution has not been qualified, not that PowerShell is broken. Verify the exact behavior in source before publishing any particular article.

## Architecture and lifecycle

Keep a pure catalog/search/resolver module and a shared manual view separate from operation-specific adapters. Static catalog queries need no new privileged IPC. Main supplies the native Help-menu navigation command through existing trusted surface control; it must not create a renderer-controlled execution or filesystem endpoint. Manual UI mounts/unmounts through the shared surface lifecycle and keeps only bounded local state.

Search is case-insensitive over catalog titles, codes and approved article text, bounded to the finite shipped catalog and a 200-character query. No project-wide source scan or worker is needed. Result ordering is deterministic: exact scoped code, title match, then content match. A flow is bounded to 24 nodes and 48 edges, validates references and accessible labels, and rejects invalid/cyclic navigation without recursion or unbounded traversal. Cycles are not needed in the initial resolution flow model.

Package the catalog and shared view explicitly through the existing builder and allowlist. Native windows, main workspace and Home must use the same content version, theme tokens and behavior. No standalone browser release or native detached help window is included in this first stage.

## Acceptance and validation

1. Offline opening and searching works from Home and working desktop modules; Quick guide remains available.
2. Known scoped receipts resolve to the correct article; colliding codes in another namespace and unknown codes do not acquire an unsupported diagnosis.
3. Articles distinguish observation, possible cause and advice, retain drafts and accurately describe qualified capabilities.
4. Logical flows work without Mermaid, using mouse and keyboard, with a text equivalent; malformed IDs/edges/cycles and oversized content refuse safely.
5. Imported HTML, arbitrary stdout, credential-like error text and source content cannot execute markup, enter an automatic upload or become privileged action payloads.
6. Lock, project change, surface disposal and late asynchronous callbacks clear context and cannot reopen a hidden panel. Reading in recovery does not enable editing/execution.
7. Use meaningful pure tests, actual native integration across representative Home/Code/Docs/Diagram surfaces and theme/Lock checks. Test the copied portable build, record source/package identities and preserve original failures.

## Deferred scope

General programming encyclopedia, arbitrary Python traceback diagnosis, debugger control, automatic repairs, cloud support submission, AI explanations, executable playbooks and full translation are separate follow-up work. This specification does not admit native Terminal execution or close any existing hosted-test failure.

## Self-review

The module reuses existing navigation, theme and Lock ownership; it introduces no runtime shell or new dependency. Unknown errors and duplicate codes have explicit behavior. Diagrams work independently of the renderer being diagnosed. Inventory may refine initial mappings and entry-point files without changing the accepted user flow; any privileged action would require a separate design change.
