# SIREN Round 9 handback

## Outcome

All five jobs are complete in the required order against the exact shipped v1.69.0 base. A clean replay of `AN → AO → AP → AQ → AR` produced bytes identical to the artefact used for the final tests.

- Base: 8,563,119 bytes, `1C088DAC741F7D216474FDC7F6F58ED941E26F053B0175718F7281BD8B3A1288`
- Final: 8,565,752 bytes, `86F6E9E110363F0156A1F7A04D6EA6A7C568E7040D3A34D8301352375CB4F8D8`
- `APP_VERSION`, the complete `CHANGELOG` constant, and CSP are byte-exact against the base; `APP_VERSION` remains `1.69.0`.
- Official syntax gate: 2 script blocks, 7,564,345 characters, `node --check` exit 0.
- Every script hash, required input hash, exact output hash, byte size, and the replay command are in `round9_patches/APPLY_ORDER.md`.

No Downloads copy and no release file outside this private workspace was touched.

## AN — slash control keys preserve what the writer typed

The Docs slash affordance now distinguishes immediate writing keys from deliberate menu navigation. With the five-row Add block menu open:

- immediate Space resumes the paragraph as `/ ` and subsequent text remains visible, stored, and reloadable;
- immediate Enter keeps `/`, creates the next line in the same text block, and subsequent text remains stored;
- immediate Backspace closes the menu and restores `/` with the caret after it; the next Backspace edits normally;
- Arrow, Home, or End marks the menu as deliberately navigated, so Space/Enter still activates the selected row;
- a bare `/` still opens five rows, and pointer selection still consumes only the marker paragraph.

The stable rich-text representation uses an NBSP for a trailing space until more text arrives; the visible and persisted document text normalises to an ordinary space. The global `openStructureMenu` engine and its other callers were not changed.

## AO — zero-delay source replacement no longer takes the title with it

The source input event now commits a pending title-only undo boundary using the previous `state.source`, not the textarea value that has already changed by the time `input` fires. `captureUndoEntry` and `commitUndoSnapshot` accept that explicit source while retaining their existing default for every other caller.

Measured with physical title input followed by a source replacement and one Undo:

- at 0 ms, the typed title survives and the source reverts;
- at 1000 ms, the same contract holds;
- Redo remains available after Undo.

The existing 560 ms source debounce remains unchanged; the patch fixes ownership at the event boundary rather than widening or removing the debounce.

## AP — Add block submenus follow every Docs context origin

The physical right-click point now travels through the block/paragraph and inserter-gap builders into `openWorkpaperAddMenu`, just as the Round 8 blank-page route already did. Keyboard invocation still supplies no point and therefore remains anchored to the focused element.

The suite exercised block/paragraph, gap, and blank-page origins at x=180, 520, and 980, plus the keyboard route. All 19 placement/route assertions passed. The inspected `ap-keyboard-gap.png` shows the keyboard-opened Add block menu beside the focused gap, not at a stale pointer coordinate.

## AQ — front matter after leading blank lines is visible to all six consumers

`mermaidFrontmatterEnd` now locates the first nonblank line, accepts a front-matter delimiter there, and finds the closing delimiter relative to that real start. `mermaidSourceLinesForScan` continues to blank the complete span, including leading blank lines, so source indices remain stable and the existing Guided action gate remains intact.

All six declaration consumers were measured before and after: diagram type, structure rows, flowchart gating/count, native summary, Guided guidance/actions, and Office export type text.

- leading-whitespace Pie: `Advanced Mermaid`/disabled starter/Advanced Office hint on the base; `Pie chart`/enabled starter/Pie Office hint on final;
- leading-blank Flowchart: `Advanced Mermaid`, no count, code-only guidance on the base; `Flowchart`, `2 blocks · 1 connection`, flow guidance, and editable body rows on final;
- every leading blank and YAML row remains disabled with the front-matter reason; body rows remain enabled;
- normal frontmatter Flowchart and plain Flowchart remain unchanged and correct;
- metadata-only complete front matter is now honestly `Advanced Mermaid`, not a fabricated Flowchart;
- tab-indented YAML keeps its prior Pie intent classification, while embedded Mermaid still reports the visible YAML parser error.

The six-consumer positive control moved from 5/14 on the base to 14/14 on final.

## AR — narrow menus stay inside the left edge

The menu placement code now constrains width only when the menu genuinely cannot fit between two 8 px viewport insets, then clamps its rightmost legal x-coordinate to at least 8 px. The global `min(72vh, 560px)` height cap is unchanged.

Measured menu left positions on the base were -16, -8, 0, 8, 34, and 364 px at viewport widths 240, 248, 256, 264, 320, and 1440. Final keeps the menu inside both 8 px insets at 240/248/256 and leaves the already-correct 264/320/1440 placements unchanged. The inspected `ar-248.png` is readable and fully contained; `ar-1440.png` remains at the baseline desktop position.

## Verification

### Targeted Round 9 suite

