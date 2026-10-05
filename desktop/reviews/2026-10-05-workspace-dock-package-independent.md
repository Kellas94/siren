# Independent narrow review — copied development-package docking probe

Author: Codex independent reviewer `/root/workspace_surface_review`, separate from implementation/package/probe author `/root`.

Date: 2026-10-05. Source HEAD: `8af803f2ad1fe0221538b54c0d6f53cebc9e8ca7`; observed `git status --short` was empty. Scope: the ignored package-probe adaptation, unchanged original docking oracle/deadlines, copied-package launch/Data/selection, and exact application/archive/runtime bytes. **No actionable finding identified in this narrow review.** This does not admit a release or certify the entire package/Task 4.

I ran read-only Node checks and inspected the artifacts below. I did not start Electron, run the native cases, build or alter a package, edit source/tests/scripts/evidence, change prior reports, or commit. Only this new report was written.

## Exact inspected file hashes

Paths relative to `C:/Claude/SIREN_WORK/portable/desktop`; SHA-256.

| File | Hash |
| --- | --- |
| `tests/native/workspace-dock.mjs` | `5e964ce133db3a321998134fcf48dcf958a82d71259a473cdf1be09e88ce3ce6` |
| `tests/native/drive.mjs` | `6a9d05e2036d85160412681f8640fb565985722598045b5d28a41bcbed0e5f87` |
| `tests/native/condition.mjs` | `caa3c18db9d750d52917ec1b351b6d6b8948b1529e659842c570bcd18feda8d4` |
| `tests/native/attach-page.mjs` | `026e108019a2560a2f79b1488f9dcefdd0c01426946cbb42424c522647124770` |
| `tests/native/native-keyboard.mjs` | `251561e232148cafbf79a339bf9dcd54d2872450a818f1f304bbf470aff62d6f` |
| `evidence/workspace-dock/prepare-package-probe.mjs` | `00fd5b02beff01e90582511a90fda69bbc90d5d9ff0097ebb1140eb62477bac1` |
| `evidence/workspace-dock/packaged-probe.mjs` | `001374e33b12072d9de9db53e63c6f1cc610cec488c630965474675a8ed4df7d` |
| `evidence/workspace-dock/verify-package.mjs` | `b3b4c9e4811742144275a27e5701ca04fcfa1da69c9950595443446ca71754b4` |
| `evidence/workspace-dock/package-byte-receipt.json` | `8027db9ba653b15c49ee6ca94876ae7988ea46bfbf315bdba991069383bd7efd` |
| `evidence/workspace-dock/package-build.json` | `49ce4310f5fbf6556403866b0584c017e10d3d0cb4492d14801b499cf3dfd51f` |
| `evidence/workspace-dock/run-package-probes.mjs` | `db814fed57e10324fe5638a652ea1f2ab11adbbee51862cdcce25b3f3f1b08f6` |
| `src/main.mjs` | `244cd8ecb1590ca1414a5a38bea68baa080a3d32ea3d60c01d8f2959a6581227` |
| `scripts/package.mjs` | `6bbc5506c1161005e2c3b46c68b59ed790ee3a3f87666f22a46faeb9c696a746` |

## Oracle and package-launch adaptation

I inspected each generator replacement. Every replacement requires exactly one occurrence, refusing source drift. In memory only, I replayed the generator with its final evidence-writing operation replaced by an equality assertion against the existing generated file. It reproduced `packaged-probe.mjs` exactly. This checker did not import or execute the generated Electron probe.

I additionally compared the complete original body from `await unlockDesktop` through the last common-Lock assertion/status assignment against the generated body: exact string equality. The existing fixture creation, immutable source oracle, dirty Docs/title/selection, Code version bytes, native identity/frame/DOM checks, 12-attachment loop, drawn exclusivity, real Undo/Redo, resize, save, native commands, monitor assertion, Lock and error handling remain unchanged. There is no relaxed assertion, geometry tolerance, mutation retry, synthetic success or replaced expected source value in this adaptation.

The actual changes add `cp`; resolve the same three native helpers from the evidence directory; copy the development preview into the owned evidence directory `Pachet-Știință-Dock`; move fixture data into that copy's `Data`; write its `session-selection.json` with the seeded project ID; launch the copied `App/versions/0.1.0/SIREN.exe` using `packaged:true`; add the generated probe to input capture; and add package identity/archive/runtime hashes plus final integrity refusal. Preview kind and `releaseAdmitted:false` are explicitly asserted. Copying refuses an existing destination and the copied archive is checked before launch.

The original development test-root/project CLI flags are removed. Production `main.mjs` resolves packaged Data relative to `app.getPath('exe')` and reads its normal persisted selection file. Thus the fixture selection uses the production packaged Data route. `launchDesktop` receives the copied executable; `packaged:true` omits the source-root argument. It retains the original inspector/debugging and Chromium test switch, owned PIN setup/unlock, and the existing driver.

