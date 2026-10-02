# Desktop evolution UX audit — 2026-10-02

Independent author: `/root/review_native_launcher`. Read-only product-design audit; no product, native driver or existing test files changed. Recommendations below are proposed design work, not approved architecture or implemented UI.

The application has strong local-first boundaries and a useful diagram/document/code relationship. Its largest usability problem is competing navigation and control layers. Start with one consistent context bar and quieter contextual controls; keep native Lock easy to reach. A distinct vault transition and a compact SIREN icon can follow that hierarchy work. AI remains the last batch and hidden without configuration, as requested.

## Scope and provenance

Fresh actual Electron run through the existing native QA driver, with an independently copied package and owned synthetic Data only. The fixture includes one three-node diagram, one new agent-specification document and the Python draft `review_audit`; no real user projects, credentials or knowledge files were inspected. PIN setup used actual masked UI entry and production native access; no unlock fixture injection.

Package: `development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43`. Receipt source `b6249016cc9a001c646cc183f3c38884da678b1d`; renderer SHA-256 `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8`; Electron 44.5.1. Independently rehashed owned archive: 14,277,106 bytes, SHA-256 `53da590bd172987fb0102b183dde6e5c921b4af6a2ec8f34f1c8251d63a1e9f5`.

Audit fixture SHA-256 `083c4ceb05aa50f896fae7b32c1d98a68d79a1769865a9cbabb52cbec48dbb67`; native driver SHA-256 `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4`. Native execution: explicit `C:/Program Files/nodejs/node.exe`, desktop working directory, escalated normal Windows execution. Receipt and pre-capture DOM observations: [steps.json](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/steps.json).

All captures are actual **1424 × 895 client pixels, DPR 1, dark theme**. Each saved PNG was inspected before acceptance and findings. They exclude Windows titlebar/frame, taskbar, native menus and operating-system dialogs. Inputs followed real Electron pointer/keyboard dispatch; this is not a physical hardware keyboard or screen-reader audit. No light-theme, small-window, zoom, touch, high-contrast or full keyboard traversal qualification is claimed.

## Captured steps

### 01 — PIN setup

**Good foundation.** Focused masked entry, clear keypad and Quit; local PIN explanation is very small.

![01 PIN setup](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/01-pin-setup.png)

### 02 — First workspace tour

**Needs simplification.** First card foregrounds technical native features before the first creative action.

![02 First workspace tour](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/02-workspace.png)

### 03 — Settled workspace

**Needs hierarchy.** Global navigation, diagram management, editing mode, style and preview actions compete across stacked bands.

![03 Settled workspace](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/03-workspace-ready.png)

### 04 — Docs library

**Good empty state.** Clear first-document CTA; top-level project/save identity and navigation grammar change.

![04 Docs library](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/04-docs-library.png)

### 05 — Agent specification document

**Needs progressive disclosure.** Clear selected document; governance, references and formatting consume substantial space before writing.

![05 Agent specification document](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/05-docs-agent-spec.png)

### 06 — Contents navigation intermediate frame

**Rejected for intended evidence.** Inspected redundant heading view; not accepted as a knowledge-section capture.

![06 Contents navigation intermediate frame](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/06-knowledge-document.png)

### 07 — Knowledge document section

**Useful, dense.** Optional provenance and content collapse are useful; horizontal metadata and repeated secondary buttons need grouping.

![07 Knowledge document section](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/07-knowledge-source.png)

### 08 — Code library

**Good boundary wording.** Explicitly says code is not run and independent files stay unlinked; uses a third navigation grammar.

![08 Code library](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/08-code-library.png)

### 09 — Floating Code with typed source

**Strong working model.** Source, structure and line explanation are linked; dense window chrome competes with the underlying workspace.

![09 Floating Code with typed source](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/09-code-floating.png)

### 10 — Minimised Code

**Useful return path.** Named draft restore pill remains visible, but competes with Desktop in the bottom-right corner.

![10 Minimised Code](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/10-code-minimised.png)

### 11 — Desktop controls

**Needs prioritisation.** Equal-weight grid mixes Lock, project actions, updates, recovery, diagnostics and Quit.

![11 Desktop controls](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/11-desktop-controls.png)

### 12 — PIN settings

**Clear scope.** Honest installation/local-access wording; generic Settings currently contains only Change PIN.

![12 PIN settings](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/12-pin-settings.png)

### 13 — Recovery list

**Safe wording, technical selection.** Clearly opens a verified new copy and preserves original/drafts; choosing versions relies on timestamps/revision numbers.

![13 Recovery list](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/13-recovery.png)

### 14 — Manual Lock completed

**Correct observed gate; identity opportunity.** Native locked/readonly state and null snapshot; empty focused password field. Backdrop repeats setup rather than a distinct vault.

