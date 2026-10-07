# Dedicated Electron protection profile — bounded prototype result

Author: `/root/media_batch_review` (Codex subagent), 2026-10-07.

**Result: ADVERSE / NOT QUALIFIED.** The prototype did not complete a genuine encrypted-record cross-process receipt. The unchanged `LocalPinAccess` setup→owned child kill→restart case was **not started**, and no PIN was published. This is not an implemented product fix, independence approval, recovery of a previously lost key, or power-loss qualification.

## Authorized scope and architecture

All authored files are under the ignored `desktop/evidence/pin-provider-profile-prototype-2026-10-07` directory or this review. No source, test, generated asset, build, policy, or product data was changed. No BrowserWindow or other GUI was created. No new executable was compiled, no sandbox-disabling flag was used, and no Windows protection policy was changed.

The diagnostic adapter uses existing Electron 44.5.1, with fixed operations and fixed owned profiles. Intended encryption order: bounded plaintext input over inherited stdin → safeStorage encryption → buffer returned only over private fd3 → normal Electron `app.quit()` and observed process exit → a second process decrypting the exact buffer and comparing plaintext in memory → only then return ciphertext to unchanged `LocalPinAccess` for its existing atomic publication. Every actual encryption/decryption worker checks native protection availability and exact `userData`/`sessionData` identity. Stdout contains only receipts; errors never print exception messages or payloads. The PIN fixture is synthetic, not a user credential. The dedicated provider profile is separate from the synthetic PIN data root.

The sync diagnostic adapter is deliberately not a production design: `spawnSync` blocks and its `isEncryptionAvailable()` is a compatibility shim, while actual availability is enforced inside every worker. Production integration requires asynchronous operations and real lifecycle ownership.

## Actual execution, including harness adverse evidence

1. First intended direct-case invocation refused before PIN allocation. Its evidence-capture implementation initially omitted the pending worker receipt on this error path, so its precise failure was not retrospectively invented. Original result retained as `early-adverse-result-original.json`. The provider directory remained empty and the actual PIN child never started.
2. Bounded version-only preflight confirmed both ordinary and extra-private-pipe spawning of the installed Electron succeeded, status 0 and expected version. This does not exercise application readiness, safeStorage, or persistence.
3. Fixed nonsensitive worker-pipe preflight exposed a harness transport defect: the worker's `process.stdin` stream produced **zero input bytes**, leading to `SyntaxError` before crypto. That receipt is retained in `worker-pipe-preflight-empty-stdin-adverse.json`; an earlier less specific receipt remains in `worker-pipe-preflight-adverse-original.json`. Bounded `fs.readSync(0)` on the inherited input handle then passed the same preflight: status 0, exact 13-byte private-pipe response, no encryption/PIN operation. This only resolves the harness input channel.
4. The next intended direct-case invocation used the repaired input channel but terminated with **2147483651 / 0x80000003**, about **207.94 ms** after spawning. Stdout: 2 bytes; stderr: 438 bytes; no private response; no Local State file. Result and exact input hashes retained in `headless-startup-adverse-result-original.json`. No decrypt comparison ran and no PIN child was started. This worker used the Chromium `headless` switch in addition to creating no windows.
5. Parent explicitly authorized exactly one readiness-only comparison without that unnecessary switch. It used a separate owned readiness profile, no explicit safeStorage operation, no PIN, and no BrowserWindow. Its only successful phase receipt was `before-ready`; it then terminated with the **same 2147483651 / 0x80000003**, 438 stderr bytes, and a sanitized FATAL marker. Stderr was hashed, not printed or retained as raw content: `a616080327703471830edce5d7ae4ec7cf73f9f40c82a7bd2e9566272f9abd51`. This comparison also failed, so the prototype was stopped. No corrected two-case execution, additional variant, timeout increase, encryption weakening, or policy bypass followed.

