# Independent analysis — importing an exported schema-2 source bundle

Author: `/root/media_batch_review`, 2026-10-06. Read-only analysis of the real import routes, approved designs and existing copy/recovery primitives. I changed no product, tests or generated application inputs and ran no additional tests, GUI or CI for this analysis. Recommendations below are an implementation boundary, not delivered functionality, independent approval or qualification of any hosted run.

## Confirmed gap and current routes

The separate bounded measurement report `2026-10-06-source-bundle-bounded-scalability-independent.md` retains four actual exported bundles whose bytes/provenance decoded exactly but which current `parseLegacyImport` rejected with `Not a SIREN workspace export`. Decoding in that probe was an assertion, **not user import**.

- Legacy `src/main.mjs:294` enters `changeSelection`, prepares/drains current views, opens the native picker, reads at most 64 MiB, runs `validateImportedProject`, then uses `parseLegacyImport` and creates a new project (`:321`). It does not have a source-bundle decoder.
- Home `src/main.mjs:745` uses exact Home sender/frame authority and its transition ticket, reads the chosen file, runs the same hidden validator, then calls `selectHomeProject` with legacy parsed JSON (`:759`). That selector owns preparation, write drain, native-view retirement, creation and final selection.
- `build/import-validation.mjs:76` expects a legacy portable project or schema-1 storage bag. It runs frozen workpaper/signoff rules, not schema-2 bundle validation. A source bundle cannot safely be fed to this function unchanged. The direct parser rejection above is measured; this separate hidden-validator limitation is established from its source, not a native validation run.
- Export filenames end in `.siren-backup`; Home's picker currently filters only `siren` and `json`. The smallest import batch must make actual exported files discoverable through the picker and any relevant OS file associations, without accepting renderer-supplied filesystem paths.

Two existing mechanisms help but do not close this door. `verifySourceManifest` validates metadata hashes/references, but is not a hostile base64 decoder or a complete Docs/diagram domain validator. `restoreSourceSnapshot` verifies sources in an already-owned repository and copies/remaps them; it is not permission to trust a bundle's project IDs, pointers, provenance claims or approvals.

## Coverage by approved design

The approved large-source design, `docs/superpowers/specs/2026-10-02-siren-large-sources-design.md:33`, requires explicit native-picked file import, exact BOM/newlines/raw bytes and no renderer path authority. Its persistence section (`:55–61`) requires verified source blobs before manifest selection, copies preserving originals, explicit failure semantics and schema-declared backup/export. The approved plan (`docs/superpowers/plans/2026-10-02-siren-large-sources.md:71–72`) explicitly requires bundled referenced versions and restore into a new project. The approved Home design requires Open/import, coherent project switching and no content in Home bootstrap.

Therefore restoring an exported source bundle into a separate project is aligned with approved scope. Those documents do **not** specify a hostile external bundle parser, canonical base64 rules, unknown-envelope policy or exact file-signoff transformation. A short explicit contract/plan amendment should record those details before implementation. This analysis neither requests additional permission nor treats a recommendation as user-approved design. No new accounts, AI, execution, synchronization or module authority is needed for this batch.

## Smallest coherent implementation batch

1. **One native-only bundle preflight.** Classify the native-read chosen bytes; retain the existing legacy path unchanged for older formats. For `format:'siren-source-bundle'` require schema 2, a valid complete snapshot and an exact finite set of source records. Verify original manifest/request/metadata hashes before any transformation. Match records one-to-one by `sourceId + version + sha256`; refuse duplicates, missing/extra sources or a differing complete reference/provenance. Require strict canonical base64, preflight encoded/decoded lengths before allocation, decode and hash each source, and verify all declared metrics/encoding/BOM/newlines against actual bytes. A hash proves consistency, not author identity.

2. **Source-aware metadata admission through the isolated validator.** Pass bounded metadata to a dedicated bundle-metadata method at the existing hidden, hash-pinned validation entry; do not pass source base64/text to the legacy portable-project sanitizer or initialize the workspace behind Home. Reuse frozen diagram/Docs limits and file-signoff semantics via an explicit adapter for source-linked rows. Admit only validated known functional fields. Preserve unrelated opaque metadata and unknown provenance as data. Refuse unsupported operational envelope/ref fields rather than silently dropping them; preserve the chosen original file. Keep CSP/no network/no preload/timeouts/disposal checks. A copied approval is a file claim, never a newly obtained independent approval. Preserve as-written authors/review evidence and apply the established `stampWorkpaperFileSignoff`/`signoffFromFileAsWritten` rule rather than stripping source pointers or silently trusting copied signoffs. Document intentional metadata changes separately from exact source-byte preservation.

