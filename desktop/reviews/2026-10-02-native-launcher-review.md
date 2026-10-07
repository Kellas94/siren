# Independent native development launcher review — 2026-10-02

Author: independent reviewer agent `/root/review_native_launcher`. This is my original assessment of the files below, not a coordinator-authored verification statement.

**Disposition: changes required for the scoped development delivery. No release PASS.** Three actionable findings are supported by independent Windows filesystem probes. The existing four Node attachment tests pass but do not cover these cases. I did not compile Rust locally, execute a Rust launcher, disable Windows Application Control, install an alternate toolchain, or qualify a production updater.

## Reviewed snapshot and scope

Reviewed every file under `desktop/launcher/` and `.github/workflows/launcher-verify.yml`; read the Task 6 brief and the existing Node path/atomic/hash/manifest helpers used by attachment. Root product changes, Code fix, publisher signatures, extraction, apply, rollback and release admission are outside this review.

The coordinator supplied frozen private CI commit `9888badc13273958a1ce8df4eac7ac4a3cc0bda7`, tree `96b5a90db10d02ef2bca7e16b977b478b469f73c`, and a separately verified local/remote file mapping. The local checkout HEAD observed here is `a92692f523e8664fab24e0862a1b7fcc5c7db006`; launcher/workflow files are untracked in that checkout. The CI commit is not in this checkout's object database, so **I independently bind this review to the following file SHA-256 values**, and do not claim to have independently verified the remote Git tree.

| File | SHA-256 |
| --- | --- |
| `desktop/launcher/attach-development.mjs` | `0e62ee566c0f78e0a61798a195471e69f60af1308a3b53b3a00c952c161161b9` |
| `desktop/launcher/attach-development.test.mjs` | `9cd150eeffc47e4e3ea1c72111b76eb47edd59d82ef2a8cbff9eea40c2282d17` |
| `desktop/launcher/Cargo.lock` | `af367ee3e4d9e16845d9cab56733becdebd982dc8eaf530ac1965d58743dab7e` |
| `desktop/launcher/Cargo.toml` | `60b4264145689082161037b11014ed91a49c598f22e2e8589c68d935d4b98a06` |
| `desktop/launcher/README.md` | `10361bfb43fc2ccf7d24855c78ebcf77d6e70303df8e7c0b72093fce5b69f199` |
| `desktop/launcher/src/lib.rs` | `834b1270200e3b1749c69120175ce30c0a78d8546355a3a9838d3ac2ada01376` |
| `desktop/launcher/src/main.rs` | `5f3f999d5f2de9f695c7fbf08bcaa3abf027f6fa9c7e167d205f36f9584af820` |
| `desktop/launcher/src/selection.rs` | `da4a90e746a3b20e8f3835522607c5455577d56de3d6c8cf4aced1bb5f7e58e7` |
| `desktop/launcher/tests/launch.rs` | `680f85dceb63f9e07481f981f2754183e067d16eff31a2a7068a3741686dc85e` |
| `desktop/launcher/tests/production.rs` | `91aacb4325437f9e7ecf8c8eb538cf15ff32f17ddd1d623330ca17aa2135adb1` |
| `desktop/launcher/tests/selection.rs` | `ab6368f9b589485b024f91a8391d2c896dc90929539118c9127d321182e312a9` |
| `desktop/launcher/tests/fixtures/app-probe.rs` | `c3854748e40747a15d46aff29641039a50e7d47fc9415b6d61e2ed94653bdf54` |
| `.github/workflows/launcher-verify.yml` | `539929eb6f2d00b2c9f98c5b81656994e0e15fb329955f1f0128fe7298770bc2` |

## Findings

### 1. [P2] Directory handles do not freeze the verified file census

Location: `desktop/launcher/src/selection.rs:92`, `:108`, `:115`; `desktop/launcher/src/main.rs` child spawn after `select()`.

`hold()` opens directories with `GENERIC_READ`, `FILE_SHARE_READ`, `FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS`. That prevents conflicting operations on the held directory object, but does not prevent creating new child files. The census reads each directory once. After a directory has been enumerated, another writer can add an unlisted file before `spawn()`, or while the child runs, without changing any held file. That new file is never checked against the selector or hashed. Holding verified files is useful, but the README's claim that extra files prevent startup is incomplete under concurrent insertion. The exact consequence depends on what runtime code subsequently loads; I have not demonstrated Electron loading an injected DLL or bypassing activation.

Independent real Win32 evidence: `python desktop/reviews/native-launcher-directory-lock-probe.py` opened an owned directory with those exact flags and successfully created `injected.dll` while the handle remained open. Output: `directory_handle_valid=True; unlisted_child_created_while_held=True`.

Required correction: establish an explicit trust/immutability boundary for version directory membership before claiming a verified immutable payload; add a real adversarial native test that inserts a previously absent executable asset after census. A second census alone cannot eliminate the final race. If the development contract is intentionally only existing-file integrity, make that restriction explicit in qualification and documentation instead of claiming full tree immutability.

### 2. [P2] Attachment failure leaves a state that refuses the authorized retry

Location: `desktop/launcher/attach-development.mjs:64` through `:69`, paired with the unconditional absence checks at `:46`.

