# Next functional parity batch: native Docs Activity

Author: `/root/media_batch_review`, 7 October 2026. This is my read-only source/backlog analysis and proposed implementation boundary. No GUI, build, test suite, network, Git operation, or product/test/generated/workflow modification was performed. Only this report was authored. Root reports the current Inspector candidate as committed `a603`, native8/full1417/development8 complete, with separate portable qualification still running; I did not execute or independently approve those results.

## Decision and reconciliation

Recommend **one native Docs Activity tranche: structured retained comments, archived changes, and review/release records, with safe block navigation and a bounded revision comparison**. This restores useful access to already retained document information. It is not another shell redesign and does not require a new dependency, account system, publisher or privileged IPC.

The approved `docs/superpowers/plans/2026-10-06-siren-workspace-ui.md` explicitly requires functional migration from the supplied HTML, with real controls and preservation of existing boundaries. The earlier `2026-10-06-post-media-next-analysis.md` rank4 and `2026-10-07-next-desktop-parity-batch-analysis.md` rank3 already identify this gap. Their earlier ranks are historical: Home saved backup, Docs saved export, Presenter notes/export, Code context/commands, Diagram history/typography, Walkthrough and Inspector/Filters have since been implemented in separate lots and are excluded here. This report does not independently qualify them.

The opening checkpoints in `SIREN_RESUME.md` and `SIREN_UI_NEXT_BATCH.md` still describe Inspector qualification in progress. They are useful ordering/provenance records, not a fresh remaining-defect census; root's newer explicit checkpoint takes precedence. Original adverse evidence stays intact. Historical hosted Diagram Save-to-Attach remains OPEN and is neither diagnosed nor closed by this proposal.

Why Docs next: it exposes existing agent-document review evidence that users currently have to decipher as nested JSON-like fields. Diagram type/template discovery and offline layout choice are another genuine remaining group (`2026-10-07-native-diagram-parity-next-analysis.md` rank3), but require a deliberate creation/configuration precedence contract. Public presentation image/media cards need a larger binary asset/recovery boundary. Neither belongs in this small Docs lot.

## Concrete missing access

| Reference / current source | Supported finding |
| --- | --- |
| `baseline/R78.html:70956–70975,71020–71160` | Separate Comments and Changes doors, open/resolved comment filtering, block jump and explanatory comment rows. Legacy comment resolution/deletion are mutations, not mere display. |
| `baseline/R78.html:70932,71165` | Archived revisions are distinct from local Undo. The reference compares block IDs/content and offers Restore; they must not be collapsed into one native-history claim. |
| `baseline/R78.html:41385,41506,69821` | Agent release records, review states and provenance are visible in dedicated controls. Legacy UI includes capture/approve operations; reading a record is not authority to create or approve one. |
| `src/ui/windows/docs.js:18–45` | Retained document fields, including comments/revisions/review/releases, use generic `field/items` expansion and field-name outline buttons. Data is not absent, but semantic comment filtering, exact block jump, revision compare and readable review/release rows are absent from this native controller. |
| `src/ui/docs/draft.js:8–19,48–58` | Working edits and session Undo already exist. `getDocument()` merges current title/blocks/context over the retained document. Existing metadata is preserved; no comment/review/release setter exists. |
| `src/windows/domain.mjs:33–43` | Docs accepts rename, replace-blocks/content/context-content only. Do not expand that allowlist just to render retained records. |
| `src/windows/docs-reads.mjs:15–32` | The existing exact selected-document read is registry/frame/epoch/owner scoped and checks before/after identity and digest. Activity can consume this already admitted document; it must not ask the renderer to choose a different project/document. |

This is a native-access gap, not a claim that Classic Studio lost its controls or that imported records are independently authenticated.

## Smallest coherent implementation

Add one compact **Activity** disclosure beside Context, using the existing shell/theme tokens. Inside it offer **Comments**, **Changes**, **Review & releases**. Keep the document and its working inputs mounted; no permanent second toolbar row and no modal that blocks use of Docs. All controls work in genuine readonly windows. This tranche has **no document mutations**: no resolve/delete/comment composer, Snapshot now, Restore, approve/reject/capture release, or fabricated status changes. Those remain explicit functional parity gaps requiring finite write/provenance contracts, rather than decorative disabled buttons in this tranche.