3. **Guarded copy into a fresh project only.** Reuse the mechanics of `createHomeProjectCopy`, `SourceRepository.importSource`, `remapSourceReferences` and `commitManifest`; do not import into the currently selected project or bind disk paths to IDs from the file. Generate new local project/source identities. Map each distinct original source/version/hash to its new reference (local imported version 1); keep different original versions/provenance distinct even if bytes coincide. Preserve source provenance and entity/agent/release IDs, without inventing relationships. Validate the remapped metadata, commit the new manifest, reopen actual source bytes/reference metrics, and require an exact saved recovery checkpoint before returning a completed copy. Preserve opaque storage strings byte-for-byte where they need no pointer transformation; storage containing remapped pointers necessarily receives a new serialization.

4. **Use both existing selection boundaries.** Home and legacy routes must call the same native importer, with their own current frame/PIN/mode/generation/monotonic transition authority. Keep all-view flush/drain and native roster preparation; recheck authority after picker, read, validation and each awaited copy/publication boundary. The chosen file is read once and never overwritten. Only after the copy is fully verified may the native session pointer select it and activate fresh registry authority. Home must retain its actual durable-pointer/receipt check. No renderer receives bundle bytes, arbitrary path authority or a newly writable full envelope; schema-2 legacy rendering stays fenced as today.

5. **Honest failure/recovery semantics.** Validation failure occurs before project creation. Once a fresh copy has allocated files, failure may leave import debris: keep it unselected and explicitly incomplete; never present a blank/partial initial project as completed import. Prefer retaining owned evidence to recursive best-effort deletion or deleting anything addressed by imported IDs. If bounded exact cleanup is implemented, it must target only verified new-owned paths and report failure honestly. On ordinary refusal resume old view authority, keeping its drafts. An atomic pointer already renamed is a committed event: reconcile/read back actual state, rather than claiming rollback or deleting the accepted copy. Original project content must not receive imported changes; legitimate pending-work saves by the preparation barrier are a distinct action, so compare originals after that barrier when proving import isolation.

This is a single batch: parser/admission, safe copy, both doors, tests and discoverability. A backend decoder alone would leave the user's actual Open/import broken. Existing source-bundle serialization need not change format to implement this boundary.

## Important implementation traps

- `restoreSourceSnapshot` cannot directly consume an untrusted in-memory object: its verifier currently obtains bytes from a local repository. A validated bundle may supply a narrow read-only source adapter or a factored verified-copy primitive; it must not gain repository/path authority.
- `ProjectStore.createProject` publishes an initial schema-1 revision before the final source manifest. The importer needs an explicit incomplete-copy outcome and tests of this interval; `ok:true` must require the final schema-2 revision and exact checkpoint, not merely creation of that initial directory.
- A globally scanning `RecoveryStore` must not be rebound to a source reader that refuses every project except the new copy. Its `scan()` visits other owned projects and records verification failures as damaged entries; such a binding could corrupt the derived catalog's view of valid existing projects. Restrict new-copy mutations while retaining genuine authorized read verification for the global scan. Derived global catalog changes are different from changing existing project content or pruning their checkpoints.
- `remapSourceReferences` already uses own-property definitions and depth/node budgets. Keep these protections for `__proto__`/`constructor`-named opaque data; do not merge parsed objects into live configuration or use labels/filenames/provenance as paths.
- Use the existing 64 MiB chosen-file limit, 32 MiB per-source limit, finite reference/node/depth caps and 256 MiB on-disk repository budget without widening them in this batch. Also preflight aggregate decoded bytes and disk amplification, including blobs/staging/records. The wire cap bounds base64 payload to less than 48 MiB before metadata overhead; it does not qualify memory/RSS or importing every possible 256 MiB project. Report oversized bundles explicitly, without truncation. Small injectable lower budgets can exercise refusal without a real giant fixture.
- Imported invalid-UTF8 source bytes may be represented by an existing `encoding:'unsupported'` reference; preserve them exactly and retain the existing edit refusal/conversion requirement. Requiring UTF-8 for the outer JSON must not silently re-encode embedded raw source bytes.

## Meaningful adverse tests and sequencing

Start with a tiny **actual exported bundle** as a RED against the genuine import doors; retain the first refusal. Build parser/preflight tests, guarded-copy tests, then actual route/selection tests and finally native/package evidence. Suggested extensions: `tests/source-recovery.test.mjs`, `source-manifest.test.mjs`, `source-migration.test.mjs`, `home-import*.test.mjs`, `home-native-selection.test.mjs`, `home-selection-receipts.test.mjs`, `import-validator-window.test.mjs` and native `headless-import` / `import-export`. Add a focused source-bundle import file rather than rewriting previous adverse cases.

