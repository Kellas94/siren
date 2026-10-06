# Schema-2 metadata adapter: independent design review

Author: `/root/native_menu_trace_review`, 2026-10-06. Read-only review of the proposed adapter before implementation. No product, test or generated application input was changed for this analysis; no GUI or CI was run. This report is preserved separately from any subsequent implementation by this author.

The conservative design is sound: validate an isolated projection, refuse changes to explicit functional fields, retain the original metadata, then apply only the established file-signoff transformation to original documents. Never publish the sanitizer's replacement rows. Two existing frozen helpers need explicit compatibility handling to import actual native exports.

## Concrete compatibility boundaries

- `validatePortableProjectForImport` validates diagram syntax, the Code library and a detached Docs preflight. It **does not sanitize presentation or other diagram style fields**. Those require their actual frozen validators or an explicit current native contract. Merely invoking the full-project function is not a complete HTML/style gate.
- Home creates sparse documents `{id,title,blocks:[],agent:null,releases:[]}`. Compare only original own fields at known functional paths; defaults introduced for absent fields are permissible and need not be written. Whole-object equality would refuse these real native documents. Explicit `null`, empty string, empty list and absence are different cases. Do not reinterpret every explicit malformed value as a missing default.
- `sanitizeWorkpaperLink` derives `dangling` from global `state.diagrams/workpapers`, rather than its argument. Temporarily bind the validator's state to the candidate workspace, restoring it in `finally`, or validate the derived flag separately against the candidate. Comparing against the hidden window's initial workspace would reject valid native `dangling:false` references. This matters during both full preflight and `prepareProjectWorkpapers`.
- Table is already a frozen Map-card kind. New native table rows (20 by 12, 1,000 units per cell) fit the frozen table limits (500 by 12, 8,000). A table card's exact current native shape should pass. The compatibility problem also affects **non-table** native title/text cards: `newEntry` explicitly writes `rows:[],headerRow:false`; frozen `mapSanitizeCardTable` returns `headerRow:true` when a non-table has no rows. Current native body edits preserve leading/trailing whitespace, while frozen `mapCardPlainFromHtml(...).trim()` changes that explicit plain mirror. Admit these through a narrow current-native title/text/table contract, still applying genuine frozen HTML safety and authored-field limits, rather than globally forgiving sanitizer differences. Preserve the original values.

## Nested history, sources and unknown fields

The projection must cover current knowledge blocks, archived `doc.revisions[].blocks`, `doc.releases[].snapshot.knowledge`, Code files, and both native `codeWorkspace.drafts` and the legacy stored drafts list. Only verified source-linked fields receive empty content/text/base placeholders. Remove pointers from the validation projection, but retain original pointers in the admitted metadata. Native verification must still check every original `sourceRef` and `baseSourceRef` against the exact original manifest references and verified bytes. A naked missing payload must not be converted into a verified source.

`sanitizeAgentReleaseSnapshot` replaces its snapshot and knowledge rows with finite known fields. `sanitizeWorkpaperRevisions` replaces revision records and directly sanitized blocks. Knowledge, checklist, prompt history, test runs, comments and review trail also reconstruct nested records. These operations discard opaque row IDs, pointers and unknown provenance if their results are saved. Comparing every explicit *known* field, array length/order and identity while returning the original object avoids that loss. Unknown keys cannot automatically become known safe operational fields; preserve genuinely opaque data without granting it rendering, path or execution authority. Use own-property inspection/definition rather than merging hostile keys into live configuration.

Frozen releases retain approved signatures on `superseded` releases, correctly; drafts have approval fields cleared. Strict admission must refuse an explicit draft approval that frozen would erase. It must also refuse over-60 histories, over-320 release knowledge rows, invalid/case-normalized fingerprints, changed sequence values, dropped snapshots or capped text. These are file claims, not newly obtained approval. A release snapshot's boundary strings are bounded text in the frozen format, not workpaper rich HTML; do not invent a new interpretation.

