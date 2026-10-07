# Native Docs export integration — independent correction recheck

Author: `native_menu_trace_review`, 2026-10-07. Separate from the immutable integration original, SHA256 `2c4c16db4d79c8b6773a8f19054e9a161455004370aa1bf19d7d5a07ae7ed5d4`, and formatter reports `1586e787...` / `ca6b6cd8...`. No source/test/build/workflow edits, build, GUI, full suite, merge/push or release approval.

**The keyboard cancellation finding is corrected. No remaining must-fix was identified in this bounded current integration review.** Actual renderer emission, native keyboard/default focus, minimum-size geometry, real Close/Lock sequencing, copied-package execution and hosted verdicts remain separate qualification work.

The corrected controller removes the blanket dialog Enter listener. Independent execution of the actual source in inert DOM/event adapters confirms that Enter targeted at Cancel, the format selector or Confirm is not intercepted and does not itself send IPC. Pointer Cancel closes without IPC; explicit Confirm still submits. This proves removal of the wrong override; browser-native Enter activation itself is not emulated or claimed. The real Ctrl+Shift+E handler opens the picker and retains the dirty/saved-only disclosure.

Six independent controlled integration case groups passed, with eight source/test hashes unchanged:

- Actual UI controller submits only format and expected saved version/hash, hides/joins a pending export during prepare, and ignores a late valid receipt after pause/resume rather than restoring Show file.
- The exact actual main IPC boundary tracks its returned promise in `writes`, removes it after refusal settlement, and rejects all eight PIN/selection/view/barrier/account/native-shell fences before invoking the service.
- The exact actual main barrier-owner boundary pauses/drains/resumes the Docs exporter. A held Docs drain prevents completion; non-idle state prevents capture/validation of quiescence. Actual retirement prefix rejects `DOCS_EXPORT_NOT_IDLE` before proceeding to view destruction.
- The actual preload exposes only finite export/reveal on the dedicated channel. Invoking export during its genuine preparation callback supplies no private flush ticket or extra argument.
- Both actual UI source files parse as JavaScript. Static builder flow includes the controller before the consuming Docs view and computes the existing Docs CSP hash from the assembled script. This is source/syntax evidence only, not a build or emitted hash verification.

Two additional independent cases coupled the **actual `SirenNativeDocsDraft` and actual export controller** through the production `getContext:()=>draft.getStatus()` relationship. After real `setContent` makes title/body dirty, export still sends the original saved version/hash. On both a valid saved export receipt and a CAS refusal, the actual local draft remains byte-for-byte the same JSON value, remains dirty, sends no body/dirty text and makes zero save calls. A valid receipt shows Show file; a refused receipt does not. This verifies controller/draft semantics under controlled bridge receipts, not the full real Docs renderer.

Source review confirms that main Close prepares then joins tracked writes, the all-window barrier includes Docs export idle/drain and cleanup uncertainty remains fenced. Working-view closure uses the existing barrier; readonly closure revokes registry authority checked by the service. UI prepare closes/joins export before existing draft flush; reset/disposal clear cached receipt state. New controls use existing light/dark dialog styling, native select/buttons and the existing hashed script admission; no new external URL, inline event attribute or renderer path is introduced. Actual geometry/theme/CSP behavior still requires emitted-artifact/native proof.

## Immutable independent evidence

- Original Cancel-on-Enter result: `evidence/docs-export-integration-independent-2026-10-07/cancel-enter-original-result.json`, SHA256 `b92dfbde038751d44b28870288b289e48a0d1c567026ccba83c3f6b48d1247ed`; driver `cancel-enter-probe.mjs`, SHA256 `c046bd90143618312b7a2dee545b5e94e7c453736fa3e3fef09efdec5dad4186`. Original view snapshot retained beside it.
- Current integration result: `evidence/docs-export-integration-independent-2026-10-07/corrected-integration-result.json`, SHA256 `0263bd1cb99afb252e65945c47ab65cbae84a85ac62f8dc22d8bcf5ab54c2284`; driver `corrected-integration-probe.mjs`, SHA256 `e613737c65a5af59493af2bb2317695fece2fb4fc08df4140da106604a2f0cf2`.
- Actual draft/controller result: `evidence/docs-export-integration-independent-2026-10-07/actual-dirty-draft-result.json`, SHA256 `9a662373402ad3bf3590c5f1a5c59a6f95a0ae149d6e33177debed18d4b65249`; driver `actual-dirty-draft-probe.mjs`. All three recorded input hashes unchanged.

| Current reviewed input | SHA256 |
| --- | --- |
| `src/ui/docs/export.js` | `13bf24c94fd0727bf7defabb4e78eca660d72d155771ded16ad26421c52d0ada` |
| `src/ui/docs/draft.js` | `4743688a62dd9615f72e6f7551d2a9198680150f933096e48a324001d8ea4c7f` |
| `src/ui/windows/docs.js` | `5de401ccc609efb70928c3c5d89bcf85544106fb33cd77531a43200274f15c55` |
| `src/windows/preload.cjs` | `23c4a4c6aa4d8cb6d0ca0854cd10824b2ca90a6ab263f14e4caf97be072862d2` |
| `src/main.mjs` | `e3fe14b8ebbd86ce969268bac459779a20f8165745bc65dbb8e763576a8367b2` |
| `build/windows.mjs` | `bc19ab270e5e5da412feddad72296937408457f017233b7a78f041359fedc8f3` |
| `tests/docs-export-view.test.mjs` | `008568a57fb7ddb5a22ff3935160e6f848886a06588cfd9455c4202e00c8edf1` |
| `tests/docs-export-main.test.mjs` | `2813d028b706e4b0da66b01296082d7f8176ba08565e27bc615da7719cd50021` |
| `tests/docs-export-preload.test.mjs` | `1f60529f873c3231085a6996884282f604133913ce0b78144d6a285d4dc166ea` |

The original adverse reports and results remain adverse and unchanged. This later bounded recheck does not retroactively turn them into passes or close unrelated hosted failures.