`qa_round9/run_round9_targeted.js` drives the real application over localhost with physical keyboard and mouse input, reads persistence, exercises ordinary sideways cases, and captures the visual jobs after the intro clears.

- Base positive control: 6 scenarios, 39/67 assertions, 28 red; all five disclosed defects reproduced and boot remained clean.
- Final clean replay: 6/6 scenarios, 67/67 assertions, zero page exceptions.
- Final report: `round9_work/final_targeted_v2/report.json`
- Final report SHA-256: `106ABEE59FD5A0FAA866659B21CD247A73FD3351FA2A341D40E6068479694EA4`
- Targeted runner SHA-256: `C4BB90DDE9F37A86F0DC73C17F194047689F99AB501944CF1AB2A2948CFD1056`

Rendered evidence inspected:

- `round9_work/final_targeted_v2/ap-keyboard-gap.png`
- `round9_work/final_targeted_v2/ar-248.png`
- `round9_work/final_targeted_v2/ar-1440.png`

### Patch-chain and guards

- A fresh frozen-base replay ended at the exact final SHA and byte size above and is byte-identical to the tested work artefact.
- All five scripts use exact-count anchors, assert their pinned input and output SHA-256 values, and write atomically.
- A deliberate attempt to apply AN to the final artefact exited 1 on the input-SHA guard; before and after SHA remained `86F6E9E1…F8D8`.
- `APP_VERSION`, the complete 31,620-character `CHANGELOG` constant, and CSP compare byte-for-byte with the base.

### Job A gate

The complete existing Job A gate ran against the clean final replay and left its application SHA unchanged:

- raw: 43/48 scenarios, 428/439 assertions;
- fatal: false;
- 16 exports passed structural validation;
- official syntax and boot assertions are green;
- report: `round9_work/job_a_gate/report.json`;
- report SHA-256: `BFA76477121C026F57F4BB2BF424A7F24BEFEF169F051CD070CE7D8D92373CB7`.

All 11 red assertions reproduce unchanged on the unmodified frozen base in `round9_work/job_a_base_failures/report.json` (3/8 bounded scenarios, 55/66 assertions; report SHA `5B8701DFD3164E83D6AB83CB0D75DB04FFFF635C7F65F251316E64E3D2575229`):

- six `R2.ITEM3.NARROW` assertions directly probe hidden desktop Comments/Review controls at 375 px instead of their current mobile routes;
- `EXPORT.MAIN.01` directly clicks the hidden grouped `#styleShortcutButton`;
- `R3.SURFACE.CENSUS.01–02` retain older toolbar-region expectations; the shipped base and final both measure header 5, tabstrip 5, modebar 6, preview head 0, preview toolbar 9;
- Word and PowerPoint COM inspection fail in this managed Windows logon with `0x80070520`.

These are inherited suite drift or environment failures, not regressions introduced by AN–AR. No Round 9-specific gate assertion failed. I did not change the shared regression suite merely to turn those inherited reds green.

## Anchor audit

No brief anchor drifted on the exact frozen base, no anchor guard was loosened, and every final replacement anchor occurred exactly once.

- AN: unique Docs slash `resumeTyping` callback, unique Add-menu key-handler preamble, and its unique printable-key tail.
- AO: `handleSourceInput` title boundary, `captureUndoEntry`, and `commitUndoSnapshot`.
- AP: Docs context dispatcher, inserter builder/signature, block builder/signature, and the adjacent Above/Below Add rows.
- AQ: `mermaidFrontmatterEnd` and the unique empty-cleaned-source classification tail.
- AR: the unique structure-menu width/left/top placement block.

AN needed an implementation revision before pinning: an ordinary trailing space/newline in `contenteditable` collapsed before the next physical key. The final patch uses stable rich-text encodings and was then replayed from the frozen base. This was not anchor drift and no failed draft touched the frozen base.

## Deliberately not done or claimed

- AP is intentionally scoped to Add block submenus from block/paragraph, inserter gap, and blank page. It does not repoint unrelated second-level block menus such as Turn into or Role; that scope is now explicit rather than omitted.
- AN treats immediate Space and Enter as writing. Direct Enter on the initially highlighted row therefore no longer inserts Heading; Arrow/Home/End followed by Enter or Space remains the explicit keyboard selection route. Pointer selection is unchanged.
- The first Backspace closes the open affordance and restores the slash; a second Backspace performs ordinary editing. I did not silently turn the first press into deletion.
- AQ does not normalise tab-indented YAML. SIREN identifies the Pie declaration, but Mermaid visibly rejects that YAML; hiding or rewriting the source would be a different and riskier policy.
- AQ does not add new diagram families or alter any of the six consumers independently; they continue to share the scanner.
- I did not change the global structure-menu key/focus engine, global height cap, Style card, visual builder, Present, Map, decks, ambient scenes, `APP_VERSION`, `CHANGELOG`, or CSP.
- I did not claim Word or PowerPoint COM validation in an interactive desktop session. The managed-session failure and the successful structural export validation are reported separately.
