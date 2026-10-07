# Independent scoped review — native Close/Quit keys

Author: Codex independent reviewer `/root/workspace_surface_review`, separate from implementation/native execution author `/root`.

Date: 2026-10-05. Observed local HEAD during review: `f155c425ce8853cd447b5a5e80e015ca85fe06f0`. This is a separate uncommitted local lot from the prior hosted shelf correction. Scope: `NativeWindowFocus.closeActive/quit`, Ctrl+W/Ctrl+Q before-input routing, application/context menu routing, captured authority, transition refusal and integration with the existing native working-close/permanent-main lifecycle. Subsequently authorized additions are guide text for those keys, a separate modern role-privacy native oracle, and their CI registration/retention. **No actionable finding identified in the reviewed code/unit/oracle/registration scope.** Actual native qualification is limited to the receipts recorded below; this is not independent Electron or release qualification.

I read source/tests and independently ran the focused unit command below. I did not launch Electron, edit source/tests/build/helpers/evidence scripts, alter prior reports, create agents, or commit. Only this report was written.

## Exact inspected hashes

Paths relative to `C:/Claude/SIREN_WORK/portable/desktop`; SHA-256.

| File | Hash |
| --- | --- |
| `src/main.mjs` | `311d40fc553fcd82f88c0114fa7274a99d89804cbe264698ce84023a19a016e2` |
| `src/windows/focus.mjs` | `6774de6f4d36725ba4f55015ce07f53d5eb223b8e691f0441feb7d94c817262d` |
| `tests/window-focus.test.mjs` | `6d8effcb55db64166c3cd4a7e7e734c0d83893568fb7ac4006bbf4667bfa2e29` |
| Corrected `tests/native-shortcuts.test.mjs` | `aca832feb1a5ec39a965648d2f3cf112e2804d46fc6ef301ab2311781c84895f` |
| `src/windows/registry.mjs` | `fbb41c71f4ce26bdd456afc1ae59ec412622dec6ce29d2eda756a11e99a32c3f` |
| `src/windows/surface.mjs` | `c8c1ad80b087911a33a3ca38276f507079524d69f9690b28a444d1312a3d9cde` |
| `src/windows/source-barrier.mjs` | `69da5d68f3c1739d40e1792082a4d07dbcd6f34461adfef137744368881784e8` |
| `src/windows/coordinator.mjs` | `6940ced31f008afcd65ae66457c6c3ca834463fc759935140fe640bc9b4b1af1` |
| `src/windows/working-sources.mjs` | `2a3879c447d092601d78626aadb45e208ac191a3b1758713078331b202f94704` |
| `src/windows/docs-edits.mjs` | `8a535cc0b66805a8e785f8c52b4f74592de59eff39c947c906072ccba4d42852` |
| `tests/window-layout.test.mjs` | `58388e88e7865f3749a045ab43ea3d1426ca418ee5af6f8cab01ca672a75c0d0` |
| `tests/window-views.test.mjs` | `2897fbb3f2659d581ba3af8e89d58dd9a8b4f915b7b8915bbc5277466cee11d7` |
| `src/ui/workspace/home.js` | `f66e3e3c5472d65ea3aba614be71c4f45bbaaf0e73a0afe4ec9a4aa51b18b8d1` |
| `src/ui/desktop.js` | `e524dd33ec1a7ca7fb8299f6630d7efc8069d2114c3a27bc5e40351455171139` |
| `generated/home.html` | `6c99e5796c086dd5c4ad21f22abd2af25441cb48a93078b8604e8c98a9ed3932` |
| `generated/app.html` | `039c6478a2d5f9ef902635d94fb1c61ac6335e512dacdc10e6235d3e1d560ec2` |
| `tests/native/window-close-keys.mjs` | `da83f02649a4aeb08ae4c98bfa97a9b67a21cdabbea6d25da26c03768f0cd885` |
| `tests/native/native-keyboard.mjs` | `51966a4884cf8f6ff22ebf5f55a2ee3dffa787050ddfe4d8a5d3373cc248f963` |
| `tests/native/drive.mjs` | `6a9d05e2036d85160412681f8640fb565985722598045b5d28a41bcbed0e5f87` |
| `tests/native/condition.mjs` | `caa3c18db9d750d52917ec1b351b6d6b8948b1529e659842c570bcd18feda8d4` |
| Separate `tests/native/window-role-privacy.mjs` | `a389e91bd15d9f332f8c77e4338aac570eb52cad768aa1c9a5461d93968c10e3` |
| Original `tests/native/window-shells.mjs` | `382c7bc43e875f6875155ca55b65487defacb7ed710475fb9436fb27669a5b51` |
| `scripts/native-verification.mjs` | `84734fa99cf07f6799d9a41bf17eba62ed4fa7543d4ea9e6bce0225563f63db7` |
| `tests/native-verification.test.mjs` | `2ea4e7954c1ee695d083330eee7edac056d4745337c0a8389eee9e257ed4397e` |
| `../.github/workflows/desktop-verify.yml` | `c608c1b66dc8057f94e0b0b315f31bd02f7e23a6d451711bdbdb6761938dc120` |

