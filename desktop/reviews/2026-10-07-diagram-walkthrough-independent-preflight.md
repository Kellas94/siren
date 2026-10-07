# Native Diagram Walk through — independent preflight

Author: `/root/diagram_history_final_review`, 2026-10-07. Read-only inspection of the proposed next parity batch, current Diagram session/controller, semantic style targets, transform, history, presentation hiding, transfer and saved SVG export. No implementation, tests, build or GUI performed. This is acceptance/design guidance, not certification.

## Recommended boundary

Keep traversal state entirely in the native view controller: current render identity, semantic target list, selected index and view transform. Start/Previous/Next/Overview must never call draft setters, history operations, panel `commit()`, Save or Presenter. Readonly browsing uses the same successful rendered target set. Preserve unfinished Guided/Build/Style field text, dirty state and history exactly.

Use the existing `styleTargets` results, capped at 250 **semantic IDs**, not arbitrary SVG groups. One ID can have multiple groups: select it once, focus its useful combined geometry, and derive one bounded plain-text label from sanitized rendered text with ID fallback. Empty, unsupported, invisible/non-finite geometry and truncated target sets need honest labels; do not claim semantic execution order or complete Mermaid grammar coverage.

Prefer a pointer-transparent focus overlay outside the SVG. It preserves imported fills, borders and typography without saving/restoring style attributes or contaminating shared `applyStyle`. Saved export already rereads the exact saved entity in main and renders fresh SVG in the separate vector surface (`diagram-export.mjs`, `vector.js`); retain that path and keep walkthrough dependencies out of the vector builder. Never serialize the decorated live preview for export.

## Concrete integration risks

- **Invalidate before debounce.** Source changes currently mark `diagramRendered=false` and wait 250 ms; style waits 120 ms; history schedules preview later. Session generation advances only when render starts. An older in-flight render can still reach `onPreview` during that gap. Clear walkthrough synchronously at edit/history/Refresh intent and fence target installation against the current draft/render identity. Clearing only on successful/error callbacks is insufficient. `onError` currently retains old SVG, so `isConnected` alone cannot establish currentness.
- Clear selection, overlay, retained DOM references and active controls on failed/invalid render, `onSource` replacement, presentation-mode preview hiding, Prepare/Lock and dispose. On resume, enable only after a fresh accepted render. Two windows must have independent state. Attach/detach keeps the renderer alive: remeasure after viewport changes instead of treating transfer as a new saved diagram.
- Existing Fit resets CSS zoom/pan; target focus must account for nested SVG transforms, viewBox sizing, CSS scale and preview-title offset. Reject zero/non-finite bounds, clamp zoom, and avoid compounding already-scaled client rectangles. Recompute on resize, source-panel toggles and manual pan/zoom. Overview should restore the established Fit behavior.
- Restrict keyboard handling to walkthrough controls or an explicitly focused preview. Yield for input/textarea/select/contenteditable, composition, modifiers, already-prevented events and unrelated app shortcuts. Do not add global arrow interception or disturb existing history shortcuts. Prefer instant motion, visible focus and a bounded live announcement of label and position.
- Add controls without rebuilding or moving the Save/Attach header during pointer interaction. The original hosted Diagram Build Save mis-target remains OPEN; walkthrough success cannot close it.

## Acceptance before qualification

1. Exact draft/history/pending-field snapshots before and after Start/Next/Previous/Overview, manual pan and readonly navigation remain equal; imported typography/colours are unchanged.
2. Deferred-render test: edit while an older render is pending, then resolve it before the debounce fires; no old targets become actionable. Cover invalid source retaining old canvas, history restore, Refresh replacement, hidden presentation mode, Lock and disposal.
3. Target fixtures cover Unicode/multiline labels, same ID with several groups, unsupported/empty diagrams, 250/251 semantic nodes, nested state groups and invalid geometry. Counts disclose the admitted set and any truncation.
4. Keyboard checks preserve exact editor/field input and IME handling. Pointer and keyboard traversal agree; control focus survives updates; unrelated Save/Attach targets stay stable.
5. Native small/medium flowchart and supported state-diagram scenarios verify focus geometry, themes, resize/source-panel toggle, attached/detached placement, independent windows and Lock retirement. Export while walkthrough is active must contain only independently rendered saved content; compare against an undecorated export and inspect absence of walkthrough artifacts.

Inspected controller SHA-256: `df7ac8286ebb1ce38af4a2aca55350c2364498e19d437a6c154427d2298c02ca`; session: `951506c1d8b0dfb55086c5b5e1f95cd8d6d78badb648faa9985e94d1f47bcd79`; style targets: `c8e6c2c2bb598e513e844ac526113efa1fa639a3ca84ba663895a09b243d04e4`. These identify the pre-implementation source snapshot only. No native, capacity, hosted or release claim is made.
