# Native writer exclusion — retained observation

Author/inspection: `/root/media_batch_review`, 2026-10-07. Harness authored by this agent; **native execution performed once by `/root`**, outside the restricted token as confirmed by the parent. This author read/rehashed the retained receipt and current inputs; I did not execute the harness. The result's `author` field identifies harness authorship, not an independently authenticated native executor. This is not independent runtime approval or release qualification.

Original receipt: `desktop/evidence/pin-worker-writer-exclusion-2026-10-07/result.json`, SHA256 **`eab1f5c546eb4226b1713854742c00521cb01f48cd9ae658507468ff7432f7ef`**. It records **COMPLETE 4**, `changedInputs: []`, interval `2026-10-06T21:53:09.893Z`–`21:53:11.015Z` (1122 ms). My inspection confirms all seven product input hashes still match that receipt. No GUI/source/test/build/workflow edits or new native execution were performed in this inspection.

## Recorded observations

The real windowless Electron holder **PID12316** acknowledged lock ownership, exact owned profile, executable and program name; Electron44.5.1/Chromium152.0.7977.130; no BrowserWindow. It reported **two actual `second-instance` notifications** while still owning the lock, rather than relying on timing assumptions.

- Direct unchanged/default `PinProtector.encryptString` refused `PIN_PROTECTION_FAILED` in **72.45 ms** while the holder remained alive; first actual notification; PIN absent.
- Actual `LocalPinAccess` setup using that protector refused `PIN_STORAGE_UNAVAILABLE` in **113.83 ms**; blocked true/unlocked false; second actual notification; PIN and Local State still absent in the immutable refusal snapshot.
- Controller terminated only its owned holder child handle and observed **SIGKILL/close**; watchdog false, holder stderr0. After that exit, fresh actual/default provider encryption (including its independent decrypt verification) and explicit decryption returned exact text in **341.42 ms**. Cipher79B SHA256 `de70287b43c6b1ccb168875e7087914e99e2ce47fc7c922e68df615485c646fa`; Local State490B SHA256 `86c718857ae85a43e1b13cfcf7d3129c79009618881c624b1a6d94b08284778c`; provider alone published no PIN.
- Fresh actual `LocalPinAccess` with the fresh provider successfully published the dedicated envelope in **278.15 ms**: configured/unlocked true, blocked false; PIN232B SHA256 `3e78d85ccfff67c0edb015a26308cfdada21eff8419c5af0b134b7cc8fc5942b`. The original failed class remained blocked/unlocked false. Local State identity stayed unchanged.

## Exact identities

| Product input | SHA256 |
| --- | --- |
| `src/account/pin-protection.mjs` | `1e47f90e02e0e17b29c6cc26ee555c85fdeebea289cb6e4bf66b0c2b437d79fb` |
| `src/account/pin-worker.mjs` | `cc7c1c07b18f939c527b1c872141cbc43f25458d5612b9ca8e22b1306eb0c995` |
| `src/account/pin-protocol.mjs` | `d673e53389c2f20e98fbd5b20bc53e8b496e12b913e467117c7fea19e2df2f5a` |
| `src/account/local-pin.mjs` | `a41f4d6868820973b92f568239934b4d1a669db317b4388aed049e225b6eb537` |
| `src/start.mjs` | `1db3fb8b968168f69a915956927bcf5f544a59dd792be21c635e3e6d5a0b4f62` |
| `package.json` | `dbce38460412c79f3ae8618279ec27c11ffcc01598aebab672e36e867adccb19` |
| `src/projects/atomic.mjs` | `803eb8c40edd5711bae3a51ade69ab935b779bae7d1ec6e8da5808dbeea77de4` |

Installed Electron executable SHA256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. Harness identities match prepared files: holder `8acb54890dd7660a16b6e24614612c6d517f4c72160513903d9a4691d0ecedf2`, controller `fd9c98be08f67c866ce5642c18a7a38e1dcb3ae32b7d912a923727a6e7a44fea`. Original prepared-only CONTRACT remains SHA256 `34c8ce83d984edc446a5141bb8d2b1062da101e5deb095ff3b4ca06a7adc7bb6` and was not rewritten.

## Limits

These recorded outcomes establish this sample's live-owner exclusion, no PIN publication during contention, and reuse after that owner's confirmed process death. Default real provider spawn/worker/start were used; no crypto or worker transport substitution. Provider API completion enforces actual child-close checks internally, but the harness does not separately record every worker PID/exit and does not invent those receipts. Sample timings are not performance targets.

The holder is a public-API fixture, not an actual SIREN worker orphaned by killing the production parent. No production orphan scenario, packaged dispatch, Lock/cancellation race, worker timeout, first-launch crash/power loss, wrong PIN, corrupt profile, migration, existing-record recovery, or original incident cause is qualified by this run. App-ready may initialize Chromium internally; this was explicitly a contention test, not a crypto canary or first-key persistence qualification. All original adverse evidence remains intact. No global PASS or independent approval is asserted.
