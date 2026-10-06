# Independent Docs authoring review — 2026-10-06

Author: Codex review agent `/root/shared_workspace_review`. Independently authored code/UI review and independently executed checks. Final rereview at approximately 05:03 Europe/Bucharest. This is a scoped review of uncommitted Docs work, not a release or complete reference-parity approval.

## Scope and provenance

Repository: `C:/Claude/SIREN_WORK/portable`; verified baseline HEAD `21941019052fdc7ab307a2542acde79bd428bde7`. Read git diff and complete new files for `desktop/src/ui/docs/draft.js`, `rich.js`, `reader.js`, `desktop/src/ui/windows/docs.js`, `desktop/build/windows.mjs`, `desktop/src/ui/shared/shell.css`, `desktop/tests/docs-rich.test.mjs`, `docs-draft.test.mjs`, and `tests/native/docs-format.mjs`. Included `docs/structured.js` and its tests because the focus/history correction changes that integration. Read frozen sanitizer/domain validation only to assess whether renderer formatting can actually be saved. No source, build script, generated file, or repository test was modified by this agent.

The owner changed source during review. Original findings and their original evidence remain recorded below; the final source correction is separately assessed. Builds for this review went exclusively into directories outside the checkout named `C:/Claude/SIREN_WORK/tmp-docs-authoring-review-20261006*`. Mock renderer fixtures are not production grants, ProjectStore, durable save, actual keyboard/clipboard interaction, or native Lock qualification.

## Findings

### Critical

None established within the reviewed scope. This does not establish absence of security defects outside these paths or qualify production Lock.

### Important — original findings, corrected in the final source

1. **Formatting accepted by the editor could be refused by the native validator.** Initial `rich.js` allowed inline color styles and offered Quote; it also admitted PRE/CODE/S/H4-H6. The frozen sanitizer preserves a smaller tag set and finite original SPAN classes, stripping style attributes. These mutations left a dirty working document that could not be saved and therefore could block a project-bearing transition. My independent frozen-validator fixture confirms Bold accepted, but style color, BLOCKQUOTE, PRE, CODE, S and H4 refused. Original proof: `tmp-docs-authoring-review-20261006-validator/result.json`. Final `rich.js:3-5,16,38,42` uses the saveable tag subset, removes Quote, and emits original finite `wp-c-*` classes; reader remains separately read-only. `result-final.json` independently confirms `wp-c-blue` and `wp-hl-yellow` are accepted without changing frozen validation, while those incompatible forms are still refused. This verifies transport compatibility for representative classes, not actual durable production save.

2. **Undo in structured fields removed focus and hid the field, breaking immediate keyboard Redo.** Original `docs.js` captured plain/rich block identities but not structured field identity or open/page state. My renderer fixture edited a prompt and invoked Ctrl+Z: focus became BODY, the prompt details closed, and subsequent Ctrl+Shift+Z was not prevented and did not redo. Original proof: `tmp-docs-authoring-review-20261006/pre-correction-final.json`. Final `docs.js:154-162`, plus structured rendering, captures block/field identity, reopens the details, restores the table page and input selection. My final fixture verifies focused TEXTAREA, open prompt, and successful immediate keyboard Redo. Initial finding is resolved within that renderer fixture.

3. **The first focus correction still lost a knowledge field beyond the first 40 rows.** Intermediate fixture edited notes on the 41st row, then Undo: focus became BODY and row41 was absent after repaint. Proof: `tmp-docs-authoring-review-20261006-post/result.json`. Final `docs.js:137` expands the rendered rows through the requested row before restoring focus. Final fixture confirms row41 remains visible and its notes TEXTAREA has focus after Undo. This correction preserves bounded default pagination; it does not eagerly render all rows.

4. **Format text could destroy the plain editing control for a valid paragraph above the rich-editor cap.** Initial code removed the textarea before calling `rich.render`, whose inspection rejects more than131072 characters. Frozen HTML accepts larger paragraphs. This initial failure path was identified by source inspection, not reproduced as a pre-fix runtime result. Final `docs.js:128` both gates the initial Format control and revalidates the live block before removing the textarea. My final fixture confirms a140000-character paragraph remains editable as a textarea and has no Format control. The click-time growth branch is source-reviewed; the fixture did not simulate growth between creation and click.

The owner separately reported and corrected an actual native Colour-menu selection collapse: opening the summary moved focus before applying the format. Final `rich.js:41` prevents pointerdown focus movement; `rich.js:36` refocuses before restoring the range. I reviewed this correction, but did not independently reproduce the original physical native pointer sequence. Do not attribute the owner's native evidence to this reviewer.

### Minor — remaining

