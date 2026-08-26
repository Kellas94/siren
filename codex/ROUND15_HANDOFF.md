# SIREN Round 15 — handback

## Outcome

Round 15 is delivered as six exact-count, SHA-pinned atomic patch scripts. Replaying them in the published order against the frozen base produces:

- final bytes: `8,603,633`
- final SHA-256: `1D263A698E07016A8BC2EA7A7142952213E02454C8758B4F078FA3EAB4B162DD`
- independent replay SHA-256: `1D263A698E07016A8BC2EA7A7142952213E02454C8758B4F078FA3EAB4B162DD`

The frozen input remained byte-identical. `APP_VERSION` (`1.70.0`), CSP and the complete `CHANGELOG` block are byte-identical to the base.

Patch order and all script/input/output hashes are in `round15_patches/APPLY_ORDER.md`.

## What landed

### BO — marker repeat events no longer activate Docs underneath

The marker still opens its document immediately. For the following ~400 ms, the Docs surface consumes only repeat pointer/mouse/click events whose `detail >= 2`, then removes every capture listener. It does not delay the first click and does not introduce a persistent state object.

The pre-committed one-attempt exit rule resolved in favour of keeping the shortcut. The real-app probe passed `44/44` assertions across flowchart TD, stateDiagram-v2, classDiagram and flowchart LR with a subgraph. The marker was physically aligned over Docs Undo; no `Undone.` toast appeared, `KEEPBO-2026` remained in rendered and stored content after close/reopen, and single click, Ctrl-click, right-click and body double-click controls still worked. Measured single-click opening was 30–36 ms.

### BP — reference arrival synchronizes selection, focus and write target

Arrival now selects the referenced block in Build, restores the canvas ring/handles and places real keyboard focus on the referenced SVG group. A pending 420 ms auto-render is consumed before landing, so a reference clicked immediately after creation cannot replace the focused group and drop focus to `<body>`.

Uncommitted labels are keyed by diagram id and block id. A dirty PAY label survives the jump in memory, the arrival form truthfully displays SIGN, and reselecting PAY restores the exact draft. Updating then changes PAY only; SIGN remains unchanged. The clean route writes `SIGN[RENAMED HERE]` and leaves START untouched.

This is a deliberate correction to the literal brief wording. The brief asked for `UNSAVED WORK 2026` to remain visibly inside the shared label field while the selector names SIGN. That pairing makes the form lie and lets **Update block** apply PAY's text to SIGN. I did not ship that corruption path. The draft is retained without loss and becomes visible again when its owner, PAY, is selected.

### BQ — invisible targets are editable and explained

Reference arrival still opens the inspector; there is no refusal or new gate. When Preview is hidden, the rendered target is 0×0, or a filter hides it, a neutral message says:

> Block ID is open for editing, but the block is not currently visible in Preview.

Visible and oversized targets do not receive a false warning. The contract passed `15/15`; the frozen-base control failed exactly the two missing-message cases.

### BR — Tab indents selected source by whole lines

Tab over a selection now mirrors the existing Shift+Tab model: it indents every selected line, handles a selection ending exactly at the next line boundary, preserves blank/final lines and retains all selected text. One SIREN Undo restores the exact prior source.

### Welcome-tour reachability

The fixed-position tour card is inserted as the body's first child rather than its last. It is the first sequentially focusable surface, its measured rectangle is unchanged, and it does not steal focus.

### Marker-corner decision

The resolver comment now states the actual contract: the marker is a single-purpose open-document control; modifier/right-click gestures can resolve the block underneath; drag and double-click rename belong to the block body.

## Verification on the final bytes

| Gate | Result | Evidence SHA-256 |
|---|---:|---|
| BO real-app matrix | `44/44` | `C7EC49450F87D10EED5F2DFB27E36A2A1A225F002E00B7D6754BFF9B743FF0DC` |
| BP real-app contract | `13/13` | `329CC20752DDD40D8812F9FBDF9D91FCEA46F9A58AAB766A9017FE4B5BEB4BFC` (combined BP/BQ report) |
| BQ contract | `15/15` | `AA20AFA7B7D988CE63D62A59C62F742B0F60E366DD434ACAA90277E8B030BEE7` |
| BR + tour contract | `27/27` | `BA50978A267C57F6CEF67A774210E6DA34BA9D83AD35FFC3AF07DB559EF311D6` |
| Static/protected-surface gate | `16/16` | `BCC07FEFE6827ED718648412A980668D14BA7AAF42B819C0D6478CCED5123DFD` |
| Job A broad suite | `43/48` scenarios, `427/439` assertions, `fatal: false` | `7C66CE090879D1B5FF6B2CF6BCEC9B655F2838ECB179FF1C06083620D03DEEA1` |

