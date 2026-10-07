# Dedicated Electron protection profile — external-token prototype observation

Author: `/root/media_batch_review` (Codex subagent), 2026-10-07. Own experimental implementation and execution; **not independent approval of my own prototype**, not a product fix or release approval.

This separate record supplements the unchanged adverse report `2026-10-07-pin-provider-profile-prototype-adverse.md`, SHA256 `8cd2c0ff36fdef3f16c85574be0ae482614cd6c38fe327242897317096b17f86`. All original adverse receipts remain unchanged. Only ignored evidence scripts/receipts and review documents were authored; no product source, tests, build, generated files, security policy, or existing account data changed.

## Environment diagnosis and authorized continuation

The earlier failed app-ready invocations used the default **restricted execution token**. After the original report, parent explicitly authorized a bounded fatal-category-only replay of the unchanged readiness operation. It identified the known `install_dir_access.cc:52` FATAL category, recorded only as `INSTALL_DIR_ACCESS_ACL`; no raw stderr or payload was printed/persisted. Receipt: `readiness-category-only-result.json`, SHA256 `ef78c00fe0cc9a4f305d84bf84e6122d532ce34b3aec1ead3c7f10c6eed9581b`.

Parent then authorized one execution of the exact readiness worker/arguments/profile outside that token. `require_escalated` was used; Electron's sandbox and flags remained unchanged, no BrowserWindow was created, and no explicit safeStorage/PIN operation was invoked. It exited 0 with no stderr and reported ready/profileMatches true. Receipt: `readiness-external-token-result.json`, SHA256 `ccb1caa1214c5e8fafd17c1014ca29895281451a77cb1a4d027b5ba87fcd9c77`. This establishes an execution-environment distinction; it does not retrospectively turn the restricted observations into crypto results. The earlier zero-byte `process.stdin` transport defect and repaired bounded `fs.readSync(0)` preflight also remain separately recorded.

After this success, parent explicitly authorized **exactly one** execution of the existing two-case controller outside the restricted token. It verified both intended provider/data directories were still empty; it retained the same fixed operations, profiles, worker byte bounds and timeouts. The separate readiness profile was only for the preflight and was not used as a protection provider by either case.

## Actual observations — two cases, one execution

Receipt directory: `C:/Claude/SIREN_WORK/portable/desktop/evidence/pin-provider-profile-prototype-2026-10-07`.

Result: `result.json`, SHA256 **`8a6cca4e7865d0ed433467b4de8e1c9783c53d1aa269ac5154c4a6fc908e5ebc`**, records **COMPLETE 2/2** for these exact bounded cases. Execution interval: `2026-10-06T21:41:17.649Z`–`21:41:18.979Z` (1330 ms including controller file hashing and both cases). These are sampled diagnostic timings, not a performance target or GUI responsiveness measurement.

### 1. Direct exact cross-process receipt

Both Local State and PIN record were absent initially. The first real safeStorage worker encrypted a 63-byte synthetic text, exited normally with status 0, and returned a 94-byte ciphertext through private fd3. Its elapsed time was **129.64 ms**. Only after that exit did a second independent Electron process decrypt the exact ciphertext and compare the plaintext in memory; it reported exact equality and exited normally, **113.93 ms**. Both native availability/profile identity checks were true; both had zero stderr bytes.

Cipher SHA256: `483b2157e2984f0fe83a36eb525524430a96cbedae8f50dda3f260155018d5a6`. The first normal exit produced 490-byte Local State SHA256 `4cb2edf8b5cc134fa1133e1dda0a567f9c826debb029f51694c93998d0ef1a15`; its identity remained the same after verification. No PIN record was created by this direct case.

### 2. Unchanged LocalPinAccess setup → owned abrupt kill → restart/unlock

The separate PIN case started without Local State or a PIN record. Node child **23464** imported actual unchanged `src/account/local-pin.mjs`, using only the diagnostic sync adapter as its injected storage dependency. Setup derived the real scrypt verifier, then the adapter completed a genuine encryption-worker normal exit followed by a separate exact-decrypt verification-worker normal exit before returning ciphertext. The unchanged class then performed its actual atomic write/readback and acknowledged setup with configured/unlocked true. Those two provider workers took **113.39 ms + 104.15 ms = 217.54 ms**, excluding derivation, child startup, and PIN-file publication.

