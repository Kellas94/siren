# Resume here — 24 August 2026, late (v1.67.0 SHIPPED, round 6 staged)

**Read this block first.** The block below it describes the state before this release.

## Shipped

**Live app:** `C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html` — **v1.67.0**, 8,528,590 bytes,
SHA-256 `DFFFD40E0E5E6BC205B86D779CF6FADAA89426BC04493CB389CD3308CBCF8435`.
Snapshot `releases\SIREN_v1.67.0.html`. Rollback point `releases\SIREN_v1.66.0.html` verified
byte-identical to the pre-release live file before anything was applied.

Applied to the live file in this order, each script guarding its own input:

1. Codex round 5 — twelve SHA-pinned patches, `AC → AB → R → S → T → Q → K → L → M → N → O → P`
2. `tools\patch_dead_ui.py` — four dead-UI fixes
3. `tools\ship_1_67_0.py` — deck tooltip, version bump, changelog entry

**Verified on the shipped bytes, not on a copy:** syntax gate clean; 0 boot exceptions; dead-UI suite
14/14; export fidelity 19/25 (the six declared Office picture fallbacks, see below); disclosure probe
7/7; ship checks 5/5.

## What 1.67.0 actually changed

**The big one: every diagram PDF now carries real text.** All five measured types report
`fonts=4 images=0`; before, all five were `fonts=0` with an embedded picture. The export gate went
from 10/25 to 19/25 on the same unmodified gate.

The remaining six reds are **not regressions**. They are pie, gantt and sequence × PPTX/XLSX, which
export as one picture — and the app now says so on screen before you download. Measured in the open
export dialog at 632×28 px; a flowchart correctly says nothing. Codex's separate gate patch accepts
those six only after reading that disclosure out of the running app, so the exemption cannot widen
without the app saying the words.

## Two things checked and NOT confirmed — do not re-open without new evidence

**Codex reported "the historical unqualified CHANGELOG promise about editable PowerPoint shapes
remains an owner-owned wording defect." It does not hold.** Every user-facing surface was measured:
the only changelog entry making that claim (1.63.x) already names the exceptions; 1.65.0 and 1.66.0
do not make it; `#diagramShapeExportHint` is qualified; the export dialog names the picture types on
screen. He was being conservative about a file the brief forbade him to touch.

**One real overclaim was found next to it, on a surface nobody had measured:** the deck export
button's tooltip promised "an editable PowerPoint" unconditionally while the deck writer produces
editable shapes for flowcharts only. Fixed in `ship_1_67_0.py`.

**`0x80070520` in Codex's Word/PowerPoint COM tests** is "a specified logon session does not exist" —
Office COM without an interactive desktop. Environment, not application. Our export claims never go
through Office: the gate reads the PDF/PPTX/XLSX containers directly.

## Round 6 is staged and ready to hand out

Three stages: **Codex Spark groundwork → an independent model verifies → integration here.**
Spark is a fast model with limited reasoning, so it gets a procedure, not principles.

| file | what it is |
|---|---|
| `codex\ROUND6_BRIEF.md` | the round; jobs U and AD marked DONE, six live: V W X Y Z AA |
| `codex\ROUND6_STAGE1_PROCEDURE.md` | per-job steps: which types, which selectors, how long to wait |
| `codex\PROMPT_ROUND6_SPARK.txt` | stage 1, five numbered steps |
| `codex\PROMPT_ROUND6_VERIFY.txt` | stage 2, with the failure modes of a fast model named |
| `qa_exports\r6_probe_reference.js` | a working probe to copy; all the traps already solved |
| `codex\FROZEN_R6_BASE.html` | the base — byte-identical to the shipped 1.67.0 |

**Job V is deliberately pre-measured** and its answer is in both the procedure (as the worked
example) and the verify prompt (as calibration): all nineteen types report `"Flowchart Preview"` in
`#diagramTitlePreview`, `#previewHeading` and `#diagramTitle`. If Spark's Job V disagrees or is
vague, the verifier is told to treat the other five as unmeasured.

**Z and AA are fact-collection only.** A fast model must not choose the design; both prompts say so.

## Still open

- **The QA harness's stale `.doc` name.** `qa/run_regression_suite.js:2111` saves the Word export as
  `active-doc.doc`; `validate_regression_exports.py:284` sends `.doc` to an HTML text parser. The app
  writes a real `.docx` (verified sound by hand). Red on every run since the docx fix, so the Word
  export has had no working validation since. Needs BOTH the filename and a `.docx` branch —
  `docx` appears nowhere in that validator. Touches zero application bytes.
- **Preview toolbar** — 585 px empty at 1440. A design decision, mine, still undone.
- **Visual builder section** — decided in principle, not implemented.
- **Placement** and **saved Views** — parked by the owner.

---

# Resume here — 24 August 2026, evening (v1.66.0 live, Codex mid-round-5)

**Read this block first. Everything below it is from 23 August and describes v1.65.0.**

## State

- **Live app:** `C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html` — v1.66.0, 8,438,995 bytes,
  SHA-256 `B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`.
  Byte-for-byte identical to `codex/FROZEN_1_66_0.html`, which is Codex's round-5 base.
- **Codex** is working round 5 — twelve jobs, brief at `codex/ROUND5_BRIEF.md`. He is hitting usage
  limits, so round 6 may never reach him.
- **Antigravity** has no job. Three delivered: browser matrix, export fidelity, dead-code audit.

## Held, ready, deliberately NOT applied

Four dead-UI fixes are written, applied to a scratch build and fully verified. The owner's decision
on 24 August: **wait for Codex to deliver round 5 before touching the live file**, so his SHA-pinned
chain is not invalidated. Nothing to decide — just sequence.

- **Patch script:** `tools/patch_dead_ui.py` — anchor-guarded, **deliberately not SHA-pinned** so it
  can be re-run on top of whatever build round 5 produces.
- **Verified build:** `pending/deadui/app.html`, SHA-256
  `F168D5ADC6ED72FAA12BAC8D0F0CA88C190DBBBE17E69F6ABA56B40760352688`, 8,441,266 bytes.
- **Verifier:** `qa_exports/verify_dead_ui_fix.js` — 14 assertions, all passing.

What the four patches do:

1. Un-hide `#diagramTypeChip` (invisible across 77 measured states).
2. Comment `#direction` as load-bearing so nobody deletes it — `diagram.direction` is READ from that
   invisible select's value. It is a state store, not a dead control.
3. `#layoutAlignment` disables itself and says why under the Mermaid renderer, which ignores it.
4. `revealDiagramTypeControls()` opens the collapsed `<details>` first — without it the chip's click
   switched to Code mode and achieved nothing visible.

## The apply sequence, when round 5 lands

```
1. Verify Codex's chain on a copy of FROZEN_1_66_0.html, as always.
2. Ship that result to the live file. That is the new base, call it X.
3. Re-run: python tools/patch_dead_ui.py <X>
   It is anchor-guarded, so it either applies cleanly or refuses. If it refuses, Codex moved one of
   the four regions and the anchor must be re-read from X - do NOT loosen the assertion.
4. Re-verify: node qa_exports/verify_dead_ui_fix.js --app <X> --port 9950   (expect 14/14)
5. Regression net: copy X into codex/qa/, then
   SIREN_APP_FILE=<...> node run_regression_suite.js
   Compare the FAILING ASSERTION IDS against a baseline run of X-without-my-patch. On 24 August both
   runs failed the identical 16 assertions, so "16 failures" is the environment, not a regression.
```

## Do not let these be done twice

`ROUND6_BRIEF.md` Jobs **U** and **AD** are already implemented by the above and are marked DONE in
that file. If round 6 ever reaches Codex, he must skip them.

## Open, not started

- **Stale `.doc` name in the QA harness.** `qa/run_regression_suite.js:2111` saves the Word export as
  `active-doc.doc`; `qa/validate_regression_exports.py:284` dispatches `.doc` to an HTML text parser.
  The app writes a real `.docx` (verified sound: zip CRC OK, all four OOXML parts, WordprocessingML
  declared, 42 paragraphs, 1 table). So the assertion has been red since the docx fix landed, and the
  Word export has had **no working validation** since. Fixing it needs BOTH the filename and a
  `.docx` branch in the validator — `docx` appears nowhere in that file today, so renaming alone
  lands on "unsupported export type" and stays red. Touches zero application bytes.
- **Preview toolbar** — 585 px empty at 1440, 1,093 px with the panel hidden. A design decision,
  still mine, still undone.
- **Visual builder section** — builder for the 4 live types, Sequence builder for sequence, Guided
  promoted for the rest once it stops lying. Decided in principle, not implemented.
- **Placement** and **saved Views** — both parked by the owner.

---

# Resume here — 23 August 2026, night (v1.65.0 live)

Live app: `C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html`
Last snapshot: `releases\SIREN_v1.65.0.html`  — **read the LAST section of this file first; it is append-only.**
Live worklist: https://claude.ai/code/artifact/f6a81e75-4aba-4094-9f3e-1e66f5710db4
(a copy of the page is also at `SIREN\siren_worklist.html`)

## The agreed order

1. Finish the themes — i.e. the two regressions below.
2. Then the queued fixes, top down.
3. Vector PDF and the drawing canvas **last**, both deferred deliberately.

## In flight when the session ended

A workflow was mid-build on the live file (it had grown 4,085,237 → 4,091,759 bytes,
still stamped v1.49.0, so the version bump had not landed). **Check the file boots and
`python tools\syncheck.py` passes before doing anything else** — a build interrupted
between writes is the one state nothing here protects against.

It was fixing two regressions, both measured by me, not reported:

**A. The ink guarantee never fires.** `inkOnFill` / `enforceDiagramInk` shipped and do
nothing. Verify on the exact cell: a mindmap on the **Matrix** theme, label
"TB reconciliation" — ink `rgb(217,255,226)` on fill `rgb(117,255,149)` = **1.17:1**,
10 of 10 labels under 4.5. The report chip exists in the DOM and its text is empty,
so a pass that never ran and a pass that found nothing look identical from outside.

**B. Both reworked themes stopped moving.** Sample `#ambientCanvas` pixel data twice,
1.5 s apart. Before the fix: artdeco 371049 → 371049, wasteland 401273 → 401273
(frozen); kintsugi 1239777 → 1239199 (moving — use it as the control). Cause was
deliberate: `artdeco` is `settleFrames: 1, frameMs: 2000` with everything baked in
`init`. Motion is safe to restore because Art Deco's `--ambient-card` is now fully
opaque — no scene pixel can reach the working surface.

## Ready to apply, held only because the file was busy

`pending\fix_recovery_wording.py` — anchor-guarded, not yet run.

`offerCrashRecovery` reads whether the last session closed cleanly and then **never
uses the answer**. So "The previous session ended unexpectedly" is asserted on every
reload whose draft differs, even after a clean close. Offering the draft is still
right (the last IndexedDB put can die with the page); the sentence is what is wrong.
The patch splits the wording by `cleanExit` and, when the exit was clean, says the
likely real reason — a save that did not finish.

## Open thread, not yet diagnosed

"Local save failed" appeared with only one window open, and a reload cleared it.
Four different causes share that one red chip; one of them (another tab holding a
newer workspace) is not a failure at all. Probably the same root cause as the
recovery prompt: if the main key falls behind the draft, every reload sees a
difference. Queued as its own item.

## House rules that keep proving themselves

