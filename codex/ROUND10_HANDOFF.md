# SIREN Round 10 handback

## Outcome

All three jobs are complete in the required order against the exact frozen Round 10 base. A clean replay of `AS → AT → AU` produced bytes identical to the tested artefact.

- Base: 8,582,897 bytes, `BAC0C5591C5F9CAECDCD031BE38FFE4EF6221F06C239437CDBFB7BF9BADFF9AB`
- Final: 8,584,062 bytes, `D5F5B7DC6C3D7C067435EB1C3E2469C26A5858900EF8E53D64E5C51200C11A3D`
- `APP_VERSION`, the complete 31,620-character `CHANGELOG` constant, and CSP are byte-exact against the base.
- Official syntax gate: 2 script blocks, 7,577,046 characters, `node --check` exit 0.
- Every script hash, required input hash, exact output hash, byte size, and replay command are in `round10_patches/APPLY_ORDER.md`.

No frozen input, Downloads copy, or release file outside the private workspace was modified.

## AS — the advertised slash recovery can be used twice

The Docs paragraph now remembers one local, transient fact: Backspace closed a slash menu and restored its exact marker. A second `/` may reopen the menu only when that fact is true and both the visible paragraph and its model contain exactly `/`. Any ordinary input clears the fact.

Measured through the real editor:

- `/` → Backspace leaves exactly `/`;
- the next `/` reopens the five-row Add block menu and does not produce `//`;
- `Sample 12/2026` remains ordinary text and opens no menu;
- `/` on a genuinely empty paragraph still opens all five rows;
- the owner patch above this round remains effective: if writing stops immediately after slash-Space, the live editor may still use NBSP as its caret-preserving representation, but the persistence boundaries store the paragraph as `/ ` with an ordinary trailing space.

This corrects the Round 9 handback wording: NBSP does not need a following character to normalise in storage on this base. It can remain in the live `contenteditable` until input/blur, while both persistence boundaries normalise it even if the paragraph ends there.

## AT — the remaining Docs submenu rows follow the context point

`openWorkpaperTurnIntoMenu` and `openWorkpaperRoleMenu` now accept the same optional `{ point }` shape already used by Add, Contents, and Document type. Only block-context callers supply the point; the toolbar and keyboard routes continue to omit it and therefore anchor on their element.

Measured coverage:

- paragraph rows `Turn into`, `Mark as purpose…`, `A block above`, and `A block below` at x=240, 520, and 920;
- the gap's `Insert a block here` below x=300;
- blank-page `Add a block at the end` below x=300;
- Shift+F10 on the focused block anchors `Turn into` to that block rather than to the last pointer point.

All 29 AT assertions pass. The inspected `at-keyboard-turn-into.png` shows the keyboard-opened menu beside the focused block. Editable text intentionally retains the browser's native context menu, so the wide x-coordinate matrix dispatches real browser `contextmenu` events to block chrome with explicit pointer coordinates; the gap and blank-page controls use physical right-clicks, and the keyboard path uses physical Shift+F10.

## AU — post-squeeze overflow is both detected and readable

The scrollability measurement now runs after the narrow-width squeeze and its resulting reflow. At 240×420, the six-row Docs page menu measures `scrollHeight 303`, `clientHeight 300`, sets `data-scrollable="true"`, and exposes the existing `aria-description` explaining how to reach every action.

The brief's statement that moving those three lines was the whole job did not hold under measurement. The exact reordering fixed the Docs announcement but left the Present PowerPoint row clipped at 240, 248, 256, and 300 px: the intermediate build was only 12/16. Native button intrinsic width kept the glyph run wider than its squeezed parent.

The final AU patch therefore also releases each row's intrinsic minimum and permits wrapping, only inside the existing branch where the menu genuinely cannot fit. Final measurements at 240, 248, 256, 300, and 320 px show zero horizontal or vertical glyph loss and preserve the 8 px viewport containment. At 240 px, `PowerPoint (.pptx)` wraps into two complete lines rather than being cut.

Rendered evidence inspected:

- `round10_work/au_targeted_v3/au-present-240.png`: the complete PowerPoint suffix is visible;
- `round10_work/au_targeted_v3/au-docs-240x420.png`: every Docs page action is present, with the menu contained;
- `round10_work/final_targeted_v2/at-keyboard-turn-into.png`: the keyboard submenu is anchored to its block.

All AU losses are below 320 CSS px. That matters for WCAG reflow and practical high zoom, but I do not claim it affects an ordinary shipping phone at its normal CSS viewport.

## Verification

### Targeted Round 10 suite

`qa_round10/run_round10_targeted.js` drives the real application over localhost, uses keyboard and pointer input, reads canonical persistence, exercises ordinary sideways cases, and captures the visual jobs.