Both inline scripts pass `node --check`; the project's A11 checker also reports two script blocks and exit 0. Job A validated 16 exported files with no ZIP CRC, XML, relationship, OOXML, PNG, PDF or text-contract errors. Its pre/post application hashes are identical.

The final BP screenshot, filtered-target BQ screenshot and tour-card screenshot were rendered from the final SHA and visually inspected. They show the referenced selection and canvas block agreeing, the neutral BQ explanation readable beside the open inspector, and the tour card in its unchanged on-screen position.

Positive controls were non-vacuous:

- BP fixed-contract assertions: frozen base `1/13`, final `13/13`.
- BQ: frozen base `13/15`, final `15/15`.
- BR/tour: frozen base `13/27`, final `27/27`.

All six patch scripts pass `node --check`. Each was run against a wrong-SHA input, exited non-zero before writing, and left its target unchanged. A fresh six-script replay from the frozen base is byte-identical to the separately verified work artefact.

## Job A findings that are not Round 15 regressions

The final build has the exact same twelve failing assertion ids as the frozen-base control:

- `R2.ITEM3.NARROW.02–07` and `.11`: the suite still measures hidden desktop Comments/Review buttons directly at 375 px and carries one old canvas-shortcut contract. The intentional mobile More route is what the current UI exposes; Compare's pointer and keyboard route passes.
- `EXPORT.MAIN.01`: the harness directly clicks hidden `#styleShortcutButton`; the grouped toolbar now exposes Style through Inspect.
- `R3.EXPORT.DOCX.09` and `R3.EXPORT.PPTX.11`: Office COM returns environmental HRESULT `0x80070520` in this isolated session. Package/XML/editability checks pass before COM is attempted.
- `R3.SURFACE.CENSUS.01–02`: stale layout expectations say header 4 / preview head 3; both frozen base and final measure header 5 / preview head 0.

These are suite-route/environment baselines, not changes caused by this patch chain. I did not widen Round 15 to rewrite them.

## Anchor drift

None. Every brief-supplied anchor matched exactly once on `FROZEN_R15_BASE.html`; no anchor was loosened or moved. BP gained three new exact-count anchors only after the real-browser focus probe exposed the pending-render race.

## Deliberately not done or claimed

- I did **not** leave PAY's dirty text visibly under a selector naming SIGN; the safe keyed-draft behaviour and the reason for the deviation are stated above.
- I did **not** edit the v1.59.1 release note. It lives inside `const CHANGELOG`, while the method explicitly protects the complete block. The release-time correction should be: `F2 or a double-click on the block body renames in place.`
- I did not touch `APP_VERSION`, CSP or any other `CHANGELOG` entry.
- I did not start Round 16 ELK work or the separate Round 12 rework.
- I proved one press of SIREN's Undo for BR; I did not claim native browser-textarea Ctrl+Z parity.
- BO is measured for the requested ~400 ms repeat window. I did not claim protection from an operating-system double-click interval longer than that window.
- Targeted visual and Job A verification used Chromium. This handback does not claim a fresh Firefox/WebKit pass.
- The verified HTML under `round15_work` is evidence only; the deliverable is the patch chain, not a merged application file.

## Files

- Patch chain: `C:\Claude\SIREN\codex\round15_patches\`
- Apply order: `C:\Claude\SIREN\codex\round15_patches\APPLY_ORDER.md`
- Machine-readable verification summary: `C:\Claude\SIREN\codex\round15_work\final_evidence_v2\summary.json` (`6AFB3742CCF7792B51E051DDAB5167CBC50BB6ADAEDFE72B1A5B3BA80AF814D6`)
- Job A report: `C:\Claude\SIREN\codex\round15_work\final_evidence_v2\job_a\report.json`
- Targeted evidence: `C:\Claude\SIREN\codex\round15_work\final_evidence_v2\`