1. **Bold/Italic/Underline only add wrappers; repeated formatting cannot remove them.** `rich.js:34-36` extracts a selection and wraps it every time, with no toggle or clear-format control. My final fixture applied Bold twice and obtained `<strong><strong><p>Original text</p></strong></strong>`. A user cannot directly unbold saved text with the same familiar control; Undo only helps for recent local operations. Consider toggling the requested mark or providing an explicit Remove formatting action. Proof: final fixture `secondBold`.

2. **The local-history limit notice does not update when the limit is reached during typing.** `draft.js:41` can clear history and set `historyLimited=true` when a snapshot exceeds4MiB, but `docs.js:113` creates the notice only during paint; `updateState` does not synchronize it. Undo can become disabled without the promised Large edit explanation until a repaint. This is a source-confirmed UI wiring gap; no oversized production document was used to demonstrate it. Update or create the notice from status changes.

3. **Oversized or malformed paste is silently ignored.** `rich.js:45` prevents default paste and returns without invoking `onRejected` when plain text exceeds131072 characters or is not well-formed. The user receives no reason why paste did nothing. A short status message would make the editing limit discoverable. Valid literal paste was independently exercised; this rejection branch was source-reviewed.

## Own verification and evidence

- Final own command: `node --test tests/docs-rich.test.mjs tests/docs-draft.test.mjs tests/docs-structured.test.mjs`: **17 tests,17 passed,0 failed**, duration99.9175ms. Earlier initial draft/rich run:10/10. These are targeted local tests, not the full suite or release gate.
- Independent hidden Chromium renderer fixture built from current source: `tmp-docs-authoring-review-20261006-final/result.json`. Opening Format leaves the original block and dirty state unchanged. Formatting/paste change only the local draft until mock prepare/save. Literal hostile-looking paste produces escaped text, no IMG and no execute/resource node. Exact agent/release metadata, the untouched rich block, and knowledge sourceRef/version/hash are retained in the mocked saved document.
- The same fixture's mock prepare hides the document, makes the body inert, disables editing/history, and restores accepted HTML after an injected late input. Mock resume restores editing. This exercises UI pausing and the draft barrier, not main-process revocation, OS interaction, native ProjectStore or Lock.
- Final fixture confirms structured Undo/Redo focus, knowledge row41 focus, and140000-character plaintext preservation. Original/intermediate proof files are retained separately as listed above. Preliminary `original-probe.json` used an incorrect single-listener mock resume; its resume observation is excluded. The later `pre-correction-final.json` uses multiple listeners and is the accepted original fixture evidence.
- Independent frozen-validator browser fixture: `tmp-docs-authoring-review-20261006-validator/result.json` and `result-final.json`. Uses the actual frozen import-validation bundle in isolated Chromium with no project/native bridge. These establish exact format acceptance/refusal only.

History is bounded to60 snapshots and4MiB of serialized UTF16 content, with one-second grouping per field. Domain/save metadata lives outside editable title/blocks snapshots. Tests exercise retained opaque fields, wrong complete-entity hashes, pending saves, uncertain commit fencing, dirty conflict refusal and clean concurrent recapture. Resume does not remove the fenced state. Reader creates only inert permitted display elements from a template, never appends the original HTML or carries executable/resource attributes, and limits complex input. Unknown rich blocks remain preserved rather than converted.

Controls have semantic toolbar/textbox names and wrapping CSS. Undo/Redo is sticky within the document editor; ordinary textarea users discover rich tools through Format text. I did not perform a physical detached-width480–900px screenshot/keyboard/accessibility audit in this Docs task, so no claim of complete native control visibility or selection usability across that range follows from the mock fixture.

## Limits and declined judgments

No copied-package test, hosted PASS, release certification, full native save/Lock claim, full R78 parity judgment, images/comments/releases/presentation-authoring completion, actual OS clipboard or assistive-technology result is claimed. The native `docs-format.mjs` was reviewed, not run by this reviewer. Owner-reported native offscreen-control and shortcut-mask test failures, later actual Colour selection loss and style-save refusal are owner evidence; they are not renamed as independent results. Latest owner native checks were still pending at report time.

Canonical0304 diagnostic CI, earlier diagram-style `GUIDED_EDIT_PENDING` and menu timing concerns remain separate. This scoped Docs review does not demonstrate their cause, repair, or acceptance.

Final rereview source SHA256 anchors: `rich.js` d7294bc15cb0897c4b5167586db866c5c54709e0ef8f2c34d41ee738950ef1da; `draft.js`4769569526c2950361c7afc84bdf868cc8b8fe2faabe021c947bebeb1a5d64a8; `docs.js`ac9233da53a5f05c4e5928662180e1547779f6081f1634fc8f8db1cf1622e936; `structured.js`9a2be0cdd94be56d0f6734279f8b775c6770b1deb96b6badc15d1d6271dfa87e; `reader.js`8398a0fad7121c608034ebe2543b27fb0f1f48f26c47ac55106eb8c6dc24ba16. These identify the reviewed source snapshot, not an approved package.