- Verify every agent claim in the running app. Two rounds today reported success on
  things that do not work in the shipped file.
- Check your own harness first. Three false alarms today were mine: a dead local
  server, a `position: fixed` element read through `offsetParent`, and a welcome tour
  card that is not a `<dialog>`.
- One writer at a time on the 4 MB file. Anchor-guarded patches fail loudly; a whole-
  file rewrite by another agent does not.

---

## Handed to a second engineer (Antigravity), same evening

Folder: `antigravity\` — the frozen copy, its hash, the brief and the prompt that
was given.

Their territory is the **three export writers**, chosen because all three are purely
additive, touch nothing the main work is inside, and can be verified entirely from
their own output bytes: PPTX diagrams as editable shapes (started first), real
`.docx` instead of `.doc`, and vector PDF.

Vector PDF is last on the owner's list **for my time, not for theirs** — it runs in
parallel and is not blocked by anything.

They deliver anchor-guarded patches against `FC7AB9E6…`, not against the live file.
When a delivery arrives: re-apply the patches to the current file, run syncheck, and
**open the artefact** — unzip the PPTX and read `ppt/slides/slide2.xml`, extract the
PDF content stream, rasterise a page and look at it. Never merge on the strength of a
report.

## Where everything lives

| | |
|---|---|
| `RESUME_HERE.md` | this file |
| `siren_worklist.html` | a copy of the live worklist page |
| `releases\` | one snapshot per version, `SIREN_v1.49.0.html` is the last stable |
| `pending\` | patches written but not applied |
| `audit\` | the canvas spec, the declutter move list, the competitive inventory |
| `prototypes\` | `canvas_handles.html` — the playable canvas prototype |
| `antigravity\` | the second engineer's frozen copy and brief |
| `tools\` | every patch installer kept from every round, plus `syncheck.py` |
| `qa\` | the regression suite: `node qa\run_regression_suite.js` |

---

## Antigravity — where they got to before the limit

**Job 1 of 3, PPTX editable shapes. Plan approved, implementation started.**

**They corrected me, and the correction stands.** I reported "PPTX diagrams are still
images" after checking `mapPptxDiagramSlide` — the deck path. The **single-diagram**
export already writes editable shapes: `buildPptxBlob()` (L74525) calls
`buildEditableSlideShapes` (L74450) for flowcharts. Only the deck path rasterises. So
the scope is the deck path only, and the single-diagram path is the template.

**They asked whether a tall flowchart should be one slide or several. It is not a
choice** — the deck writer's own comment settles it: *"WHO DECIDES. Not this writer.
`deckPlanDiagramPages(target:'pptx')` — the same pure function the PDF asks… Both files
therefore cut a diagram in the same places and report the same point size; only the
page shape differs."* One slide would produce a PPTX that no longer matches the PDF
beside it in the same audit file, and on a tall diagram the smallest type was 2.42pt
before the deck round and 10.92pt after.

**Their revised plan**, which I approved: filter shapes per `part.source` viewport;
map shape pixel → SVG viewBox → part-local normalised → `part.picture` design px → EMU;
include connectors crossing the cut fully in both parts; a new `buildCroppedSlideShapes`
that targets `part.picture` instead of auto-fitting the slide; consume
`deckPlanDiagramPages`, never modify it.

**Three things I added that were missing:**

1. **Subgraph containers.** The planner cuts in the gaps between blocks so no *block*
   straddles a cut — but a subgraph rectangle wrapping ten blocks straddles by
   definition. They must choose: whole in both parts, clipped at the part edge, or
   label only.
2. **PowerPoint re-measures text.** A label that fits in the SVG can overflow a
   DrawingML shape, because PowerPoint uses its own font metrics rather than the ones
   Mermaid measured with. The classic way SVG→OOXML conversions fail. Test with a real
   long label, not "Start".
3. **The overlap becomes real duplicated objects.** The parts deliberately repeat a
   block or so, so a reader rejoins them by recognition. In a raster that was obviously
   one picture shown twice; as shapes they are two independent objects that can be
   edited apart and drift. Not a defect — the price of splitting — but it must be in
   the report, not discovered by someone who fixes a typo on slide 3 and finds it still
   wrong on slide 4.

**Acceptance criteria given to them:** unzip the export; `ppt/slides/*.xml` holds
`<p:sp>` with `<a:t>` runs and no `<p:pic>` for a flowchart; the part count matches the
PDF for the same diagram; the eyebrow text ("Part 1 of 3") agrees between the two files.

---

## Both regressions closed — v1.50.0, verified 21 Aug

**The 1.17 I reported was my measurement error, not a defect.** For an HTML label inside
a `foreignObject`, the glyphs are painted by `color`, not `fill`. My probe read `fill`
off wrapper elements that paint nothing — and worse, it explicitly treated
`rgb(0,0,0)` as "unset" and fell back to `fill`, so when the real ink *was* black it
threw the true value away. Rendered pixels on that cell: black glyphs on green,
**16.4:1**. Those labels were always readable. Third harness error of the day, and the
costly one: it sent a whole workflow after a phantom.

**But the failure shape I predicted was real, in a different diagram type.** gantt:
"Scope" measured **1.38:1**, pale mint on light grey. The pass *did* detect it and *did*
attempt the repair — and the repair silently failed, because Mermaid ships
`.doneText0 { fill: … !important }` and the write had no priority. Then it computed
`after` from the colour it *intended* rather than reading the DOM back, so it counted a
repair that never happened and the chip stayed hidden. Fixed: the write carries
`important` and the result is read back off the element; a write that does not land is
reported as `blocked`, never counted.

`report.ran` was indeed written and never read — confirmed by grep. The chip now says
"Ink not checked" with a reason, and "No labels measured". **Silence now means measured
and clear.**

**Motion, measured myself.** Wasteland moves (three samples, two states). Art Deco moves
**rarely by design** — one event every ~25 s — so a three-sample test misses it; 19
samples over 32 s gave 2 distinct states. Kintsugi control moves throughout.

---

## Antigravity delivered all three — nothing merged, verification running

**Delivered** (`antigravity\`): `patch_pptx_editable_shapes.py`,
`patch_word_docx_ooxml.py`, `patch_pdf_vector_deck.py`. All three are anchor-guarded,
hash-gated, and **all three applied cleanly to the current v1.50.0** even though the
file moved under them. `node --check` passes on the combined result.

**None of it is merged.** Everything is on a test copy at
`antigravity\test_150.html`. The live file has not been touched.
Verification workflow `wb36z1ibr` is running four adversarial checks — one per format
plus a regression sweep — and writes its verdict to
`scratchpad\ANTIGRAVITY_VERDICT.md`.

**Two boundary problems worth knowing before the next round:**

1. **They modified the frozen copy.** `SIREN_v1.49.0_frozen.html` in that folder is now
   4,252,397 bytes with a different hash — they applied their own patches to it. The
   clean baseline is `releases\SIREN_v1.49.0.html`; use that if anything needs rebasing.
2. **They built nine modules nobody asked for**, in `antigravity\recommendations\`:
   watermarking, a zip binder of all deliverables, round-trip Excel sync, cryptographic
   provenance, and more. Two cross into the main engineer's territory —
   `08_offline_mermaid_cache` is queue item 3, and `09_monochrome_accessible_themes` is
   theme work. One is genuinely valuable and in their own lane: PDF Flate compression,
   533 KB → 65 KB. **None of it is applied**, and the regression check confirms none of
   it leaked into the three patches.

**The fear to test for on the PDF**, and the reason the verification is adversarial: a
vector PDF that is *structurally valid and visually wrong* passes every automated check
and fails only when a client opens it.

## What Antigravity does next

**Not a fourth format.** Three unverified jobs are enough. Instead, and it is
independent of the verdict: **extend `qa\run_regression_suite.js` to cover the three
formats they just built** — unzip the PPTX and assert `<p:sp>`/no `<p:pic>`, parse
`word/document.xml`, count fonts and text operators in the PDF. Assertions with numbers,
failing loudly. They may find their own defects writing it; that is the point, and it
removes the hand verification from every future round.

**After that, if the verdict is good:** Mermaid inlined into the file. Note for the
brief — they already built the *wrong* shape of this unasked (`08_offline_mermaid_cache`,
IndexedDB). A cache still needs one online load, so an auditor opening the file for the
first time inside a filtered client network still loses sequence, gantt and class. It
must be **embedded**, not cached.

**Off their list**: the editor, the board, the themes, the parser, the canvas.

---

## Antigravity round 2 — verdict delivered, one job merged (23 Aug, 00:30)

**Merged: embedded Mermaid → v1.51.0.** Tested myself with the CDN blocked: zero
external requests, "Full Mermaid", sequence/gantt/class all render — before, all three
refused offline. Online it no longer touches the CDN at all. Cost: first paint 184 →
344 ms, file 4.1 → 7.7 MB. `patch_embed_mermaid.py` and `mermaid.min.js` are in
`tools\`. **The "one file, fully offline" claim is now true.**

**Not merged:** PPTX (one blocker — node geometry read from the editor's diagram, not
the exported one), DOCX (nested `<w:p>`, Word refuses; images dropped), PDF (rejected
twice — 89.5% black fills, zero clipping, visually wrong). Their suite additions kept.
Their 18 unasked modules declined; the destructive patcher is in `antigravity\QUARANTINE\`.

**Round 3 brief written:** `antigravity\ROUND_3_BRIEF.md`. New base is `releases\SIREN_v1.51.0.html`.

**Found while verifying them, not theirs:** PPTX and PDF already cut a tall diagram into
different part counts (4 vs 3) before any of their patches. The code comment claiming
they agree is wrong in the shipped app. Queued.

---

## 23 Aug, resumed — recovery patch applied, surgical editing in flight

**Applied:** `fix_recovery_wording.py` → v1.51.1. Verified **statically only**: both
branches are in the file, the condition is `cleanExit !== 'yes'`, the old crash wording
is now confined to the crash branch. I could not exercise it behaviourally — `readDraft`
picks the newest of two copies (IndexedDB via `sirenStore`, and localStorage), and boot
rewrites both with the current state before `offerCrashRecovery` runs, so a forced stale
draft is swallowed by the harness. Not a defect in the patch; a limit of the test. If the
owner sees the prompt again after a normal close, the title should now read "A draft
does not match this workspace", not "Recover unsaved work?".

**In flight:** workflow `wqblgolbh` — surgical editing for the visual builder (queue
item 1, gates the canvas). Read confirmed the shape: `writeStructureLine` touches one
line; `applyVisualModel` reserialises everything and has **18 callers**. The round maps
all 18, designs a line-level writer, proves it on the hard cases in a standalone harness
first, then installs it. The test is a byte diff of the source before/after every gesture.

---

## Surgical editing shipped — v1.52.0 / v1.52.1 (23 Aug, 01:40)

**Queue item 1 is closed, and the canvas is no longer gated.** The visual builder edits
the lines a gesture concerns and leaves every other byte alone.

Measured on the owner's own five-line source (comment, chain, `-- Yes -->`, unquoted
labels, alignment spaces), real UI gestures, byte diff before/after, one Undo restoring
the exact bytes every time:

| gesture | before the round | now |
|---|---|---|
| add block | 1 of 5 lines kept, 12 added | **5 of 5 kept, +1** |
| rename D | 1 of 5 kept | 4 of 5 kept, only `D{Over 50k EUR?}` |
| shape A | 1 of 5 kept | only `A(PO raised)  --> …` — double space kept |
| delete DIR (chain middle) | 1 of 5 kept | `P[PO issued]` declared; **never an invented `D --> P`** |
| direction LR | 1 of 5 kept | header only |

All **17** `applyVisualModel` callers migrated; the parser and the guided editor untouched
(verified byte-identical). Where a change cannot be expressed without moving lines the
user did not point at, the app **asks** ("Move lines to do this?") quoting the line; a
full reserialise happens only after an explicit "Rewrite the Mermaid code?" — never
silently. Sidecars migrate; `deleteVisualNode` now clears all seven stores.

**v1.52.1:** the one bypass the verifiers found — shape changes from the *inspector* and
the style panel went through `replaceNodeShapeInSource`, which re-emitted the whole line
(`D -- No  --> MGR[…]` became `D -->|No| MGR("…")`). Routed through `surgPlanUpdateNode`;
measured: `MGR[Manager approval]` → `MGR(Manager approval)`, rest of the line byte-identical.

**Honest-but-costly fallbacks still open** (queued, not defects of the writer): a connector
label containing `>`, `<`, `&`, `|`, `"` or `;` in a `-- label -->` file falls to the
rewrite dialog because the statement splitter trips on the entity; a label with `[`/`]`
on a chain-declared node likewise (parser loses the node). And no-op gestures still toast
success. Fix for the first: retry in pipe form before offering the rewrite.

**A harness lesson from this round, for the record:** the JS source contains literal
`\r?\n` (double backslash) inside `text.split(/\r?\n/)`, so a hand-typed anchor never
matches. Take anchors from the file, never retype them. And `#inspectorShape`'s option is
`rounded`, not `round` — a probe that sets a value the select does not have silently does
nothing and then reports "5/5 kept" as if it proved something.

---

## 23 Aug, ~02:20 — v1.53.0, nine queue items closed in one round; owner asleep, working unattended

Owner's standing instruction before sleeping: **close the whole list; canvas builder is
last of all, after the list is empty; no approvals needed.**

Closed in 1.53.0 (all verified in-app, zero page exceptions on the final run): save chip
names its cause; pop-out toolbar wraps (6/6 controls hit-test ok) and opens clear of the
mode switch (x=508 = preview pane left); search/filter force a collapsed project open;
board heading truthful ("1 of 3 diagrams · TBS"); View button shows filter with ✕; docked
Wrap toggle mirrored with pop-out; pop-out stats from the parsed source.

One self-inflicted bug on the way: `singleGroupFilter = filter !== 'all'` was placed above
`const filter` (TDZ → ReferenceError on every board render). Caught by the harness
(`PAGE EXCEPTION` lines), moved below the declaration, re-verified clean. **Lesson kept:
grep the harness log for PAGE EXCEPTION every run, not just the named probes.**

Queue: 25 → 16. Next lot, small and independent: +Block inserts at the focused row;
+Connection refuses duplicates; no-op gestures stop toasting; `>`/`&`/`;` labels retry in
pipe form before the rewrite dialog; PDF vs PPTX part-count mismatch.

## v1.54.0 — guided +Block/+Connection, pipe-form retry, silent no-ops (23 Aug ~02:50)

[04] +Block inserts after the focused row (measured: line 3, not the end). [05] +Connection
starts from the focused row's FROM block and skips pairs already joined (first press wrote
`B --> N1`, second `B --> D`; duplicates impossible). [11] `amount > 50k` in a mid-form file
is written surgically as `A -->|amount &gt; 50k| C`, no rewrite dialog. [12] no-op gestures
no longer toast. [10] is NOT a bug: PDF may go portrait, PPTX cannot (one `sldSz`), so part
counts legitimately differ (4 vs 3); the misleading code comment is corrected instead.
Queue 16 → 11.

## v1.55.0 — error panel in plain words, Add comment on right-click (23 Aug ~03:25)

[01] closed: `parseRenderError` walks back from Mermaid's blamed line to the nearest line
with an unbalanced [ ( { or " and names THAT one ("Line 6: a block label is opened here but
never closed"); the 297-char token dump is folded under "Technical detail". Measured: gutter
marks the true line, panel sentence 85 chars. [08] closed: "Add comment…" in the block's
right-click menu opens the inspector on that block with the comment field visible.
Left as an XS item: the comment field does not take keyboard focus automatically in the
headless harness (a direct `box.focus()` is a no-op there with no throw, no hidden ancestor,
no disabled) — almost certainly the context menu's managed focus trap; a user clicks the
field. Not worth more time now. Queue 11 → 9.

## v1.56.0 — hide a diagram from the bar (23 Aug ~03:50)

[07] closed. `hiddenFromBar` persists on the record; the strip skips it and reads
"4 diagrams · 1 hidden"; the ⋯ menu offers Hide/Show; the board keeps the card with
"Show in bar"; hiding the active one switches to the next visible; the last visible cannot
be hidden. Verified incl. reload persistence, zero exceptions. Queue 10 → 9.

## v1.57.0 — declutter: Docs head and Present bar (23 Aug ~04:20)

[09] closed (the two remaining verified moves from DECLUTTER_MOVES.md). Docs head at rest:
8 → 5 (Type/Changes/Releases into the document ⋯, Type as ticked rows, picking one changes
#wpType — measured). Map bar at rest: **7 → 5** (Build and ? into the authoring ⋯ cluster;
E and ? keys still work — measured). Zero exceptions. Queue 9 → 8.
Remaining owned by me: tiles for collapsed projects, guided rows draggable, drag a diagram
between projects (three M design items sharing the board/guided drag machinery — one
workflow), plus the XS comment-focus polish. Four items are Antigravity's (PPTX/DOCX fixes,
vector PDF, raster PDF pages).

## 23 Aug ~04:35 — last three owned items in flight as ONE round (workflow w4m2snxmc)

Tiles for collapsed projects (the tile IS the collapsed state, rides folder.collapsed),
drag a card onto a project header/tile/Unfiled (calls moveWorkspaceDiagramsToFolder), and
guided rows draggable with Alt+↑/↓ + right-click Move up/down (never drag-only; byte-diff
discipline on the reorder write). Build order A→B→C; three independent verifiers after.
**Do not touch the live file while this runs.** When it lands: verify tiles by READING the
two screenshots, a board drag by folderId readback, a guided move by byte diff; grep logs
for PAGE EXCEPTION. Then bump, snapshot, close the three items, and the queue holds only:
the XS comment-focus polish, and four Antigravity items (PPTX/DOCX fixes, vector PDF,
raster PDF pages). After that: **the canvas builder, last of all, as the owner ordered.**

## v1.58.0 / v1.58.1 — tiles, board drag, guided drag (23 Aug ~05:10)

The last three owned items shipped as one round. Verified by me (the tiles verifier died
mid-response, so I re-measured): shelf 886×98 at 1440 (726 at 1280), tiles 169×98 (174),
56-char name clamps to 2 lines with the full name in the title, tick hidden at rest,
Enter on a focused tile expands it; zero exceptions both widths. Drag verifier: every board
and guided check PASSED (folderId readback via IDB; guided byte-diff exact; Undo restores;
auto-scroll to a tile works). 1.58.1 fixes the one load-bearing finding: **Undo did not
rebuild the guided rows**, so the next reorder by any route was swallowed as stale —
measured fixed (Undo → rows rebuilt, byte-identical; second Alt+↓ applies). Also: the drag
ghost names the card (a reorder carries one).
Three XS follow-ups queued: moving across a blank line leapfrogs (arrow vs drag differ);
no Unfiled drop target once Unfiled is empty; tile ⋯ should hover-reveal like the tick.
**Queue now: 1 XS focus polish + 3 XS above + 4 Antigravity export items. Nothing else is
mine. Next and last: the canvas builder, as the owner ordered.**

## 23 Aug ~05:30 — owned queue EMPTY; canvas builder phase 1 in flight (workflow wp8qdto91)

Everything the owner asked to be fixed before the canvas is closed (v1.58.1). The canvas
round is the last ordered item: grow-forward, insert-before, connect, rename-in-place on
the rendered preview, every gesture an op through the surgical writer; splice (G4) and
reorder (G6) deliberately excluded until phase 2. Targets: 1 mouse + 1 key + label per
step; byte-exact diffs; keyboard + touch routes; overlay hidden in Present and absent from
exports; no new mode or panel.
**On waking / resuming:** if wp8qdto91 finished, read its `built` + three verdicts; verify
yourself the gesture byte diffs and that click→inspector / dblclick→rename / right-click
rows / pan / exports are unchanged; grep logs for PAGE EXCEPTION; then bump is already
1.59.0 by the builder — snapshot, close the card, publish. If it did not finish, the live
file may be mid-write: run syncheck first; `releases\SIREN_v1.58.1.html` is the last good.
Remaining queue after this: 4 XS polish items + Antigravity's 4 export items (theirs).

## 2026-08-23 — v1.59.1: canvas phase-1 verifier defects closed

Live: `C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html` = **1.59.1**. Snapshots: `releases\SIREN_v1.59.0.html` (canvas phase 1 as the workflow left it) and `releases\SIREN_v1.59.1.html`. Installer: `tools\fix_canvas_followups_1_59_1.py`. Evidence: `qa\canvas_1_59_1\` (out_cfu2.log = D1, out_cfu3.log = D2 + nit, out_cfu.log step 13 = D3; 0 PAGE EXCEPTION in all three).

What changed (all four verifier findings):
- **D1** insert-before now inherits the target's group: `surgPlanCanvasStep` 'before' takes the group from the target's own membership mention (not the hop line) and writes a bare member line inside the block when the hop sits outside it. Measured: seed with `subgraph AP {D,E}`, insert "Pre-check" before E → `D --> N1[Pre-check] --> E[Match]` + `    N1` inside AP; inAP = [D,E,N1].
- **D2** keyboard route for connect: `#canvasPopLabel` carries `list="canvasPopBlocks"` (datalist of every block except the source); an exact case-insensitive match on a forward gesture calls `canvasConnect({id, role:'fwd'}, existing.id)` instead of `canvasGrow`. Measured: from A, type "Pay" → `  A --> F` added, still one `[Pay]`; type "Triage" → `A --> N1[Triage]` (new label still creates).
- **D3** hint chip sits at `view.top + 10`, `.canvas-hint{pointer-events:none}` / its button `auto`. Measured: chipTop 254 vs viewTop 244, chipPE none, btnPE auto.
- nit: "Follows Start." (no doubled punctuation when the label ends in .?!).

Harness notes for next time: the forward handle is `#diagram g.t-handles .t-handle[data-role="fwd"]` (back = `data-role="back"`, `data-handle-for=<id>`); a pointerdown/pointerup/click on it opens the popover. `parseVisualFlowchartSource` is IIFE-internal — read groups from `#source` text, not from window. Synthetic Ctrl+Enter on `document` does not reach the canvas; click the handle instead.

Queue after this: 4 XS polish (comment-field focus; guided blank-line leapfrog; empty-Unfiled drop target; tile ⋯ hover-reveal) + 4 Antigravity export items (theirs). Canvas phase 2+ (G4 splice, G6 reorder, type-to-replace) stays future. Vector PDF stays last.

## 2026-08-23 — v1.59.2: the four XS polish items closed; the owned list is empty

Live: `C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html` = **1.59.2** (7,825,913 bytes). Snapshot `releases\SIREN_v1.59.2.html`. Installers in `tools\`: `fix_xs_polish_1_59_2.py` (XS2 + XS3), `fix_comment_focus_1_59_2.py` (XS1), `bump_1_59_2.py` (version, changelog, comment box scrolls to centre). Evidence `qa\xs_1_59_2\` (out_xs*.log, run_xs*.json, PNGs; 0 PAGE EXCEPTION in every run). The CDP driver now lives at `tools\drive.mjs` too (steps: nav/js/click/key/hover/shot; focus emulation on).

- **XS1 "Add comment…" focus** — real cause measured, not the guessed focus trap: the composer sits inside the inspector's closed `<details>` ("Comments"); `focus()` on a field in a closed details is a silent no-op (no focus event, `checkVisibility()` false, `#metadataRisk` in the other closed details fails the same way; `#inspectorBlockLabel` outside focuses fine). Fix: `focusComment` opens `box.closest('details')` first, then focuses and scrolls `block:'center'` (with `'nearest'` the box sat under the sticky Reset/Done footer). Measured: focused on the first try, typing lands.
- **XS2 guided leapfrog** — `structureMoveRow` skipped blanks and then inserted one slot too far; now one press = one visible slot, blank included, same as the drag. Measured: [hdr, A, '', B, C] → Alt+↓ on A → [hdr, '', A, B, C] → again → [hdr, '', B, A, C].
- **XS3 empty Unfiled** — `ensureWorkspaceUnfiledGhost()` on drag begin (grouped by folder, filter all, no Unfiled section present) appends a dashed `section.multi-preview-group[data-folder-id=unfiled][data-drop-ghost]`; `removeWorkspaceUnfiledGhost()` in teardown. Measured: ghost appears, lights under the pointer, drop → "1 diagram moved to Unfiled.", real Unfiled renders with the card, ghost gone; no ghost when a real Unfiled exists.
- **XS4 tile ⋯** — no change: `.multi-preview-group-actions` wrapper is opacity 0 at rest, 1 on real hover (CDP mouseMoved) and on focus-within; the queue's "opacity 1" was the button's own computed opacity (not inherited).

Harness notes: the Bash tool collapses `\\` to `\` inside heredocs (a `\b` in a JS regex became a backspace and produced a false `hasAtoF:false`) — write scripts with the Write tool. Ticking "all unchecked ticks" on the board ticks cards inside folders too, so a "tick rest → new folder" seeding empties every folder (harness, not app). The board showed duplicate Unfiled sections after six rapid folder creations in run 1 — possibly overlapping async renders appending sections after `replaceChildren()`; not reproduced with slower pacing; worth one targeted probe before calling it a bug.

**State of the list:** everything I own is closed. Queue = Antigravity's four export items (PPTX editable shapes, DOCX real .docx, vector PDF, raster PDF pages). Next things to start, both deliberately last and both needing the owner's go: canvas phase 2+ (G4 splice, G6 reorder, type-to-replace) and true vector PDF.

## 2026-08-23 — v1.59.3: board stale-render duplicates fixed

Live = **1.59.3** (7,826,513 bytes). Snapshot `releases\SIREN_v1.59.3.html`. Installer `tools\fix_board_stale_render_1_59_3.py` + `tools\bump_1_59_3.py`. Evidence `qa\board_1_59_3\` (out_dup.log = before: three Unfiled sections and 15 cards for 6 diagrams after collapsing three projects in one tick; out_dup2/3.log = after: one section per project, no duplicate cards; 0 PAGE EXCEPTION).

Cause: `renderWorkspacePreviews` is async and begins with `replaceChildren()`; a render overtaken by a newer one resumed after its first `await mountWorkspacePreviewCard(...)` and kept appending the next group's section and cards to the live grid — the `requestId !== workspacePreviewRequestId` guard lived only inside the card mount. Fix: the guard at the top of each group iteration and after each awaited mount (both the grouped and the flat loop). Found while verifying the XS items (the first XS run showed "unfiled:Unfiled" twice and 16 cards for 6 diagrams); reproduced deliberately with three toggle clicks in one tick.

Owned list still empty. Next: canvas phase 2 (G4 splice, G8 delete-and-heal, shared `heal()` + refusal dialog, type-to-rename guard) per `audit\CANVAS_BUILDER_SPEC.md` §5; the spec asks for a restructure benchmark on a real 40-node diagram before phase 2 starts.

## 2026-08-23 — v1.60.0: canvas phase 2 (move, delete-and-heal, the refusal, type-to-replace)

Live = **1.60.0** (7,853,218 bytes). Snapshot `releases\SIREN_v1.60.0.html`. Installer `tools\patch_canvas_phase2_1_60_0.py` (version + changelog included). Evidence `qa\canvas_1_60_0\` (out_p2d.log = the full phase-2 probe on the shipped build; out_lit2 = the lit connector; PNGs: p2_lit, p2_refusal, p2_menu, p2_drag_over_edge, p2_after_splice; the six `setPointerCapture` PAGE EXCEPTIONs in the logs are the probe's synthetic pointerdown on the viewport reaching `beginPan` — real pointers never throw there; 0 other exceptions).

What shipped (spec §5 phase 2, `audit\CANVAS_BUILDER_SPEC.md`):
- **heal** — `canvasHealPlan(model, id)`: every in×out pair becomes one connector carrying the upstream label (downstream when upstream blank); identical connectors never duplicated; casualties = a self-loop, or two different labels that would share one connector → the gesture refuses via `canvasRefuse` → `requestNotice` (the confirm dialog in one-button mode; `closeConfirmDialog` restores the danger class, the Cancel button and white-space).
- **G8** Delete/Backspace on a selected block → `canvasDeleteAndHeal` (op `canvasHeal`). Toast: "Pay removed; Post now leads to Close. Undo restores it." Sidecars: `structureForgetNode` + `canvasForgetEdges`.
- **G4** body drag onto a connector → `canvasSplice(id, edge)` (op `canvasMove` → pass 1 detach+heal, `then` pass 2 `canvasSplice` on the re-indexed text; `surgicalWrite` gained `plan.then`). Hit via `canvasEdgeHit` → `resolveEdgeFromElement`; the hit band is lit by writing its inline `stroke` with `important` (the hit path carries `stroke: transparent !important` inline — a class can't win), plus the drawn `flowchart-link` gets `.t-canvas-drop-edge`. Ghost pill `.canvas-move-ghost`. Group: the block joins the connector's group only when it had none and both ends share one. Ctrl+Shift+I → `canvasOpenSpliceMenu` (openStructureMenu; incident connectors disabled).
- **G5** type-to-replace: printable key on a selected block → `canvasBeginInplaceRename(id, { replaceWith })`; guard `canvasTypeSuppressed` armed by a body drag or handle drag that produced nothing (and a popover dismissed with Esc), cleared by a deliberate click/F2; never `?` or `/`.
- Planners: `surgChainShrink` (common shape `A --> X --> Z` → `A --> Z`, keeps upstream or downstream label), `surgHealEdits` (healed connector after the in-hop's line, depth 0 when grouped), `surgPlanCanvasHeal`, `surgPlanCanvasMove`, `surgPlanCanvasSplice`.
- `handlePreviewNodeClick` ignores the click that ends a body drag (`canvasMoveSuppressClickUntil`).

Measured (out_p2d.log): delete F → `D --> G` + `G[Close]` re-declared, AP loses F, Undo byte-exact; refusal on E (No in / Handled out) with the source untouched; chain `A --> B --> C` minus B → `A --> C` in place; body drag B onto D→F → `D --> B --> F[Pay]`, `A --> C` healed, B joins AP, toast right; type Q → inplace "Q" → commit → `A[Quote]`; failed drag then `z` → nothing; click then `N` → inplace; Ctrl+Shift+I menu → pick → splice → Undo exact.

Known polish (not defects): the general detach path re-declares the dropped line's blocks on their own lines (`A[Start]` / `B[Review]` / `A --> C` / `C{Approved?}`) — correct, a little verbose; the chain-shrink shortcut covers the common one-line shape. Two draw-io-parity items remain by the spec: phase 3 (keyboard/touch parity) and phase 4 (reorder with verify-after-render).

## 2026-08-23 — v1.61.0: canvas phase 3 (keyboard parity)

Live = **1.61.0** (7,860,178 bytes). Snapshot `releases\SIREN_v1.61.0.html`. Installer `tools\patch_canvas_phase3_1_61_0.py`. Evidence `qa\canvas_1_61_0\` (out_p3_live.log; 0 non-harness exceptions).

Shipped: `handleCanvasFocusIn` (focus on a block selects it — the ring follows keyboard focus); `canvasMoveFocus(key)` (↑↓ along the flow axis to the nearest predecessor/successor by rendered cross position, ←→ to a sibling sharing a predecessor on that side, else the nearest block on the same rank; LR/RL and BT/RL handled by `CANVAS_AXES`-style direction logic); `canvasFocusBlock`; handles get `tabindex="0"` and a focused handle is re-focused by role after `canvasOverlayRepaint` rebuilds the ring; `handleCanvasHandleKeydown` (Enter/Space on a handle opens the popover at the handle); `canvasFocusPending` set in `canvasApply` when focus was on the canvas/popover/inplace and consumed in `canvasAfterRender` (the made/kept block takes focus after the re-render). Quick guide gained a "Canvas keys" row. Touch drag deliberately not built (owner: tablet = reading).

Measured: focus A → ring A; ↓ B; ↓ C; ↓ D; → E; ← D; ↑ C; fwd handle tabindex 0 + focus; Enter → popover (input focused); "Verify" Enter → `C --> N1[Verify]`, ring + focus on N1; typing `x` → in-place rename of N1; guide row present.

Remaining canvas spec: phase 4 (G6 reorder `[`/`]` only behind verify-after-render + silent rollback + plain refusal) and the 40-block restructure benchmark (§10). Vector PDF last (Antigravity's, rejected twice).

## 2026-08-23 — v1.61.1: the 40-block restructure benchmark (spec §10), and the arrow walk fixed from it

Live = **1.61.1**. Snapshot `releases\SIREN_v1.61.1.html`. Installer `tools\fix_arrow_ahead_1_61_1.py`. Evidence `qa\bench40_1_61_1\` (mk_bench40.py + run_bench40.json + out_b40.log / out_b40b.log / out_arrow.log, bench40.png).

**The benchmark** — a 40-block purchase-to-pay flow (3 groups, 8 decisions, 2 loops; 79 lines) driven on the live build at 1440×900:
- render 40 blocks: **660 ms**; neighbours sit **41 px** apart on the AP chain.
- hover reveal at that spacing: 8/8 rings match the hovered block (the first run's "none" was the probe dispatching pointermove on the viewport instead of the block).
- select a block below the fold (D9): ring + both handles in view.
- four inserts via the back handle: **434–483 ms** from Enter to the new block drawn; each = **one line changed** (+ one bare member line when the target is in a group), e.g. `B2 -->|Yes| B5[GRN posted]` → `B2 -->|Yes| N1[Quality check] --> B5[GRN posted]`.
- six connector relabels via the edge inspector: 6/6, one line each (two in the first run failed only because the inserts had split those connectors — probe, not app).
- one move via Ctrl+Shift+I (C7 into D1→D2): correct, verbose general path (`C7[Buyer review]` / `C6 -->|Price| C9` / `C9[Resolution logged]` / `D1 --> C7 --> D2{…}`), toast right, 0 exceptions.
- arrow walk: **found a real UX defect** — from "Return to requester" (only successor = the loop back to A1) ↓ jumped up the page and the walk cycled A1→A2→A4→A1.

**Fix (1.61.1)** in `canvasMoveFocus`: along the flow axis, linked blocks *ahead on the page* first; when none is linked ahead, the nearest block ahead on the page (by along-distance, then cross); never a jump back. Measured after: ↓ from A1 = A2, A4, A5, A7, A8, A9, B2, B5, B6, B7, C1, C2; ↑ from E2 = E1, D12, D10, D9, D8, D7, D6, D5.

Verdict per the spec's own gate ("if the ring survives that, the rest of the plan is safe"): it survives. What remains of the canvas spec is phase 4 (G6 reorder with verify-after-render). Known polish: the general detach path on a move is verbose (re-declares the dropped line's blocks); a later tidy could rewrite the in-hop's `to` instead.

## 2026-08-23 — v1.62.0: canvas phase 4 (reorder siblings, verified) — the canvas spec is complete

Live = **1.62.0**. Snapshot `releases\SIREN_v1.62.0.html`. Installer `tools\patch_canvas_phase4_1_62_0.py`. Evidence `qa\canvas_1_62_0\` (out_p4*.log, run_p4.json, mk_p4_probe.py, p4_swapped.png; 0 non-harness exceptions).

Shipped: `[` / `]` on a selected block → `canvasReorderSibling(id, dir)`: the neighbouring branch out of the same predecessor (by rendered cross position; for LR/RL above/below) → precondition via `surgPlanSwapEdges` (each connector must be the whole of its line; else plain refusal "These two connectors share a line with others; swap them in the code.") → the two connectors trade lines (op `swapEdges`) → `canvasVerify` → after the re-render `canvasVerifyReorder()` reads the two blocks' rendered order back: flipped → toast "X and Y swapped sides."; not flipped → `undoSource()` silently + "These two branches rejoin further down, so the layout decides their left-right order. Moving them apart would mean changing what feeds them." Guide row updated.

Measured: open branches → `]` flips C/D (x 879/1045 → 1059/893), the two source lines swap, toast right; `[` restores byte-exact. Rejoining branches → `]` → source back to the original, reason toast, undo/redo both enabled (the redo holds the attempted swap). Chain line → plain refusal, nothing written. No neighbour on that side → "No branch to its left to swap with."

**The canvas spec (`audit\CANVAS_BUILDER_SPEC.md`) is now fully shipped: phases 1–4 plus the §10 benchmark.** Left out deliberately: touch drag (owner: tablet = reading). Next canvas work would be polish only (verbose general detach path on a move; a touch pass if the owner ever wants authoring on a tablet).

**Backup refreshed 2026-08-23 ~11:15:** `C:\Claude\SIREN_backup_2026-08-23.zip` — 5,772 entries, 307.8 MB, testzip clean; holds the whole `C:\Claude\SIREN` tree (releases up to 1.62.0, tools, qa evidence, audit, antigravity) plus `live/T_Industries_SIREN_v1.html` (= 1.62.0). The older `SIREN_backup_2026-08-21.zip` (30 MB) stays as the pre-canvas point.

## PICK UP HERE — 2026-08-23 afternoon, round 4 (read this first if the session was cut)

**Live file** `C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html` = **1.62.0** (7,866,983 bytes) — untouched by round 4 so far. Board: https://claude.ai/code/artifact/f6a81e75-4aba-4094-9f3e-1e66f5710db4 (source scratchpad/siren_worklist.html, mirror C:\Claude\SIREN\siren_worklist.html).

**What round 4 is:** the owner's morning list (canvas block/note left-right; pop-out free move + upgrade; Docs right-click + export check + upgrade; Guided ↑↓× gone + interaction more fluid; central UI less scary; dismiss a diagram from its tab; "New block…" on empty-canvas right-click; preview minimap) + the three exports (PPTX editable shapes, real .docx, vector PDF — Antigravity round 3 returned nothing) + PDF Romanian diacritics (pdfEscapeText → '?'; embedded subset font). Secondary non-priority list: audit/SECONDARY_SKILLS_AND_OSS.md. All additions: pending/ROUND4_ADDITIONS.md.

**State of the machinery:**
- Rules for agents: C:\Claude\SIREN\AGENT_CONVENTIONS.md. Frozen base: pending/FROZEN_1_62_0.html.
- Scouts DONE: pending/scout-reports/*.md (8) + pending/scout-guided-ux/REPORT.md.
- Briefs: pending/briefs/<job>.md for jobs pptx, docx, pdf, popout, docs, guided, tabs, ui, canvas, minimap (PRE.md = preamble).
- Implementation workflow wf_32c9c308-44f was RUNNING when this was written (10 implementers → 2 verifiers each → fix → re-verify). It is tied to the Claude Code session: if the session died, it is gone, BUT every agent writes to disk: pending/impl-<job>/ (patch scripts *.py, evidence), pending/verify-<job>-result|regression/, pending/fix-<job>/, pending/reverify-<job>/. Inspect those folders: a job is usable when impl-<job> holds a patch script that applies to a fresh copy of the frozen base (python <script> <copy>; then tools/syncheck.py <copy> → exit 0) and a verify/reverify folder (or the agent's last message in the workflow journal C:\Users\tsinc\.claude\projects\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\subagents\workflows\wf_32c9c308-44f\journal.jsonl) shows ok. Jobs with no patch → relaunch with the same brief (Agent or a new Workflow; ports 9920-9929/9820-9829 family).
- Integration (me, serial): `python C:\Claude\SIREN\tools\integrate.py pending\FROZEN_1_62_0.html pending\INTEGRATED.html <patch1> <patch2> ...` in this order: guided, tabs, ui, popout, docs, docx, pptx, pdf_fonts, pdf_vector, canvas, minimap (UI-shared regions first so anchor collisions show early; exports after). On an anchor failure: read the failing rep() assert, re-anchor that patch against the integrated text (never skip silently). Then: serve INTEGRATED on 9877, re-run my probes (qa/canvas_1_60_0/run_p2.json, canvas_1_61_0/run_p3.json, canvas_1_62_0/run_p4.json, xs_1_59_2/run_xs*.json, board_1_59_3/run_dup.json, bench40_1_61_1/run_bench40.json — with tools/drive.mjs), look at screenshots, grep PAGE EXCEPTION; then a final "integrated regression" agent pass; then bump APP_VERSION to 1.63.0 + one CHANGELOG entry per job, copy to live, snapshot releases/SIREN_v1.63.0.html, installers → tools/, evidence → qa/round4/, RESUME + board + memory.
- If only some jobs are good: integrate the good ones (1.63.0), list the rest as open on the board. Never ship an unverified export writer.

**Owner rules in force:** no git; right-click works where you build, silent in Present; tablet = reading (no touch drag); "better tool, not sellable one"; ask the owner when something is worth a decision; Fable for judgment/integration, Opus fine for mechanical steps.

## 2026-08-23 (late afternoon) — Round 4 INTEGRATED on a copy; verification finished by me

**Live is still 1.62.0 and untouched.** The integrated build is `pending\INTEGRATED.html` (8,198,068 bytes, syncheck green).

**Integration order that applies with zero anchor collisions** (tools\integrate.py, syntax gate after each):
impl-guided\patch_guided.py · fix-tabs\patch_tabs.py · fix-ui\patch_ui_declutter_v2.py · fix-popout\patch_popout.py · fix-docs\patch_docs.py · fix-docx\patch_docx.py · fix-docx\patch_docx_settings.py · impl-pptx\patch_pptx_editable_shapes.py · impl-pdf\pdf_fonts.py · impl-pdf\pdf_vector.py · fix-canvas\patch_canvas_1_notes.py · fix-canvas\patch_canvas_2_sides_newblock.py · fix-minimap\patch_minimap.py · **my-fixes\patch_pptx_text_fixes.py** (mine, last).

**My own probes on the integrated build (scratchpad, port 9878): canvas p2/p3/p4, xs, board dup, bench40 — 0 non-harness PAGE EXCEPTION in every run.**

**My two fixes** (`pending\my-fixes\patch_pptx_text_fixes.py`), both escalated by the PPTX verifier and both measured in an exported deck (`pending\my-fixes\deck_textfix.pptx`): (a) `svgTextLines` joined leaf tspans per `text-outer-tspan row` — Mermaid emits one tspan per WORD, so "Accounts payable" exported as "Accounts" and "Not approved yet" stacked three lines; this also fixed the single-diagram PPTX and the Excel drawing. (b) `deckShapeTextBody` type floor 6pt → 1pt: a 40-block overview scaled to 1.7pt wrapped letter-by-letter over its neighbours.

**Verification status per job.** Fully verified (2 lenses, fixed where needed): guided, tabs, minimap, docs, ui, popout, docx, canvas. Partially: **pptx** (result lens found 2 defects — both now fixed by me; regression lens never ran) and **pdf** (implementer's own measurements are extensive — diacritics extracted exactly, vector pages 9% of raster size, PowerPoint/pymupdf checks — but BOTH independent verifiers died when the account ran out of usage credits). Remaining before ship: my own look at a vector PDF page + diacritics, and the Word COM open of the .docx.

**Known open points carried forward:** .docx opens in Word compatibility mode (cosmetic); PPTX edge-label patches use the slide background colour; PDF card headlines are Noto stretched to Inter's widths (owner should see p1/p2 before/after); Guided held-Delete auto-repeat chain-deletes lines.

## 2026-08-23 — v1.63.0 SHIPPED (round 4)

**Live = 1.63.0**, 8,201,093 bytes. Snapshot `releases\SIREN_v1.63.0.html`. Pre-ship copy of 1.62.0 at `backups\siren_pre_1_63_0.html`. Installers (15, in apply order) `tools\round4\`; evidence `qa\round4\`.

Apply order (this is what shipped): patch_guided · patch_tabs · patch_ui_declutter_v2 · patch_popout · patch_docs · patch_docx · patch_docx_settings · patch_pptx_editable_shapes · pdf_fonts · pdf_vector · patch_canvas_1_notes · patch_canvas_2_sides_newblock · patch_minimap · patch_pptx_text_fixes (mine) · bump_1_63_0.

**Verified by me on the built file before it shipped:** canvas p2/p3/p4, xs, board dup, bench40 — 0 non-harness PAGE EXCEPTION each; p2 re-run after the version bump. PDF: exported a Romanian deck (`qa\round4\deck_check.pdf`), pymupdf extracts "Ședință de deschidere / Țară aprobată? / Conturi de plătit" exactly, fonts SIRENA+NotoSans-Regular/-Bold, 9 pages 134,701 B = **14.6 KB/page**, rendered p2/p4 and looked (`deck_check_p2.png`, `p4.png`) — clean vector, focus ring, arrowheads; the "a"/"N" at a crop edge are the clipped halves of Da/Nu, same as the raster cut. PPTX: exported deck (`qa\round4\deck_textfix.pptx`) — `Group 1 -> ['Accounts payable']` and `Label -> ['Not approved yet']` (were `['Accounts']` and three stacked words). Guided at 40 blocks: 79 rows, **0 row buttons**, **0 overflowing rows**, row height 34→28. Minimap present on the 40-block diagram with its viewport rectangle; header down to Dark/⋯/Export (screenshots `qa\round4\smoke_1_main40.png`, `smoke_2_guided.png`).

**Open (on the board):** .docx opens in Word compatibility mode; held Delete in Guided chain-deletes (key auto-repeat); PPTX connector-label patch is the slide background colour so it shows on a subgraph fill; two things for the owner to look at (PDF headline letterforms stretched to Inter widths; PPTX true-size type on a very large diagram). Secondary list: `audit\SECONDARY_SKILLS_AND_OSS.md`.

**Never independently verified (agent credits ran out):** the PPTX regression lens and both PDF lenses — I did those myself as above. If credits return, re-running `verify:pptx:regression` and the two PDF lenses from `pending\briefs\` is the cheapest way to close the gap.

## 2026-08-23 — v1.63.1: the guided "+ Block / + Connection" bar removed

Live = **1.63.1** (8,203,117 bytes); snapshot `releases\SIREN_v1.63.1.html`; pre-ship copy `backups\siren_pre_1_63_1.html`; installers `tools\round4\patch_guided_footer.py` + `bump_1_63_1.py`; evidence `qa\round4\out_gf3.log`, `gf_full2.png`.

Owner asked whether the two footer buttons could go now that Guided has a line right-click menu. Measured first: the row menu carries "Insert block below" and "Connect from here" (shipped in 1.63.0), the hint above the lines already names that route, and the rows list is **never empty** (a blank source still renders line 1), so there is always a line to right-click — the buttons were a duplicate route holding a permanent 32px bar. Removed; `#structureCount` moved into the hint row (right-aligned); `.structure-footer` gone. All wiring was already `if (button)`-guarded, so no JS changes were needed for the removal.

One case needed care and my own probe caught it: on a **blank page** `structureAddBlock` refuses (`structureIsFlowchart()` false), so a first-timer would have had no route at all. A single quiet `.struct-first-block` line — "+ Add the first block" — renders in the rows area only when there are no blocks AND (the page is blank OR it is a flowchart); on a blank page it writes `flowchart TD` first, then adds the block. Measured: blank page → click → `flowchart TD` + `N1["New block"]` with the inline input focused and the words selected, line gone; sequenceDiagram → line absent; 40 blocks → footer absent, line absent, 79 rows, 0 row buttons, count "40 blocks · 46 connections", rows box 440px; right-click line 4 → Insert block below → line 5 `N1["New block"]` with the input focused. 0 non-harness exceptions; p2 and xs suites re-run on the shipped file.

## 2026-08-23 — harness bug: syncheck.py was checking the wrong file

Found by the round-5 gitgraph fixer, and it applied to my own work all day: `tools/syncheck.py`
hardcoded `P = <live app>` and never read `sys.argv[1]`, so every "syntax gate green" on a
working copy was really a re-check of the live file. It also wrote to one shared `_inline.js`,
so parallel agents overwrote each other's extraction. Fixed: target = argv[1] (default live),
temp file named after the target, exit code returned. Proved by injecting `function ((){` into
a copy: `node --check exit 1` with the line and the message. `tools/integrate.py` now decides
on the return code instead of searching the output for "exit 0".

What this did and did not invalidate: every version shipped today WAS genuinely checked,
because after copying to live I ran syncheck with no argument (which checked live, correctly).
What was false comfort: the per-copy checks and the per-step gate inside integrate.py during
the round-4 integration. The integrated artefact itself was checked once it reached live.

## 2026-08-23 — v1.64.0 SHIPPED (round 5, four of five jobs)

Live = **1.64.0**, 8,257,865 bytes. Snapshot `releases\SIREN_v1.64.0.html`. Pre-ship copy `backups\siren_pre_1_64_0.html`. Installers `tools\round5\` (11 patches + bump, in the apply order below); evidence `qa\round5\`.

Apply order: r5fix-popout/patch_popout_guided · patch_wrap_default · patch_popout_guided_fix · r5fix-style5/patch_a_connect · patch_b_style · r5fix-glass/patch1_glass_canvas_surfaces · patch2_glass_menu_current_row · r5fix-gitgraph/p1_gitgraph_type · p2_git_branch_colours · p3_code_only_surface · p4_gitgraph_fixes · my-fixes/bump_1_64_0.

Process: five jobs built on FROZEN_1_63_3 → one adversarial verifier each (all five found defects) → a fix pass rebased onto FROZEN_1_63_6 → a re-verifier each. Four came back ok (gitgraph, glass, style5, popout — each with only "low" nits disclosed); **docs5 is still open** (re-verifier: "Turn into → Heading" silently truncates a text block at 300 characters, and "Turn into" wipes a checklist's ticks) and a second fix pass is running against FROZEN_1_64_0.

My own integration checks on the built file: canvas p2/p3/p4, xs, board dup, bench40 — 0 non-harness PAGE EXCEPTION; Cupertino popover measured opaque (rgb(252,252,254), backdrop none); git-graph Style rows carry per-branch contrast readings; pop-out shows the Text/Guided switch inside the float with 4 guided rows and 0 row buttons; the Wrap toggle is gone. Screenshots in `qa\round5\`.

**Earlier the same day, versions 1.63.1–1.63.6** (all in `tools\round4\`): the guided "+ Block / + Connection" footer removed with a blank-page "+ Add the first block"; the tab × restricted to the active tab after it was found hiding diagrams on an ordinary click, plus a "N put away" restore menu; held-Delete no longer chain-deletes; the PPTX connector-label patch takes the colour behind it; block right-click carries "Add a step after / Insert a step before"; the side handles connect from the pressed block; Present opens with the Studio rail closed (44 controls → 6).

## 2026-08-23 (night) — v1.65.0 SHIPPED (Codex round 3 + the Docs repair + one of mine)

Live = **1.65.0**, 8,405,358 bytes, SHA-256 `D48D61736A4092D94AEFA5502E59FC78F97781D856C6A74C3B02317868785BBA`.
(The gated build was `D5FF8AB8…`; one changelog sentence was corrected after shipping - see
"the Excel line" below - and the gate was re-run on the corrected bytes.)
Snapshot `releases\SIREN_v1.65.0.html`. Pre-ship copy `backups\siren_pre_1_65_0.html`.

**Apply order from live 1.64.0** (`F6330D42…`):
1. Codex `codex\round3_rebase_patches\` — R3_B01…B06 (PDF), R3_C (Excel), R3_D1…D4 (imports),
   R3_E (storage). B01–B06 and E take `argv[1]` in place; **C and D1–D4 take `input output`**
   (argparse) — that difference is real and cost one aborted run.
   Chain ended at `CB107D5C…`, matching his published hash byte for byte.
2. `pending\r5fix2-docs5\patch_docs5_fixed.py` then `patch_docs5_fix2.py` (Docs "Turn into").
   Both applied on top of the Codex chain with **zero anchor conflicts** — his regions
   (PDF/Excel/import/`sirenStore`) and the Docs regions are disjoint.
3. `tools\round5\patch_heading_no_silent_cut.py` — mine.
4. `tools\round5\bump_1_65_0.py` — version + changelog.

**Verification actually run on the shipping file** (not on a copy of something like it):
- `tools\syncheck.py <candidate>` → 2 script blocks, 7,444,993 chars, `node --check` exit 0.
- Served on 9878; `Content-Length: 8405121` == bytes on disk.
- My six probe suites — canvas p2/p3/p4, xs, board dup, bench40 — **0 non-harness PAGE EXCEPTION**.
- Codex's Job A gate: **48/48 scenarios, 475/475 assertions, fatal false**, 31 exports validated,
  Word COM green, PowerPoint COM green. Report `codex\gate_1_65_0_final\report.json`.
- PDF measured independently on my own Romanian deck: 9 pages, **134,701 → 72,267 bytes
  (−46.4 % per page)**, subset NotoSans regular+bold, diacritics extract correctly
  ("Ședință de deschidere", "Țară aprobată?"). File `pending\my-fixes\deck_1_65.pdf`.
- The heading fix measured in the browser: `maxLength` 300 taken from the app's own sanitiser,
  five real keystrokes at the cap leave the field at 300 with a single toast, a repaint takes
  **nothing** away (300 → 300, lost 0), a 75-character paste into 20 characters of room says
  "the last 55 … did not fit", a paste that fits stays silent. Evidence
  `pending\r5fix2-docs5\out_h165.log`, screenshots `out\h165_*.png`.

**One gate failure, and why the test was wrong rather than the app.**
`R3.SURFACE.DOCS_CONTEXT.03` failed on the first full run: it expects the literal labels
"Insert a block above/below" and "Mark as purpose" in the Docs block context menu. Measured on
an Agent spec document, with and without the Docs patches:

| | rows | insert wording | role row |
|---|---|---|---|
| without the Docs repair | 7 | "＋ Insert a block above…" | present |
| with it (shipped) | 12 | "＋ A block above…" under an **INSERT** heading | present |

Nothing was lost — the menu gained Copy as Markdown, Duplicate, Turn into, Move to top/bottom
and keyboard hints, and the two inserts moved under a group heading that carries the verb.
So the expectation was stale, the same class as the CENSUS 10→9 case. Fixed by
`tools\round5\suite_docs_menu_expectation.py`, which pins the *contract* (an insert-above and
an insert-below are reachable from this menu) instead of the sentence.
`qa_round3\surface_suite_additions.js` is now SHA-256
`3D8A942C98D69C1C6BA98D27C44135D0DCC8023D132192C39F13D1B76DAFA275`
(old file kept as `.bak_1_65_0`). The runner only pins `run_regression_suite.js`, and the
mutation gate pins its own historical copy under `qa_round3_1635_runtime\`, so neither was
disturbed.

**The Excel line — I wrote something I had not opened.** The changelog first said the Excel
export is "three sheets — blocks, connections and the workspace". That came from the second
engineer's summary, not from the file. Opened in real Excel through COM, the workbook this
build exports is: **one sheet per diagram**, the diagram drawn as **native Excel shapes**
(18 in the test), and under it one native Excel table (`SIRENDiagram1`, TableStyleMedium2,
A65:AF79) with **32 columns** — Type, ID, Label, Shape, From, To, Connector, Connector label,
Risk, Control, Owner, Evidence, Status, Reference, Frequency, System, then fill/border/font/
layout. The sentence in the app now says that. Workbook kept at
`pending\my-fixes\workbook_1_65.xlsx`. Lesson worth keeping: a claim inherited from another
engineer is still my claim once I write it into the app.

**Note on boot time.** The open list says 717 ms. Navigation timing on the shipped file with a
fresh profile: firstPaint 272 ms, domContentLoaded 303 ms, load 336 ms. Those two numbers are
not measuring the same thing — do not treat boot as fixed, and re-measure with whatever
produced the 717 ms before working on it.

**Still open, in priority order** (all on the board artifact):
1. The six gates before the old visual builder's construction steps are retired.
2. One click on a block does two jobs (handles + a 14-control form over the diagram).
3. The zoom chip says "fit the whole diagram" and calls `fitToWidth`.
4. First run opens a Romanian public-finance map for a general audience.
5. Boot is 717 ms against 283 ms before Mermaid moved inside the file — and the file has
   grown again since. Worth a measurement.
6. **Codex Job F** (draggable block inspector) — the Style region it needs has landed and the
   Docs repair is merged, so it can be released now. This was the stated condition.
7. Disclosed and not fixed: the Docs block menu scrolls at 1100×620; "Document type…" opens at
   the page's left edge; the confirm button is red even when the choice loses nothing;
   `/` typed as the first character of an empty paragraph is swallowed on Escape; the
   read-only pill's × still deletes a block; the Import dialog still says "workpapers".

**House note.** Roughly seventy `python -m http.server` processes from the day's agents are
still alive. They are harmless but they hold ports; kill them before a fresh round so a new
agent does not bind a port that is already answering with somebody else's file.

## 2026-08-24 (small hours) — round 6 scouted, the disk reclaimed, two briefs out

Live is still **1.65.0** (8,405,358 bytes, `D48D6173…`). Nothing shipped since. What happened:

**The owner added six items.** Five from screenshots plus a Docs navigation rail. The list on the
board artifact is now five sections, agreed with the owner: *Working on now* (5) · *One question
first* (1) · *Ideas — not now* (3) · *Cheap, when passing* (3) · *Watching* (2). Nothing was deleted;
three items were parked because they depend on the placement question.

**Ten agents measured the new items** — five scouts, each re-measured by an adversarial verifier
(`pending
6-scout\SCOUT_FINDINGS.md`, 201 KB; raw results in the workflow journal
`wf_3ce56d6e-dcc`). Three findings changed the work:

1. **The shape strip is not cut off.** Five chips fit with 36 px to spare at every width and in all
   sixteen themes; `maxScrollLeft` is 0, so a wheel fix alone would do nothing. What is clipped in
   the screenshot is the input's placeholder. The real gap: the app knows **14** shapes
   (`NODE_SHAPES` 32340) and the canvas offers **5** (`CANVAS_CHIPS` 86342). And adding them under
   today's CSS wrecks the row — `flex:1 1 0` squeezes each chip to 15.2 px around a fixed 20 px icon.
   The three parts must land together.
2. **The map "go into the diagram" behaviour already exists**, at app.html:72568 — unreachable while
   Build is on, because that branch returns early to set a block *pick*. The pick is the only
   producer of block-framed slides (`mapCaptureView` 73588). Fix must keep both.
3. **ELK is not in the file.** Choosing it does a dynamic `import()` from cdn.jsdelivr.net
   (app.html:34563) — three requests, ~502 KB. I told the owner it ran offline with no network
   calls; **that was wrong** — my probe hooked `window.fetch`, which a module `import()` bypasses.
   Measured properly with `performance.getEntriesByType('resource')`. Consequence, now on the list:
   the same diagram lays out differently depending on connectivity.

**What Mermaid can and cannot do** (measured directly through `mermaid.render`, 11.16.1): node
declaration order does nothing; **edge** declaration order controls sibling left-right order
completely; but when branches rejoin, or an edge pins siblings to different ranks, order is ignored
entirely. `A ~~~ B` is a rank constraint, not a same-row hint. The app already exploits the working
case with ask→render→measure→roll-back and an honest refusal message.

**Two briefs are written and waiting for the owner to hand over:**
- `codex\PROMPT_CHATGPT_PRO.md` — the placement question, three routes (constrain ELK / position
  sidecar / own format), with the measured facts and the hard constraints. Deliberately *not*
  "design us a language".
- `codex\PROMPT_ROUND4.txt` + `ROUND4_BRIEF.md` — Codex jobs F, G, H, I, J on
  `FROZEN_1_65_0.html`. `ROUND4_RELEASE_F.md` carries the Job F release and my correction to their
  Excel claim.

**The disk.** C: went from 165 GB free to **276 GB** — 111 GB reclaimed. 1,500 agent browser-profile
directories deleted (1,059 under `pending`, 441 under my own `Temp\claude`), 200 agent copies of the
app, 75 pre-patch copies. 11,284 screenshots and logs **moved** to `D:\SIREN_archive`. Downloads:
22 entries (4.8 GB of installers and the owner's large CSVs) moved to `D:\Archive\Downloads`; 56 of
my own test exports deleted. Manifests in `audit\cleanup_*.txt` and `audit\cache_cleanup_*.txt`.
The live app was verified byte-identical after all of it. Browser caches were **not** touched.

**Verified backup:** `C:\Claude\SIREN_BACKUPS\SIREN_2026-08-24_0108.zip` and a second copy at
`D:\SIREN_archive\` — same SHA-256 `7588C585…`, 8,825 files, 102 MB. Opened and checked: the app
inside is byte-identical to live, all 59 releases present, manifest with hashes included.
Rebuild it with `tools\backup_snapshot.ps1` (fixed: the manifest used to hash itself and fail).

**Harness lessons, all mine, all in one night:** a `fetch` hook is blind to `import()` — use
`performance.getEntriesByType('resource')`; a probe reporting an empty app usually means my own
static server died (`curl -sI` first); Git Bash paths (`/c/...`) are not valid for Windows Python.

## 2026-08-24 — placement work PARKED by the owner

Nothing shipped. Live is still **1.65.0** (`D48D6173...`). The owner asked to hold the
fixed-placement development and read around it, possibly toward "a small pseudo-code running on
top of Mermaid" so blocks can be connected sideways the way they want.

**Where it got to, so it costs nothing to resume:**

- **The outside analysis** (ChatGPT Pro) is in `codex\PROMPT_CHATGPT_PRO.md` (the brief) and was
  answered in full. It chose **Route B - a versioned position sidecar applied after Mermaid
  renders**, and was honest about the real cost: SIREN would own connector routing. It also
  corrected two things in my brief: Route A is *not* format-free (ELK constraints still need
  per-node metadata), and "block" must be scoped - free placement is meaningless in a sequence,
  gantt or git diagram where position carries meaning.
- **The prototype settled the open question.** `prototypes\placement_bench.html`, published at
  https://claude.ai/code/artifact/afebfbbf-1775-4e78-907f-851192c28482 . Same swap, same follow-up
  edit ("add two more reviews"), two anchoring models:
  | model | after the edit |
  |---|---|
  | absolute point on the canvas | 2 overlapping blocks, 4 unroutable connectors, conflict banner |
  | offset from the layout | no conflict at all |
  The relative model also matches the app's own precedent - see below.
- **The precedent I found in the app**, which the analysis did not know about: `edgeRoutes`
  (sanitiser at app.html:21911) already persists per-connector waypoints as **relative** `{rx, ry}`
  clamped -4..5, keyed `"from|to"`, up to 8 per edge and 400 edges. `absoluteWaypoint()`
  (app.html:37032) turns them into real points **using the endpoints of the freshly rendered path**,
  and `applyRouteToPath()` (37065) rewrites the path. So *persist intent, apply after render,
  derive geometry from the render* is already shipping in this app - for edges. Node placement is
  the same pattern applied to nodes.
- **A gap in their specification, found by building it:** the natural gesture for "put B left of A"
  is dragging B *onto* A. Their rule (overlap = refuse) blocks exactly the case the feature exists
  for. The bench adds the missing rule - **drop squarely on a block = the two change places**, both
  become fixed; a partial overlap is still refused.
- **Three points to send back to ChatGPT Pro** if this restarts: the `edgeRoutes` precedent, the
  relative-vs-absolute evidence above, and the missing case - what happens to a connector that
  already carries user waypoints when one of its endpoints becomes a fixed block.

**Still live and unaffected:** Codex round 4 (jobs F, G, H, I, J) is written and waiting for the
owner to hand over - `codex\PROMPT_ROUND4.txt`, `ROUND4_BRIEF.md`, base `FROZEN_1_65_0.html`.
None of it depends on the placement decision.

## 2026-08-24 — v1.66.0 SHIPPED (Codex round 4: jobs F, G, H, I, J)

Live = **1.66.0**, 8,438,995 bytes, SHA-256
`B9D8FF0AC6D8FB5BA1AF08D3CE386FF617523D0C568509D780D9C7CE7645F208`.
Snapshot `releases\SIREN_v1.66.0.html`. Pre-ship copy `backups\siren_pre_1_66_0.html`.
New frozen base for the next round: `codex\FROZEN_1_66_0.html` (same bytes/hash).

**Apply order from 1.65.0** (`D48D6173...`), all `argv[1]` in place:
`round4_patches\R4_F_draggable_inspectors` → `R4_G_canvas_shapes` → `R4_H_map_block_navigation`
→ `R4_I_docs_heading_rail` → `R4_J_elk_online_disclosure` → `round4_followup_patchesR4_FOLLOWUP_01_docs_rail_visibility` → `tools
ound6\ump_1_66_0.py`.
Every input/output hash matched on the first run; the F–J chain ended on `31596D69...` and the
follow-up on `29011D34...`, exactly as published. `R4_FOLLOWUP_02` (their targeted runner) was
already applied in place by them - its guard refused and said so, which is how I knew.

**Verification on the exact shipped bytes:** syncheck 2 blocks / `node --check` exit 0; Job A gate
**48/48 scenarios, 475/475 assertions**; their new targeted suite **5/5 scenarios, 95/95
assertions**; my six probe suites (canvas p2/p3/p4, xs, board dup, bench40) **0 non-harness
exceptions**; live boots at 1.66.0 with 1 diagram and 0 exceptions.

**What I verified myself rather than taking on trust:**
- Shape picker: collapsed row 318/318, expanded **318/1027, maxScroll 709**, wheel moves
  scrollLeft 1 → 246 with `defaultPrevented true`, **15 chips** = the 14 `NODE_SHAPES` + SIREN's
  own `note`, placeholder now "New step or connect to a block", popover 340 px, "← Scroll →" cue.
- Docs rail: 34 px wide, 5 marks for 5 headings, full accessible names, exactly one
  `aria-current="location"`.
- ELK control: reads "ELK · online · dense diagrams", `aria-describedby="layoutEngineHint"`, hint
  names the ~500 KB jsDelivr fetch, the offline fallback and the cross-machine difference.

**Codex corrected me twice, and both times he was right** (I had told him not to trust my numbers):
1. I wrote that Docs' "Contents" is Agent-spec only. It is **generic, driven by heading count**.
   Re-measured on a plain Note in shipped 1.65.0: 1/2/3 headings → button width 0; **4 headings →
   width 89**. My original sample compared a 1-block Note with a 15-block Agent spec, so document
   type and heading count moved together - a confound, not a finding.
2. I wrote that nine shapes were missing from the canvas. It is **ten**: `NODE_SHAPES`
   (app.html:32340) has exactly 14 entries and `note` is not among them, so the old five chips were
   four Mermaid shapes plus SIREN's own Note.

**Boot time: do not trust tonight's numbers.** Three runs of the *same* build gave first paint at
852 / 952 / 2,388 ms, and 1.65.0 and 1.66.0 overlapped completely. The machine was loaded. The
watch item stands and needs one careful measurement on a quiet machine - including a re-check of
the 717 ms that started it.

**Still mine and not done:** the preview toolbar (my scout's recommendation was refuted by its own
verifier and I have not redone the analysis), the canvas hung-note deletion defect, and the Docs
revision-restore focus defect. Placement stays parked at the owner's request.

**Harness lessons from this round** (all mine, none the app's): `pw/drive.mjs` **silently ignores
step types it does not implement** - `clickjs`/`rclickjs` need `pending
6-scout\drive.mjs`; a
regex for "all shapes" does not match a control labelled "All 15 shapes"; and a static server
started with `nohup ... &` from a Bash call does not survive - start it with
`run_in_background: true` so the harness owns it.

## 2026-08-25 — v1.68.0 SHIPPED (Codex round 7 + the toolbar work + two honesty fixes)

Live = **1.68.0**, 8,552,615 bytes, `F93B2CD12E05297907D01D965D21C39683048C344FB830797849662AB3886A56`.
Snapshot `releases\SIREN_v1.68.0.html`. Backup of 1.67.0 at `backups\siren_pre_1_68_0.html`.
Twelve steps, replayed byte-exact from FROZEN_R6_BASE twice; order in
`pending
ound7\APPLY_ORDER_COMBINED.md` (steps 1-8 there, plus label-class, honesty, theme menu, ship).

**Round 7 did not pass verification as delivered.** A 13-agent adversarial pass found two things the
handback claimed as done and were not, both confirmed by me independently:

- The new type-aware Guided counter said `0 participants · 3 messages` on a sequence diagram with no
  `participant` lines — which is how most people write one — while the preview drew three people.
  Also `4 nodes · 3 links` for a mindmap whose `::icon()` line was counted as a node. A confidently
  wrong number is a regression from an obviously wrong one. Fixed in `tools\patch_r7_honesty.py`:
  participants are harvested from the messages, `::` (two colons) is a decoration not a node.
  Now 12/12 cases correct, verified with a positive control.
- The code-only chip's sentence is composed once inside `if (!chip)` behind an early return, so
  git graph → pie inside its 9s life left "export and branch colours" over a pie with no colour row.
  Fixed: one `codeOnlyHintSentence(type)`, re-applied on every call. 5/5, both directions.

Three further accusations did NOT reproduce and were deliberately not "fixed": `%%` counted as a
gantt task, `@{}` as a kanban card, a mindmap comment line. All measured already correct.

**Two bugs of my own, both found by looking at a picture rather than at numbers:**
the View menu greyed the flow rows without saying why (the app's own `#orientationHint` sentence is
now used, read not re-worded), and it painted "Horizontal" as current on a mindmap, where neither
direction applies — a two-way ternary over a three-state fact. And a third, found by the owner
rejecting my proposal to remove "Hide panel": the toolbar wrapped at 960px because I had wrapped my
labels in an invented `.btn-label` instead of `.text-label`, the class the `@container preview-pane
(max-width: 745px)` rule targets. Bar now fits one line at 1440, 1180 and 960.

**Harness bug worth remembering:** `r7_lib.js` line 84 had `/\s+/g` inside a template literal, where
the single backslash collapses and the regex becomes `/s+/` — it replaced the letter "s" with spaces
in button text and corrupted two verifiers' output. Fixed; all harnesses scanned for the same shape.

**Known and deliberately not claimed in the changelog** (all round 8 candidates):
`detectMermaidDiagramType` has no YAML frontmatter branch, so `---
title: X
---
pie` still reads
as Advanced Mermaid across the chip, the title and the context menu. A title typed as exactly a
family default is still rewritten, and Undo after a type change wipes a typed title, because title
edits never enter the undo stack — both need a real "a person touched this" flag. Swimlane/Ishikawa
identity ends at the first structural edit; the release note says what survives instead.

## 2026-08-25 (afternoon) - three rounds verified, three sent back, and the tail closed

Live is **1.69.0**. Working build sits at `pending\slotpp.html`, which is round 9 plus six
patches; round 10 is out with Codex against `codex\FROZEN_R10_BASE.html`
(`BAC0C5591C5F9CAECDCD031BE38FFE4EF6221F06C239437CDBFB7BF9BADFF9AB`).

**Not one of rounds 7, 8 or 9 passed verification as delivered.** Round 7 had two of four jobs
wrong. Round 8 turned on a Guided row that wrote a Mermaid node inside YAML front matter and counted
it. Round 9 stored a literal `&nbsp;` in every paragraph that ended in a space, so the phrase on
screen never matched a search while the string "nbsp" did. Every one was caught by driving the build
with real keyboard and mouse - none of them by reading the diff, and none by the handbacks, which
were honest and thorough and still wrong.

**The gate in 1.69.0 was mine and it was too narrow.** `index <= frontmatterEnd` stops at the closing
delimiter, so the blank line beneath it was never covered. It had been protected by accident: the old
build could not see front matter after a leading blank, called the whole document code-first, and
disabled every row for the wrong reason. Round 9 fixed the detection correctly and the unguarded row
came back with the body rows. Now `tools\patch_declaration_gate.py` reads "at or before the
declaration", which is what is actually true - nothing goes above the line that names the diagram.

**The second editor slot** now says Build, Sequence or Guided and goes where the label says. Measured
first: of twenty types the builder can edit three, sequence has its own editor, and sixteen opened a
panel announcing "Build without code" before explaining it could make none. Guided was verified as a
real destination before the change, not assumed - rows on all twenty, count equal to source lines on
every one. The app already carried the idea (`// The tab names itself after the builder it actually
opens`) with two answers available to it; the patch extends that line rather than adding a second
writer, because a first draft did the latter and lost every time.

**Themes.** `wonders` night and day shipped into the working build, from measured contrast. The star
now marks every animated theme (KPMG Blue was the only one missing it) and carries a legend plus
`content: "º6" / "animated"` - it was a pseudo-element, so a screen reader never mentioned it.
Five groups became four: "Signature" held seventeen places with weather and "Worlds" held four static
palettes, so the names were nearly swapped, and what separated them - motion - is already written on
every row. 39 themes, nothing lost, quick view still hides nothing.

**A theme lives in four places that must agree**: the visible menu, BOTH legacy selects, and
`themePresets`. Missing the selects is why the wonders palette reached the chrome, the scene, the
star and `color-scheme` while the diagram kept Dark's colours - `syncStateFromControls()` does
`state.theme = el.themePreset.value` before every render. Found only by a positive control: matrix
gave rgb(2,26,8), kpmg gave rgb(237,244,255), both new themes gave Dark's rgb(23,34,48).

**The list is staler than it looks.** The "cheap, when passing" section had four items; three were
already fixed. Earlier, eight of sixteen triaged items were already fixed or not reproducible. Re-
measure a section before handing it to anyone.

**Harness discipline, said again because it cost five false readings in one day:** a single-backslash
regex inside a JS template literal collapses, so `/\s+/` becomes `/s+/` and eats the letter s out of
your own output. It reported a legend as "move  gently" and a panel as "Add block , choo e their
 hape ". Write probe files with the Write tool, never a shell heredoc.

## Two pieces held, waiting on Codex (added 25 August)

**The theme quick menu cap.** Verified 19/19 on a copy of the shipped 1.67.0 at 1440, 960 and 375: the menu goes from 520x800 with **263px permanently below the fold at every desktop size** to 312x410 with nothing hidden. Eight rows shown, all 37 still in the DOM with ids unchanged, "More themes... (29)" at the FOOT of the list reveals the rest, a theme from behind the cap still applies, and the menu auto-expands when the active theme is one of the hidden ones. Patch: `pending	hememenu\patch_theme_menu.py` (anchor-guarded, not SHA-pinned). Verifier: `qa_exports\verify_theme_menu.js`. Report: `pending	hememenu\THEME_MENU.md`. Verified build at `pending\thememenu_verify\app.html`.

The count is **37 themes**, not the 36 the outside audit reported - confirmed independently. And the professional/artistic distinction already exists three times in the app and disagrees with itself: the group names, a `✦` glyph on **27** themes, and `AMBIENT_SCENES`/`themeIntroTimers` naming **28**. The odd one out is **KPMG Blue, which animates but carries no glyph**. Found, not fixed. Also: the `body[data-ambient-soft="on"][data-theme=...]` blur map names only 9 themes - those are *overrides on a 14px default*, not the ambient roster, which is 28. Do not use it as an inventory.

**The `wonders` theme.** Palettes done and measured, night and day; scene drafted and never run; nothing integrated. Everything, including the three findings worth not re-deriving, is in `pending\wonders\WONDERS.md`.

## Two upgrades staged, verified, NOT applied (25 August)

Both prepared on copies, at the owner's instruction to touch nothing while Codex works. If taken
together the order is Mermaid first, then ELK.

### Mermaid 11.16.1 -> 11.17.1

`tools\upgrade_mermaid_11_17_1.py` · build at `pending\mermaid1171\app.html`

The embedded bundle is 3,566,060 bytes - **41.8% of the file**. An earlier note said "about 7 MB";
that was wrong by roughly a factor of two, and is corrected in the round-6 documents. The upgrade
itself is +6,597 bytes.

Verified: 19/19 types draw with zero page errors, export gate 19/25 unchanged, disclosure probe
7/7, regression suite with identical failing assertion ids. **Only two types change output at all**
- c4 32->45 elements, block 51->59 elements and 4->7 paths - and both GAIN detail.

New tool: `qa_exports\render_matrix.js` renders all nineteen types and counts SVG elements, so two
builds can be diffed line by line. Run it on every future Mermaid bump. The syntax gate and the
regression suite can both pass while one diagram type silently renders empty; this is the only
check that would catch it.

### ELK inside the file, and no external host at all

`tools\bundle_elk.py` then `tools\embed_elk_offline.py` · build at `pending\elkoffline\app.html`
SHA-256 `1259DCECC101F7EAEBB877F6DE982D2CCDEEFE956F42346A8CC9F2CF0EDFC347`, 10,175,176 bytes (+1.64 MB)

The three-file ESM graph is bundled into one module and inlined as **inert** text
(`<script type="text/plain" id="embedded-elk">`), then imported from a Blob URL when ELK is chosen.
Inert matters: an inline module would parse 1.6 MB at every boot, for everyone, including people who
never touch ELK.

The policy goes from two permitted hosts to none:

    script-src  'self' 'unsafe-inline' blob:
    connect-src 'self' blob:

A blob: URL is not a network permission - it is built from bytes already in the file and can reach
nothing. So this is a tightening, and it closes the air-gapped item on the worklist.

Three labels are corrected in the same patch or they would have become false in the other
direction: the option said "ELK - online", the hint promised "about 500 KB from jsDelivr", and the
failure toast blamed the internet.

Verified by `qa_exports\verify_elk_offline.js` with **every external request blocked at the
browser**: ELK stays selected, zero requests attempted, no errors, and the node geometry genuinely
changes. That last one is the assertion that matters - a layout engine that loads but never runs
leaves the drawing identical, and that is indistinguishable from success unless you measure it.

### One real finding, and it was in the test suite

`BOOT.05` failed on the stricter policy. It was asserting a **literal string** -
`script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com` - so removing the
hosts failed a test written to keep the policy strict. Same shape as the suite saving a .docx under
a .doc name and then failing it for not being HTML.

Fixed by `tools\refresh_boot05_csp_contract.py`, which is **test-only** and touches no application
file. The host clause is now an allowlist: every http(s) host in the policy must be on a pinned set,
and zero hosts satisfies it most strongly. Every other property it protected is kept - default-deny,
base-uri none, form-action none, no unsafe-eval, no wildcard, inline app script permitted.

Confirmed **211/16 on both** the shipped build and the combined build, so the corrected contract
holds across the transition and still fails on a third, unpinned host. The original suite is backed
up at `codex\qa\run_regression_suite.js.bak`.

### Measured on the way, and it changes how to think about air-gapped mode

A normal boot of the shipped app makes **zero** external requests even with the network fully
available. The embedded Mermaid wins; the CDN list further down is a fallback for when the embed is
absent. So air-gapped mode is not "stop the traffic" - there is none. It is closing the permission,
which is the difference between "does not phone home" and "cannot phone home".

Staged downloads live in `pending\deps\` (mermaid 11.17.1, the three ELK files, and the bundle).
