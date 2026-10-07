# Independent package readback — 2026-10-07

Author: `/root/catalogue_view`. Status: **ARCHIVE_AND_FINAL_COPIED_RECEIPTS_VERIFIED**. This is an independent read-only archive/hash/receipt review, not independent GUI execution, production certification or a release approval. Root executed all native programmes.

## Snapshot and independent byte checks

Frozen source: `38deec920aa8b41441ad5cc43fba6352e075d4bd`. Preview: `dist/development-bf2e5946-0d24-45f4-9468-5d411e97f800`.

The reviewer executed only `reviews/2026-10-07-diagram-layout-package-readback.check.mjs` (SHA-256 `0b1195359dc6c681a76dd06702c0d9a8399b06e7a6c875627a7acf95a5d211ac`), exit 0. It reads ASAR members in memory, Git committed blobs and filesystem hashes. No application GUI, build, package generation, downloaded code or product/test modification occurred in this review.

All **303 ASAR file members** match the separately retained root manifest in `evidence/workspace-surface/package-identity-2026-10-07T11-34-05.249Z/result.json` (SHA-256 `94c7a5ec46716a484bd813bcf72d4afd133e3bdd8f9949dc02c2ada4b5ee0a19`). No unpacked files or links were admitted. The 121 packaged source members exactly match raw working-tree bytes. Against the exact Git commit, 118 match raw bytes; `src/ipc.mjs`, `src/main.mjs` and `src/preload.cjs` differ only by CRLF/LF. Both representations must roundtrip as UTF-8, and only CRLF-to-LF normalization is permitted. All 16 generated and 165 installed dependency members match current raw bytes. The remaining member is packaged `package.json`, whose entry is `src/start.mjs` and type is `module`.

| Binary | Bytes | SHA-256 |
| --- | ---: | --- |
| app.asar | 54,536,865 | da48bb93e3ccc31b6f51e935f3e896db000f356a2c6f723b7adbcedfbdbc1be6 |
| SIREN.exe | 245,726,208 | 49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa |
| Process identity helper | 6,144 | 485d4fe26225c75670e2ce425fa0daa816f5b8ef93b1561042b7138e01fed6a3 |

This is member and provenance readback; it does not independently rebuild generated output or certify all dependencies.

## Final copied programme

Root's final `evidence/workspace-surface/layout-package-native-2026-10-07T11-34-14.430Z/result.json` is **COMPLETE**, SHA-256 `b01cd0a9bcf98603f4e3c1ed1bc8c5184fa83f864835ac7b2607750b109628d5`. Its 643 captured input identities are equal before/after and `changedInputs` is empty.

The reviewer separately read each final result and required exact equality with the programme's embedded receipt. All 14 probe files still match their captured harness hashes. All **16 distinct executed copies** were independently rehashed after execution: **48 binary hashes** for archive/runtime/helper match the preview and root post-run receipts exactly. Every copy also retains the exact BUILD-IDENTITY and process-helper metadata.

| Copied programme | Explicit native cases | Copies |
| --- | ---: | ---: |
| Diagram layout | 4 | 1 |
| Catalogue | 7 | 1 |
| Pan release | 5 | 1 |
| Guided | 4 | 1 |
| Style | 6 | 1 |
| Build | 7 | 1 |
| Edit | 4 | 1 |
| Walkthrough | 8 | 1 |
| Annotations | 8 | 1 |
| History/typography | 8 | 1 |
| Dock | 5 | 1 |
| Appearance | 8 | 1 |
| Shell | 4 named checks, separate schema | 1 |
| Packaged production boundary | completed receipt, separate schema | 3 |

There are **74 explicit native cases across 12 probes**, plus the shell's four named checks and the packaged three-copy programme. The latter two schemas are checked honestly via `completed`, not an invented `status` or case count. Shell readback includes absent renderer Node/process and refused protocol access. Packaged readback binds the probe SHA, source commit, archive/runtime and resolved production editor flush to the acknowledged saved-project hash, distinct from the initial project hash.

Copied layout's four actual UI cases cover keyboard engine geometry with imported fill, Undo/Redo and exact CAS Save, source-owned frontmatter/unsupported grammar, new reader persistence and shared Lock. Root is named as author and executor. The separate 27-case multi-family SVG/Present/scoped-layout utility evidence remains **development** evidence described in the source addendum; this copied programme does not run that utility harness.

## Original adverse evidence and limits

Five earlier root receipts remain ADVERSE and byte-identified in the JSON companion: original full suite, native SVGRect recorder failure, rough-path family oracle, and two legacy defaultRenderer oracles. No old report was overwritten.

The reviewer's own first checker exited 1 on `3170 !== 3197` because it assumed raw Git blob bytes equal a Windows CRLF working tree. Its exact output is retained in the JSON companion. Only the review checker was corrected to enforce the explicit EOL rule above; raw ASAR/current comparisons were not relaxed. No product defect is established by that fixture error.

No new blocking finding was identified within archive/member/receipt scope. The receipt still explicitly marks **releaseAdmitted, inventoryQualified, launcherQualified, accountConfigured and updatesConfigured false**. This review grants no launcher/apply/clean-PC/physical-monitor/IME/online-account/hosted/production-release approval. Runtime assertions were executed by root; this reviewer independently verified retained bytes and records.