## Authority, routing and lifecycle assessment

Ctrl+W uses the listener's captured actual native window rather than looking up whichever window happens to be focused later. If the permanent main is the origin, it resolves only the selected surface from the registry's Code/Docs surface roster; no selection is a no-op and never closes the main. It rejects missing/destroyed/main handles, foreign or retired frames, workspace grants and transition refusal, then rechecks the captured grant immediately before calling the existing native `close()` path. The production native-handle map is populated by native factory registration; roster metadata alone does not supply renderer authority.

The returned `true` means a close request was submitted. It does not mean disposal finished. The existing satellite native-close listener retains its working-copy veto: it prevents initial close, refuses overlap with view/selection/Lock/account preparation, performs the all-view preparation, releases the proven barrier, then permits the second native close and resumes remaining views. Preparation failure rolls back rather than treating an unsaved view as closed. Surface disposal/registry retirement continue to await actual renderer and shell destruction; this new route does not replace them with synchronous forced destruction. The unit native-veto double only proves request semantics; it is not a real Electron before-unload/save receipt.

Ctrl+Q from a satellite requires that satellite's actual registered current frame/grant, then requests the permanent main's existing close handler. A trusted permanent-main origin can request Quit while locked. The main handler prevents immediate close, refuses active selection/view/access transitions, deduplicates a pending close, prepares/drains work, joins pending writes, awaits native view retirement, flushes layout and records clean-close before closing. Failure resets the request, rolls back preparation and preserves the failure fence. Quit does not bypass coordination by directly terminating the app or destroying satellite drafts.

The shared before-input listener accepts only noncomposing Control keyDown without Shift/Meta, consumes Ctrl+W/Q before the page/menu accelerator, ignores auto-repeat actions, and returns after dispatch. Existing Ctrl+Alt routes remain separate. The old additional main Ctrl+Q action was removed, so the second main listener has no Q/W action. Application File menu and Code/Docs context close commands call the same authority-aware methods; a popup's retained native origin is revalidated at invocation. The event doubles verify one dispatch/preventDefault/repeat behavior; actual Electron menu suppression must be judged from separately attributed native evidence.

## Independent tests executed

```text
node --test tests/window-focus.test.mjs tests/window-layout.test.mjs tests/window-views.test.mjs
```

Exit 0: **48 passed, 0 failed/cancelled/skipped/todo**, 8328.3847 ms. The five new meaningful regressions cover exact close target/no-main close, main selected-surface/no-selection behavior, foreign/revoked/mid-selection refusal and native veto semantics, captured-satellite/locked-main Quit, and once-only captured-input routing with composing/modifier/repeat preservation. The existing focus/layout/dock tests also passed. No broad/full-suite or Electron run is attributed to this reviewer.

### Subsequent shortcuts-fixture correction reviewed

Root's first whole-suite run at 18-35-46 remains ADVERSE, 1051/1052, with unchanged captured inputs. I checked its JSON before-map contains 419 entries, rather than the initially reported 420. Its sole failing shortcuts fixture extracted only the old primary listener while Quit had moved into the actual shared listener. This report does not relabel that run.

