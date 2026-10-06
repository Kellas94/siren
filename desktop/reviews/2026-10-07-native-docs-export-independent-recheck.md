# Native Docs export — independent formatter/service/package correction recheck

Author: `native_menu_trace_review`, 2026-10-07. Separate from the original **CHANGES_REQUESTED** report `2026-10-07-native-docs-export-independent-original.md`, which remains unchanged at SHA256 `1586e7877a5efaab50302de3e4b57eda61c1c4187de3d3096ee4c77810edc98e`.

**Both independently reproduced formatter findings are corrected on the hashes below. No remaining must-fix was found within this bounded formatter, publisher-service and package-admission review.** Main/preload/UI integration, actual renderer build, native development/copied-package execution and full-suite/hosted verdicts are outside this recheck. No source/test/build/workflow edits or GUI/full-suite execution by this reviewer.

## Actual independent recheck

Nine formatter/package case groups completed against eight input hashes unchanged before/after:

- The original 21,097-byte / 3,000-by-3,000 jagged table still exports exact JSON (93,671B, 5ms) and HTML (182,632B, 7ms); Markdown refuses `EXPORT_BUDGET` in 6ms. HTML no longer builds its unused padded Markdown. Times are observations on this host only. The child result's `paddedCellCount` remains a fixture's potential rectangular size, not a claim that corrected code performs those operations.
- Fresh aggregate control: one 40,000-cell projected Markdown table is admitted under 16MiB; two such blocks in the same otherwise small document are refused. The per-document 50,000 rendered-cell preflight is shared across blocks and occurs before rectangular allocation. Existing input/output limits remain intact.
- Four lone-CR/CRLF prompt and unsafe-rich cases were formatted by the real formatter, parsed by the existing baseline Marked module in an isolated VM, then inspected as inert parse5 trees. No `script`/`img` elements remain in the reading section. The appendix parses back to each original document exactly, including original CR values. No resulting markup was executed or opened.
- Structured lock comparison against actual Git HEAD verifies all package entry versions, resolution URLs, integrity, dependencies and licenses are unchanged. Only root parse5 promotion and removal of existing `dev` flags from parse5/entities are admitted. The exact existing versions remain parse5 8.0.1 and entities 8.1.0.
- Actual `collectApplicationInputs` with the real production package set includes both `src/documents/export.mjs` and `src/windows/docs-export.mjs`, parse5's runtime entry and entities' runtime entry. An unrelated source module remains refused; collected files exclude tests/maps. This is actual finite collection, not a built archive/runtime dependency proof.

Four additional service case groups used independently constructed real `WindowRegistry`, `WorkspaceCoordinator`, `DomainRepository`, `ProjectStore`, `NativeDocsReads`, `NativeDocsExports` and an owned filesystem (inert EventEmitter window adapters):

- Readonly own document exports exact archive/claims, excludes a foreign document, returns no public path, reveals only the retained matching file, and refuses reveal after file modification. An object-valued format is refused without invoking `toString` (root's separate coercion correction, not claimed as this reviewer's discovery).
- A pending formatter permits no second same-window export. Lock aborts the supplied signal; after release/drain, no publication is admitted and the saved project remains exact.
- Lock while the third/final saved read is held **after actual rename** removes the unretained output before successful drain; the exports directory is empty and the project unchanged.
- A deterministic failure fixture replaces only that owned unretained output path with a directory before Lock/release. Actual cleanup refuses, the invocation returns `DOCS_EXPORT_FAILED`, `isIdle()` stays false and drain throws `DOCS_EXPORT_NOT_IDLE`. This is controlled filesystem uncertainty, not a normal-user operation or platform crash claim. No untracked output is reported as success.

These cases check actual saved/version/hash and publication/lifecycle behavior within the service. They do not establish that evolving main currently pauses/drains every service correctly, that UI preserves drafts, or that a copied application contains/loads the exact dependency closure. Those require final integration review and actual qualification.

## Exact retained identities

Formatter/package driver `evidence/docs-export-independent-2026-10-07/corrected-formatter-package-probe.mjs`, SHA256 `e3fd6170d8d727720188a36f2028aea556ccea16877b428a848bc44b0912c32f`; result `corrected-formatter-package-result.json`, SHA256 `5cabd27dacecb68d83394804f84c8ba32a8b66f7e91183709f2c40b679f6c55b`.

Service driver `evidence/docs-export-independent-2026-10-07/service-probe.mjs`, SHA256 `e217e835653df5104c34a85ace3ab3426ae6ecc648d0da6ac8b8cea198d53246`; result `evidence/docs-export-independent-2026-10-07/service-2026-10-06T22-58-18.860Z/result.json`, SHA256 `5b92544c354ed87afeeffb374724cbe0033aebfa51f3c42ab26398451db40db6`. Six service input hashes unchanged before/after. The owned fixtures and adverse cleanup path are retained; no user directory or profile was used/deleted.

| Reviewed current input | SHA256 |
| --- | --- |
| `src/documents/export.mjs` | `ff169981db7fb4faaf865e4e9ddbee4ad68d177b9939611b5dc9ad630ecd02ee` |
| `src/windows/docs-export.mjs` | `74bb26715bc82ee444d572e23434fdf3bc7b7f4a2363e938eda2fde7660ab850` |
| `tests/document-export-format.test.mjs` | `02a75e756aea481c3a1a5ad96d09cc4319fb8dc96ba9d99e302c8f39b8a97691` |
| `tests/native-docs-export.test.mjs` | `2a848681fd3672ad675eb4e456b750376b717cbde8eb3d640801fb5efe52ae4c` |
| `package.json` | `3c0bf4d8fa257852a8c438f261bcaf77f032175f9f1c3457fbd1e78717d3b434` |
| `package-lock.json` | `2c887168ab1ff14bef19b7e05a1b76856569e6f393d7477e5aba2658bf0d8247` |
| `scripts/package.mjs` | `7dbfe2292df85fe2084568dcb03e097cf0d0204449c8426c043e5cb5c5b692e6` |

Plan inspected SHA256 `63e3c255b24d0ed55fd0086075b2477e689afeead2b9d7de63c9d5fb30605696`; boundary analysis remains SHA256 `8623a6b0dfb0be542fd3e7eb2ab07066484f07b04083a948efcceec1a2359612`. No release/merge/push approval or original hosted-cause closure is implied.
