# Native Export / Delivery — implementation boundary analysis

Author: `/root/media_batch_review`. **Analysis only**, based on direct source reads at local HEAD `378a0485eb02cd44f6224e0ded6ede1e0a3f9d37`; this is not the immutable remote `67896f9` qualification, implementation, permission, independent acceptance or CI approval. No product/test/generated files were edited, no tests or GUI probes were run, and previous reports remain unchanged. Physical monitor, DPI and accessibility behavior is unverified. This narrows the next batch recommended in `2026-10-06-post-media-next-analysis.md`; it does not reopen delivered Docs images/public tables.

## Recommended first batch

Implement three finite delivery routes sharing publication machinery: **Home → Export saved backup**, **Docs → saved document JSON / Markdown / inert HTML**, **Presenter → private captured-deck text notes**. Use the existing compact entity context and themes. Export saved versions explicitly; do not imply unsaved drafts are included, all original formats are restored, or notes metadata editing/playback is implemented.

For the smallest consistent native boundary, initially publish ordinary files under the actual project's owned `exports` directory and provide **Show file**, matching native Diagram SVG. The legacy Save dialog remains separate. A later Save As route needs a cancelable destination capability and its own Lock/selection behavior; it must not merely reuse the unguarded legacy helper.

## Existing boundaries that must remain true

| Source | Observed authority / consequence |
| --- | --- |
| `src/ipc.mjs:26–33`, `tests/home-desktop-boundary.test.mjs` | Generic `siren:desktop` deliberately denies Home `exportProject` and workspace envelopes. Preserve that denial; exposing this old method in `homeMethods` is not the new design. |
| `src/main.mjs:315–320`, `src/sources/recovery.mjs:10–29` | Old exporter accepts a project ID from the session's historical `grants` set. Schema 2 verifies each exact source ref, bytes and hash before constructing a source bundle. Reuse source-aware serialization, not the old authorization or metadata-only JSON. A new Home request derives **current selected** project internally. |
| `src/main.mjs:182–187` | Legacy `exportBytes` awaits a Save dialog then writes, without its own post-await access check. It is not a safe shared native publication boundary. |
| `src/navigation/authority.mjs`, `src/navigation/ipc.mjs:61–86` | Home grants bind actual sender/main frame, URL, epoch, selected ID, mode, generation and unlocked state. Current Home result contracts accept state/navigation receipts, not arbitrary export objects. A finite new route/result contract is required. |
| `src/main.mjs:502–530` | `prepareNativeWorkspace` **invalidates HomeAuthority immediately**, pauses/drains owners and native background work, obtains genuine flush acknowledgements and checks a roster/quiescence proof. Therefore the original Home `scope.isCurrent()` cannot authorize a later post-preparation write. Navigation transition receipts are not generic export permissions. |
| `src/main.mjs:161–179,497–500,548 onward` | `changeSelection` prepares then retires native services/views and changes selection. Do not invoke it to export. `rollbackNativePreparation` resumes the same workspace services; full retirement also disposes presentation state. |
| `src/windows/docs-reads.mjs` | Exact own Docs window/entity read is bound to owner read authority, epoch, document hash and version. Renderer cannot choose another document, project or filesystem path. |
| `src/windows/presentation.mjs:39,65,103–121`, `presentation-ipc.mjs` | Main retains an admitted saved deck until explicit refresh. Presenter projection has slide IDs/titles/text notes and deck version. Audience has public-frame/ack authority only. Pausing invalidates in-flight presentation work; refresh changes captured version. |
| `src/windows/presentation-deck.mjs:36–43` | Current admitted deck projects note **text only**; owner/reference/duration/checkpoint are not available in its captured private projection. Export text faithfully first. Reading the latest project to add metadata would combine versions. |

## Minimal safe shared exporter

Keep **authority adapters separate from pure formatters and the shared owned-file publisher**. Do not build a universal renderer-controlled `{projectId,entityId,path,body,format}` channel.

1. **Capture a narrow main-owned job.** Home: empty export-backup request, current selected snapshot and Home grant. Docs: finite format plus expected own document version/hash; read through `NativeDocsReads`. Presenter: expected captured deck version; read `session.getPresenter(grant)` internally and refuse Audience. Bind role, actual sender/frame, epoch, project, selected generation and access state; reject extra fields.
2. **Capture immutable content.** Home reads/verifies the actual selected saved snapshot; schema-2 bytes come from `exportSourceSnapshot`. Docs retains one exact saved document, including unknown archival fields. Presenter retains the admitted deck's ordered private text notes, not renderer input or a newly loaded deck. Pure formatters receive copies and no filesystem/network capability.
3. **Publish with the native Diagram pattern.** Use owned project directory checks, exclusive temporary files, bounded writes, sync/close, rename, readback/hash, and a small main-owned receipt. Recheck job authority/version before and after every awaited read/write boundary and publication. On retirement/staleness/error, remove temporary and unretained published output; failed cleanup fences further exports and is reported. Existing retained user exports are never removed by job cancellation.
4. **Track and revoke jobs.** Bounded per-window/global pending counts and receipt retention. Integrate the shared exporter into `prepareNativeWorkspace` pause/drain/quiescence, rollback resume and service retirement. Lock/selection/access changes invalidate jobs synchronously before awaits; pending publication must finish cleanup before Lock completes. Show file uses only a genuine bounded receipt owned by the same live grant, verifies the exact emitted bytes again and never accepts a path. Never return project/document bodies or private notes in an export receipt.

`NativeDiagramExports` already implements most publication/receipt behavior (`src/windows/diagram-export.mjs`). Extract/refactor only after equivalent regression coverage: it currently embeds Diagram-specific grant capture, reads, version validation, error names and 2 MiB SVG budget. Generalize publication **mechanics**, not its authority assumptions or limits. Backups can be far larger than SVG; compute checked serialized-size limits including base64 expansion and multiple sources before allocating/exporting, and report a real budget error. Do not apply SVG's cap to source bundles or relax source/project budgets silently.