The corrected fixture imports actual `NativeWindowFocus` and `bindNativeWindowFocusKeys`, binds them to the same EventEmitter as the actual extracted main listener, and asserts that production main binds the shared route. Its original seven-chord exact dispatch/preventDefault count and repeat/composing/modifier assertions are retained. It does not fabricate a Q callback or bypass the production implementation. It can detect duplicate dispatch between those listeners.

I independently ran `node --test tests/native-shortcuts.test.mjs tests/window-focus.test.mjs`: **15 passed**, zero failed/cancelled/skipped/todo, exit 0, 81.225 ms. This is my executed scope, distinct from root's reported 23-test command. I also restored only the removed legacy main Q branch in an in-memory copy of the actual listener, without editing any file. On the same actual shared binder/emitter, current source returned one Quit/one prevention; the restored duplicate returned two Quits/two preventions. This confirms the relevant duplicate regression is observable by the combined fixture. The completed later full-suite receipt is recorded below separately.

## Root-owned native receipts and limits

The first root-owned completed Close/Quit receipt `evidence/window-close-keys/2026-10-05T18-32-27.008Z/result.json` has four `ok:true` cases: main no-selection no-op, detached Code close without peer save/close, selected attached dirty Docs close with coordinated exact save and Home/peer resume, and attached dirty Code Quit with actual process exit after dirty Docs save and exact retained private source draft/original references/blocks. Result SHA-256 `d7decb9424f0f57a50b2103414e27300d2a29c74a80d9c2dc5c4b75b365b67bb`; Electron log SHA-256 `0884aa70ee655eaef506d638de21f5f1090b4e63d26052a7a58e836f3ef40017`. I inspected its probe and result. Its 14 captured inputs equal afterInputs internally; main/focus hashes match the reviewed code. **The subsequent guide edits changed four UI/generated hashes**, so this first receipt is bounded to its captured older UI snapshot.

The separate final root-owned `evidence/window-close-keys/2026-10-05T18-36-03.129Z/result.json` repeats the four cases COMPLETE, all `ok:true`, on the final guide/UI snapshot. Result SHA-256 `7cf16cc552d40fc51527d5c450d31e7e358d3d4a6873ffc636a826b6b60b71b6`; Electron log SHA-256 `a45c5d3bbf5f689e74aa39e9dd46d9a18eaeae1fcbb174ef01b89928ff721bcc`. I independently compared all 14 captured input hashes against afterInputs and current files: zero mismatches. This final receipt establishes the named runtime cases on the final captured snapshot, without rewriting earlier receipt provenance.

Three earlier native ADVERSE receipts at 18-30-10, 18-30-54 and 18-31-19 remain adverse. The first two fixture observations prematurely rejected legitimate pending-preparation `SENDER_REFUSED`/`PROJECT_BUSY` responses. The final probe still returns false for these responses and waits inside the same fixed observation deadline until the exact view is gone and Home resumes; it never treats them as successful close. The earlier Quit timeout log had reached journal/window-close and explicitly reported `Waiting for the debugger to disconnect...`. Final fixture cleanup closes the owned native inspector before waiting for actual process exit; no product-source correction or timeout extension is inferred from these fixture changes. The new native helper dispatches actual Control W/Q input through PID-checked Electron webContents, then sends keyUp only if contents survive. It does not directly call a product close function.

The native probe establishes its four observed routes, not physical keyboard/IME or exhaustive native menu invocation. No Electron execution is attributed to this reviewer.

