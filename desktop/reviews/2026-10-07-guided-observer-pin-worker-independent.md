# Guided intro observer / PIN worker dispatch — independent causal analysis

Author: `native_menu_trace_review`, 2026-10-07. Scope: read-only investigation of hosted run `37539190289`; source inspection and a bounded, independently authored controlled probe. No product/test/build/workflow edits, Electron launch, GUI, full suite, actual encryption worker or native qualification were performed.

## Finding: the observer application bypasses the production worker dispatcher

**Actionable harness defect, P2.** `tests/native/guided-intro.mjs:115-130` creates an owned Electron application whose `package.json` names `entry.mjs`. That entry unconditionally patches `BrowserWindow.prototype.loadURL` and directly imports the real `src/main.mjs`. It does not import `src/start.mjs` or guard private worker arguments. This still observes the ordinary real SIREN main, but does not preserve the application's new private worker startup contract.

The exact launch/source chain is:

1. `launchDesktop` launches `electron.exe` with the observer fixture directory as the application argument, followed by the owned parent test-root/project flags. The fixture contains its own package and main entry.
2. Installed Electron's inert `default_app.asar/main.js:78-140` resolves that package directory, assigns `appPath = packagePath`, calls `app.setAppPath(appPath)`, then imports its entry. Its `getAppPath()` contract is the current application directory. Therefore the source-level application path is the **observer fixture**, even though its entry subsequently imports SIREN's real main from another directory. This is a loader/source determination; the original hosted artifact does not contain an actual child's appPath receipt.
3. Historical `src/main.mjs` constructs `PinProtector` with `application: app.getAppPath()`, `executable: app.getPath('exe')` and `packaged: app.isPackaged`.
4. The actual protector's development argv is `[application, '--siren-pin-worker-v1=' + profile]`. It intentionally does not forward parent GUI or test-root arguments. Consequently this application path relaunches the observer entry, carrying a valid private worker flag.
5. That entry ignores the flag, patches the UI prototype again and imports ordinary main. The sole production dispatcher, `src/start.mjs`, would instead import `account/pin-worker.mjs` for any `--siren-pin-worker` prefix, allowing that worker to reject malformed versions before ordinary main loads. It is bypassed here.
6. The actual private protocol requires a bounded stdin request, a nonce/operation-matched frame on fd 3 and normal child close. Ordinary main has no implementation of that protocol. Its source also receives no `--siren-test-root`, so its default development-root path would be considered if that main reaches initialization. No assertion is made that this fallback path was actually created in CI.

This is a deterministic fixture dispatch mismatch, independent of animation timing or menu behavior. The original hosted child's exact terminal event (deadline, ordinary-main startup refusal, exit or another normal-main path) remains unobserved.

## Original retained adverse evidence

Original result: `evidence/workspace-surface/ci37539190289/desktop-native-desktop-evidence-original/evidence/guided-intro-2026-10-06T22-22-07.535Z/result.json`, SHA256 `037906e9403d6375ee46f10bf3507c0625b0e25de4fa512f0274d7eb09e78ed3`.

The result is **completed:false**, failing only at `unlockDesktop`'s setup acknowledgement assertion (`drive.mjs:42`, second `guided-intro.mjs:154` call). Earlier guided editing saved successfully, replay/reduced-motion checks succeeded, and the observer's first-paint checks reached 77 frames, locked/read-only bootstrap, motion allowed and `flashConfirmed:false`. The subsequent successful-unlock/project/no-replay assertions were not reached. The assertion records `setup?.ok !== true`; it does not retain the returned setup code, so this report does not attribute the original failure to a specific native PIN error code.

Original ZIP independently rehashed: SHA256 `3f73707a0a16823f602570672a3cdfeee61bf1f018a846285f31b37d93875a4c`, 4,406,009 bytes, artifact id `11447199336`. Its original second-process `electron.log` (135 bytes, SHA256 `8406f2482fff761acec5808adb5ccaa4bf690609d9ad86b19fb46e863397d298`) contains only DevTools listening and `OWNED_FIRST_PAINT_OBSERVER_READY`. The original first-phase log has SHA256 `e463e3b6da041098d0b06421f8a9730f1de4803da14924e96693be1e8b5c2d0c`. Both were read directly as bounded inert ZIP entries and copied byte-exact into the new evidence directory. They contain no child appPath, fd-3 receipt, private-worker stage, exit code or setup result code. Failure PNG identity remains `9c14e61c58bd3775a9b33eb7e525319ac0405b575796ac4ee647231d23ab9f37` (original inventory; not used to infer child execution).

