# SIREN Round 12 handback

## Delivery identity

- Authoring base: `FROZEN_R11_BASE.html`
- Base bytes: `8,591,186`
- Base SHA-256: `2F2DA0BDA18427E3262EB97D06401723183D1938A09083654C64AFE791223030`
- Final clean-replay application bytes: `8,599,488`
- Final clean-replay application SHA-256: `101E2ACE553B7AEB44CDC1FF6C9E02042CDAC7F7038741CD8D3BCDFB5322FD61`
- Application patch order: BB, then BC. BD is a separate test-only multi-file transaction and changes zero application bytes.
- Exact commands and every input/output identity are in `round12_patches/APPLY_ORDER.md`.

The frozen base was not edited. `round12_work/SIREN_R12_FINAL_REPLAY.html` is a private verification artefact, not a merged or release application.

## BB — no external requests

### What landed

- Removed the unused `unpkg.com` grant from the baseline CSP and the unused Mermaid fallback candidate. The jsDelivr grant remains because the optional ELK feature uses it.
- Added an early, parser-time network-mode bootstrap. When the visible setting is on, a second CSP intersects the baseline policy before later resources load and removes every external host grant while retaining `'self'`, inline app code, local styles, data/blob images and local workers.
- Added a visible status chip and a Style control. The default remains today's behaviour: `External requests permitted`. Turning the mode on safely saves, records the preference and reloads; a query-string fallback is used if localStorage cannot retain the preference.
- In strict mode, a remembered ELK selection is normalised to Standard before controls and first render. Selecting ELK then produces an honest refusal, returns the selector to Standard and preserves the existing diagram.
- Preserved `./mermaid.min.js` exactly, prefers it in strict mode, and left the embedded full Mermaid renderer untouched.

### Measured evidence

- Dedicated real-UI BB probe: `26/26` assertions, no unexpected page or console errors. Its unpatched-base control fails before the BB controls exist.
- Default/off: embedded Mermaid renders with zero external responses. Selecting ELK makes three jsDelivr GETs (main module plus two chunks), all `200`; unpkg receives none.
- On after the visible control reloads the app: one strict CSP is present, the chip reads `No external requests · Full local renderer`, and an ELK selection raises a real `securitypolicyviolation` for jsDelivr. It receives zero external responses, returns visibly to Standard, shows the explicit refusal and leaves the rendered SVG hash unchanged.
- Off again after another visible-control reload: the strict CSP is absent and ELK again loads the same three jsDelivr resources successfully.
- Local sibling sideways case: a scratch HTTP response with only the embedded renderer removed loaded the real `mermaid.min.js` placed beside the final HTML. The app issued one local HEAD and one local GET, both `200`, remembered the success, exposed the full renderer, and received zero external responses under strict mode. The hash-pinned application file on disk was not changed.
- I opened and inspected the three BB screenshots. The on/off chip, checkbox, explanatory text and refusal toast are fully visible at 1600×1000 without overlap or clipping; the diagram remains visible during refusal.

Evidence:

- `qa_round12/r12_bb_probe.js` — SHA-256 `494E1C8356223E854F5C17F81D284ED79662B2B7D4B0320A751F7473A2B7B950`
- `qa_round12/bb_work_probe3/report.json` — `26/26`, SHA-256 `8BC28614D3F2A1633822A9D281B101EED789FFEFF9D05A524D5FEA352BD8BAB9`
- `qa_round12/r12_bb_local_fallback_probe.js` — SHA-256 `1D8D8518476AC646FD282AAB5594BBE3920D21120B321B6159DF2BB88347CE42`
- `round12_work/bb_local_fallback/report.json` — local sibling positive control, SHA-256 `E1F5634A94A3539E9005D654ED8E924254A83D42AE00C804646E3EFCA729F130`

## BC — confirmation colour tells the truth

### What landed

- `requestConfirmation` now accepts `destructive`, with the safe default `true`. A future unclassified call therefore remains loud rather than silently becoming neutral.
- Every actual caller is explicit: 12 always-destructive, 32 non-destructive/undoable, and one conditional. The conditional Compare merge is neutral only when the active diagram owns the real snapshot/Undo path; writing into an inactive target stays destructive.
- Added one presentation reset for danger class, Cancel visibility, notice mode and message whitespace. It runs before every confirmation, before every notice, on the app close path and on the native dialog `close` event. A notice dismissed with Escape can no longer leak its one-button/pre-line/neutral state into the next confirmation.

