# Independent scoped review — Close/Quit development-package bytes

Author: Codex independent reviewer `/root/workspace_surface_review`. Implementation, packaging and actual native execution author: `/root`.

Date: 2026-10-05. Source commit: `bf68ccbd87287fb39d3dc00665b1a79e7485903b`. Package: `desktop/dist/development-f8a19147-5815-4e62-9adc-9f51394e379a`. **No actionable finding identified in the independently checked archive-byte/file-set and original-probe/copied-launch scope.** This report is separate from the source review and does not admit a release or qualify hosted CI.

I ran only read-only Node/ASAR/Git checks and inspected code/receipts. I did not launch Electron, run native tests, edit product/tests/generated/build/helpers/evidence scripts, commit, or alter prior reports. Only this new report was written. The previous source review remains SHA-256 `685ff89880cbb7e392a9d69d23b638e000c98339ba1205834b6880940abb91a4`.

## Actual archive and executable checks executed by this reviewer

I independently imported the actual `collectApplicationInputs`, used the actual packaged runtime inventory's production dependency names, enumerated the actual ASAR with `listPackage` and `statFile`, and compared the sorted regular-file set. **Exactly 243 ordinary files**, with no duplicate paths, unexpected additions, omissions, links or unpacked entries, equal the collected application input set. Every extracted file was compared using `Buffer.equals` against its current application input: **all 243 matched exactly**. This checks actual contents rather than trusting the root summary's `exactApplicationBytes:true` flag. The checked archive includes the reviewed main/focus and surface/registry modules and generated renderer entrypoints; it excludes native test/evidence helpers.

Actual archive: **53,568,366 bytes**, SHA-256 `4036ccc025e29f037120549a98916350913df06dcff0cbc9717ae898b2c54e2b`. Actual `SIREN.exe`: **245,726,208 bytes**, SHA-256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. The executable is byte-identical to the local original `node_modules/electron/dist/electron.exe`. `BUILD-IDENTITY.json` equals the build receipt, records the exact committed source and these archive/runtime hashes, and retains `kind:development-preview`, `releaseAdmitted:false`, plus unqualified inventory/launcher/account/update fields. No executable modification or launcher admission is inferred.

An initial extra check required raw equality against Git blobs and failed on `src/main.mjs`. Follow-up isolated CRLF/LF as the sole difference: local main is 88,380 bytes, Git blob 88,201 bytes; normalized text is identical. The other twelve checked source/oracle/helper files are raw byte-identical to their committed blobs. This diagnostic normalization was used only to describe Git checkout representation. **ASAR-to-local comparison remained raw exact bytes for every file**, including main; no package mismatch was normalized away. The corrected read-only check exited 0.

## Original oracle and copied-launch review

The six-job runner calls the committed original native scripts directly: Close/Quit, WindowFocus, DocsEdit `--300k`, SourceEdit `--300k`, SourceAnalysis `--300k`, and original portable. It uses the package root for every invocation and waits for each child exit before the next. There are no generated oracle adapters, inserted tolerances, changed deadlines or retry routes in this lot. The six originals, shared driver, condition helper and native keyboard helper were independently checked against the source commit; all nine are raw byte-identical. The Close/Quit source is also unchanged from the prior independent source/oracle review.

For the first five probes, `--package` copies the actual package into each owned Unicode evidence folder, verifies archive identity, seeds a project in that copy's `Data`, and records schema-1 session selection there. `launchDesktop` runs the copied `SIREN.exe` with `packaged:true`, so it supplies no development root argument. Close/Focus retain the owned PID-checked inspector instrumentation; their actual native keyboard/oracle scope and cleanup are unchanged. Package mode selects only the fixture/launch location, not weaker assertions. The production main's packaged path uses `Data` beside the package and reads its session selection; test root/project flags are restricted to development. The original portable probe explicitly supplies forbidden test flags and still asserts that no forbidden directory is created, alongside exact save/recovery and copied package inventory checks. These are named fixture scopes, not general portability, physical keyboard or exhaustive security guarantees.

