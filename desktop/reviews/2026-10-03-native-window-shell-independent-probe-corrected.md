# Independent native window shell probe — corrected fixture

The separately authorized corrected probe was invoked exactly once. Real 2 Code + 2 Docs shells opened, and all shell privacy/caller checks passed before the probe failed on the first native close receipt (`closed.ok` was false). Exit code 1; **the complete native shell qualification did not pass**. Lock/null bootstrap, post-close revocation, and exact disk snapshot retention remain unqualified by this attempt. No product, probe, oracle, timeout, or delay was changed by this reviewer, and no further native invocation was made.

## Provenance and immutable input

The first attempt's missing-fixture-root failure remains separately recorded in `2026-10-03-native-window-shell-independent-probe.md`; it launched no Electron. After its independent full suite completed, the coordinator added only `await mkdir(dataRoot);` immediately before constructing the fixture stores. Comparison of the same 83 captured source/build/generated/native-test/package/lock/baseline files found only that intended probe change since the first attempt. The probe changed from 8,058 to 8,081 bytes, with corrected SHA-256 `382c7bc43e875f6875155ca55b65487defacb7ed710475fb9436fb27669a5b51`. The reviewer inspected the actual corrected bytes before invocation.

All 83 identities matched between this attempt's start and end captures. Start capture: `2026-10-02T23:44:20.9034681Z`. Relevant frozen inputs:

| File | SHA-256 |
| --- | --- |
| `src/main.mjs` | `19811a4e792f6abfb294e48ef59339af65a1764e1ede6d87bbdbf59a4501daa0` |
| `generated/app.html` | `222c72e960ec0facff468bca11123582194b78335ef1d4845a59cc251220fe93` |
| `generated/windows/code.html` | `bd4cd24dac119d2841b65daf9f6422b412aa17ef19d4c6900a5a14285e71f477` |
| `generated/windows/docs.html` | `bf3eec20cbadf5d0d966fc2950d99370a5008b839e6eb52d58a213c50c2cec11` |
| `src/windows/registry.mjs` | `275926961b2b7fcd1f07f8e3d94e0e1bf8e2bf125c92285a791163324e62ad28` |
| `src/windows/ipc.mjs` | `bead48b66f55229514c5c51bdf2ccd71d6002e2db0f93eda96a05eb93a514295` |
| `tests/native/drive.mjs` | `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` |

## Actual invocation and reached checks

Command `node tests/native/window-shells.mjs`, working directory `C:/Claude/SIREN_WORK/portable/desktop`, executed through `require_escalated` using `C:/Program Files/nodejs/node.exe`, Node `v24.16.0`. Node PID 15008. Invocation started `2026-10-02T23:45:05.4442123Z`, finished `2026-10-02T23:45:13.0685744Z`, exit 1. The intended workspace Electron executable had file version `44.5.1`; its actual launch path and owned command line were observed, but the probe does not collect Electron `process.versions` or executable hashes.

The unchanged sequential assertions reached and passed:

- Real original fixture creation and migration with two standalone source references; native launch, production local PIN fixture setup/unlock/reload; registered workspace role.
- Two Docs and two Code `openView` acknowledgements and a workspace roster of five windows.
- For each of the four actual role targets: connected status; no `window.require`, workspace `sirenDesktop`, or `sirenDesktopBootstrap`; no private source sentinel in body text; correct role/entity metadata; refusal of satellite `listViews` and forged role payload.
- Refusal of an extra forged `projectId` key and of Code source version 999.

This is actual reached assertion coverage, not a total native PASS. The generated shells are data-free; the probe's body sentinel check is narrow and does not inspect arbitrary memory/network surfaces.

## Native close failure

The saved result is `completed: false`, operation `native close and revocation`, error `Expected values to be strictly equal: false !== true`. The first assertion in that operation requires `closed.ok === true` after workspace `closeView` of the first Docs window. It therefore observed a refusal receipt. The probe did not persist that receipt's code or a stack, and no exact refusal code is claimed here. Its next focus/revocation assertion was unreached.