- Base positive control: 4 scenarios, 39/51 assertions; 12 red, covering every disclosed failure.
- Final clean replay: 4/4 scenarios, 51/51 assertions, zero page exceptions.
- Base report: `round10_work/baseline_targeted_final_v2/report.json`, SHA-256 `0BD304B686D8BAB782F95B313645B194EA671F54E5195F89914AC908E20AB3D7`.
- Final report: `round10_work/final_targeted_v2/report.json`, SHA-256 `54BA626B6A5F9637B9478A6FB8FE09B2C26206E7832BBAD557E24C561729E236`.
- Runner SHA-256: `DE3DA490F11167EB75F860CDCB1367016AEBDD66778DAA89901F75BA3BBC2915`.

The AU reordering-only negative control is retained separately: `round10_work/au_targeted_first/report.json`, 12/16, SHA-256 `8E659EA30203B48358CAC860A93F98E476A4DB341F44D710BED4BC3194D2B612`.

### Patch-chain and guards

- A fresh frozen-base replay ended at the exact final SHA and byte size above and is byte-identical to the tested work artefact.
- All three scripts and the targeted runner pass `node --check`.
- Every replacement is exact-count guarded before transformation; each script verifies its pinned input and output SHA and writes atomically.
- A deliberate attempt to apply AS to the final artefact exited 1 on its input-SHA guard. Before and after SHA remained `D5F5B7DC…C11A3D`.
- A zero-context diff contains changes only in `openStructureMenu`, the two Docs submenu builders/callers, and the Docs slash handler. The parallel editor-mode row and routing do not appear in the diff.

### Job A gate

The complete existing Job A gate ran against the clean replay and left its SHA unchanged:

- raw: 43/48 scenarios, 428/439 assertions;
- fatal: false;
- 16 exports passed structural validation;
- syntax, boot, persistence, recovery, Docs table deletion, and application-SHA assertions are green;
- report: `round10_work/job_a_gate/report.json`;
- report SHA-256: `A54F519269B1FA74889934EB26F6C58ECEA063E83FAFA34E7D105CBA253C01C1`.

All 11 red assertions reproduce unchanged on the frozen Round 10 base in `round10_work/job_a_base_failures/report.json` (3/8 bounded scenarios, 55/66 assertions; report SHA `71DAF0CA61BD07748CCFD74E1DDE928C08AFA3C823E0D9CD499A07338E8308EF`):

- six `R2.ITEM3.NARROW` assertions directly probe hidden desktop Comments/Review controls at 375 px;
- `EXPORT.MAIN.01` directly clicks the hidden grouped `#styleShortcutButton`;
- two `R3.SURFACE.CENSUS` assertions retain older toolbar-region expectations;
- Word and PowerPoint COM inspection fail in this managed Windows logon with `0x80070520`.

These are inherited suite drift or environment failures, not regressions introduced by AS–AU. No Round 10-specific gate assertion failed.

## Anchor audit

No final application anchor drifted on the exact frozen base, and no guard was loosened.

- AS: the unique Docs slash-handler preamble, non-empty guard, `resumeTyping` callback, text-block input handler, and Add-menu resume call all remained exact. The owner's new NBSP normalisation lives at the persistence boundaries and did not collide; its mechanism was explicitly retained and tested.
- AT: the unique Turn/Role block-context rows, both submenu signatures/options, and the toolbar Role caller remained exact after the four owner patches.
- AU: the unique append/scrollability/point/squeeze/height sequence from AR remained exact. The final patch moves the existing scrollability block and adds wrapping only inside that already-unique squeeze branch.

One AT draft contained an incorrect postcondition claiming a separate non-context Turn-into caller existed. The postcondition stopped before any HTML write; source census showed the context row is its only caller, while Role has the toolbar caller. The postcondition was corrected without weakening any replacement anchor. This was a test-authoring correction, not application anchor drift.

## Deliberately not done or claimed

- I did not touch `visualModeButton`, `visualModePanel`, `applyEditorMode`, the editor-mode event row, or mode routing. The parallel engineer's surface is byte-unchanged.
- I did not remove the native browser menu from editable Docs text. AT changes only the app-owned block-context route; spellcheck, paste, dictation, and native undo remain available inside the paragraph.
- AS does not treat any paragraph containing one or more slashes as a marker. Only the exact marker restored by that editor instance's Backspace recovery may reopen once.
- AU does not raise or remove the global `min(72vh, 560px)` menu cap and does not change AR's 8 px containment clamp.
- I did not deliver or claim the reordering-only AU build as fixed; its four remaining visual failures are preserved as evidence for the additional constrained wrapping.
- I did not change `APP_VERSION`, `CHANGELOG`, CSP, Present actions, Map/deck logic, themes, or any unrelated surface; AU changes only how an already-existing Present menu row wraps when squeezed.
- I did not claim Word or PowerPoint COM validation in an interactive desktop session. The managed-session failure and successful structural export validation are reported separately.