The earlier root-owned whole-suite receipt `evidence/workspace-surface/full-suite-2026-10-05T18-40-10.320Z/result.json` is COMPLETE, exit 0, with 1052 passed and zero failed/cancelled/skipped/todo, 183784.5741 ms. Result SHA-256 `3504c09503a9fad4eb4926c58368b3b39d0f5695d3fe018cd0d2d7f50e8014db`; log SHA-256 `99661348e25daaa9f29112456f24bedbd234be38cafd63d22fa0b0aafcf92e8e`. I inspected the final log counts and verified its hash against the receipt. Its **419** captured before entries equal after and `changedInputs` is empty. They initially matched current bytes at my inspection, but subsequent CI registration changed the runner/test entries, so this receipt is now explicitly historical for those two captured files. It is not the final post-registration frozen-suite qualification. Full-suite executions are root-owned, not mine; they do not supersede hosted failure status or establish a packaged/release claim.

## Separate modern role-privacy oracle review

The new role-privacy test is a separate file. It does not edit the original data-free `window-shells` oracle or declare that original ADVERSE successful. Two admitted Code windows each require exact own rendered source text, source ID, version and SHA; each rejects the other source's sentinel and a cross-source `getMetrics` request, and must not display either document sentinel. Two Docs require their own exact document ID/content, forbid the other document and both source sentinels, and reject source metrics. Native caller role/entity metadata, absent Node/desktop/bootstrap globals, denied list/forged scope/version, close revocation, all-view Lock/null bootstrap and exact original/migrated disk snapshots remain asserted.

I independently compared old/new CDP connect and deadline implementation and the entire native-close/Lock/disk/exit block in memory, after normalizing line endings: both were identical. Readiness additionally waits for the actual editor/document, within the original 15-second bound. The new oracle correctly qualifies legitimate own-content display rather than pretending modern Code remains data-free. This is a named test scope: it does not establish absence of every possible transport leak, cache side channel or hidden object exposure.

The root-owned actual result `evidence/native-window-role-privacy-2026-10-05T18-35-08.930Z/result.json` is COMPLETE with `completed:true`, SHA-256 `1d7f29f685f2f0ce9b609aef1c32fe7fb7ec22cc5e2b038b73fe6a7a81aa22ce`. My independent read-only Node check verified all ten captured inputs equal after and current files and the structural comparisons above; exit 0. A first fixture syntax failure reported by root occurred before application launch; it is not native product evidence. The original `window-shells` failure remains unchanged and separate.

## Subsequent CI registration reviewed

The native group definitions append only `window-close-keys` and `window-role-privacy` to sources. An independent read-only in-memory comparison against the actual HEAD runner established that all original 50 children and their within-group order remain exact, the new total is 52, and group sizes are 20/17/15. The entire runner runtime text after the group definitions is identical. It still invokes each child once sequentially, retains nonzero exit/spawn refusal as failure while allowing later children to finish, and refuses group success when any child or captured-input check fails. It adds no retries, removed checks or timeout changes.

Workflow registration adds the actual copied-package Close/Quit command and a nonzero-exit refusal. All three existing `if: always()` evidence sets gain nested close result/log/png patterns. The modern role-privacy probe's first-level `evidence/native-window-role-privacy-...` results/logs are covered by the existing first-level glob patterns. The existing all-group qualification gate remains intact. This is static registration/retention review; it does not mean the new CI run or copied-package close test has executed successfully.

I independently ran `node --test tests/native-verification.test.mjs tests/native-shortcuts.test.mjs tests/window-focus.test.mjs`: **17 passed**, zero failed/cancelled/skipped/todo, exit 0, 87.2994 ms. The registration test retains the original finite-group gate and planted child/spawn failure checks, now explicitly requiring both additions and package/retention registration. Product/native captured inputs remain unchanged after these runner/test/workflow additions.

The separate final post-registration root-owned frozen-suite receipt `evidence/workspace-surface/full-suite-2026-10-05T18-45-15.244Z/result.json` is COMPLETE, exit 0: **1052 passed**, zero failed/cancelled/skipped/todo, 183375.9802 ms. Result SHA-256 `f996666388c606527e538d19ee5eef6fddae2df2c1841743f164b4efa087fcd5`; log SHA-256 `03baf0c658c60afaff2e3ff71ec2c8b7b3dc7d2cce234022255a45d6c8060958`. I independently checked its log count/hash and every captured before entry against after and actual current files: **419 entries, zero mismatches**, with `changedInputs` empty. All **25** file hash rows above also match at finalization. This qualifies that root-owned final whole-suite snapshot, not an independent whole-suite execution.