The brief's `46 callers` is an occurrence count, not a caller count: the frozen file contains 46 occurrences of `requestConfirmation(`, comprising 45 callers plus the function definition. All 45 callers are classified; the definition carries the default.

### Measured evidence

- Dedicated base-vs-final UI probe: 8 scenarios and `113/113` assertions, no page errors, no console errors, `fatal: false`.
- `Start blank`, `Delete folder`, structural `Delete line`, and active-target merge use the neutral primary button (`rgb(37, 99, 235)` with white text).
- `Remove diagram` and inactive-target merge retain the danger treatment (`rgba(239, 68, 68, 0.12)` / `rgb(252, 165, 165)`).
- On the base, notice → Escape → Start blank reproduces the leak: Cancel remains hidden, pre-line remains and the next choice inherits neutral presentation by accident. On the final build, both notice-button close and native Escape reset the next neutral choice correctly, and a following destructive choice returns to danger.
- I opened and compared the base/final, destructive, notice/Escape and conditional-merge screenshots. The semantic colour change is visible, the neutral and danger treatments are distinct, and the dialog layout does not move.

Evidence:

- `qa_round12/r12_bc_probe.js` — SHA-256 `59705DA3D345D4EB0CE85F9E791AE776B1A37EA9BD1787F5FFE26F1DE4C83367`
- `qa_round12/r12_bc_final/report.json` — `113/113`, SHA-256 `0DF60F60212FA86B4775510EA597B3F1B35CE18F3981F12CAB5689889E68CD74`

## BD — shared gate repair, zero application bytes

### What landed

- Replaced the six narrow-screen assertions aimed at hidden desktop buttons with the real 375px Mobile More route. The gate now proves pointer and keyboard reachability plus the ordered Review, Comments, Compare contract.
- `EXPORT.MAIN` now opens Style and Review through the visible Inspect menu before exercising every export route.
- Replaced brittle exact census totals with named required controls, per-region minimums and a live-diagram-tab contract. A legitimate additional labelled control is measured and allowed; hiding required Inspect fails.
- The upstream Word export asks for `.docx`. The upstream validator opens `.docx` as OOXML and requires `word/document.xml` and `word/styles.xml`; it also recognises the short-lived legacy case where genuine DOCX bytes carried a `.doc` suffix. A generic ZIP or PPTX renamed `.docx` fails.
- Added structured environmental skips. Only recognised Office COM activation failures are skipped with their HRESULT and reason; OOXML/package assertions still run and any other COM failure still fails the scenario.
- Updated the syntax contract from two script blocks to three because BB intentionally adds the early network-mode bootstrap. Node syntax must still pass.
- Updated the boot CSP contract to the single retained online host.

The repository has two gate trees. The actively executed `codex/qa_round3` path already downloaded `.docx` and had a real DOCX validator. The stale `.doc`/HTML route from the brief exists in upstream `qa`; BD repairs it there and repairs the active gate's other stale contracts. The separate `codex/qa` historical copy is not the owner's named upstream target and was not modified.

### Positive control and final result

- Before BD, the selected shared-gate slice was 3 passed / 5 failed scenarios and 55 passed / 11 failed assertions. It reproduced the obsolete narrow route, hidden Style timeout, exact census failure and the two `0x80070520` COM failures.
- The final complete Job A run on the clean BB→BC replay is `48/48` scenarios and `469/469` assertions, `fatal: false`; all 31 generated exports validate. The application SHA is identical before and after the suite.
- Two checks are explicitly skipped: Word COM and PowerPoint COM, both because this isolated logon session returns `0x80070520`. Their OOXML assertions passed.
- Dedicated BD contract/mutation probe is `25/25`: valid DOCX passes; legacy `.doc` OOXML passes as DOCX; non-Word ZIP renamed `.docx` fails; pristine census passes; hidden Inspect fails by name; an additional labelled control is observed and allowed.
- I inspected the 375px render and the open More menu. The toolbar remains within the viewport and the Review, Comments and Compare rows are visible in order; the app's mobile menu semantics issue noted below remains deliberately unpatched.

Evidence:

- `round12_work/job_a_final_v2/report.json` — `48/48`, `469/469`, SHA-256 `7B5CF2494E7C5140A2B4987F990C81907C751F560B40C13FAE5F0AA1DD53C8DB`
- `qa_round12/r12_bd_contract_probe.js` — SHA-256 `0E8C77A91E0420B7F32BB32E1A34B214F1C75D3A6586D165E4352D1F37A7E744`
- `round12_work/bd_final_root_v2/codex/qa_round12_contract_probe_final_v2/report.json` — `25/25`, SHA-256 `AF346431CE22C8AF0E36DA8093F898FF13397BD7EADB9582D33B310139492836`

