# Explicit native Code to Docs links — implementer evidence

Written by the implementing coordinator. This is implementation evidence, not an independent review or release approval.

Working Code now offers **Link to Docs**. It first verifies the actual source save, presents paginated document/row metadata, and updates only the explicitly chosen row using its document content token. Cancelling leaves Docs unchanged. Stale document content refuses the link; source versions, other rows, agents and historical releases remain retained. Native Docs Refresh reads the actual newly selected manifest. Readonly historical Code and Docs cannot use the link channel.

The finite main-owned bridge derives project/source identity from the real registered working Code frame; renderer payloads cannot supply a project, path, full document or preparation nonce. The service validates the source's real committed operation and uses the shared owner queue and existing manifest/recovery transaction. Main refreshes selected metadata only after the real commit. The target catalog returns 64 rows per page, at most 4096 targets, 200-character titles and no private document body. It verifies the manifest once per request and computes the same content token once per document, avoiding repeated full-project verification.

## Current evidence

- Boundary and production-main tests: 19/19 passed, including real disk writes, exact selected history, foreign/pinned/Docs/subframe/readonly/Lock denial, strict accessor/extra-field refusal, 64/64/2 pagination, oversized catalog refusal, source commit provenance and stale Docs tokens. Earlier broader integration run passed 26/26.
- Actual production 100k-line flow `evidence/source-link/2026-10-03T22-17-00.997Z`: COMPLETE four groups. Cancellation, explicit pointer selection, exactly one changed row, exact unchanged other Docs/releases/history, native Docs Refresh, actual stale CAS refusal, Close/reopen and Lock passed. This run precedes the catalog optimization and later open-dialog Lock extension.
- Actual production 300k-line final flow `evidence/source-link/2026-10-03T22-20-21.449Z`: COMPLETE four groups, captured inputs unchanged. It includes the catalog optimization and actual Lock with the link dialog open; all native satellites are destroyed and the locked bootstrap has no snapshot. Generated Python source contains Unicode comments; exact new and historical bytes remain asserted.
- Readonly native regression `evidence/source-read/2026-10-03T22-21-30.720Z`: COMPLETE six groups. Actual historical source selection, future draft isolation, Code/Docs reads, explicit write refusal and Lock preserve the whole selected project/source.

Original `evidence/source-link/2026-10-03T22-16-16.005Z` stays ADVERSE with two successful groups: the fixture sent `documentVersion` where the strict link contract requires `expectedDocumentVersion`, producing REQUEST_REFUSED before the intended stale-document check. The corrected request is explicit; no authorization, byte oracle or document-conflict rule was relaxed. Initial missing-module/main-channel tests were RED as expected. The first boundary fixture wrongly used a full SourceRef in a row pointer and was refused by the existing manifest validator; it now uses the actual three-field pointer. These are retained development observations, not independent approvals.

The real target-dialog screenshot was inspected: theme-compatible modal, source version explanation, literal imported titles, bounded scrollable rows, clear Cancel and Update actions. No imported HTML is executed. Full frozen-suite, committed package and hosted results will be recorded after they actually finish.

Frozen `evidence/code-docs-suite-result.json` completed **692/692** tests (2 native identity + 690 unit/protocol), exit 0, no skips/cancellations/todos, `changedInputs:[]`. Log SHA256 `56ce65e465128e6434b45466d80f20c524b437ce2176fce1342c6c80e04ae29d`. No captured runtime/build/test/package/workflow changes occurred during the run. Committed package and hosted results for this batch remain pending.

## Open scope

This updates an existing linked Docs row; creating Docs/rows and linking previously unlinked sources remain separate work. General native Docs editing, synchronized Code view UI, A/B analysis/diff workers, native Diagram/Presenter/Terminal and physical multi-monitor/DPI qualification remain open. No installed user application was replaced, main merged or public release published. The one-time Git graph remains frozen.