The ignored preparation helper derives build/verify helpers from the prior scroll-package helpers using only the current source identity and receipt filename prefix. Its runner replaces the job list with these six original-script invocations. The root verification helper checks every expected extracted file but does not itself enumerate unexpected regular entries; my separate closed file-set check above covers that omission in this review. This is not a product finding.

## Exact inspected file hashes

Paths relative to `C:/Claude/SIREN_WORK/portable/desktop`; SHA-256.

| File | SHA-256 |
| --- | --- |
| `scripts/package.mjs` | `6bbc5506c1161005e2c3b46c68b59ed790ee3a3f87666f22a46faeb9c696a746` |
| `tests/native/window-close-keys.mjs` | `da83f02649a4aeb08ae4c98bfa97a9b67a21cdabbea6d25da26c03768f0cd885` |
| `tests/native/window-focus.mjs` | `c8ffa306ff029c6f01fd4ead6638b72c79e9ee7d94207507e656e81e507cb8c6` |
| `tests/native/docs-edit.mjs` | `fe5b4335fac2afa1d2f3d47ced66582c7977771abc87bc2eec55da6397a32d32` |
| `tests/native/source-edit.mjs` | `fba73105cfe3040e74d152ee81940af55b053484cfeffeca8e47595613ae2944` |
| `tests/native/source-analysis.mjs` | `29a5d05d7cc702b240f4a67caa4195310766dcc57c8dee2bbd68f124be5b47b5` |
| `tests/native/packaged.mjs` | `eaf8e3bab4c7267c57eb24a2a250901b05ac4494ce2ac736461dfeeada96ae24` |
| `tests/native/drive.mjs` | `6a9d05e2036d85160412681f8640fb565985722598045b5d28a41bcbed0e5f87` |
| `tests/native/condition.mjs` | `caa3c18db9d750d52917ec1b351b6d6b8948b1529e659842c570bcd18feda8d4` |
| `tests/native/native-keyboard.mjs` | `51966a4884cf8f6ff22ebf5f55a2ee3dffa787050ddfe4d8a5d3373cc248f963` |
| `src/main.mjs` | `311d40fc553fcd82f88c0114fa7274a99d89804cbe264698ce84023a19a016e2` |
| `src/windows/focus.mjs` | `6774de6f4d36725ba4f55015ce07f53d5eb223b8e691f0441feb7d94c817262d` |
| `src/data-root.mjs` | `4bfb044c74097ee0fdd65276355324d32cd95cccac7c3efe358e059ad62fd7ab` |
| `evidence/workspace-dock/close-keys-package-build.json` | `b4a6d041200e614fb9dff6f2f403ad6d78fa0fd6cdc58861f548ff5849dc71b6` |
| `evidence/workspace-dock/close-keys-package-byte-receipt.json` | `51a06209fd4eeff188e1ba0432253147fe2908a5ffff306f4ebd17ca2cd8606b` |
| `evidence/workspace-dock/run-close-keys-package-probes.mjs` | `4eefcd1b644b200d1978b1b4bb95839f4714336fcc1cc1fe0c4595fc02536843` |
| `evidence/workspace-dock/prepare-close-keys-package-helpers.mjs` | `147b1a9af4f4c859bf08bfb7fd0373dd4ee52438e4969701429c770c560270b5` |
| `evidence/workspace-dock/verify-close-keys-package.mjs` | `4576b9af549d78a29b7bb38e223cdcb78aeb7024dc79135aa923f2c8bdc5a00f` |

## Actual native receipt attribution