The current guided-intro file's CRLF-normalized LF hash is `35520ae9e2b23b35cfb82cbeff22146ca0b2f7772678830a4e68c389512d634c`, exactly the original result's harness hash. Current `start`, protector, worker, protocol and LocalPinAccess bytes each match the original hosted `home-entry/.../prepared.json` input hashes. Historical main was read using `git show c210bfb:desktop/src/main.mjs`; SHA256 `fe4930149de8121f3ce1d2519a6776bbf7bf2d343c560fc80071539c0c3b09f1` exactly matches that original hosted receipt. Current main contains separate Home-backup work and was not substituted for historical causal reading.

## Independent bounded probe

Driver: `evidence/guided-observer-worker-independent-2026-10-07/probe.mjs`, SHA256 `bebe812aabf5782777dd7c1cfab09de8156c86016c13b9f2cd6a8afc79b57869`.

Result: `evidence/guided-observer-worker-independent-2026-10-07/2026-10-06T22-30-27.757Z/result.json`, SHA256 `e5de4fd97a9c235723b73a5c2d2e4d8537d0628f61e5187da69f59ec47d5f3c9`. Five bounded case groups completed with nine inspected input hashes unchanged before/after. The probe extracts and evaluates only the actual observer string and entry-template writer in an isolated VM; it does not run the native test or real main.

- Normal launch: actual generated entry patches the observer then imports real-main URL. The candidate keeps that order through the actual `start.mjs` dispatcher.
- Valid private-worker launch: actual entry still patches the observer and selects main; candidate selects worker with no observer patch or Electron BrowserWindow import.
- Unknown private-worker version: actual entry selects main; candidate selects the real worker dispatch so its existing finite version rejection remains authoritative.
- Negative controls: changing only the main import to start still patches UI in worker execution; adding only the observer guard still launches main for the private worker. Both parts of the amendment are necessary.
- Actual `PinProtector` plus actual `LocalPinAccess`, with a controlled in-process child adapter: captured argv uses the supplied observer fixture as the application, carries the private flag and forwards no test root. Original entry selects main, produces no worker frame, and a simulated normal child close makes the real classes return `PIN_STORAGE_UNAVAILABLE`, with no `local-pin.bin` publication. Candidate dispatch provides two strict protocol receipts (encrypt then separate decrypt), makes setup acknowledge and publishes through the real local-PIN persistence path. The adapter uses synthetic transport ciphertext and a placeholder profile key; it proves dispatch/protocol/persistence behavior **only**, not Windows safeStorage encryption, actual child lifecycle, crash durability or the original hosted child's terminal event.

The exact generated entry is retained as `actual-generated-entry.txt` (SHA256 `dc5c76f2c13558e523277dd0121470ea6cc2a3f9914048216c4914b848c751c2`); the candidate is `candidate-entry.txt` (`2c0eaa22cdcf9cc2ac6e95464d0515446d751d515d1e40a4fc0e4c90828ddbdc`). Installed Electron loader excerpt/hashes are in `electron-loader-source.json` (`0cbe63d5d2952853d63581c9bcef87bac2ac478511602ff0d643c45c8eb875f9`). This loader source was inspected, not executed; its identity is not a measured hosted child process identity.

## Minimal fixture correction and verification boundary

Within the **test-generated observer entry only**, guard on the same private prefix as production start (`process.argv.some(arg => arg.startsWith('--siren-pin-worker'))`). Put the Electron BrowserWindow import and the complete existing passive loadURL observer patch inside the non-worker branch. After that branch, import the actual `src/start.mjs` by its absolute file URL. Do not special-case only `v1`, import main directly in either path, instantiate a fake main/window, change product PIN behavior, add UI instrumentation to the worker, skip the second unlock or weaken the existing first-paint/unlock assertions or deadlines.

A bounded VM regression should cover ordinary, valid-private and unknown-private argv, asserting unchanged ordinary-main observer ordering and zero observer patch/BrowserWindow import for either private path. Then rerun the actual unmodified-scope native guided-intro cases: genuine first-phase editing/replay plus observer-phase real setup, unlock, selected project and no replay. Preserve the original adverse result. A passive finite setup result code on failure would improve future classification without changing its acknowledgement oracle; no raw PIN, key, plaintext or cipher is needed.

This report supports a targeted harness correction and native retest. It does **not** close the original hosted failure, approve a release, qualify unrelated Home-backup changes, or reinterpret the separate development crash-matrix skipped step / copied-package results as proof of this observer path. No native correction has been executed by this reviewer.

## Later input-drift note (separate from the retained original probe)

During report finalization, root announced and began the test-fixture correction after the above immutable original-entry probe. A later capture is retained separately in `later-input-drift.json` beside its result. The before/after equality claim applies only to that probe's recorded execution interval. This report does not recheck, execute or qualify the later corrected harness. In particular, no locally launched known-broken fixture was used to generate a purported native RED; source/VM and original hosted adverse evidence are the only original-defect evidence here.
