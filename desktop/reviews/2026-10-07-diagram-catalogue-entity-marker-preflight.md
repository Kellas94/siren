# Catalogue creation marker on the new Diagram

Author: Codex `/root/media_batch_review`, 2026-10-07. Separate read-only design refinement of `2026-10-07-diagram-catalogue-append-transaction-preflight.md`; that original remains unchanged. No implementation, tests/probes, GUI, build, package, CI or source edits. No runtime qualification or independent release approval.

**Recommendation:** put the distinct bounded creation marker on the newly allocated minimal Diagram. This avoids changing any pre-existing top-level metadata and naturally supports creating B then C. Accept replay only from an exact selected historical manifest operation with a verified immediate parent and an exact one-object append proof. Neither a current entity marker nor an imported lookalike grants creation/open/edit authority.

## Concrete marker and replay proof

Suggested key: `sirenNativeCatalogueCreation` on the new object only. Its strict own-data schema binds action/schema, selected project ID, operation ID, logical request hash, catalogue version/reference SHA, entry ID/source SHA and new entity ID. Optionally bind the hash of the minimal entity **excluding this marker**. Bound all fields and reject extras/unsupported versions. The logical request hash binds exact validated title plus trusted catalogue identity, action and project; it excludes the random new ID so the same caller request can recover its previously allocated ID.

Do not put a full hash of the object containing the marker inside that marker: it is a self-reference. The same applies to storing the enclosing manifest's request hash inside metadata whose bytes that hash covers. Instead verify the manifest request hash from the verified snapshot and calculate the complete historical entity hash for the external creation receipt. Existing `commitManifest` already binds project/baseRevision/sourceRefs/raw metadata JSON/operation ID (`manifest.mjs:27,164–183`).

Replay procedure inside the FIFO:

1. Obtain `selectedManifestHistory`, recheck scope, and locate the selected snapshot whose **snapshot.operationId** equals the requested operation. A marker elsewhere in the latest workspace is not the lookup authority. Reject multiple conflicting selected identities or an operation used by another action.
2. Require a verified immediate schema2 parent in this returned ancestry: same project, revision exactly child minus one, child.parentRequestHash equals parent.requestHash and child.parentManifestHash equals `manifestSnapshotHash(parent)`. Check this relation explicitly; do not merely trust adjacent array positions. Task3 creates only from schema2, so a schema1/import bootstrap is not a valid historical creation parent.
3. Parse the actual primary workspace/envelope via the existing `workspaceMetadata` policy. Validate both raw diagram containers and unique IDs. Require child diagrams to equal parent's complete ordered prefix, plus exactly one final object. The new ID is absent from the parent; no existing entity, source pointer, version, unknown field or non-diagram workspace value changes.
4. Reconstruct the allowed child from the parent: append the exact minimal trusted catalogue object with initial native version1 and this strict marker. Replace only the primary storage string, `state`, or direct-workspace diagrams as the ordinary envelope algorithm does (`domain.mjs:71`). Compare the resulting full metadata with the actual historical child using the same deterministic serialization as creation. This proves preservation beyond the diagram prefix, including every top-level field, unrelated storage string and nested opaque/source-reference value. Require unchanged project identity and source-reference values/provenance. No inherited style/presentation/default metadata or extra new-object fields are permitted.
5. Validate marker project/action/op/catalogue/request/content against this historical child and the exact normalized request. Invoke `commitManifest` using that historical base revision, original child metadata, child source refs and original operation ID. Its exact duplicate path checks request hash, verified source bytes and actual recovery durability without selecting an old revision over current work. Recheck scope after the await.
6. Report historical creation identity/version/hash separately from current availability. Reread current membership/current bytes before opening. B edited to version2 still replays creation at version1 but opens version2; missing/duplicate B never resurrects. Opening remains a separate main-owned current policy and post-FIFO working admission.