![14 Manual Lock completed](C:/Claude/SIREN_WORK/portable/desktop/evidence/desktop-evolution-ux-2026-10-02/14-locked-vault.png)

Rejected loading/transition frames are retained separately: `02-workspace-loading-rejected.png`, `03-workspace-loading-rejected.png`, `09-code-floating-transition-rejected.png`, `14-lock-pre-navigation-rejected.png`. Step 06 remains inspected but excluded as knowledge evidence. Neither transient screenshot nor CSS visibility implies a measured physical display flash. The first knowledge wait used an incorrect assumed selector and failed; the accepted step 07 came from actual PageDown input and shows the intended section. The first Lock capture preceded completed navigation; the final accepted 14 is independently observed locked. These capture limitations are not product defects.

## Concrete findings and priorities

### Batch 1 — Make the existing workspace easier to navigate

**P1: consistent global context (03, 04, 08).** Diagram workspace shows SIREN, diagram identity and Saved locally; Docs switches to its own search/filter/Back header; Code switches again to Docs/Diagrams links. Keep selected project, current surface and an honest save indicator in the same place across all three. Use predictable Diagrams / Docs / Code navigation. Present belongs to the selected diagram/workspace action group rather than looking like another equally persistent library.

**P1: reduce permanent contextual controls (03, 09).** Main workspace stacks global controls, diagram tabs, mode/edit actions, font/colour/layout controls, and preview actions. Code adds window header, file tab, actions, sources, map, language and search. Keep daily actions visible; move typography, layout engine and optional metadata into the existing Inspect/Style disclosure. Keep Build/Mermaid adjacent to the editor they affect, and zoom/view adjacent to the canvas. This reduces visual demand without removing capability.

**P1: promote Lock and clarify Settings (11, 12, 14).** Add a visible, named Lock action or stable project-menu entry with a discoverable native shortcut. Settings currently means PIN settings; label it “PIN & local access” until it genuinely contains broader settings. Group project/import/export separately from Help, recovery, diagnostics and updates. Do not present unavailable update stages as equally prominent persistent actions. An inspected development UI mentioning signed updates is not proof of production update admission.

**P2: shorten the first tour card (02).** First teach where work is saved and how to return to it, then one creative action. Move recovery, signing, accounts and development limitations to relevant settings/help. Retain truthful status; remove the initial wall of technical prose.

Acceptance for this batch: verify navigation from each surface, visible project/save semantics, preserved private draft state after minimise/surface switch, clear focus restoration, and native locked/read-only authority. Proposed topbar grouping is not a new architecture approval.

### Batch 2 — Organise advanced work without flattening its meaning

**P2: document progressive disclosure (05, 07).** Agent specification is a useful local document type, but governance/release/reference fields appear before writing. Default to purpose/content; group optional review, release and provenance sections. For knowledge sources, use a readable stacked card with name/type/role as essentials, origin/date/description under Details, content in the existing disclosure, and smaller secondary Copy actions. Preserve exact source text and provenance. A local knowledge document must not imply configured AI execution.

**P2: unify Code return paths (09, 10).** Retain the good source → structure → explanation layout, native private recovery wording and explicit static-analysis boundary. A small shared window shelf can group minimised drafts away from Desktop access. Name unsaved versus privately recovered versus explicitly saved-to-Docs states plainly. Keep close/discard/save meanings separate. The command-key-shaped “⌘ Code” glyph is a Windows learnability risk, not an observed shortcut failure; consider a neutral source glyph while actual shortcuts remain Ctrl-labelled.

**P2: make recovery selection understandable (13).** Keep “new project copy” and preserved-original wording. Add an available verified summary such as project name, diagram/document counts and reason/checkpoint kind, with technical revision/hash details expandable. Do not invent a summary from damaged or unverified bytes. Retain stable identifiers for support; timestamps alone are poor recognition cues.

Acceptance: actual source/knowledge text remains exact, save scope remains honest, original recovery bytes remain untouched, and keyboard users can reach disclosure/restore controls without traversing hidden content.

### Batch 3 — Distinct vault identity and app icon; AI last

Create the visual Lock identity described below only after daily navigation and native transitions are stable. Test each proposed icon at small Windows-facing sizes. AI work remains last: no active AI button, provider fields, “run agent” affordance or implied results when no configuration exists. Existing agent-spec documents can remain a document type; that does not admit backend capability.

## Viable grouping options