After the acknowledgment, the controller observed the owned files and terminated **its exact Node child handle** with SIGKILL; the exit receipt reports signal SIGKILL. The PIN record remained **222 bytes**, SHA256 `961e4020ac1e1a802d005876456494e8d8d8ef38fed32d91baf37e94e5a11b3d`, unchanged across that termination. Its dedicated 490-byte Local State also remained unchanged, SHA256 `69e5c342fc3b6b9f4e4674752a5c9f59e8ae76c599e9741a9a7a51a1deae3230`.

New Node child **32572** initialized through genuine worker decryption and the unchanged class's record validation: configured true, unlocked false, blocked false. Its known synthetic fixture PIN then passed the class's real scrypt comparison and unlock operation. That operation re-encrypted, separately verified, and atomically persisted the record. Final configured/unlocked true, blocked false; child exited 0 with no stdout/stderr payload. The four restart provider workers took **113.02, 123.37, 107.73, and 105.76 ms** (449.88 ms total). Final PIN ciphertext SHA256 `4da0cf743c9bf1c5e7c626a4ea3b4d5234f7ad27c5d1481911ef6585ac2e0fcd` changed as expected with fresh encryption, while the provider Local State stayed the same.

Across both cases, all **eight** crypto workers reported Electron **44.5.1**, Chromium **152.0.7977.130**, actual encryption availability and exact configured profile identity, status 0, no signal/timeout, and zero stderr. Child stdout and worker stdout contained no secret record content; secret transformation bytes traveled only through bounded private pipes/in-memory structures. The persisted real record contains the verifier, not the plaintext fixture PIN.

## Identity, closure, and scope limits

| Input / receipt | SHA256 |
| --- | --- |
| `worker.cjs` used in successful execution | `9ee17c70197023ef26ca02ae452b457ed90c7fcdb36b1e2726b91d374f27d513` |
| `adapter.mjs` | `e3cab2a8bc3eab3482f198a5d9175cc4a347af32469ac1e821d98e772fcd5cb6` |
| `controller.mjs` | `e1225f23cf0c835886f56f911c2c72fbc8dd562564f643e721ab0c2ff0a116da` |
| `pin-child.mjs` | `f630a866b923db45dad1c88450ac3a2886e605489426a6970bf2f45160e24218` |
| Installed Electron executable | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |
| Unchanged actual LocalPinAccess | `61b0eb84e4b90d2babd73d2dde9c34c976c271f17c7c0c5eb98dc9c47547eea7` |
| Unchanged actual atomic writer | `803eb8c40edd5711bae3a51ade69ab935b779bae7d1ec6e8da5808dbeea77de4` |
| `closure-external-token.json` | `94827afe1efda69365e43a567b878d2b1bcd0cb6ed4651d8017ff10e22be05fe` |

Read-only Win32 process inventory outside the restricted token at `2026-10-06T21:41:53.8994025Z` found **zero Electron/Node processes whose command line matched this exact prototype directory**. The controller had already observed each explicitly spawned worker exit, the owned setup child's SIGKILL exit, and the restart child's normal exit. This scoped inventory does not claim knowledge about unrelated processes.

These observations establish a feasible **isolated existing-Electron route for this sample**: normal provider exit followed by separate-process verification happened before publication, and an acknowledged synthetic PIN remained usable after abrupt termination of its Node owner. They do not qualify abrupt termination of the production SIREN Electron app, packaged worker entrypoints, OS crash/power loss, competing app instances, filesystem tampering, worker timeout/failure during actual class persistence, wrong-PIN behavior, interrupted migration, corrupt profile, availability failure, or Lock races. No repetitions beyond the single bounded two-case run were performed. The diagnostic `isEncryptionAvailable()` shim remains an explicit limitation, not a claimed production API implementation.

Production must use asynchronous provider awaits, an actual availability contract, monotonic epoch checks after provider awaits and before publication/rename, and Lock draining of actual operations. Serialize dedicated-profile writers across instances and bind every receipt to exact operation/cipher/profile identity. Failures must refuse publication and preserve any existing record. Migration requires successful legacy decrypt/validation and actual matching PIN authorization; wrong-PIN paths must not migrate. No separate profile can reconstruct a lost legacy key. Keep the original adverse PIN matrix and this prototype's adverse observations immutable, and require the missing fault/Lock/package tests before calling a product correction complete.
