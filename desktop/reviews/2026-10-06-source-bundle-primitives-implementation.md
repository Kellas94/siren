# Source bundle parser and new-copy primitives — implementation evidence

Author and implementer: `/root/media_batch_review`, 2026-10-06. This is **my implementation report**, not independent approval of my code. Ownership was limited to two new source modules and two new test files under the source-bundle import amendment. Root owns isolated metadata admission, main/Home/legacy routes, discovery/startup fences, packaging and native qualification. I did not modify those files, frozen R78, existing validators, existing tests, generated application files or CI runners. No GUI or CI was started by me.

## Implemented API and boundaries

- `parseSourceBundle(bytes,{limits}={})` in `src/sources/bundle-import.mjs` returns `null` for valid JSON without the declared bundle format, leaving legacy validation to its caller. A declared bundle with invalid schema/fields/data throws a refusal, never silently falls back. It checks wire/reference/node/depth/provenance/source/aggregate limits, original manifest/request hashes, exact one-to-one references/full provenance, strict canonical base64, actual bytes/hash/encoding/BOM/newline/metrics. Unknown operational fields are refused; opaque metadata/provenance remains data. The parser does not authenticate a claimed author.
- Native-only `verifyParsedSourceBundle` rechecks source bytes, references, metadata and provenance after asynchronous admission and returns owned copies. `verifyBundleMetadata` validates admitted metadata's pointer membership **and exact original `sourceRef`/`baseSourceRef` graph at the same paths**, including JSON storage bags. A substitution with another valid bundled source is refused before allocation. File-signoff transformations which preserve that graph remain possible; the actual domain/signoff validator belongs to root.
- `createImportedSourceBundleCopy({root,bundle,metadata,isCurrent,recovery,writerOptions={}})` in `src/navigation/source-bundle-copy.mjs` allocates a fresh native-generated directory only after revalidation. Each distinct source/version identity becomes its own local version-one source; equal hashes do not merge differing provenance/identities. It remaps references, commits/reopens the manifest, re-verifies actual source bytes/full local references, and requires an exact saved checkpoint. It never writes `session-selection.json` or an existing project. It returns `ok:true,snapshot` only after completion checks; failures return `ok:false,code` and an `incompleteProjectId` only once that fresh directory was actually allocated.
- Copy source/project mutations are scoped to the generated ID and use a latched current-authority guard at every fault/publication boundary. A separate guarded `RecoveryStore` preserves the supplied genuine global source reader instead of replacing it with a copy-only reader. Existing valid projects/checkpoints remain globally scannable. The supplied store must share the same root.

## Durable incomplete-copy fence

Before initial project selection, source import or manifest work, the new owned directory gets `source-import-status.json`, atomically written and read back as `{schema:1,projectId,state:'incomplete'}`. An initial metadata marker independently says `kind:'siren-incomplete-source-import', importState:'incomplete'` while the copy is not yet a source manifest.

The sidecar changes to `state:'complete'` with the exact imported revision/metadata SHA only after verified sources, manifest and saved checkpoint. Its final write/readback is guarded. A pre-publication completion-marker failure returns failure and leaves durable incomplete status even if the manifest/checkpoint already exists. No recursive cleanup hides partial data.

`readSourceBundleImportStatus({projects,projectId})` is exported for root's startup/open/Home/catalog fences. It reads only a strict owned path with a 4 KiB cap. An absent sidecar returns `null` for an ordinary project; unreadable, oversized, malformed, unknown-field or mismatched state throws `BUNDLE_IMPORT_STATUS_REFUSED`. Valid incomplete state is explicit. Complete status must describe the actual schema-2 manifest or a genuine selected ancestor, so ordinary later edits remain openable while an unrelated/orphan body cannot prove import completion.

**Integration prerequisite:** existing `ProjectStore.listProjects` alone still recognizes an allocated initial pointer as a project. Root must consume this sidecar in discovery, startup and both open routes to exclude/refuse or explicitly recover incomplete copies. This report does not claim that the primitive alone changes those UI routes. The same applies to `.siren-backup` picker discoverability and frozen source-aware metadata admission.

## Actual test evidence