The function publishes `App/current.json`, copies the root launcher, validates/syncs it, then writes the updated identity. A failure in any later step has no cleanup or same-identity resume. The next invocation sees the already-created pointer/launcher and refuses, even if that prior attempt is the caller's own interrupted attachment. A copy failure can leave a selector without a root launcher; a sync/identity failure can leave a runnable launcher without its BUILD-IDENTITY receipt. This is a normal recoverability issue without requiring malicious input.

Independent Windows reproduction: a valid read-only artifact is readable/hashable and `copyFile()` preserves its READONLY attribute. Copy and hash readback succeed, but the `open(launcherPath, 'r+')` durability step returns `EPERM`. The original identity has no `launcher` receipt; both selector and root launcher remain. The identical retry returns `Development launcher attachment never replaces an existing selection or launcher`. Original Data bytes remained unchanged.

Reproduce with `node desktop/reviews/native-launcher-attachment-adverse.mjs`. Observed values: `selectionPresent=true`, `launcherPresent=true`, `identityHasReceipt=false`, `dataUnchanged=true`.

Required correction: make attachment an exclusive recoverable transaction. Publish only after all preparatory checks and support exact-identity completion/retry or clean up only files proven to belong to the failed transaction. Serialize concurrent attachment attempts; the initial `absent()` calls and atomic rename do not provide mutual exclusion. Preserve any pre-existing launcher/selection and project data.

### 3. [P2] Attachment accepts a selector that the native metadata bound rejects

Location: `desktop/launcher/attach-development.mjs:53` through `:64`; consumer `desktop/launcher/src/selection.rs:5`, `:39`–`:41`.

Attachment limits file count and extracted bytes but never limits the actual serialized selector size. Native selection rejects anything over 1,048,576 bytes. A valid payload well inside the 50,000-file, 240-character path and 2 GiB extracted byte limits therefore attaches successfully yet cannot launch.

Independent real filesystem reproduction: `node desktop/reviews/native-launcher-attachment-adverse.mjs --large-metadata` generated the two required payload files plus 4,200 additional zero-byte files with safe 200-character leaf names. Attachment completed successfully and updated BUILD-IDENTITY, but `App/current.json` was **1,251,976 bytes**. Native rejection follows directly from the unconditional 1 MiB guard; I did not run Rust to observe that error locally. Data remained unchanged.

Required correction: serialize and validate the exact selector bytes against the shared native metadata limit before publishing any attachment state. Keep a meaningful cross-language limit test.

## Reviewed controls and qualifications

- Default features are empty and `select()` returns `PUBLISHER_NOT_CONFIGURED` before filesystem selection in a production build. The production test asserts this exact refusal. This is a sound refusal contract, not a signed-launch implementation.
- Native selection derives a fixed executable path from its own root and stable numeric version. It uses typed `deny_unknown_fields` structs, rejects invalid encoding/duplicate struct fields through serde deserialization, bounds metadata/read/aggregate bytes and manifest file count, rejects escape/stream/reserved/case aliases, requires runtime and ASAR entries and checks every enumerated file hash. The reviewed code has no Data write path.
- Windows opened-file verification checks reparse attributes, file hard-link count and final handle path. Its FFI declarations/layout and buffer length checks are structurally consistent with their Win32 contracts. Existing file locks are retained in `Selection`, and the normal launch path explicitly drops that value after `child.wait()`. This is code inspection; I have not independently observed the native fixture or child-lifetime tests passing on the hosted runner.
- The child command uses a fixed executable and root cwd, no shell, no forwarded switches, and removes `NODE_OPTIONS` and `ELECTRON_RUN_AS_NODE`. Environment removal does not by itself prove all Electron runtime configuration paths are confined; no broader environment-hardening claim is made.
- The workflow pins action commits, uses hosted Windows, exact Rust version, locked dependencies, separate development/default-feature tests, a private raw binary receipt, and `persist-credentials: false`. It tests debug launcher code then builds a release/static-CRT preview; the exact release artifact is not itself exercised by that workflow's Rust fixture tests. Hosted CI results and a real packaged Electron launch remain necessary evidence.
- Receipt validation checks schema/commit/target/toolchain/feature/hash fields, but the local receipt and binary do not authenticate their origin. A party able to fabricate both can declare any source commit and hash. Trust must come from the separately authenticated private CI retrieval and the coordinator's source mapping. `MZ` alone is not PE/toolchain provenance. This is a scope limit, not a request to add publisher admission to development attachment.
- Native recursion also retains a handle for every encountered directory, including empty/unlisted directories, without a separate directory-count budget. Path length limits bound nesting, but not arbitrary breadth. I did not stress resource exhaustion and do not promote this observation to a separately reproduced finding.

## Evidence and remaining gate

Independently executed `node --test desktop/launcher/attach-development.test.mjs`: **4 passed, 0 failed**. Independently executed both retained adverse probe scripts above: observed the three findings and unchanged original Data bytes. The scripts create/remove only their own temporary directories under `desktop/reviews`; they do not modify launcher/product sources or alter machine policy.

The coordinator reported retained CI RED evidence and pending Rust GREEN. I do not infer a passing native launch from that report. This review must be rebound to updated source hashes and independently rechecked after corrections. Signed updates, archive extraction, shared signature corpus, recovery journal, rollback, helper replacement, owned-instance waits, minimum allowed version and boot confirmation remain open Task 6 work. Neither this review nor development CI is release admission.
