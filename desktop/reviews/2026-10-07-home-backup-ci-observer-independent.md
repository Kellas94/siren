# Home backup CI wiring and guided observer correction — independent scoped recheck

Author: `native_menu_trace_review`, 2026-10-07. Read-only review of the new CI tranche and corrected observer fixture. No source/test/build/workflow changes, GUI, native launch or full suite. No merge, release, push or hosted qualification conclusion.

**No must-fix defect found in the inspected wiring/correction.** The actual new Home command appears once, only in `native_windows` with `matrix.group == 'desktop'`, after the original group runner and PIN crash step. It runs `node tests/native/home-backup-export.mjs` without package arguments. No Home invocation appears in the copied-package job. The harness does not parse `process.argv`: adding `--package` would silently continue to run development Electron. This limitation remains real; the current command and the harness's explicit development-only scope correctly avoid a package claim.

The native artifact step remains `if: always()`. Its new exact path, `desktop/evidence/home-backup-export-native/*/result.json`, reaches the timestamp-nested original receipt, which the existing single-level generic result path cannot reach. The new path captures neither the owned PIN/protection profile nor exported source bundles. Independent controlled `node:path.matchesGlob` checks of all actual native upload patterns admitted that receipt and excluded representative `outputs/*.siren-backup`, `owned-data/Access/local-pin.bin`, `owned-data/Access/PinProtection/Local State`, project files and the nested `failure.png`. This is a controlled glob-shape check, not an actual GitHub upload. PNG exclusion is consistent with this receipt-only tranche; failure diagnostics embedded in the receipt remain available. The real harness writes the receipt in its `finally` path and retains status/error/input hashes; its chooser observations contain finite title/default-name/mode/delivery fields, not source bytes.

The actual three native groups remain exactly 20 original children each; neither their definitions nor the existing `<=20` assertion changed. Home is an additional workflow step. With an injected first-child failure, the actual `runNativeGroup` still invoked every child exactly once and retained an adverse verdict for all three groups. Existing step/job failure behavior is not weakened by the Home addition.

`tests/home-backup-ci.test.mjs` was actually run in isolation: **2/2 PASS**, including its planted missing-retention, broad-profile-path and unsupported-package-command controls. This structural test does not claim actual native UI/export execution. No broader tests were repeated while root's full suite was active.

The corrected guided-intro source now guards **all** `--siren-pin-worker` prefixes before importing Electron/patching BrowserWindow, then imports the actual absolute `src/start.mjs`. An independent VM executed the exact generated corrected entry for normal, valid-worker, unknown-version and bare-prefix argv. Normal execution preserved `Electron import -> observer patch -> actual start -> main`; all private cases selected `actual start -> worker` without Electron BrowserWindow import or observer patch. The entire original observer body is byte-exact inside the corrected entry. Git diff confirms only explanatory comments and the generated entry changed; existing actual unlock, first-paint assertions, actions and deadlines remain. Unknown/bare flags are routed to the production worker's finite rejection logic; no direct main fallback is added.

The original adverse analysis remains unchanged, SHA256 `0480ed081d97be12ed522edf6f36bb0e1b71e334153fb95909e3ef0d986af39c`. This recheck confirms the source-level dispatcher correction only. It does not invent the original hosted child's unrecorded appPath/terminal receipt or substitute a VM result for a corrected actual native run.

## Retained independent verification

Probe: `evidence/home-backup-ci-independent-2026-10-07/probe.mjs`, SHA256 `6320962bd873f01fda27ab559a64508869257d9e8fd8a1103f616b21e3508ddc`.

Result: `evidence/home-backup-ci-independent-2026-10-07/2026-10-06T22-39-34.984Z/result.json`, SHA256 `d43b116859c0f503e9d05a922afd71ee33270f460c99361b68468bf27ed979a0`. All eight input hashes unchanged before/after. Exact generated corrected entry is retained beside that result. Focused test log: `evidence/home-backup-ci-independent-2026-10-07/home-backup-ci-focused.log`, SHA256 `bcdd0a22cbac84ed1e61e860d084187970c913c9853e0c69db2bb35285eeda0f`.

| Inspected input | SHA256 |
| --- | --- |
| `.github/workflows/desktop-verify.yml` | `c4b0dcd912f343d1b66e145c4d1df3a274413a10f4100c66fa305715c33aed64` |
| `desktop/tests/home-backup-ci.test.mjs` | `e3847b8f2d6a79f93768eb8629fabce03c4640edff461acc015cd8aab8b0ae22` |
| `desktop/tests/native/home-backup-export.mjs` | `8128dc7ab8dd188c1ae3bc77587ab7b146d51dd83230dde8ceecf2d18f961834` |
| `desktop/scripts/native-verification.mjs` | `55f4b43265e5eda950c86f26e95e539ececfe633e886097adaac7c96e8872d0b` |
| `desktop/tests/native-verification.test.mjs` | `e02b0deab4e293796a3be197244b76ef7eb4fd3e5e5cbc36bcbda8c1f54bfbb6` |
| `desktop/tests/native/guided-intro.mjs` | `c99cd2c047e415bad4354b85730f56b5c2ff836a4f928e0af12742e92bfffee0` |
| `desktop/src/start.mjs` | `1db3fb8b968168f69a915956927bcf5f544a59dd792be21c635e3e6d5a0b4f62` |
| `desktop/src/account/pin-worker.mjs` | `cc7c1c07b18f939c527b1c872141cbc43f25458d5612b9ca8e22b1306eb0c995` |