Initial real-export parser RED: nine assertions failed against a null TDD seam, including an actual emitted RecoveryStore bundle not being admitted. Initial copy RED: six failures and two existing refusal controls against an unavailable-copy seam. Separate retained REDs cover missing durable status, a valid-pointer substitution incorrectly accepted and an imported completion marker incorrectly refusing a genuine later save. Product code was implemented only after those corresponding tests.

One first checkpoint test used `checkpoint-verified` as though it meant an uncommitted save. It failed because existing `commitManifest` correctly found and acknowledged the already verified checkpoint. That first 17/18 result is retained. I corrected the fault classification: a genuine `before-rename` checkpoint refusal must fail; a separate postcommit hook-error control requires acknowledgement of the exact saved checkpoint. This distinction preserves commit semantics rather than forcing a false failure or claiming no write occurred.

Final execution on Node v24.16.0:

```text
node --test tests/source-bundle-import.test.mjs tests/source-bundle-copy.test.mjs
  tests/source-repository.test.mjs tests/source-manifest.test.mjs
  tests/source-recovery.test.mjs tests/source-migration.test.mjs
  tests/source-metrics.test.mjs tests/text-model.test.mjs
  tests/home-project-copies.test.mjs
92 tests passed, 0 failed; 24 new focused tests plus 68 related existing tests.
```

Coverage includes actual exported two-version sources, exact Unicode/BOM/newline/raw unsupported bytes; same bytes with differing source identity/provenance; corrupt hash/metrics/provenance, canonical base64, lower injected budgets, traversal/unknown pointers/operational fields and prototype-named opaque data; pre-allocation revocation; post-source and initial-selector failures; checkpoint failure/actual postcommit acknowledgement; global recovery isolation; final status publication failure; corrupt sidecar; actual later save; and original project/session-pointer isolation.

A real **2 MiB source** export also passed the current repeated-group base64 regex without stack overflow. `source-bundle-base64-size-red.log` is unfortunately named from the intended probe stage, but its actual contents are GREEN (one control passed); it is **not adverse evidence** or proof that every maximum-size input is safe. No maximum-budget/OOM fixture was allocated and budgets were not widened.

Full global suite is intentionally deferred at root's explicit request until the shared import validator/main integration freezes. Root was editing those other ownership areas concurrently. These local unit results do not qualify runtime/package allowlists, genuine selected native dialogs, metadata sanitizer/file-signoff behavior, GUI fluidity or hosted CI. A separate author must review the integrated batch.

## Exact delivered identities and retained logs

```text
src/sources/bundle-import.mjs 551dc265aae802b35e46e9bc5fab44f8adbbe35a8157166facc2ef60cda20345
src/navigation/source-bundle-copy.mjs a85b1adc01ec485bcce83f37d86da84beff63048fb4f42a85dc9be0b804164f9
tests/source-bundle-import.test.mjs 19e70c837f5c79b71cea61681154c4d68202d335233ba9a89bbb5c5eba70776d
tests/source-bundle-copy.test.mjs 8a72b034737f7be5cbe7cbc5f70a1fcce55c9cea2cbcf848c0782f58f5222e6a
evidence/source-bundle-parser-red.log 1916723fb4f05347b21abca1a49bfb930bf0798b1323d70944fb99f074ed8baf
evidence/source-bundle-copy-red.log 4e91f4273b3f9a84416176d933ff55dced0010fadbc3300c709a97b815b90ab6
evidence/source-bundle-primitives-green-initial.log b0ddd216d89ddc3b426dd97ad1e0f93ec3138616e9a2daf4d65d72c0de1ec945
evidence/source-bundle-copy-durable-status-red.log 19d7f81b44f101e38e909528d644ccbff5cfddd207800d84930947fea530af5b
evidence/source-bundle-pointer-status-red.log e7c7f16892933d0343b76ecdb257e1e84db89025dde8c12ba62551757142e53b
evidence/source-bundle-base64-size-red.log a2ef1fdc3788e4e8ece9606871f54d2d2f86abee9726adf250eeb4e4afd46130
evidence/source-bundle-focused-related-final.log d9c4cafe2759202e7b94952115867969f33592e75a75e038a3729f70655081a9
```

Previous independent reviews and adverse artifacts remain unchanged. This author is now the implementer of these new primitives and does not provide independent approval for them.
