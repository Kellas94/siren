# Diagram History and Typography: final native development observation

Author of harness and this report; actual native executor and screenshot inspector: `/root/media_batch_review`. Date: 2026-10-07. This is scoped actual development runtime evidence. I did not implement the product batch or its CSP repair. This report is not release, hosted, copied-package or full-suite approval.

## Final receipt and exact inputs

Final unchanged tracked harness: `tests/native/diagram-history-typography.mjs`, SHA256 `d1beb7d0e4b3a03a459bd715a5e85828d2a2446e63b7e3d2a27941ebf3447da4`.

Actual receipt: `evidence/diagram-history-typography-native/2026-10-07T00-24-52.032Z/result.json`, SHA256 `b564b7ccfa9429d46b6601f14827492839cb247431df1f7ddf98b84ab0583d00`. Result: COMPLETE, eight cases, changedInputs[]. UTC 00:24:52.033–00:25:13.245 (21.212 seconds); controller exit 0. Owned Electron PID 41352 was closed by the harness and was no longer present at my post-run inspection. Execution used the approved normal Windows token; Electron sandbox remained enabled. Only owned isolated data was used, not the installed app or user's profile.

The receipt hashes all source/build/generated/test/baseline inputs and package files plus the Electron executable before and after. Selected actual identities:

| Input | SHA256 |
| --- | --- |
| generated/windows/diagram.html | 1a8e1f0dcb95f2ddb5e5641e6e50508351e42abb656465c27f7ff686a7284b17 |
| build/diagram-window.mjs | 5ccdce1ad24321c1554b68508899d26c9afb03835f587c2b4a58bf173d94a633 |
| src/main.mjs | 5fea6af52afdb4398b536b82cda4316596e5e43a7240bbe64a241b984155c07e |
| src/ui/diagram/draft.js | 57c87befd6724b9d104f2ab12a3b3bc78329b8c444e26a3c1dbad86cac933de3 |
| src/ui/diagram/history-view.js | a112417b7c6c10f6117db36b709f12d600756cc1eff1b07bb7074b7b2bc283eb |
| src/ui/diagram/style-view.js | c2c223896417f18c2b569c6d857bd6836f868f1bbf23cd895dd01c93b473b6c5 |
| src/ui/diagram/style.js | c8e6c2c2bb598e513e844ac526113efa1fa639a3ca84ba663895a09b243d04e4 |
| node_modules/electron/dist/electron.exe | 49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa |

The bounded schema-2 fixture contains two diagrams and exact source-backed metadata, including a 42-byte BOM/CRLF Python source with Unicode and provenance, private presentation fields, and opaque fields. Source SHA256 `00e7f5463842a38481c4f2676063b202025ae794cdaaf1e33c5aea6fb13e96bb`. Native input was genuine CDP pointer/key dispatch and Input.insertText. There were no fake product handlers, DOM value setters, persistence/crypto adapters or relaxed wait deadlines. Executor metadata is a declared finite controlled-test field, not an authentication mechanism.

## Actual eight-case scope

1. Real readonly history controls refuse editing; two trusted Text chunks coalesce (42 ms) and actual Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y restore exact local source without persistence.
2. Build label edits Undo/Redo correctly, and actual global/block Style controls apply title and typography without implicit Save. Imported source fonts/colours retain precedence; other node colours remain unchanged.
3. Incomplete Add/Connect and invalid block-size input survive refused toolbar/history/target changes. Escape cancels the invalid field without saving it.
4. Actual Attach/Detach preserves the same renderer DOM controls, performance time origin, source/history and unsaved state.
5. Acknowledged Save then Undo+Save uses the current version/CAS/hash and preserves full workspace, source pointers/bytes/provenance, private presentation and opaque fields.
6. Explicit block inheritance removes only local font keys while preserving colour keys. Oldest-state history jump followed by current Save restores true absence of global optional font/title keys.
7. A second real working diagram preserves source-declared global-font protection and independent local Text history without changing the primary history or saved workspace.
8. Ordinary common Lock saves both distinct dirty owners, retires all Diagram targets and preserves exact full metadata, original source bytes and a verified saved checkpoint.