If the required parent is unavailable/truncated, refuse to acknowledge creation or reopen from that proof. Do not synthesize a parent from current metadata. If the operation is found but proof fails, return conflict/refusal and do not allocate a fresh ID. If ancestry no longer reaches an operation but a current marker claims it, treat that as ambiguous retained data and refuse duplicate creation; do not promote it to a receipt. A removed object plus missing historical proof cannot be safely reconstructed by marker inspection. This is a recovery limitation, not permission to resurrect.

## Why ordinary imported lookalikes do not suffice

Current source-bundle copy allocates a new project, stores imported metadata at its initial schema1 revision, and commits schema2 under a fresh native random operation (`source-bundle-copy.mjs:56–65`). Legacy source migration also uses a fresh project and operation (`migration.mjs:53,165`). Imported markers are retained as opaque entity data; they do not make those transitions an exact schema2-parent append. A marker on an already-existing diagram fails the new-ID/prefix proof even if its strings resemble the request. Parent project binding and enclosing operation identity add independent necessary checks.

This is structural consistency and selected-history proof, **not cryptographic author authentication**. `verifySourceManifest` validates hashes, not a secret signature. A party able to replace the owned native project/history and recompute a completely consistent chain can forge either marker design. Do not claim marker placement prevents filesystem tampering, proves native authorship or represents reviewer approval. Current authentic sender/epoch/mode/working-admission guards remain necessary on every replay/open; the marker is never a capability or general sibling-open grant.

## Comparison with a recognized top-level marker

| Property | New-entity marker | Recognized top-level marker |
| --- | --- | --- |
| Existing opaque fields | No existing key overwritten. | Needs reserved-key collision refusal or an explicit recognized-bookkeeping overwrite exception. |
| Create B then C | Each new object carries its own marker; B unchanged. | C replaces B's latest marker; B replay depends on retained historical snapshots. |
| Later B edits | Existing typed Domain apply preserves unknown target keys because it assigns admitted fields; creation proof remains historical. | Top-level creation marker may survive unrelated operations, but only historical snapshot operation can prove creation. |
| Deleted B | Historical selected ancestry may prove creation; current open still denied. | Same. Neither placement permits resurrection. |
| Imported lookalike | Must fail unless enclosing operation and exact verified parent append also match. | Requires the same proof; recognizing marker shape alone is insufficient. |
| Tampered owned history | Unsigned consistency proofs cannot authenticate authorship. | Same limitation. |

The entity marker is the smaller preservation contract. Treat any imported identical key on **existing** entities as opaque and unchanged, rather than reserved editable bookkeeping. Existing style/source typed payload allowlists do not expose this new key, and existing unknown-field preservation should keep it through ordinary edits. Do not add a global sanitizer or strip imported markers. Future clone/import/export semantics should state that copying the marker does not copy authority; current-copy project/operation identity already changes.

## Negative acceptance cases to add

- B then C preserves B, all original data and top-level opaque marker-key collisions exactly; retries for each operation still select their original historical append.
- Same operation with changed title/entry/catalogue identity, foreign action, wrong project, extra marker fields or mismatched historical object refuses without another append.
- Marker copied onto an existing or second object, appended diagram plus unrelated top-level mutation, reordered/edited prefix, modified sourceRefs/provenance, or missing parent refuses replay.
- Genuine imported bundle containing a perfect-looking marker remains opaque; no native historical creation receipt/open is inferred from it. A fully forged filesystem chain is explicitly outside this unsigned author-proof claim.
- Later B edit preserves its marker without resetting B; deletion/duplicate membership refuses open; unavailable historical parent refuses safely and does not create another B.
- All existing Lock/selection/account/frame/private-flush/FIFO guards and post-FIFO admission cases from the original preflight remain required. Marker placement does not solve lifecycle races.

The nine-file input map was captured after source reads, before report writing, at `evidence/workspace-surface/diagram-catalogue-entity-marker-preflight/inputs-report-start.json`. Closing receipt records actual report/source hashes and any changes. This recommendation refines the approved Task3 marker placement without expanding implementation scope or asserting that the proposed API exists.
