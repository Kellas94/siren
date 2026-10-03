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

## Subsequent committed-package and private sync

Local source `70bd68bd3299edac0b99df7788a031701a3c5d78` built `dist/development-cb6ec9a3-a1de-48b1-b033-cee86b5ba471`. Archive SHA256 `c17f9bf287b912eff421c581d18d8f2423eb12352592ca37c4ff009116b27921`, 31,339,734 bytes; runtime unchanged `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. Existing packaged probe `evidence/packaged-2026-10-03T22-28-16.433Z` completed. Actual packaged 300k-line Code/Docs probe `evidence/source-link/2026-10-03T22-28-29.310Z` completed four groups with inputs unchanged, executing the receipt-matched ASAR from a separate Unicode folder copy. It qualified the real edit/cancellation/chosen-row link/Docs refresh/stale conflict/native Close/reopen/open-dialog Lock flow; no CLI test-root bypass was used for the packaged app.

Private remote `013e45f84e43a634a17d17a54b0d878f16c36d8e`, tree `3183b0672befbb180ed3aecce80eba3f30a23ed7`, has 19 exact changed blobs and 1,101 unrelated blobs preserved (1,120 total). Actual commit parent/tree, nonforced ref, raw PR head and unchanged main were checked. PR2 remains draft/open/unmerged; hosted results for this head remain unobserved here. Later working-view synchronization is separate development.

## Open scope

### Hosted qualification observed after the preceding package

Desktop CI48 (`37158751195`, head `013e45f84e43a634a17d17a54b0d878f16c36d8e`) **failed** at Development package identity; Launcher39 (`37158751241`, same head) succeeded. The earlier statement that hosted results were unobserved describes the time of the preceding sync, not current qualification.

The original authenticated artifact `11287466200` is retained in `evidence/ci48/artifact.zip`, SHA256 `db9c9d2d5dc413812101f406a4f72b661fc3d06d9955efc119362fb51d9b96fd`. Original packaged source-link `2026-10-03T22-48-31.947Z` completed its three edit/link/conflict groups, then failed closing the working Code view with native `VIEW_FLUSH_FAILED` / renderer `SOURCE_REQUEST_FAILED`. Original packaged recovery `2026-10-03T22-48-01.371Z` completed. The raw underlying source failure was not recorded by that version. Its cause remains unconfirmed; local success does not erase it. The next batch adds bounded main-only method/code diagnostics and preserves visible local text after a refused preparation.

This updates an existing linked Docs row; creating Docs/rows and linking previously unlinked sources remain separate work. General native Docs editing, synchronized Code view UI, A/B analysis/diff workers, native Diagram/Presenter/Terminal and physical multi-monitor/DPI qualification remain open. No installed user application was replaced, main merged or public release published. The one-time Git graph remains frozen.