## Dirty work and preparation policy

The initial **Export saved backup** action is read-only and does not require flushing dirty owners. Its UI must state that unsaved working copies are excluded and identify the actual captured saved revision. Docs disables saved export while its own draft/tentative field is dirty, as native Diagram does, or offers an explicit **Save, then export** using the existing actual save receipt before requesting export. A stale reader/version gets a conflict and reload action; do not silently export a different document version. Presenter exports its labelled captured saved deck; explicit refresh is a separate action.

If a later **Save all and export current work** action is included, it needs a dedicated same-selection operation lease with main-owned sender/frame/selection/access identity plus the genuine preparation proof. It cannot retain an invalidated Home grant, manufacture a new grant from renderer data, or treat a navigation handoff receipt as an export lease. Read the snapshot only after actual dirty-owner commits and proof validation. Resume/release the prepared roster on success, cancellation or failure without retiring views or changing selection, and refresh Home's invalidated authority through its real state path. Refused invalid edits must remain editable with no backup publication. This is a separate complexity from the minimal saved-export route.

## Format boundaries

- **Project backup:** existing schema-1 saved JSON or schema-2 source bundle, with a truthful format/version receipt. Keep every referenced source byte, BOM, Unicode, line ending, source provenance and opaque metadata; verify reimport behavior. It is not an individual document JSON export.
- **Docs JSON:** versioned archival envelope with exact own saved document and reference/provenance metadata. Preserve unknown fields. Clearly represent source refs as refs unless a separately authorized bounded source-including format is implemented; do not resolve arbitrary linked Docs/projects or invent missing bodies.
- **Docs Markdown / HTML:** explicit allowlisted serializers for implemented headings/text/lists/tables/code/images. Escape imported content; inert self-contained HTML has no scripts/event handlers, remote requests, live embeds or executable imported markup. Reuse PNG/JPEG signature/geometry/byte validation and current media budgets. Preserve supported image captions/alt text; list unsupported block kinds in a delivery warning instead of silently declaring full fidelity. JSON remains available for archival fidelity. No PDF/Office parity claim in this tranche.
- **Private speaker notes:** Markdown/text or versioned JSON with captured deck version, ordered slide IDs/titles and exact note text. No public frame, render adapter, Audience response or Audience export authority receives private fields. Owner/reference metadata requires a deliberate private captured-deck projection and validation change, not a fresh project lookup; duration/checkpoint playback remains out of scope.

## Sequence and existing tests to extend

1. Establish finite Home/Docs/Presenter export requests, role gates, saved/dirty policy, format-specific caps and receipts. Preserve `home-desktop-boundary.test.mjs`; extend `home-ipc.test.mjs`, `native-docs-reads.test.mjs`, `presentation-ipc.test.mjs`, `presentation-transport.test.mjs` and `presentation-deck.test.mjs` for wrong role/frame, extra fields, stale version, locked/no-selection and no private Audience data.
2. Add pure serializer fixtures and shared-publication tests based on `native-diagram-export.test.mjs`: unknown-field JSON fidelity; malicious markup/links; bounded raster and table delivery; cancellation, refused reveal, tampered file, write/readback/cleanup failures; Lock/selection/refresh during **each** asynchronous stage leaves no unretained output. Keep existing SVG behavior unchanged. Extend `source-recovery.test.mjs` with selected-snapshot bundle round trips and source corruption/size failures.
3. Wire compact actual Home/menu/keyboard export, Docs Export and Presenter private-notes actions to real receipts. Extend existing native `import-export.mjs`, `diagram-export.mjs`, Docs reader/authoring and presentation probes, or introduce a separately bounded delivery probe without silently enlarging existing qualification groups. Reopen emitted artifacts and compare exact expected Unicode/source/image/table/note content; distinguish saved working draft exclusions from export failures. Exercise real shared Lock and project selection with work in progress, and retain adverse evidence.
4. Review the complete bounded implementation delta separately, then qualify exact built/copied package and immutable hosted source through the parent workflow. This analysis supplies neither an approval nor a predicted CI outcome.

## Inspected boundary fingerprints (SHA-256)

```text
src/main.mjs e31139ed6aee100471705cad0cc48681809d4d7655dd5b6c8917ab37a39a967d
src/ipc.mjs 1f33543d72438a8ce3c2198db1d5999bb90d54111de6cb37e4626dea1946f34a
src/navigation/ipc.mjs fb66dcedeb791ddfc75a07253bae3d1baa80cba0482cb193d29fe60442891aef
src/navigation/authority.mjs 5fdebed9dd563e7bee354720755c3c052f87d4dc30ca20bf60174e0041b4352c
src/windows/diagram-export.mjs f9aef5b688a413cb9bd70b59c4e2aaf419bdc78bf3d300249ffdfb7226b03186
src/windows/docs-reads.mjs fb6fdba3f63e3338127d196691b9ce506f0c5e397a1e2ee3b7d997740e4aa764
src/windows/presentation.mjs 12ec79a34cdd253b0f9f68e00eecfb53ca6fcd19452f7b62cfe10a0d5967925e
src/windows/presentation-ipc.mjs 9141a114c6974978cbd020c61951de18fefab1bd432b731827590cb36f27af77
src/windows/presentation-deck.mjs 61c8550a23a7b8a74a9b4d7e01425b7a68e80f6b092ce689fb621df81f9fc51e
src/sources/recovery.mjs 4fddd4915be81e2290476fe5b113410c14af741f77206cf80b48a3ee23a6761a
```
