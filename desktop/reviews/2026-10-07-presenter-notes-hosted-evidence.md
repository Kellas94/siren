# Presenter notes — original hosted evidence retention

Author: `/root/disk_inventory`. Role: owner evidence retention and independently authored observation of original GitHub records, not an independent product approval. GitHub Actions executed the tests. This report was written only after FINAL, without rerun or alteration of earlier results.

## Actual final identity and result

[Run 37548819004](https://github.com/Kellas94/siren/actions/runs/37548819004) finished **SUCCESS**, updated `2026-10-07T00:04:40Z`. All nine actual jobs completed successfully, including both qualification gates. No skipped job is hidden by this statement.

- Canonical: `1227e2aaafe827e05afa9564e86ab4dec423ac74`.
- Canonical/integration tree: `dc53edfd495d9ccad74a4f348e448e03ae4e4966`.
- Actual tested integration: `94ffa380063eb4b0ec5a5fbe3f2af262c211de9b`.
- Exact ordered integration parents: main `1e5472dde446657e2dbb155868e28e033c6c9c92`, then canonical `1227e2aaafe827e05afa9564e86ab4dec423ac74`.
- Main ref at retention remains `1e5472dde446657e2dbb155868e28e033c6c9c92`.

The packaged BUILD-IDENTITY records integration `94ffa380…`, not the canonical commit string. Its ASAR identity is 54,322,555 bytes, SHA-256 `bf967415984a25812f0a4477dbf6aca04b8e591cf59ae6d60294c00779f05998`. Original module receipts agree with that exact identity. Raw ASAR bytes were not uploaded: this is a verified retained BUILD receipt, not an independent archive rehash. `releaseAdmitted`, `inventoryQualified` and `launcherQualified` remain false. Hosted success does not merge PR2, change main, replace the installed app or authorize a release.

## Original executed scopes

The unit job records **1,317 unique tests**, zero failures: identity suite 3 plus main suite 1,314. Raw job TAP counts are 1 + 3 + 1,314 = 1,318 because the early single IO probe is included again in the main suite; its exact title was matched before deduplication.

Each native group records `COMPLETE`, 20 probes and empty `changedInputs`: desktop, sources and diagrams, **60 original group probes total**. These are probe counts, not an invented aggregate count of every assertion/case. The packaged artifact records **31 module probes, all COMPLETE, 162 cases**, plus completed core packaged/shell receipts. Module and development results are distinct scopes and should not be added together as unique product scenarios.

Actual Presenter notes export receipts are `COMPLETE`, **6/6 cases in development and 6/6 in a copied package**, with empty changed-input lists; the copied package also records `packageUnchanged: true`. The six cases establish:

1. Actual Home Presenter and Export notes control publish exact ordered captured UTF-8 notes, including CR/newline/blank cases, excluding foreign data and unsupported private metadata.
2. Show file uses the owning retained receipt; only OS shell reveal was adapted.
3. Trusted ArrowRight retains the captured deck; Audience receives public frames without private notes, export controls/bridge or Presenter projection.
4. A genuine working owner saves newer notes; Tab/Space on the export button still publishes the old captured version before Refresh.
5. Explicit Refresh adopts the new captured version, invalidates the old receipt and exports the exact new notes while preserving Audience/source/saved checkpoint.
6. Common Lock after completed export retires the relevant views and preserves prior outputs/project. **Pending-export Lock was intentionally not exercised by this native probe.**

Exact original Presenter result hashes:

- Development: `desktop-native-desktop-evidence-original/evidence/presenter-notes-export-native/2026-10-07T00-03-43.025Z/result.json`, SHA-256 `48d4e007c57899dd14e82e9c017920334d5dff3d5275de780367a6e3da1c1bd2`.
- Copied package: `desktop-packaged-evidence-original/evidence/presenter-notes-export-native/2026-10-06T23-52-56.664Z/result.json`, SHA-256 `bb58674ecd094bba3498c7b9ef6325d40db5038f7fe6fdb66014ccd73ef8b3b6`.

Docs export separately records **7/7 COMPLETE in both development and package**, with empty changed-input lists. PIN crash recovery separately records **6 development / 3 copied-package cases COMPLETE**, unchanged captured inputs and individual-case receipts matching their aggregates. The original copied source-bundle import records 300,000 lines, four COMPLETE cases, 7,088,891 source bytes and 9,454,085 bundle bytes. Raw imported source/bundle bytes were not uploaded, so those byte counts are original result observations, not independently rehashed source capacity proof.

## Original retention and integrity

All evidence is retained under `desktop/evidence/workspace-surface/ci37548819004/`.

| Original desktop ZIP | Bytes | SHA-256 | Inert files |
| --- | ---: | --- | ---: |
| desktop-development-evidence-original.zip | 65,286 | 5a21b69a67cf91df0387f4150aacb10751c1869cc79fd5cdac6d21bb1dcbbee5 | 5 |
| desktop-packaged-evidence-original.zip | 9,760,371 | decc39d50180c55376df8e18df07e0a4d558722c477112a1ae08b500f5a5ae2f | 198 |
| desktop-native-desktop-evidence-original.zip | 4,470,925 | 63af42108ea7def4c4ee71c45b7f7316b45c14edf2ec3e21144450ad044df78d | 115 |
| desktop-native-sources-evidence-original.zip | 3,211,977 | 6978c3e738ec5d11a64cb3aff24643fe8785c33ca4e1ca7ffdc844a852a348f6 | 86 |
| desktop-native-diagrams-evidence-original.zip | 7,501,368 | 253e1f07c1f384909542effd5bd1fbbadc64261911e6b86570415b610c07458f | 146 |

All five exact original ZIP lengths and SHA-256 values match original GitHub artifact metadata: **25,009,927 bytes / 550 inert extracted files**. Extraction enforced fixed name/path/file/size budgets and refused traversal and symlinks; no downloaded code was executed. Per-file length/SHA-256 inventories are retained.

Five original desktop job decoded logs (unit/package/desktop/sources/diagrams), final run/jobs/artifacts API responses and canonical/integration/main-ref API responses are retained. JSON wrappers preserve each original decoded log string and its UTF-8 hash. Apply-patch transport may use LF; these wrappers are not claimed to be server-original raw log byte streams. Launcher artifact metadata is retained through the original artifact API, but its ZIP is outside the copied desktop-product artifact scope. No signed URL is written to reports.

The companion `2026-10-07-presenter-notes-hosted-evidence.json` retains all actual cases, source identities, original log/API/ZIP hashes and unavailable/raw-byte limitations. SHA-256: `1d7de706ee59f25cdff3626b8b9cdeaaa1bc9e91c22f0fb86cea2c2b87281ee5`.

Earlier run37546239582 remains FINAL FAILURE with its seven after-hook path mismatches and skipped native groups. No earlier adverse or Home report was modified or retrospectively approved. Retention made no changes to source/tests/build/workflow/GUI/Git/refs/main/release/installed data and performed no cancellation, rerun or push. Root's subsequent live-FINAL/original-hash readback is a separate verification, not claimed as my execution.