Computed actual SVG text styles were A: `Georgia`, `22px`, `700`; B: `"Courier New", Courier, monospace`, `24px`, `800`. A's styles came from imported Mermaid; B's from selected local block typography. The full graph and storage assertions, not just UI status, passed. Four explicit primary saves reached versions 2 through 5; ordinary Lock then saved primary version 6 and peer version 2, with the expected project revision increase.

## Preserved adverse → diagnostic → final chain

All earlier results and reports remain unchanged:

| Evidence | Genuine scope / result | SHA256 |
| --- | --- | --- |
| original 00-14-55.829Z native receipt | ADVERSE0; controller blocked before startup by exact inline-script CSP CRLF normalization mismatch | 7e1cfdc63f453b66b572989eb1f075342a2662e3b3d23739f91706114efb24d2 |
| passive CSP diagnostic 00-16-50.990Z | ADVERSE0; actual saved read succeeds, native security error and parsed HTML hash prove blockage | 7b76a4548d55af63530c118597fd19fd4f77374a2d0b00052b4acaf5037b49d1 |
| original harness on corrected build 00-20-29.149Z | ADVERSE1; font selector Georgia instead of Verdana because helper counted disabled Theme default | a9bda87ae1aa04948df5f5667d75cfdf3178fe25bb4cc5eb58b3ca44a4e533d0 |
| ignored enabled-option diagnostic 00-21-59.527Z | COMPLETE8, same scenarios/oracles/deadlines, unchanged product inputs | ec6bf73c87965ae97e026dd9f672a3c10bc53b96dc0155c92a6411d17bccf350 |
| tracked enabled-option harness 00-24-05.206Z | COMPLETE8, harness 22fab488…, unchanged captured inputs | 7a551c9a76fd0991c6d173841ea73eed35d73d1034e0746a7fcf71fa7f6bb828 |
| finite executor-metadata corrected final 00-24-52.032Z | COMPLETE8, final harness d1beb7d0…, unchanged captured inputs | b564b7ccfa9429d46b6601f14827492839cb247431df1f7ddf98b84ab0583d00 |

The only scenario-affecting tracked harness correction filters disabled options before choosing a genuine native select position. The other correction declares actual executor from the finite GitHub/root/media execution contexts. Original source snapshots are retained with the original receipts. Neither is a product fix or an oracle relaxation. The CSP product repair was authored separately by root; this report observes the corrected runtime, without claiming authorship of that repair.

Immutable earlier authored reports are `reviews/2026-10-07-diagram-history-typography-native-original-adverse.md` (f0942cf1…), `reviews/2026-10-07-diagram-history-typography-native-csp-diagnostic.md` (ebfb4173…), and `reviews/2026-10-07-diagram-history-typography-native-select-observation.md` (70c939ce…).

## Visual observation and limits

I personally inspected both final screenshots: `history-attached-kpmg.png` and `history-typography-before-lock.png` alongside the receipt. The attached KPMG surface has shared toolbar controls, compact two-row typography controls, history popover and visibly different styled nodes. The narrower detached surface wraps controls into more rows; short number inputs clip Theme default/Inherit placeholders. An open history popover overlays part of the source/style area. The attached screenshot retains the earlier deliberately invalid-edit refusal status after cancellation, although all subsequent state/save assertions succeeded. These visual observations remain potential polish work and are not a broad UI/UX approval.

The fixture tests bounded functional correctness. It does not test 60-step/8-MiB limits, IME, arbitrary diagram grammar, concurrent edits to the same diagram, maximum source size, performance ceilings, all themes, physical multiple monitors, power-loss recovery or deterministic pending-Lock export races. The harness supports a genuine --package context, but I did not execute that path for this report. I did not run or qualify root's full suite or hosted workflows, and no later success explains/closes historical CI375341 timeout evidence.