The final inspection found all three owned provider directories empty; the synthetic PIN data directories also contained no published record. Application startup itself may initialize crypto internally, so “no explicit safeStorage operation” is not a claim that Electron never attempted any internal key initialization. The observed result cannot identify which internal startup assertion fired. It also does not establish that Windows WDAC blocked this existing Electron binary: version-only and fixed pipe operations succeeded, and the readiness failure was a native FATAL exit rather than a reported spawn permission refusal.

## Identity and retained receipts

Evidence directory: `C:/Claude/SIREN_WORK/portable/desktop/evidence/pin-provider-profile-prototype-2026-10-07`.

| Artifact | SHA256 |
| --- | --- |
| `early-adverse-result-original.json` | `47056d7ab99c64749152b21732a695682497fb268509ef934a3832ea5473418e` |
| `headless-startup-adverse-result-original.json` | `c18a261f534e0c3c88959de5795220b11fd748f3043684cb27db391b329ee4d8` |
| `readiness-preflight-result.json` | `f9c2372d37dbc61864616129ac7ba4ff88438965802d086a29a46db70c16f281` |
| Final `worker.cjs` | `9ee17c70197023ef26ca02ae452b457ed90c7fcdb36b1e2726b91d374f27d513` |
| Final `adapter.mjs` | `e3cab2a8bc3eab3482f198a5d9175cc4a347af32469ac1e821d98e772fcd5cb6` |
| Final `controller.mjs` | `e1225f23cf0c835886f56f911c2c72fbc8dd562564f643e721ab0c2ff0a116da` |
| Installed Electron executable, 245726208 bytes | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |
| Unchanged `src/account/local-pin.mjs` | `61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7` |
| Unchanged `src/projects/atomic.mjs` | `803eb8c40edd5711bae3a51ade69ab935b779bae7d1ec6e8da5808dbeea77de4` |

Each retained result captures the probe input versions used at its own execution. Final worker hash differs from the original crashing worker because of the permitted readiness-only branch/removal of the switch; the original result still identifies its original bytes. Large executable hashing streamed file chunks rather than allocating its whole contents. Worker inputs/responses are bounded, timeout values were not increased, and stderr payload contents were suppressed. All explicitly spawned main worker processes returned an exit status to the controller. A final command-line descendant inventory through `Get-CimInstance Win32_Process` was denied by the execution environment; this report does not claim an independently verified all-descendants cleanup receipt or perform any ambiguous process killing.

## What this does and does not establish

The proposed cross-process ordering could, if genuinely completed, establish that a separately started process recovered the exact encryption key/record after the encryption process's normal exit. That would be stronger than same-process roundtrip or a timed delay. Here that crypto boundary was never reached, so its feasibility in the current execution environment remains **unverified**. There is no successful helper encryption latency, PIN setup latency, stored ciphertext hash, or kill/restart result to report. Only the approximately 207.94 ms failed worker launch/readiness attempt was measured; it is not an estimate of production performance.

Future product work, if pursued, must await the provider operation, check a monotonic Lock/operation epoch after every provider await and again before atomic rename, and drain actual in-flight publication operations before confirming Lock. Serialize profile access across all workers and app instances, bind receipts to exact operation/profile/cipher identities, fail closed on timeout/nonzero exit/mismatch, and avoid shared UI profile writers. No worker error may become a setup acknowledgment or an overwrite of an existing blocked PIN record.

Legacy migration must occur only after successful decryption, complete record validation, and genuine matching PIN authorization. Wrong-PIN attempts must not trigger legacy migration or silent verifier replacement. Unknown protection version, missing original profile key, or decrypt failure must retain the original record and refuse access; a separate profile cannot reconstruct a lost old profile key. Test cancellation, failed publication, interrupted migration, actual wrong-PIN rejection, and existing graceful/abrupt controls before making any product claim. This prototype did not perform those tests.

The upstream architecture analysis remains in `reviews/2026-10-07-windows-pin-keystore-persistence-upstream-research.md`; the original other-author six-profile adverse matrix is unchanged. This unsuccessful harness experiment neither explains that matrix's underlying failure nor qualifies a correction for it.
