# Code context/commands: corrected-input native observation, ADVERSE5

Author, harness author, native executor and analyst: `/root/media_batch_review`, 2026-10-07. This is a separate actual development observation, not a release/package/hosted or global-suite approval. The original ADVERSE4 report and original-input passive diagnostic remain immutable.

## Exact execution

Executed the ORIGINAL `tests/native/code-context-commands.mjs` once, unchanged SHA256 `c0a026e3b3ccd7e82c45baad9c8a61a66231434dde949c539d545800018c4e7e`, after root released the exclusive native slot following its identity checks. Normal Windows token was used because restricted-token Electron startup has a known environment refusal; Electron sandbox remained enabled. No action, expected bytes, timing or oracle changed. No retry or extra GUI diagnostic occurred.

Actual receipt `evidence/code-context-commands-native/2026-10-07T01-03-26.139Z/result.json`, SHA256 `b935ad5e2008b4513bb47ce877a530a3c29a89bfc190fcde4a7ff0d0a54e9a1e`: ADVERSE, five completed cases, changedInputs[], controller exit1, UTC01:03:26.148–01:04:07.276. Owned PID25564 was closed by the harness finally and independently confirmed absent. Generated Code SHA256 `131f0be85a30b15d4e55f1801fbe66c5fc71cf545fa1b1971a799980e30d22d3`; Home `eb7698813bce1ef9238c0aebe827ece1f856e137a7a3ecfb6b07eb2c6662eb5d` (65097bytes). Full recursive source/build/generated/test/baseline/script/package/runtime before/after identities are in the receipt.

## What genuinely completed

1. Actual Home same-name rows distinguished selected source IDs/versions/languages and earlier-only Docs/agent association; the real earlier filter opened selected Pythonv2 while Docs remained pinnedv1.
2. Owner-recorded Python had syntax DOM; same `.py` filename recorded as text remained plain, Structure refused visibly and the real main bridge returned LANGUAGE_NOT_SUPPORTED.
3. Readonly toolbar and genuine right-click Commands hid Save/Undo/Redo; Find, Select all and Wrap operated without persistence.
4. Visible Compare choices had identity/version/hash labels and exact full A/B references; actual diff worked from both Python and text source windows.
5. Working menu Undo/Redo, explicit Save, verified source provenance, actual Python index, and a newly opened working copy all completed. The selected manifest/workspace, original codeFiles, Docs pinnedv1 and unrelated storage remained exact.

The previous leading-LF failure did not recur on the original input route. Genuine source versions were v2=160bytes, insertedv3=213bytes, Undov4=160bytes, Redo/Savedv5=213bytes. Version5 SHA256 `163a498d2e981820f87adeb5a69bc36b7d108e52a99ae4a6f7b6584c30ee7788` has the exact intended initial LF and a real committed receipt. This is bounded positive runtime evidence for the input correction; it does not erase the retained earlier adverse cases or establish arbitrary IME/clipboard coverage.

## New adverse: common Lock after two working copies

First failure is unchanged native line68:559, waiting for `window.sirenDesktopBootstrap.mode === 'locked'`. The fixture had opened a second working copy at savedv5, then edited the first working copy to v6 before clicking actual Home Lock. It deliberately leaves both working windows open, with only the first changed since the second opened.

Actual runtime log proves Lock reached native preparation, rather than a lost click: working preparation sent two Code requests; one prepared at105ms; another `commitSource` returned REVISION_CONFLICT, leading to renderer VIEW_FLUSH_FAILED; the barrier refused at355ms. The 30second UI oracle consequently timed out. No Lock acknowledgement or target retirement was observed. The failure is retained, not converted into success.

Read-only source tracing gives a concrete matching mechanism:

- `src/ui/code/view-lifecycle.js:31` calls `editor.flush()` for every non-readonly working view, without a clean/stale distinction.
- `src/ui/code/editor-adapter.js:161` flush always creates a fresh commit operation from its own bound version; dirty=false does not skip or produce an independently verified clean-view proof.
- `src/sources/repository.mjs:312` correctly refuses a fresh commit whose expectedVersion differs from the current source head. It must retain this CAS protection.
- `src/windows/source-barrier.mjs:37` correctly refuses when any captured view fails; `src/windows/coordinator.mjs` does not forgive Code conflicts using the Docs/Diagram-specific recapture exception.

The sole changed working source was v6; the second working copy remained the previously opened cleanv5. Together with the observed single Code conflict and the exact source implementation, this supports a stale-clean working-copy commit as the cause of this particular Lock refusal. Runtime diagnostics identify the failed role/method/code, not its window ID, so no direct per-window trace is claimed. No mutation-conflict forgiveness or change to expected bytes is justified.

Read-only independent evidence `.../lock-source-readback.json`, SHA256 `0020c8d92f7d3d8423886471213678da5824b176830ee66873b8344552b7a46e`, was produced with own ignored `evidence/workspace-surface/code-context-lock-readback.mjs`, without GUI or data writes. It verifies exact v3/v4/v5 bytes, exact v6=244bytes including both initial LF and Lock comment tail, selected workspace hash equality, and a genuine committed v6 receipt. Version6 SHA256 `6fd481644b1bb3dab5c87ad996614c8564becb3de4601b190669ae6277ff1bd7`. Thus this adverse is a refused Lock, with latest bytes actually durable; it is not evidence of discarded text or falsely acknowledged Lock.

Read source hashes: lifecycle `37fed5845a163a275c66801901bd8fb565771d02f4dfed21a83d9758f95a60d7`; adapter `3ea0de6f6dde5b270a114705699c8a2147169b3e9dabf5ccb9f64f3dd8cd3a20`; source-client `804f7568b8b824f2d41814718d22c9ffa372550da9d2e8eca09647c231ca5498`; source-barrier `69da5d68f3c1739d40e1792082a4d07dbcd6f34461adfef137744368881784e8`; coordinator `6940ced31f008afcd65ae66457c6c3ca834463fc759935140fe640bc9b4b1af1`; repository `ce4ba2ff620af9961b0b389b28c258491b5f13423ce32e1bd298ebf8d047b2e4`.

## Actual visual inspection and limits

Personally inspected `home-code-context-kpmg.png`, `working-saved-python-index.png` and `failure.png`. Home filename/context now occupies full rows with metadata beneath, without the earlier narrow two-column filename squeeze. The saved editor visibly contains the intended blank line before newly_saved; real index lists four definitions for savedv5. KPMG theme and shared shell remain coherent in this bounded viewport. The failure screenshot remains an unlocked working Code window; its top local-draft text and lower source-saved message describe different moments and are not evidence that Lock completed.

Common Lock retirement/access removal is NOT qualified. No package execution, independent root fullsuite result, hosted result, physical multi-monitor evaluation, maximum source-size claim or general release approval is made. Root owns any correction and subsequent qualification. This author made no product/build/tracked test edits during the captured run.
