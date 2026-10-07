# Native Docs export — original hosted evidence retention

Author: `/root/disk_inventory`. Role: owner evidence retention and source-identity observation, not independent product approval. Actual tests were executed by GitHub Actions. This report was written only after the run reached FINAL; it does not substitute local testing for hosted testing.

## Final outcome and immutable identity

[Run 37546239582](https://github.com/Kellas94/siren/actions/runs/37546239582) finished **FAILURE**, last updated `2026-10-06T23:33:59Z`. Seven actual jobs were returned: three success, three failure, one skipped.

- Canonical commit: `f608bd4f94250f823e592b0e340975d746fe1f79`.
- Canonical and integration tree: `2f028fb23530e2963bf2f88d1388e6df28e0aa70`.
- Actual integration: `fe86e46b77a9007602cdc6e93f4aebfb88b7a0fd`.
- Exact ordered integration parents: main `1e5472dde446657e2dbb155868e28e033c6c9c92`, then canonical `f608bd4f94250f823e592b0e340975d746fe1f79`.
- Main at retention still points to `1e5472dde446657e2dbb155868e28e033c6c9c92`.

These values come from retained GitHub commit/ref/run/job API responses. Newer local Presenter work is outside this hosted source identity.

## Actual adverse result

Desktop unit job `112550900844` failed at **Unit and protocol behavior (includes real 180-second timeout)**. First failing TAP result is #452, `readonly saved Docs exports exact archive with finite receipt; references and claims remain exact, foreign project data excluded`.

The original log records `failureType: hookFailed`, with the after-hook assertion at `tests/native-docs-export.test.mjs:18:27`. Its strict equality compared:

- Actual: `C:\Users\runneradmin\AppData\Local\Temp`.
- Expected: `C:\Users\RUNNER~1\AppData\Local\Temp`.

The same hook mismatch is recorded for #452–458, seven failures. This proves the path-string mismatch in cleanup validation. It does not independently establish that every affected product assertion passed and does not qualify the skipped development native probes. The report makes no product root-cause or correction claim.

There were **1,291 unique unit tests**: identity suite 3 plus main suite 1,288, with 7 failures. Raw job TAP totals 1,292 because an early single IO probe is included again in the main suite; its exact title was matched before deduplication.

Dependent native job `112552592245` finished **SKIPPED**. No desktop/sources/diagrams native group artifacts were published: zero executed original group probes are retained. Development Docs native export and development PIN crash matrix are therefore unexecuted in this run. Desktop qualification `112553981743` and merge qualification `112554036743` failed their actual-result gates.

## Separately successful copied-package scope

Packaged job `112550900722` finished **SUCCESS**. The original artifact contains 30 module receipts, all `COMPLETE`, with 156 recorded cases, plus completed core packaged and shell receipts. This success does not change the overall adverse result.

The actual copied-package Docs export receipt contains seven successful cases: readonly saved JSON export; receipt-bound Show file; Markdown export while retaining a dirty draft; inert HTML and archival appendix; cross-window receipt isolation; keyboard Cancel without publication; and keyboard-only JSON confirmation. Its `changedInputs` is empty and `packageUnchanged` is true. Only the OS file reveal was adapted, as declared in the original scope; no manual OS-dialog qualification is implied.

Original Docs receipt:
`desktop-packaged-evidence-original/evidence/docs-export-native/2026-10-06T23-24-29.460Z/result.json`, SHA-256 `9a24fad009a8db6cd14fa55e78c0950668d2768067052e8ea630c5be799d0c44`.

Copied PIN recovery is `COMPLETE`, three cases, with unchanged inputs and a 78-file copied-package input inventory. Original 300,000-line source-bundle import is `COMPLETE`, four cases, 7,088,891 source bytes and 9,454,085 bundle bytes. The raw imported source/bundle bytes were not uploaded, so these counts are original receipt observations rather than independently rehashed source capacity proof.

BUILD-IDENTITY records the exact integration source above and ASAR **54,303,623 bytes**, SHA-256 `42683e308ec96d209a796bc9d89dda1a4acdf58d92fef8aad01e10a379da0baa`. `releaseAdmitted`, `inventoryQualified` and `launcherQualified` remain false. Raw ASAR bytes are absent from the artifact: this is a retained BUILD identity, not an independent ASAR rehash or release approval.

## Retained originals and transport

All evidence is under `desktop/evidence/workspace-surface/ci37546239582/`:

| Original desktop ZIP | Bytes | SHA-256 | Inert files |
| --- | ---: | --- | ---: |
| desktop-development-evidence-original.zip | 64,678 | f256900f3991ef9693328e145f93d2e9ad8a095bbc3ac74251d663f3ecb65322 | 5 |
| desktop-packaged-evidence-original.zip | 9,669,804 | f4cc3b191ebe66f1ff21657c761f981c1f9f3f19621a5cb21e7ecacdb7b35666 | 197 |

Both ZIPs match exact GitHub API byte lengths and SHA-256 digests: **9,734,482 bytes**, **202 inert files** total. Extraction was bounded, traversal/symlink checked and data-only; no downloaded code was executed. The three missing native ZIPs were not fabricated.

Six completed-job decoded original logs are retained: unit, package, scope, launcher, desktop-qualification and merge-qualification. Skipped native groups have no invented logs. Log wrappers preserve the original decoded content string and its UTF-8 hash; JSON/apply_patch transport may use LF and is not represented as original server raw log bytes. Launcher artifact identity is present in original artifacts API metadata; its ZIP was not copied because the artifact retention scope here is desktop product evidence.

Original run/jobs/artifacts/canonical/integration/main-ref API responses, per-ZIP identities and per-extracted-file SHA-256/length inventories are retained. No temporary signed download URL is written to the report. The structured companion `2026-10-07-native-docs-hosted-evidence.json` includes exact paths, all original observed cases, metadata/log hashes, failure details and unavailable scope declarations; final SHA-256 `74b711c65435b507a9283f6cfad38a0dd981094990a37891c22868c659cf2e75`.

No source, tests, workflow, build, GUI, branch, main, release or installed app was changed by retention. There was no rerun, cancellation, source push, approval fabrication, physical power-loss claim or amendment of prior Home/adverse evidence. Root independently rechecks live FINAL and original hashes after this owner-authored retention.