| Option | Arrangement | Trade-off |
|---|---|---|
| A — Persistent workspace sidebar | Project identity and Diagrams / Docs / Code on left; contextual editor/preview centre; optional inspector right; Lock/Settings at sidebar foot | Strong consistent mental model, but uses horizontal space and requires a larger navigation design decision |
| **B — Consistent topbar with contextual disclosure** | One project/save/find bar across current full-page surfaces; one consistent surface switcher; existing Inspect/Style houses advanced controls; compact minimised-window shelf | **Recommended first batch:** fits current modes and preserves available canvas space with the smallest conceptual migration |
| C — Compact command-led workspace | Project menu and Find command palette, optional navigation drawer, contextual controls only on demand | Quietest chrome for experts, but weaker discovery and a higher keyboard/accessibility burden for new users |

“Apple calm” should mean hierarchy, clear spacing and restrained emphasis rather than copying macOS controls into Windows. Reuse the navy surfaces, fine borders and existing SIREN wordmark. Reserve blue emphasis for a single primary action in each context. A sidebar prototype can be considered after B is evaluated; this report does not prescribe internal architecture.

## Proposed vault Lock motion

The present completed Lock gate (14) repeats the synthetic cards from setup (01). Give returning Lock a recognisable closed-vault state. Keep setup explanatory; make returning access simpler.

Proposed sequence: a restrained navy vault plate with one central brand-derived mark and two mechanical seams/iris rings. Manual locking closes the seams in roughly **250–350 ms**; successful native unlock opens them over **500–700 ms**, revealing the workspace without another introductory brand drawing or capability-card tour. Use modest depth and light movement, with no loud shaking, flash, sound dependency or perpetual “cinematic” delay. These are proposed durations, not measured implementation results.

The animation must obey native state. Hide project content immediately while a Lock transition is pending; only claim locked after the native save/quiescence and lock receipt. If saving fails, show the precise native failure and retain work. Never read project contents to decorate the closed screen. Unlock success animation starts only after the genuine native PIN acknowledgement; cooldown, wrong PIN, storage-blocked and read-only outcomes never play success. Native unknown/read-only state remains authoritative.

Reduced motion must produce **zero running decorative animations** and a direct state change. Maintain masked digit entry, announced errors/cooldown, visible focus, readable input length and a clear Quit route. Startup unlock cannot be escaped into the project. PIN change may cancel back to its prior workspace and restore focus. After successful access, focus should return to a meaningful safe workspace control. Motion must not trap or consume otherwise valid input. Current observed Lock DOM: `mode=locked`, `readonly=true`, `snapshot=null`, password field empty and focused; synthetic scene `aria-hidden=true`. Current non-reduced audit host reported six running decorative animations; the new vault's reduced-motion requirements remain proposed and untested here.

## Brand-derived icon directions

The actual wordmark visible in 03/09/10 is thin, widely spaced, with a distinctive E made from horizontal rules and terminal points. Its full wide lockup and tiny byline will not be legible as a small app icon. The following are concepts derived from that observed asset, not generated or shipped artwork:

1. **SIREN S seal — preferred practical direction.** Reuse the actual S letter geometry as a compact cream mark on the existing deep navy ground, with slightly stronger optical strokes at small sizes. A restrained rounded-square plate avoids a generic lock/security-utility identity.
2. **Signal E / connected rules.** Use the existing E's three fine rules and terminal dots as the central symbol. It expresses structured information and connections across diagrams, documents and code. Check that it remains recognisable rather than looking like a menu icon at 16/24 px.
3. **Maker's seal.** A compact circular or squared seal using a brand letter and restrained framing rules from the existing lockup; useful for larger shortcut/splash assets, but has the highest risk of small-size detail loss.

Compare real prototypes at 16, 24, 32, 48 and 256 px against light/dark backgrounds, selected/unselected taskbar states and high contrast; inspect actual Windows icon surfaces. Keep the app icon and closed-vault mark related but avoid using a padlock as the entire product identity. No native icon screenshot was captured in this audit, so the current operating-system icon is unqualified.

## Accessibility and native limits

Observed positives include labelled PIN digits/Delete, masked field focus, synthetic decoration hidden from accessibility, labelled Code minimise/maximise/close/resize, readable modal headings, and explicit local/private boundaries. Actual typed source and PageDown movement were observed. Fine labels, muted placeholders, many small header controls and repeated focusable fields are priorities for a subsequent accessibility pass.

No numerical contrast measurements, screen-reader announcements, full Tab ordering, focus trap matrix, physical keyboard, reduced-motion override, high contrast, light theme or smaller viewport were qualified here. Screenshot health labels are UX judgments, not WCAG conformance. Healthy-project Recovery was inspected without restoring another project; damaged/recovery-only mode and native menus require their own fresh captures. This audit makes no signed-update, AI execution, production release or security certification claim.

Next design decision: approve option B's navigation/control grouping for a small visual prototype before implementing any structural change.