1. Add `src/ui/docs/activity.js`: an isolated controller with finite projections and local pagination/filter state. It receives the exact admitted saved document/version/hash, current draft block view when appropriate, a guarded block-reveal callback, and lifecycle status. It never invokes `applyDocument`, `setContent`, Save or export. Optional extracted pure projection/comparison functions can live in `src/documents/document-activity.mjs` and be injected through a small self-contained build helper if sharing genuinely helps; avoid unnecessary abstraction for one renderer.
2. Wire `src/ui/windows/docs.js` to retain the actual saved-document context separately from `draft.getDocument()`. Comments/review/releases/revisions are records from that saved version. Label the version and explicit **unsaved working content** context when comparing or jumping into a changed draft. Refresh adoption, save acknowledgement, conflict and disposal must update/invalidate the panel coherently; Activity must never trigger auto-Save or discard pending rich/context/image fields.
3. Extend `src/ui/docs/reader.js` with an owned **reveal by exact unique block identity** seam and equivalent lazy working-editor reveal in `docs.js`. Current reader only materializes 40 blocks/page (`reader.js:52–62`), editor similarly pages 40 (`docs.js:124–156`). A jump beyond the first page must progressively materialize the needed block under a finite bound without repainting the existing inputs. Unknown block kinds need a labelled preserved-block anchor. Duplicate, missing, malformed or ambiguous IDs disable jump with a reason; do not interpolate imported IDs into CSS selectors or silently take the first match. Keep focus/selection and unsaved text stable until the user's explicit jump moves focus.
4. Extend `build/windows.mjs:21–23,48` for the real button/panel/controller and strict script syntax/hash emission. Reuse shared chrome; any minimal local layout CSS must remain within the Docs panel and pass the original narrow-window shell geometry oracles. No main/preload/domain or public presentation projection change is needed for this read tranche.

### Record semantics

- Comments: display known text fields `author/kind/text/at/resolved/resolvedAt/resolvedBy` and exact `blockId`; local All/Open/Resolved filter only. Treat `resolved` as resolved only when it is the actual supported boolean, otherwise show an unsupported recorded state. Preserve original array position as the stable row locator, including malformed entries; duplicate IDs are not merged. Unknown fields and invalid scalar/container values remain accessible through existing Preserved fields, with a clear bounded-view notice.
- Changes: list retained `revisions` by original position, recorded author/date, and captured block count. Show missing/invalid dates as recorded text, never an invented timestamp. **Compare** operates on one chosen archived block set and an explicitly named saved-current or working-current block set. Use linear ID classification, including added/removed/changed/reordered rows; require unique valid IDs before claiming an exact ID comparison. Compare complete admitted block values within a byte budget so formatting, source refs, unknown metadata and images cannot yield false “no changes” from equal visible text. For unsupported/budget-exceeding content say comparison unavailable/partial, never identical. Source pointer comparisons concern pointer identity only; they do not execute or load code or claim source-byte/test equivalence.
- Review/release: render `status`, `review.state`, submitter/decision fields, `review.trail`, release sequence/version/status/creator/approval fields, notes/testing reference and fingerprints as **recorded claims**. Imported review assertions carry `signoffFromFile` (`R78:70129,70256`; actual import helper stamps at `build/source-bundle-metadata.mjs:181`). Display that provenance without re-stamping, sanitizing or mutating the record. `approvedBy`, hashes or an “approved” enum do not establish an independent reviewer identity, a valid signature or real test evidence. Do not recompute legacy `agentDrift` over partial/source-linked content and claim verified release equality.
- All displayed HTML/code/notes are inert text. No raw rich snapshot HTML, image decompression, source fetching, URL opening, clipboard of private payload, or arbitrary record execution is introduced. Existing exact archival JSON export remains the full-data escape hatch; Activity does not silently drop raw data or change export semantics.

### Meaningful finite bounds

The existing single-document native read is at most 8MiB (`domain.mjs:102`) and transport copy has structural guards. Do not widen those limits or eagerly clone/stringify the entire doc for each panel keystroke. Proposed initial presentation budgets: 20 rows/page, 4,096 characters per scalar excerpt, progressive detail chunks no larger than the current 24,576-character text chunk, and an explicit comparison cap of 256 blocks / 1MiB aggregate compared JSON. Process record arrays by cursor, with displayed/scanned/total counts, rather than rendering every row or sorting/cloning a huge array. Readonly imported documents can exceed the 300-block editing limit; a display cap is not permission to truncate the saved document. If exact compare/jump cannot complete within its declared budget, show the limit and preserve normal reading/export. These are proposed design bounds, not measured capacity or latency claims.

## Acceptance and sequencing

Implement pure bounded projections/comparison first (genuine RED/GREEN), then the controller/lifecycle, then block reveal and shell wiring. Obtain separate source review before actual native development and copied-package qualification, using the shared GUI scheduler. This is normal implementation validation, not a new user permission gate.

Proposed tests:

- New `tests/docs-activity.test.mjs`: valid/malformed/missing records, unknown fields, unsupported state values, duplicate IDs, dangling block links, exact original positions, malicious strings/URLs/prototype-like names, bounded excerpts/pages, formatting-only/unknown-field/sourceRef/image/reorder changes, ambiguity and budget refusal with no false identical result. Freeze whole input JSON before/after every operation.
- New `tests/docs-activity-view.test.mjs`: actual read-only controls and accessible disclosure/filter/compare; no mutation bridge calls; no DOM HTML execution; focus/selection and open rich/context/image fields retained, append-only lazy block reveal beyond page1, paused/disposed/stale callbacks unable to restore private DOM.
- Extend meaningful existing `tests/docs-reader-guard.test.mjs`, `tests/docs-draft.test.mjs`, `tests/native-docs-reads.test.mjs`, and relevant build/CSP fixtures only where behavior changes. Retain exact role/epoch/frame/identity adversarial checks; no generalized Home/legacy/Audience authority.
- New `tests/native/docs-activity.mjs`, genuine `--package`: imported agent document with comments,6 archived revisions, review trail, release/source pointers and opaque fields; actual All/Open/Resolved filtering; jump beyond first40 blocks and dangling-link refusal; genuine saved vs unsaved compare; exact project/source/archival-export retention; two windows with independent local filters and explicit version conflict/Refresh behavior; attach/detach continuity; common Lock hides/retire controls and rollback preserves pending edits; light/dark/named-theme/narrow geometry screenshots. Exercise actual native keyboard and pointer events, not renderer DOM clicks. Do not claim all comments/governance write parity from this read tranche.

Important risks are stale saved-vs-working context, a block jump destroying draft state, false provenance/approval labels, hidden omissions in comparison, and unbounded rendering of imported histories. Physical monitor/DPI/IME usability, full decorative parity, exact source execution evidence and remaining writable review/release operations stay unqualified.

## Inspected working-byte snapshot

SHA256 values were freshly captured from the files read for this analysis. They identify Windows working bytes, not Git blob equality. Handoffs are explicitly historical snapshots; source/runtime qualification is not inferred from their hashes.

| Path relative to `portable/desktop` | Bytes | SHA256 |
| --- | ---: | --- |
| `baseline/R78.html` | 13626609 | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |
| `../docs/superpowers/plans/2026-10-06-siren-workspace-ui.md` | 17476 | `1a8ab87d3ad6bab18a1f18e75c3281c425f8fa66de7dc7a0663a8499b95f0abb` |
| `src/ui/windows/docs.js` | 32337 | `5de401ccc609efb70928c3c5d89bcf85544106fb33cd77531a43200274f15c55` |
| `src/ui/docs/reader.js` | 5708 | `220ef1eb100db0bd9e80d1722e58ec10c3799f2c3e3815832bf3421795382e37` |
| `src/ui/docs/draft.js` | 7924 | `4743688a62dd9615f72e6f7551d2a9198680150f933096e48a324001d8ea4c7f` |
| `src/documents/context.mjs` | 6716 | `a727c903d1c9819498db3be32c52cc52f2551aea62bc45446289e4ea65df0f47` |
| `src/windows/docs-reads.mjs` | 2959 | `fb6fdba3f63e3338127d196691b9ce506f0c5e397a1e2ee3b7d997740e4aa764` |
| `src/windows/domain.mjs` | 16818 | `f77617382cbedceb8b4dde474d54d93bcf09d74027a1d2e155a45da6d063ae9c` |
| `build/windows.mjs` | 20622 | `3b40bca85307e598fe12a7e16856e6e22e6688a7938b532a4bd614b7dd109cbf` |
| `build/source-bundle-metadata.mjs` | 15062 | `8351c63024d31447389424c4001b7ddd07649dac522e1ddb317bc97d063eef42` |
| `src/ui/shared/chrome.css` | 8493 | `5947b20b1d715a1e647b32e053f10a9f22d7cd79c81da095a592bdc7aff90077` |
| `reviews/2026-10-06-post-media-next-analysis.md` | 9227 | `610cbfacc7d5fa74f2e4287175469f110c0407b2e9f8a46c6d02f538d38df72d` |
| `reviews/2026-10-07-next-desktop-parity-batch-analysis.md` | 9878 | `02877bc7f2120356088e79a38cbb49bc052d32b86b171c780fee25337fef56da` |
| `reviews/2026-10-07-native-diagram-parity-next-analysis.md` | 8966 | `e61c61f872db518ef536fe8885a5c0a9d06f24f7cd37ef706522e2815ffca52c` |
| `../../SIREN_RESUME.md` | 593069 | `d13061567b0703ad849124ed55a3ccad22cf0c781d8a5fe43d0a270c7aa2874f` |
| `../../SIREN_UI_NEXT_BATCH.md` | 95220 | `a0420e3d04f188bdaef2fea507b732deef0cb751f9371d0dde46e62ce4762f44` |

No implementation, independent product approval, runtime success, full parity, capacity maximum, release readiness or historical Save-to-Attach closure is asserted.