## Anchor accounting

- No application anchor from the frozen 1.70.0 input drifted. BB and BC replayed from the stated base and produced their pinned hashes.
- During BB authoring, the status-chip anchor was tightened to the exact inline `inkChip` → `diagramTypeChip` fragment because neighbouring chips share one physical source line. This was an exact-snippet correction before write, not a loosened guard or a changed region.
- The `requestConfirmation(` count required no anchor move, but its interpretation changed: 46 occurrences are 45 callers plus one definition.
- The gate files use CRLF while the application uses LF. BD normalises each multiline literal to the target file's existing EOL before exact-count comparison; every start/end or replacement anchor must still occur exactly once.
- After the first full-app smoke, the gate's `script blocks: 2` expectation had to move to the Round 12 contract of three because BB's parser-time CSP bootstrap is an intentional third script. Both the transformed core SHA and wrapper SHA were re-pinned.
- The first mobile test locator assumed `role=menu`; the real Mobile More surface is emitted as an unmanaged `.struct-menu` with listbox/option semantics. The test now drives the actual surface with pointer and Tab without blessing that semantic mismatch.

## Additional confirmed findings not fixed here

1. Crash recovery and portable-project Open say the current *workspace* is saved in restore points, then call `saveVersionSnapshot`, which snapshots only the active diagram before replacing the workspace. Their red classification is correct, but the copy over-promises recovery.
2. Compare merge says the target diagram's source is saved first. When the target is inactive, the implementation snapshots the active diagram and writes the inactive target. BC therefore marks that branch destructive; it does not make the false restore-point sentence true.
3. Mobile More contains actions but exposes listbox/option semantics rather than menu/menuitem semantics. Pointer and keyboard operation passed; the screen-reader role remains an application accessibility issue.

These are application findings outside the narrow BC colour contract and the zero-app-byte BD contract. They are reported rather than folded into unrelated patches.

## Verification and atomicity

- BB and BC clean replay: final application SHA `101E2ACE553B7AEB44CDC1FF6C9E02042CDAC7F7038741CD8D3BCDFB5322FD61`.
- Final pinned BD script clean replay: all five output hashes match `APPLY_ORDER.md`.
- Wrong-input checks: BB on the final app, BC on the unpatched base, and BD on its already-patched five-file tree all exit non-zero before write; every before/after hash is identical.
- `node --check` passes for all three patch scripts, all dedicated probe scripts and all three transformed JavaScript gate files.
- The transformed Python validator compiles.
- `syncheck.py` reports three script blocks and Node syntax exit 0 for the final application.
- `APP_VERSION` remains exactly `1.70.0`. The complete 35,373-character `CHANGELOG` slice is byte-identical to the base. CSP changes occur only in BB, where they are the subject of the job.

## Deliberately not done or claimed

- I did not edit `FROZEN_R11_BASE.html`, the owner's live file, `APP_VERSION` or `CHANGELOG`; I did not merge or cut a release.
- I did not touch round 11's parallel regions: tour, Docs list/reference chips, SVG document marker, pan handler or workpapers-open call.
- I did not remove jsDelivr. ELK remains an opt-in online feature when external requests are permitted.
- I did not attempt to stop a person deliberately navigating an external hyperlink. The strict policy prevents app-initiated external resource/connect loads; a top-level user navigation is a different browser action. No protected Map link was changed.
- I did not run the BB/BC probes or the complete Job A suite in Firefox or WebKit. The acceptance evidence is Chromium.
- I did not prove Office COM in this isolated session. Word and PowerPoint each returned the known environmental HRESULT `0x80070520`; their package-level contracts passed.
- I did not drive all 45 confirmation callers through UI. Every caller is explicitly classified in source; the UI probe covers named neutral/destructive samples, two sideways delete cases, both conditional merge branches and both notice interleavings.
- I did not test the local sibling renderer through direct `file://`; the positive control used the real application and real sibling script over localhost, with the embedded renderer removed only from the scratch HTTP response.
- I did not fix the three additional findings above.
- I did not rebase these patches onto the eventual round 11 output. The Round 12 brief says to expect that rebase; no post-round-11 frozen input/hash was supplied in this task.
- The final gate still records its four pre-existing coverage gaps: the separate Round 5 note-deletion matrix, protected presenter/ambient export surfaces, forced out-of-order A09 drift rehash, and the full Firefox/WebKit matrix. None is reported as covered here.