| Boundary | Required adverse/control evidence |
| --- | --- |
| Integrity and identity | Flip one source byte/base64 character, metadata hash, request hash or declared metric; substitute a record's provenance; duplicate/missing/extra records; same hash with different original identity/version/provenance. No new project on failed preflight. |
| Exact content | BOM, CRLF/LF mixture, emoji, empty and unsupported-encoding bytes; multiple references to one version and A/B versions of one source. Compare actual reopened local bytes, full provenance and remapped pointers; ensure original bundle and current project unchanged. |
| Unknown fields and claims | Opaque nested metadata/storage/provenance preserved; unsupported operational envelope/ref version rejected; forged review/author/signoff fields retained as file claims, never treated as fresh local/independent approval. Test known linked row, Docs image and presentation-table fields through genuine frozen validation. |
| Path/DOM authority | Imported IDs `../`, absolute/UNC/device paths, malformed labels/filenames, prototype-named properties and markup/remote media; no path traversal, object prototype mutation, source execution or network fetch. Renderer cannot send path/bytes into the importer. |
| Allocation budgets | Wire/per-source/aggregate/count/depth/node/provenance limits, malformed noncanonical base64/padding and lying declared lengths. Reject before decoded allocation or writes; no truncated successful import. |
| Transition/rollback | Cancel picker; Lock or frame/generation/mode change while picker/validator/import is paused; Lock then unlock/rollback must not revive old job. Refuse before selectors and keep partial-copy state explicit. Compare original/session pointer after the barrier. |
| Durable faults | Failure after source blob, source selection, manifest selection, checkpoint or final session selection; disk-full/readback failure; pending cleanup refusal. Distinguish unselected incomplete copy from accepted commit and verify recoverable bytes after each. No false success or automatic old-state overwrite. |
| Existing project isolation | Current dirty native views genuinely flush or refuse; importer writes only new copy. Existing project revisions, source bytes and checkpoints remain exact after import; global recovery/catalog still recognizes them. Two imports cannot share an operation/copy authority. |
| Genuine UI route | Home and legacy Open/import discover `.siren-backup`; success selects new project only after fresh native receipt. Open imported Code/Docs/Diagram, verify source/version links and copied file-claim labels, then save/restart/export. Include a real current-frame refusal and actual validator disposal failure. |

No tests in this proposed matrix were executed as part of this analysis. Native pointer/keyboard behavior, physical multi-monitor UX, maximum import size and UI responsiveness remain unverified. Earlier export/Lock adverse records and concurrently captured CI evidence are outside this report's verdict.

## Source identities inspected

Local HEAD at final route inspection: `59081e36f00629d6da4c0d474efe5dcb21f1312b`. Hashes below identify the read-only analysis inputs, not a release approval:

```text
src/main.mjs afb62f83614e8536893d0531c6635be257e9ba80f981fedc9948bde6ceedac0a
src/projects/import-validation.mjs fb53986db1333c0a9aeeb0d66788b97c82c93a6e218a2e030346c676c43b0a98
src/projects/import-validator-window.mjs 838b878405be89e49c6f57bf930a388ff929f9a05b95d4b439c29c12f6161df4
src/projects/migration.mjs 5a13e71306f7fcb9a6945fc2b55ded31d2a37402bc880b7768e5c8eca08d3a01
build/import-validation.mjs da352751c5ec0cea02996a8d41af81145221c0f35794b6e8f0590b53fd630aa1
src/sources/recovery.mjs 4fddd4915be81e2290476fe5b113410c14af741f77206cf80b48a3ee23a6761a
src/sources/migration.mjs 6c363f24519120578040f0c535ba266a8609e2a6d06e70409cf6fb06ae747783
src/sources/manifest.mjs 1d31f69a6ac0f1281a908bddacf0325c2f773b65c6c03f90781b31674e0086a1
src/sources/repository.mjs ce4ba2ff620af9961b0b389b28c258491b5f13423ce32e1bd298ebf8d047b2e4
src/navigation/project-copies.mjs 5742ea54c0ed761812b1d4b92e122850db79047b8bccd24fe24143e63ccfedc9
docs/superpowers/specs/2026-10-02-siren-large-sources-design.md 27855925d4fc321d09c7e2ba11ba9613bb15b6e82b4eeb0cd6871f1a6895d60a
docs/superpowers/plans/2026-10-02-siren-large-sources.md eb466d3eb4a760fb4b84e7c5030b5001ce76175d423963f3c29fad1f3e04e7da
docs/superpowers/specs/2026-10-03-siren-home-diagrams-design.md da66a8480ea5ec3fbf534b594e81053de63f961e2c702f5104028dcbf5706884
```