### Completed sources-group receipt addendum

Root's sequential actual sources group subsequently completed. I independently inspected `evidence/native-verification/sources.json`, SHA-256 `02e238824c7dc638af00846102ec972b5de23c88bfd7b74e7c1485cfe35c99d8`: `status:COMPLETE`, `ok:true`, started `2026-10-05T18:47:39.892Z`, finished `2026-10-05T18:50:28.774Z`. All **17** results are exit 0 with null signal and no error; their exact order equals the current imported `nativeGroups.sources` list. Failed/changed-input arrays are empty. My read-only Node check independently compared all **19** captured entries (runner, workflow and 17 child scripts) against afterInputs and current bytes, with zero mismatches, and recaptured all **25** report hash rows unchanged. The check exited 0. This is independent receipt/byte validation of root's execution, not my own Electron run or an independent review of every assertion in all 17 probes.

The final group Close/Quit receipt `evidence/window-close-keys/2026-10-05T18-50-20.284Z/result.json` is COMPLETE with the same four `ok:true` cases. Result SHA-256 `80c03c3078e39f684d23971d1e97eb1b617e2bd353fca1051dc8dce147ce1729`; Electron log SHA-256 `92761a059c633558c39bdffcf3e6d67817f6be728a0fb5eb82e3ebebc2eda2db`. The final group privacy receipt `evidence/native-window-role-privacy-2026-10-05T18-50-25.596Z/result.json` is COMPLETE with `completed:true`; result SHA-256 `1d7f29f685f2f0ce9b609aef1c32fe7fb7ec22cc5e2b038b73fe6a7a81aa22ce`; Electron log SHA-256 `ab84133e4d3e50dc233b0e5b111bdb9b2a8289d42245eadcbf251e013e01a59b`. I independently checked their **14** and **10** captured input entries respectively against afterInputs and actual current files, with zero mismatches. These remain root-owned actual native executions with the named Close/Quit and modern-oracle limits above.

Future copied-package qualification is a separate lot. No existing native/full-suite artifact establishes all hosted jobs green or release approval.

## Separate hosted process-identity failure attribution

At root's request I also inspected retained hosted source-read evidence from run `37355828768`. ZIP SHA-256 `bad1834dfd610f123b1a5f589212c13a5a62e189fb0dc54edad65be22cc86ae1`. The original `source-read/2026-10-05T18-32-15.030Z/result.json` remains ADVERSE with zero cases; expected source SHA readback is undefined. Its native log records `SIREN_PROCESS_IDENTITY_FAILURE` with query/QUERY_FAILED, `killed:true`, `SIGTERM`, zero stdout/stderr bytes. The unchanged Windows identity reader has a finite 10000ms PowerShell execFile deadline and returns unknown after failure; main startup selects readonly when identity is unavailable. These observations support cancellation of that bounded query and a fail-closed startup path. They do not prove a navigation race or establish whether PowerShell startup or Get-Process consumed the time.

The artifact also contains a separately recorded later seven-case source-read success. The original failed run and aggregate remain ADVERSE; this reviewer did not rerun or relabel them. A safe next investigation is to measure shell-start versus process-query latency using bounded trusted diagnostics, then evaluate a bounded native PID/executable-path/creation-time reader if shell startup is confirmed as the bottleneck. Any replacement must retain exact Unicode path/creation-time/PID validation and unknown-is-refused behavior. Current evidence does not justify treating unknown identity as known, weakening an oracle, or claiming a timeout increase/retry fixes the underlying cause. This diagnostic review is outside the Close/Quit patch verdict and is not an implemented fix.

The seven earlier reports authored by this reviewer were rehashed and remained identical. This report does not approve the entire Task 4, every role/OS/keyboard layout, physical keyboard input, all asynchronous failure permutations, a packaged distribution, current hosted CI or a production release. Prior shelf/package reports and hosted artifacts remain separate; their statuses are not rewritten by this new local lot. A scoped review is evidence, not user approval.