Frozen revisions retain six records and 300 blocks per revision. An explicit invalid revision is dropped; strict admission must reject that change. Empty `blocks:[]` is valid. Frozen knowledge rows default when an explicitly empty list is provided, and settings also introduce default rows for an empty list; a universal array-equality gate would therefore reject those explicit empty structures. Document the choice rather than silently adding rows. Real sparse Home documents have no such blocks and do pass the own-fields policy.

Test-run `rows:[]` survives. A row with `not-run` and no filled field, or an empty object, is removed by frozen validation. A strict array-preservation gate must refuse that change, even though the native existing-block short circuit can carry previously saved placeholders unchanged. Filled planned rows survive. Test rows with opaque-only payloads must not be mislabeled as validated evidence.

`validateCodeFiles` still has an **80-file** limit and a 4 MiB serialized metadata budget, independent of the native manifest's much larger reference-count cap. Empty placeholders remove the old per-file 500,000-unit text cap only for verified external sources. They do not justify silently slicing the file list, skipping identity/linkedRef checks, or dropping opaque metadata from the budget. More than 80 files must be an explicit refusal in this batch unless a separately approved native contract replaces that cap. Drafts are not validated by this function or by Docs preparation; validate their native identity/reference and finite structural contract separately, without materializing source text.

## Signoff meaning

Run `stampWorkpaperFileSignoff(originalDocument,{review:originalReview})` only after successful validation, on original source-linked metadata, never on placeholders. Preserve existing `signoffFromFile` through its established as-written history mechanism. This avoids misattributing the projection as imported content.

However, the frozen `workpaperContentDigest` reads title and block words, and knowledge digest reads `row.content`; it does **not** read `sourceRef`, source hashes or external bytes. Therefore stamping the original metadata does not turn `digestHeld` into proof that approval covered the source bytes. Preserve the frozen field's actual comparison semantics and state that limitation; do not describe it as source approval or substitute a novel source hash under the old digest label. Source-byte integrity and copied review claims remain separate evidence classes.

## Smallest safe implementation and probes

1. Native preflight verifies envelope, hashes, complete original references and bytes. The hidden method receives metadata JSON only.
2. Extract only supported workspace forms. Create detached validation projections, verify shape/count/identity, bind temporary frozen state, call full Mermaid/Docs/Code validation and prepare-workpaper rules, then compare explicit known fields recursively. Traverse historical source-bearing structures as well. Restore state in `finally`.
3. Verify diagram known fields with their frozen validators; add only the narrow current-native presentation compatibility contract described above. Unknown metadata remains opaque in the original.
4. Stamp file claims on original admitted documents and serialize the retained original envelope. Return neither projected content nor sanitizer replacements. Copy/remap is a separate guarded native stage.

Meaningful controls include an actual native export with a sparse Home document, new table and title/text whitespace, linked knowledge plus archived/release sources and two draft versions; references with `dangling:false`; explicit unsafe HTML, shortened fields, unknown kinds, 81 Code files, reordered/dropped arrays, malformed releases and unknown opaque row/provenance fields. Exercise the actual frozen hidden validator, not only a mock sanitizer. No such new executable probes were run for this design report.

## Inspected identities

```text
baseline/R78.html 5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4
build/import-validation.mjs da352751c5ec0cea02996a8d41af81145221c0f35794b6e8f0590b53fd630aa1
src/documents/presentation-edits.mjs f3edc45e5113f47caf3de3750707e6c10df3d48cde8724e9019e0c282770de09
src/navigation/document-create.mjs 8ba075ee638fea866af68dc51c7b87455378c6c4e440dfcdf8b2385683958878
src/documents/context.mjs a727c903d1c9819498db3be32c52cc52f2551aea62bc45446289e4ea65df0f47
src/sources/manifest.mjs 1d31f69a6ac0f1281a908bddacf0325c2f773b65c6c03f90781b31674e0086a1
src/sources/migration.mjs 6c363f24519120578040f0c535ba266a8609e2a6d06e70409cf6fb06ae747783
src/sources/recovery.mjs 4fddd4915be81e2290476fe5b113410c14af741f77206cf80b48a3ee23a6761a
```