No timeout is changed by the transformation. The same helpers retain 30-second startup/UI observation deadlines, 20-second CDP operations, 15-second native-inspector discovery and 10-second native-inspector evaluation. The navigation-gap helper permits only its existing narrowly identified read-only observation gap within the original deadline. These remain test launches with instrumentation, not human physical-keyboard or uninstrumented consumer-launch evidence.

## Independent exact-byte checks executed

Package root:
`C:/Claude/SIREN_WORK/portable/desktop/dist/development-9e5277d4-ceb2-4f3f-8458-73cd6a4f2ad8`.

I independently imported the existing application-input collector (without invoking its package builder), read the packaged inventory's dependency names, extracted each corresponding actual ASAR file, and asserted Buffer equality against its current source file. **All 243 files matched.** A separate archive-list/stat comparison confirmed the actual ASAR regular-file set is exactly those 243 paths, including no additional regular files. This is stronger than relying on the receipt's boolean or merely comparing archive hashes.

I also verified packaged `BUILD-IDENTITY.json` equals the build receipt, its exact source commit and `releaseAdmitted:false`, archive byte length and SHA-256, executable byte length and SHA-256, and equality of executable SHA-256 with the original `node_modules/electron/dist/electron.exe`. Finally I directly rehashed the actual docking run's Unicode-path copied archive and executable; both matched the same package identity.

| Object | Bytes | SHA-256 |
| --- | --- | --- |
| Actual `app.asar` | 53565867 | `dc0783505712f092a23224ca91f33bd6508ddb7681dd7682ac148decb060f3b9` |
| Actual copied `SIREN.exe` / original Electron executable | 245726208 | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |

Both independent read-only Node checker executions exited 0. The existing `/root` byte receipt also records 243 files and these identities; its claims were independently checked as stated above. This review does not independently compare every non-executable Electron runtime support file or license inventory.

## Root-owned native receipts inspected

These native executions were performed by `/root`, not this reviewer. I inspected their result JSON and compared every captured input against both afterInputs and current files, with zero mismatches.

| Evidence directory | Observed result | Result JSON SHA-256 |
| --- | --- | --- |
| `evidence/workspace-dock/2026-10-05T17-46-03.222Z` | COMPLETE; five `ok:true` cases; `packageUnchanged:true`; unchanged 22 captured inputs | `8bc4f14c32edbf35e3fbf23cca47b4e16aca527f7e957b2d7702b54965845663` |
| `evidence/window-focus/2026-10-05T17-46-34.820Z` | COMPLETE; nine `ok:true` cases; captured package identity matches the reviewed package | `775bd1ffc17fec4ec162f996542a2008851a18079bc7444abe3831ca01bc0d51` |

The runner runs groups sequentially and stops on nonzero exit. At finalization I additionally inspected the completed root receipt `reviews/2026-10-05-workspace-dock-package-receipt.json`, SHA-256 `dabac21e121cf4034a4a2d49f3f244fc53f0c98511346c995285dda76c2d83ef`. It records six closed groups, each exit 0. I checked all six original result JSON hashes and all six original runner log hashes against that receipt. For the five results containing input/after maps, every input matched after and current bytes. The original portable result uses `completed:true` rather than a status/cases/input-map contract; I inspected that distinction and its captured probe hash, source/package identity and declared scope rather than inferring an input-map check it does not contain.

The additional root-owned receipts are Docs300k four cases at `17-46-49.302Z`, Code300k four at `17-47-17.700Z`, monitor three at `17-47-35.965Z`, and original portable `completed:true` at `evidence/packaged-2026-10-05T17-47-51.447Z`. I independently rehashed archive plus executable in **all eight actual copies** listed in the receipt (one each for the five named native groups, plus three portable Unicode-path copies); all matched the reviewed package identities. These are artifact-integrity/attribution checks. I did not independently review those additional groups' entire oracle implementation or execute them, so their wider behavior claims remain root-owned observed test scope.

All four prior independent reports were rehashed and remained identical, including initial integration `389432fe…` and follow-up `203f0ae0…`. The final checkout had root-authored documentation/report changes alongside this new report; no source change was inferred from that documentation work.

## Limits and verdict

The ignored transformation preserves the original docking oracle and deadlines exactly, and the reviewed launch uses an actual copied development package with owned external Data/selection. The observed package application file set/bytes, archive and runtime executable identities matched independently. No correction is requested within this scope.

This report does not approve a production release, full Task 4, update launcher/feed, activation/accounts, license inventory, general portability/security, all supported OS/DPI configurations, physical hotplug, or exhaustive save/Lock failure handling. Build identity explicitly leaves release admission and inventory/launcher/account/update qualifications false. Exact-byte checks, native test receipts and this scoped review are evidence, not user approval. Earlier source/integration/foundation reports remain separate and unchanged.