The sequential root-owned runner is now CLOSED, reported exit 0. I inspected its actual final JSON `evidence/workspace-dock/close-keys-package-probes-2026-10-05T18-59-04.052Z/result.json`, SHA-256 `39c394af52693d523311017c5f505f9daf79bb973cc4a9e211ffeb288eaae368`, and the separate root receipt `reviews/2026-10-05-window-close-keys-package-receipt.json`, SHA-256 `2d2ab2a8c5c43a643a12457f8fd3cbb7792e80793c56695c361d1c254884e172`. Both record COMPLETE with the exact six original-script invocations; every child exit is 0 with null signal. The initially written receipt used a different filename; root retained its original bytes separately and corrected the report path without rerunning a probe. No result status is inferred merely from file existence.

My independent read-only Node recapture compared all six actual result hashes and runner log hashes with the root receipt; all match. Five native receipts require COMPLETE and every named case `ok:true`; original portable requires `completed:true`, the exact committed original oracle hash and package archive/runtime/source identity. All **92 captured before entries**, summed across the first five groups and not counted as unique files, equal after and actual current files. The portable receipt has a probe hash rather than the same input-map schema; that distinct evidence limit remains explicit. All **eight actual copied BUILD-IDENTITY/ASAR/EXE sets** equal the exact development identity and archive/runtime bytes, including the original portable's three Unicode copies. All **18 inspected hash-table rows** remained unchanged, and the prior source report still matches its immutable hash. The recapture exited 0, with zero mismatches. These checks independently validate retained root-owned execution evidence; no native execution is attributed to this reviewer.

| Root-owned group | Native result | Cases / captured entries / copies | Result SHA-256 | Runner log SHA-256 |
| --- | --- | --- | --- | --- |
| Close/Quit | `window-close-keys/2026-10-05T18-59-04.114Z` COMPLETE | 4 / 14 / 1 | `b4e9370c0dcffef2527f0df0ec8ce0299d75269651372cf268a3192dc908ba5b` | `d8575acfb17b0280d3358fd576f47d7dffd445c66321e50d3a498c8590d9c353` |
| WindowFocus | `window-focus/2026-10-05T18-59-13.266Z` COMPLETE | 9 / 13 / 1 | `0604b3fb84d19fea84e18dee9bceca175f46a8810d0281d03a35478b603902ac` | `94a765260e173f233554d4b7be2fccc832ca6c579176cd2284dfe2c0a3efaddd` |
| DocsEdit 300k | `docs-edit/2026-10-05T18-59-26.763Z` COMPLETE | 4 / 28 / 1 | `c3f30caa93ff66285618df23a7a333ed09451c4b0dd2c99b865fa9e95a95b85b` | `af2485ad0a504ea0bcc35bc64ae415baedc11abc8925aeb9a8bcd16ce7304f6d` |
| SourceEdit 300k | `source-edit/2026-10-05T18-59-54.543Z` COMPLETE | 4 / 16 / 1 | `9dd1b57f7b0b236e1a452f405da6106f949e8aad53859828c07f2908cf64db91` | `5ffe6bae0d6601bcdad87ce23422a9a4a4d4841c2cc0ad73fe1cb4cc173c282f` |
| SourceAnalysis 300k | `source-analysis/2026-10-05T19-00-13.314Z` COMPLETE | 4 / 21 / 1 | `2c8f25cd8342814c03ca8d2201b7b0a049e07453c54fd45ba341fc11e3673365` | `cbc69241ca9b6bb9846aa049e3a0006565fc0c1e1f6ac3b3f32b3708de065e80` |
| Original portable | `packaged-2026-10-05T19-00-28.086Z` completed | named original flow / probe hash / 3 | `b699c6d7e1d6d62a53eeb181247fbd2ade49f824366043e5104e5bc87c9aee44` | `892d82ed4dab487517c75d780cedac2eef82eef5150996de85ddbe29d572a8a8` |

This narrow report does not establish hosted all-green, whole Task 4 completion, production release admission, launcher/inventory licensing qualification, physical-keyboard/IME coverage, arbitrary machine portability, every asynchronous failure permutation or exhaustive privacy. Earlier ADVERSE receipts and original oracles remain separate and unchanged. A review verdict is evidence, not user approval.
