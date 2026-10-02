# CI18 exact-snapshot recovery diagnosis

CI18 run `37030045610`, job `110914294144`, preserves a real second-start Code library failure: the actual recovery confirmation covers the button. The log's full bootstrap snapshot at `15:57:42.1371935Z` supplies the native storage bag; extracted bag SHA256 is `d2f8218f074756196aa3d2e0b864dadd9c7aba4ed97f500c67a7af53b409f842`. The snapshot's saved workspace and Mermaid draft both have diagram zoom `31`, identical source, and identical diagram/document/map values (ignoring rebuild-only `__` caches and object key order). The persisted clean-exit flag is `no`.

## Actual reproduction

`desktop/evidence/reviewer-ci18-recovery-probe.mjs` creates a new isolated native project from that exact bag and launches actual Electron through the existing driver. Observational conditional CDP breakpoints capture the lexical `current`, `drafted`, `state`, `draft`, and `cleanExit` at the real recovery comparison; they return false and do not pause or alter the comparison. The actual confirmation remains open. No recovery choice was clicked and no occlusion check was bypassed.

Two independent first-start replays reproduced the CI prompt:

- `reviewer-ci18-recovery-2026-10-02T16-01-40.729Z`
- `reviewer-ci18-recovery-2026-10-02T16-03-03.893Z`

Both used generated HTML SHA256 `6390ee4ddbda6278dfea1d94f59cebf855cf864563f457c0da5fa54a0471bcef`. The breakpoints captured the comparison on the first startup; neither successful replay required reload. Actual signature value difference was solely `/diagrams/0/zoom`: live `100`, drafted `31`. Source remained `flowchart TD\n A[Code recovery]-->B`; Python was preserved in its dedicated native draft record. Each evidence directory includes the exact bag, generated source, complete lexical observations, and actual screenshot. The second also includes `saved-draft-value-comparison.json`, confirming saved workspace and draft already contain the same values.

The second replay captured an actual call stack `initialize → updateDirectionControlFromSource → syncActiveDiagramFromAliases`, with `currentZoom`, alias zoom, and diagram zoom already `100`. This confirms startup synchronization uses the default zoom before recovery runs, though this late observation alone does not identify the first assignment that overwrote `31`.

## Source cause and minimal repair recommendation

Frozen baseline starts `currentZoom` at `100`. `initialize` loads persisted state and applies controls, initializes builders and calls `updateDirectionControlFromSource`, then sets zoom from state later. `applyStateToControls` loads saved aliases but does not initialize `currentZoom`. Alias synchronization uses `diagram.zoom = currentZoom || state.zoom || 100`, so the default `100` can overwrite the saved `31` before the later setZoom and recovery comparison. Startup's display-state mutation creates a false recovery difference even though the native saved workspace and draft match.

Initialize runtime zoom from the active persisted diagram before controls/builders can synchronize aliases. Keep the full recovery signature and its protection of true diagram/document/map differences. Do not dismiss this prompt in the test or drop all zoom values from recovery comparison merely to achieve a pass. Product repair belongs to the root agent; this investigation edits only its own probe/report.

An additional controlled-reload boot-stage tracing attempt (`reviewer-ci18-recovery-2026-10-02T16-06-21.612Z`) failed with `CDP timeout: Page.reload` and is preserved. It is not used as affirmative diagnosis or proof of repair. No repaired-renderer verification or release approval is claimed here.