Static inspection identifies a likely lifecycle mismatch requiring coordinator diagnosis: `WindowRegistry.closeView` calls `entry.window.close()` and immediately returns whether `isDestroyed()` or registry removal already occurred. `invokeWindow` maps a false close result to `CANCELLED`. With actual native close completion deferred, immediate inspection can report cancellation for a close that is still progressing. This is an inference from source and the observed failed receipt, not a logged diagnosis. Distinguishing confirmed `closed` completion from explicit cancellation needs a product fix and focused lifecycle tests; changing this native oracle or inserting a retry-to-pass would not qualify the behavior.

The failure exited into the existing probe `finally`, which closed peer sockets, retained Electron output, and called `driver.close`. Consequently post-close focus revocation, all-shell Lock, locked reload/null snapshot, satellite target disappearance, both exact disk snapshot comparisons, and graceful request-close/exit were unreached. Opening/migration generated an owned fixture; this attempt does not establish final saved snapshot equality.

## Ownership and cleanup observations

Read-only process observation filtered the exact workspace Electron executable path and recorded ancestry from Node PID 15008. Observed owned Electron PIDs were 48060 (root), 8760 (renderer), 4016 (network utility), and 20272 (GPU). The root command line names the unique owned fixture root and project. Exact-path Electron inventories contained zero processes immediately before and after; every recorded owned PID was absent afterward. The reviewer performed no process kills. Cleanup was performed by the existing probe/driver, not a new cleanup implementation.

Sampling can miss short-lived descendants. These observations qualify only this recorded Electron family; they establish neither arbitrary process containment nor Terminal ownership. No physical monitor, editor transport, Task 3 dirty-view coordination, presentation, packaged build, or Terminal claim follows from this attempt.

## Retained evidence

Reviewer evidence is ignored under `desktop/evidence/native-window-shell-independent-probe-corrected/`. The probe's own fixture/evidence directory is `desktop/evidence/native-window-shells-2026-10-02T23-45-05.532Z/`.

| Artifact | SHA-256 |
| --- | --- |
| Reviewer `probe.stderr.log` (224 bytes, complete failure output) | `e76ec87a67e093fe57ca2dd8f1157a569636079c14d478dc535c52d9ddd1d033` |
| Reviewer `probe.stdout.log` (empty) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Reviewer `run.json` | `6f5ae7f3f658683cef28ddd88cd32cdb0ba982d61120f7af9998ad3591cffefd` |
| Reviewer `start-identities.json` | `dd18df5417dad87870b9d5d3ecb95c9381abaebb4a24297c69a33e3efc71f632` |
| Reviewer `end-identities.json` | `2835f23ef91c29a9dec6061a1f47ae3480d4fd364578af5f809ce57f6807e5d8` |
| Reviewer `identity-comparison.json` | `b352878f01a7aa842b0ebf4709c1499ce8c661e1fa81ec4044c50d52d5dc362b` |
| Reviewer `first-attempt-comparison.json` | `7b2df8648c4d319e4b9d12c26cedde285dcdd0e4fbb137af9e674ea5f10ab78b` |
| Reviewer `processes-before.json` | `70b0a4847c6f40e638e3b081ab9287aeef87effc02f8527d209d971dd74f602e` |
| Reviewer `processes-after.json` | `4dde426a4ad313561fd6c0713aa41dce792baf0113f5aaf3c6e6e91d2be54245` |
| Probe `result.json` | `5b5841b7fb02484fef5d7d5e9ca53678e359b9fd60bd207a6adcd73d0a73c890` |
| Probe `electron.log` (102 bytes, debugger endpoint only) | `9537b9e08c30b4fa988278719d6f6dcea2ba420f5f9204afe13d04696460b82a` |

No further tests or native launches were run by this reviewer. The original failure and corrected native failure are preserved independently. Native shell close acceptance blocks full qualification at the captured registry identity; subsequent fixes require fresh, explicit evidence.
