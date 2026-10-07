# Diagram Inspector metadata Tasks1/2 — independent ORIGINAL review

Author and bounded probe executor: `/root/diagram_history_final_review`, 2026-10-07. **Changes required: two Important/P2 defects reproduced.** Scope is the uncommitted metadata contract, embedding/isolated domain branch, owner validation/reset and draft/history. Concurrent unfinished Task3 UI is excluded. No product/test edits, build, GUI, full suite, commit or approval performed by this reviewer.

## R1 — P2: managed-key opaque objects can lose their original source pointers

`src/documents/diagram-metadata.mjs` protects unknown keys, but its `validate()` loop treats an existing managed key as freely replaceable/deletable regardless of the old value's type. For an admitted imported map such as `{A:{evidence:{sourceRef:exactReference,opaque:'keep original association'},owner:'Owner'}}`, `update(...,{id:'A',changes:{evidence:'New textual evidence'}})` accepts replacement of the whole evidence subtree. The original source-reference association and its opaque sibling disappear. Whole-map reset also validates when this is the sole managed field.

I reproduced this beyond the pure contract: created an owned real ProjectStore/SourceRepository, imported a real source, committed the exact referenced initial manifest, then submitted the changed map through actual DomainRepository and production validation splitter with the actual isolated `domainHelper`. The owner returned committed version2; readback contained the new string and no original nested pointer. The manifest's `sourceRefs` array remained equal, which does not preserve the original metadata path/association. Negative control deleting an unknown-key opaque source pointer was refused, so the gap is specifically managed-key legacy data.

Retain imported object/array values at managed paths as opaque and refuse replacements, removals and whole-map resets that erase them. Add contract, actual isolated-helper and actual native-owner regressions. Avoid silently relocating pointers or accepting a replacement merely because the global source list still contains the referenced source.

## R2 — P2: correcting a noncanonical imported scalar cannot be durably undone after Save

The current contract permits changing an unsupported existing scalar, while the new draft records its original value in history. Example: imported `nodeMetadata.A.owner = 7`; edit to `'Readable owner'`; Save succeeds at version2; Undo restores7 locally; the next Save is refused `DOMAIN_VALIDATION_FAILED` because7 is now a changed invalid managed value. The local draft remains dirty. The user cannot persist the history state that Undo offered, and an ordinary flush of that dirty state encounters the same validation rule.

Reproduced with the actual draft, contract, DomainRepository, production validation splitter and isolated metadata helper against a second owned project. Requests crossed the VM/native boundary via JSON data serialization. This is not an inferred history concern: the final probe records the successful first Save, restored numeric value, refused second Save and retained dirty state.

A small consistent boundary is to keep unsupported existing managed values immutable as retained opaque data, including primitive noncanonical values, while allowing other supported fields to be edited. If explicit correction of those values remains a requirement, design a trusted bounded restoration path for genuine historical values; do not allow arbitrary invalid renderer values or present an unsaveable Undo as ordinary supported history. Cover both Save→Undo→Save and dirty Lock behavior. Preserving invalid siblings unchanged already works and should remain supported.

## Actual verification and snapshot

Executed `node --test tests/diagram-metadata.test.mjs tests/diagram-metadata-draft.test.mjs tests/diagram-metadata-validation.test.mjs tests/domain-owner.test.mjs tests/diagram-draft.test.mjs tests/diagram-history.test.mjs`: **49 passed, zero failed/skipped**, exit0. These tests establish existing bounded fields, descriptor refusal, prototype-name IDs, opaque unknown siblings, optional absence, exact CAS/refusal and history controls, but miss the two cases above.

Independent `evidence/diagram-metadata-independent/adverse-probe.mjs` final execution exited0 because it asserts the observed adverse behavior. It does not mean the product passed. It confirms both defects, accessor non-execution and refusal of unknown-key pointer removal. The initial expanded history probe incorrectly passed a VM-realm object directly into the native owner, producing `REQUEST_REFUSED`; that setup error and a diagnostic run are retained honestly. After adding the normal JSON-data boundary, the first Save commits and the actual R2 validation refusal occurs on Undo Save. No product change was made to obtain these results.

Nine reviewed input identities remained unchanged throughout. Full before/after maps are retained. Principal source hashes:

| Input | SHA256 |
| --- | --- |
| src/documents/diagram-metadata.mjs | `47193c81fb12ea8bf29329e4c7ba34bb59a45645a73325838418d974f9b122a1` |
| build/diagram-metadata.mjs | `8ed4e8446394f4fbf1c226204148d0a604b9c5f8c95af0d19988e16802f3ea91` |
| build/import-validation.mjs | `74332ac827681dd2bdc59e1c88fb1b9d4779cc5e4567954fc7eb9ac0335cbb55` |
| src/windows/domain.mjs | `f77617382cbedceb8b4dde474d54d93bcf09d74027a1d2e155a45da6d063ae9c` |
| src/ui/diagram/draft.js | `3f39f927198993e1fc31de6a7ab12f35a5a00ee77833522b61e60a4574957699` |

Evidence under `evidence/diagram-metadata-independent/`:

| File | SHA256 |
| --- | --- |
| inputs-before.json | `035a8494ff40a0ab0db5b00029af8274244c3666960524efbe177e113ad0fdbe` |
| inputs-after.json | `0a26797fcba67755bdb3ac1c10a59b4706c42a6ec4766096836c29eab4a3383e` |
| scoped-tests.log | `de9cdea7f8f3552b80bf65d76e72d681cd9ee6de4163d93e6a0abd320ee1b74a` |
| adverse-probe.mjs | `12bbde0d7df0b2e2ab152ba54b99afc980c5bf2150b7952d3e9405f5ce1ec5dd` |
| adverse-probe-final.log | `b1485ed1a6d1c3450a500fbeb7525e0bde937990d9691be27aa2a0f1d69c4de1` |

Original contract and draft bytes were copied into the same evidence directory before correction. Original first R1 output and both expanded-probe setup-error logs remain alongside the final log. Owned probe storage remains local ignored evidence.

## Limits

The isolated metadata function was executed in Node VM from the actual helper string, not through a native hidden BrowserWindow. Unrelated sanitizer names in that VM throw if called, so no metadata result is attributed to permissive sanitizer stubs. Native owner tests used real disk storage and source references with owned fixtures; no live user project was touched. Public Audience privacy, Inspector pending UI, Filters, actual cross-window/Lock rendering, full saved SVG/export and package/hosted evidence remain outside this Tasks1/2 review. Source/owner/draft changes must be rechecked after correction; no final implementation qualification is claimed.
