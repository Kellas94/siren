# Independent CI6 observation — 2026-10-02

Author: independent reviewer agent `/root/review_native_launcher`. Earlier authored reports remain unchanged.

**Disposition: authenticated development CI GREEN independently observed for the frozen source below. No production release PASS.** This supersedes only the earlier reports' statement that CI6 execution was pending. It does not close signed-update, durable-recovery or hostile directory-insertion qualification.

## Authenticated execution observed

I independently called the connected GitHub read tools for the run, job, decoded job logs, Git commits and recursive tree. I did not rely solely on coordinator-supplied saved logs.

- Repository: `Kellas94/siren`; authenticated run response confirms `private: true`.
- [Run 37020405429](https://github.com/Kellas94/siren/actions/runs/37020405429): pull-request event, attempt 1, completed, conclusion success.
- [Job 110881721048](https://github.com/Kellas94/siren/actions/runs/37020405429/job/110881721048): completed, conclusion success. Selection, actual native launcher, production refusal, attachment, release build and receipt/transport steps all report success.
- Hosted system reported Windows Server 2025; official installed toolchain reported Rust 1.99.0 and Cargo 1.99.0.
- Direct job log observations: **10 selection tests passed**, **2 actual native launcher tests passed**, **1 default-feature publisher-refusal test passed**, **7 attachment tests passed**. Meaningful total: **20 passed** (13 Rust plus 7 Node), with zero failures; Rust summaries have zero ignored/filtered, Node has zero skipped/cancelled. Empty default-feature test modules are not counted as additional tests.
- The passing named tests include raw-parent alias refusal, held-file write/delete refusal, junction/hard-link refusal, late unlisted member recheck, actual selected native child launch, and readonly-artifact/oversized-selector/handled-identity-failure attachment cases.

This is observation of authenticated hosted execution. I did not compile Rust locally or alter Windows Application Control.

## Checkout and source identity independently resolved

The run API's head SHA is `00ee38ff1acfdb9b8599f958390f79fb484cdd40`. The checkout log and artifact receipt correctly identify the actual tested PR merge checkout as `dc41c29351dad382adf6df900e388d5b843f7fa2`.

The authenticated Git commit response for that merge identifies ordered parents:

1. `688c48528ff7bdab77908faf041806d10acc54dc`
2. `00ee38ff1acfdb9b8599f958390f79fb484cdd40`

Both the authenticated merge commit and the authenticated frozen head commit point to the identical tree `aecba93ef0a7ba033ebe53f55bb0a3bdafc7c8a7`. The recursive tree response is not truncated. I independently computed `git hash-object --no-filters` for each of the 13 frozen launcher/workflow paths and compared them with that authenticated tree: **13/13 exact Git blob matches**. This resolves the remote-source mapping limitation recorded in the prior review.

| Frozen path | Authenticated Git blob SHA |
| --- | --- |
| `.github/workflows/launcher-verify.yml` | `44658b3512226aeead2516176a098e5d9813a076` |
| `desktop/launcher/Cargo.lock` | `c785ab523c92a369e50207cc8a45da180d421466` |
| `desktop/launcher/Cargo.toml` | `c6189ee52a75dbae2ef2bbc46fdfec0ff46a3fe4` |
| `desktop/launcher/README.md` | `d82639f5d4f2ec26bc7960141b82a057733396a1` |
| `desktop/launcher/attach-development.mjs` | `b9a940d39ce7e789c72a2b71ff96a21e73facca6` |
| `desktop/launcher/attach-development.test.mjs` | `e2aaa3234b1191e6b1a80d2f0dbd9261e600f0f7` |
| `desktop/launcher/src/lib.rs` | `dcdb10e5ea4ac5a46f17382f1629198773509c57` |
| `desktop/launcher/src/main.rs` | `2d3a7e53549f3cb0d15ddf7451d4d880a9d310f1` |
| `desktop/launcher/src/selection.rs` | `b8728e1766c76679e8aa4631725efce5fc6e67cf` |
| `desktop/launcher/tests/fixtures/app-probe.rs` | `babf7640a8894678c4a7d748f53005945c81db01` |
| `desktop/launcher/tests/launch.rs` | `75e4d94ee4661c64992912d09cd7e4ca5e88d813` |
| `desktop/launcher/tests/production.rs` | `c0d8c866c4f558439d715954c96317b799a7c204` |
| `desktop/launcher/tests/selection.rs` | `faeea2fa9ba02275a7162fb10ba0e6d173157e04` |

Two later local files, `desktop/launcher/probe-packaged.mjs` and `desktop/launcher/probe-packaged.ps1`, appeared after the CI freeze and are absent from this authenticated tree. They are excluded from CI6 source qualification and were not reviewed as part of this observation. This report does not represent all subsequently created local launcher files as CI-tested.

## Exact development release artifact

I parsed the receipt from the independently fetched job log's receipt marker block and compared it with `desktop/evidence/native-launcher-ci6/launcher-receipt.json`. They agree on:

- schema 1; kind `development-preview`; `releaseAdmitted: false`
- source commit `dc41c29351dad382adf6df900e388d5b843f7fa2`
- target `x86_64-pc-windows-msvc`; Rust `1.99.0`; sole feature `development-preview`
- binary size **465,920 bytes**
- binary SHA-256 **`6dde7374e965dcef44d730f1bc4a08042fab77b5873cc14fa96292edc2b5bfc2`**

I independently read the local `desktop/evidence/native-launcher-ci6/SIREN.exe`, checked its size and recomputed SHA-256; both match the authenticated receipt. I also checked the authenticated log transport framing: one bounded binary block with 63 sequentially numbered chunks, each at most 10,000 characters, totaling 621,228 base64 characters, consistent with 465,920 binary bytes. No binary/base64 data was emitted by this review.

The workflow tests a debug native launcher fixture and separately builds the release/static-CRT development binary. This observation verifies the exact release artifact's authenticated receipt and local byte identity, not its runtime behavior on this machine. The coordinator reported a local release `--verify` exit 0; I did not independently execute that artifact or inspect a retained execution record in this assessment. Any subsequent packaged Electron or release-artifact runtime evidence should be recorded separately with its own scope.

## Continuing limits

The original attachment exception/metadata findings remain repaired at the hash-bound source reviewed in the attachment addendum. The final file-membership census now has observed hosted test evidence for detecting a completed late insertion before recheck. The original direct Win32 probe still shows that holding a directory does not prohibit new children; insertion after the relevant enumeration or during the child lifetime is not closed.

These authenticated CI observations do not authenticate a production publisher, implement or validate signed ZIP updates, qualify an immutable hostile-concurrency boundary, prove power-loss apply/rollback recovery, validate helper replacement or owned-instance waits, qualify activation, or admit a release. The default production build's successful test is its deliberate publisher-not-configured refusal.

