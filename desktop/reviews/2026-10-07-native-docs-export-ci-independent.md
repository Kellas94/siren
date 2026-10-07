# Docs export CI wiring — independent scoped review

Author: `/root/native_menu_trace_review`, 2026-10-07. This is a new read-only review, not a rewrite of the original formatter, integration, or workflow adverse evidence.

No concrete wiring defect found in the inspected snapshot. Four own bounded verification groups completed; the two existing Docs CI tests also passed. No product, tests, build, or workflow inputs changed; no GUI, Electron, full suite, hosted job, merge, push, or release action was run.

## What was actually verified

- Development Docs export runs once in `native_windows`, conditional on `matrix.group == 'desktop'`. The copied-package job calls the same harness with `--package $preview.previewRoot` and immediately throws on nonzero exit.
- The harness calls the actual `copiedPackageContext(evidence)` and spreads its launch object into `launchDesktop`. The actual driver spawns that executable and omits the development project argument when `packaged` is true. Thus the copied call does not silently fall back to development execution.
- Own probe exercised the real helper and real filesystem/hash implementation on tiny synthetic inert files: no argument returned null; missing package root refused; supplied root was copied into an owned Unicode directory and archive/runtime/process-reader receipts verified; returned launch selected the copied executable and packaged mode. Corrupting the copied archive then made verification refuse. No synthetic executable was launched. The harness also invokes final package verification and maps an adverse verdict to exit 1.
- Both always-run upload steps have corrected YAML literal header/body indentation (10/12 spaces) and exactly `desktop/evidence/docs-export-native/*/result.json`. Own path checks confirmed the receipt path matches and representative nested profile, project export, copied package Data, screenshot, and runtime-log paths do not match the configured upload patterns. This is a source/glob-boundary check, not an actual actions/upload-artifact execution.
- All existing `timeout-minutes` declarations match Git HEAD. `scripts/native-verification.mjs` is byte-identical to Git HEAD; desktop/sources/diagrams remain 20/20/20 with no Docs export group insertion. Existing limits were not raised. The additional step consumes existing job time; this review cannot establish hosted duration headroom.
- Inspected native harness already contains actual-browser focused Cancel Enter and keyboard-only Confirm cases. Their source presence is verified here; their native behavior was not executed by this review.

## Exact input SHA-256

All seven hashes were captured before and after the bounded probe and matched.

| Input | SHA-256 |
| --- | --- |
| `.github/workflows/desktop-verify.yml` | `0ca258c978e49f08911c812a6cccbdcf4f245c3a5c0cb333f2989e6ccd3b8961` |
| `desktop/tests/docs-export-ci.test.mjs` | `7d0460dd5c8d553fedc17781c34218c9d7e17a1437dda1b2e8de1ba9b34c38d6` |
| `desktop/tests/native/docs-export.mjs` | `27f9e5c76f18ee15b8ea403e5ce540eba06d5e2b5166420577f46e184ce6b19f` |
| `desktop/tests/native/package-context.mjs` | `67ed04e8a33da97364098b388d622ccd3c17e83b4c49fb8775665cdc5bd31c5c` |
| `desktop/tests/native/drive.mjs` | `897408a2e194127b6e3cce4d4a487bdcd231178ce61d69e0443bc3a6ee02a5ca` |
| `desktop/scripts/native-verification.mjs` | `55f4b43265e5eda950c86f26e95e539ececfe633e886097adaac7c96e8872d0b` |
| `desktop/src/updates/download.mjs` | `f3712e304b05cb472e59a2bc043e36a3d520a1640ee3dd523bc6ea3aa30099cf` |

## Own retained evidence and limits

Under `desktop/evidence/docs-export-ci-independent-2026-10-07/`:

- `probe.mjs` SHA-256 `a7515bca1fb42ae775f3cd217863a49aec1fd8fd74b19032acd9e8accd7c168f`.
- `result.json` SHA-256 `26bb1d4b00c7bc56fee1d97d688fd15ccb57da4808185966eefaeb8180780551`: four verification groups, COMPLETE, identical before/after inputs.
- `focused.log` SHA-256 `a57c225423eba0f76049dfe86d1c19feda4233552e41d6f2b8e9401e66169562`: two tests passed.
- Original own probe setup mistakes remain as `probe-first-syntax-error.mjs` (extra closing parenthesis) and `probe-second-path-error.mjs` (assumed nonexistent harness.mjs instead of actual drive.mjs). These failed before relevant checks; they are reviewer harness errors, not product REDs. Corrected probe output above is a separate bounded result.

This review does not independently rerun or reinterpret the parent's previous full-suite results, original malformed workflow header RED, local native receipts, or hosted receipts. It confirms the current wiring snapshot only. No release approval, native qualification, or closure of the separate original Diagram timeout is implied.
