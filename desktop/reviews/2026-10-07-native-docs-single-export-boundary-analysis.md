# Native Docs: bounded single-document delivery analysis

Author: `/root/media_batch_review`. **Read-only analysis, not implementation or
implementation/release approval.** Inspected current sources on 2026-10-07 local
date while root qualified the separate Home backup change. No product, test,
build, generated or workflow edits; no tests, native application or GUI launched
for this analysis. Only this report and its source-identity evidence were written.

## Finding and approved scope

The rank-2 native single-document export gap remains present. The current native
Docs header has appearance, Edit working copy, Context, Save document, Retry and
Close (`build/windows.mjs:48`); neither `src/ui/windows/docs.js` nor
`src/windows/preload.cjs` exposes document export. This is a functional parity
gap, not a newly demonstrated corruption bug.

Frozen R78 exposes seven document formats at `baseline/R78.html:22845–22858`:
PDF, HTML, Word, PowerPoint, Excel, Markdown and JSON. Its actual format dispatcher
starts at `:77414`; Markdown uses `workpaperMarkdown` (`:76346`) and its block
formatter. The JSON branch describes `type:'siren-document',schema:2` and adds
linked diagrams to the document. HTML also renders linked diagrams. Those
browser-state helpers commit the active session, consult surrounding project
state and use older delivery routes; copying them wholesale would not establish
native authority, saved-version or source-reference correctness.

The approved `docs/superpowers/plans/2026-10-06-siren-workspace-ui.md` delivery
steps 3–5 and its next-migration ledger cover access to real native module controls
and incremental functional parity. A bounded document delivery tranche fits that
direction. They do not themselves qualify all Office/PDF formats, full original
decorative behavior, or a single-document import engine. This report supplies a
concrete next implementation boundary without requesting another user decision.

**Smallest coherent tranche:** one Docs **Export saved…** control with three real
formats, JSON archive, Markdown and standalone inert HTML. Exact saved document
authority and a guarded publisher are delivered together. No automatic linked
diagram rendering, linked-source byte bundling, batch export, PDF or Office export
in this tranche. Those remain named parity limits.

## Current contracts that must remain intact

| Source | Actual contract and implication |
| --- | --- |
| `src/windows/docs-reads.mjs:17–36` | Reads one exact own Docs entity through registry and owner. Sender/main frame, role, single entity, epoch and content hash are checked before and after the owner operation. Reuse this service; renderer supplies neither document nor project/path. |
| `src/windows/docs.mjs:27–35` | Docs `version` is a 64-character project/document/content hash, **not** the Diagram integer. Restoring exactly the same content yields the same content token by design. It is not a monotonic edit-event counter or actor identity. |
| `src/windows/domain.mjs:12,78–82,97–99` | Mutation intent is bounded at 2 MiB; exact read/result entity allows 8 MiB. Result copies use depth 32 and 50,000 nodes. Export must not silently enlarge these reader contracts or bypass them to support a larger document. |
| `src/ui/docs/draft.js:6–33` and `src/ui/windows/docs.js` | A local draft and saved document are different objects. Explicit Save uses a version-checked owner operation; another window can change the saved version. Export must neither serialize the renderer draft nor imply it was saved. |
| `src/main.mjs:474–485`, coordinator `canReadDomain` | Read authority can exist without edit authority, including verified readonly work. Export should depend on a successful own-document read, not `canEdit` or `mode==='normal'`; locked, paused, retiring or unverified content remains refused. |
| `src/windows/diagram-export.mjs` | Existing finite entity publisher captures exact identity/version, limits work, pauses/aborts/drains on preparation, uses unique owned exports, atomic write/readback, retained receipts and strict cleanup fencing. This lifecycle is the closest native model. |
| `src/main.mjs:560–579,607–615` | Workspace preparation pauses/drains background services before view flush/retirement. A new Docs export service must join this lifecycle; no late export resurrection after rollback/resume or Lock/unlock. |
| `src/main.mjs:210–226`, `src/navigation/backup-export.mjs` | Home's current Save As publication now guards access after chooser and around atomic write; earlier delivery analysis described the old unguarded implementation and is historical on that point. A chooser remains outside `writes` until actual publication, so Lock is not held indefinitely by the dialog. |

Keep Home's old generic `exportProject` denial, Code/Diagram/Presenter/Audience
role separation and private flush tickets unchanged. An export is not a save,
flush acknowledgement, recovery checkpoint or approval record.

## Format decisions: fidelity without silent loss

All formats derive from the same verified saved document and captured identity.
Preserve field names, values, order of arrays, IDs, sourceRef/baseSourceRef values,
comments, releases, sign-off and unknown fields in archival data. Never fabricate
an approval/reviewer or reinterpret an imported claim as current validation.

**JSON archive (.json).** Use a clearly named versioned export envelope, for
example `format:'siren-document-archive',schema:1`, with captured project ID,
document ID, project revision, Docs version, document SHA256, exporter version,
UTC export time, `sourcePolicy:'references-only'`, and `document` equal to the
exact saved object. JSON encoding may differ from the original project envelope;
the guarantee is exact document **data**, not byte-for-byte reconstruction of a
separately stored original document file. Test parse/deep equality and the existing
document fingerprint. No sanitizing replacement is written. Do not label it
re-importable until a real native single-document importer is implemented and
qualified; Home project import is a different format/operation.

**Markdown (.md).** Produce useful headings, plain rich-text content, tables,
checklists, instructions, settings, knowledge rows and test-run rows. Escape
Markdown metacharacters and table separators/newlines rather than concatenating
untrusted cell strings. Preserve long code/prompts without fixed fence breakout
(indented code is a simple safe choice). Strip no unsupported content silently:
include a labelled raw-data appendix carrying the complete exact archival JSON
as indented code, and an explicit notice when visual fidelity is reduced. Images
are represented in the reading portion by caption, MIME/size/digest and a notice;
their exact data URI remains in the raw-data appendix. Do not inject remote image
URLs or claim every Markdown consumer supports embedded data-URI images. Rich
colour/underline fidelity is not promised by this text-oriented format.

**HTML (.html).** Feasible as a new static serializer, not an app snapshot or
arbitrary saved-markup passthrough. Render the same finite content kinds; retain
the complete exact archival JSON in a labelled escaped-text details/pre appendix.
Serialize allowed inert rich structure from a bounded parsed tree; no input
attributes become output except finite validated text colour/classes. Use fixed
local CSS for typography/tables, print-friendly light appearance and optional
CSS `prefers-color-scheme` only if tested. No script, form, iframe, SVG, event
handler, external font, URL, stylesheet import, local path or active hyperlink.
Embed only verified PNG/JPEG data URIs; captions/filenames are escaped text.
Unknown/malformed blocks get a visible preserved-data notice and exact escaped
raw data, not disappearance. Unsafe rich nodes are shown as escaped original
markup with a safety notice, not silently sanitized away. A restrictive CSP meta
(`default-src 'none'`, images data only, fixed style hash, `base-uri 'none'`,
`form-action 'none'`) supplements actual sanitization, not substitutes for it.

Existing `parse5` is build tooling in `package.json`, not a guaranteed production
runtime import. If used for the pure bounded rich serializer, bundle the required
parser at build time and include it in identity/license inventory; never add an
unbundled dev-dependency import to packaged main. A regex-only HTML sanitizer is
not acceptable. No extra remote service or image/code execution is necessary.

Source references are printed as exact source ID/version/hash, with provenance
already present in the saved document. A small source-policy notice explicitly
states that linked source **bytes**, diagrams and other referenced documents are
not embedded; use the source-aware project backup to preserve them. Do not fetch
other entities or all source versions for a document delivery request. A later
“document plus linked assets” package requires its own manifest/integrity/import
contract, not a hidden option here.

## Finite API, saved-version and publisher lifecycle

Proposed isolated bridge: `sirenDocsExport.exportSaved({format,expectedVersion,
expectedSha256})` and `revealExport({exportId})`; exactly `json|markdown|html`,
two 64-hex tokens. Reject extra fields, accessors/prototypes, renderer content,
identity, paths, HTML/CSS and source IDs. Main captures the actual own Docs grant
and successful `NativeDocsReads` result, compares requested version/hash, and
passes an immutable exact document plus provenance to a pure formatter.

Choose the existing native Diagram destination convention for the smallest
tranche: unique main-generated `document-<UUID>.<extension>` under the actual
project's owned `exports` directory, with **Show file**. Do not use document title
as a path. A later Save As adapter can reuse current guarded Home publication,
but must separately preserve cancellation, one pending chooser, permanent
revocation and exact existing-destination cleanup semantics. Avoid mixing both
destinations into the first implementation.

Extract/reuse a narrow guarded owned-file publisher if that can preserve current
Diagram behavior and tests; do not replace it with bare `atomicWrite` and lose
post-rename entity recheck, unretained-file cleanup or failure fencing. Bind each
job to actual sender/frame, project, window/entity, registry epoch and a new
monotonic export-service generation. Recheck authority after awaited read,
formatter work, directory creation, writes, sync, rename and readback. Re-read the
same saved Docs version/hash before publication and before retaining receipt.
Unrelated project-revision changes need not refuse if the exact document remains
identical; never silently substitute a newer document.

Pause increments generation, aborts formatting, clears reveal capabilities and
joins actual pending operations/cleanup before Lock or retirement can confirm.
Resume cannot revive old jobs or receipts. Failed close/unlink/readback remains
an explicit failure and fences the exporter; do not swallow it as successful
drain. Already retained exports are user artifacts and remain on disk. Reveal
accepts only a retained receipt bound to the same actual window/epoch/project,
checks the ordinary owned path and digest, and returns no arbitrary file access.
Integrate pause/resume/drain/isIdle into preparation, rollback, final quiescence
and retirement; adding only an IPC handler to `writes` is insufficient.

Return finite receipts only: `exportId,filename,bytes,sha256,documentId,version,
documentSha256,projectRevision,format` plus bounded disclosure counts/flags.
No full output, source bytes, path or another document is returned to renderer.
Status codes distinguish stale document, budget, busy, access refusal, format
failure and cleanup failure. “Exported” requires readback and retained receipt.

## UI and bounds

Use one compact **Export saved…** action in the existing Docs entity header;
reuse the shared shell/theme tokens, native spacing and accessible dialog/menu.
Three choices describe actual differences. State **Saved version; unsaved local
changes are excluded**. If dirty, keep this explicit and offer the existing Save
document separately; no implicit all-window save or preparation. Disable repeated
export while pending, show verified completion and **Show file**, and retain
draft/selection on error. Stale version requires explicit refresh/review, not an
automatic mutation retry. Formatting-disclosure flags appear in the dialog and
artifact, not only hidden logs. No broad global Export command/another toolbar.

Proposed initial hard bounds, to be tested rather than advertised as measured:

- Preserve current exact-read cap 8 MiB, depth 32, 50,000 nodes; refuse before
  adding a formatter copy when that contract cannot admit the document.
- Output cap 16 MiB for each standalone file, measured incrementally as UTF-8
  chunks are emitted. Escaping/raw appendices can exceed input size; refuse the
  entire selected format, never truncate or silently drop the appendix. JSON
  remains independently available if a human-readable format exceeds its cap.
- At most two global jobs, one per Docs window, at most 32 reveal receipts.
  Fixed formatter deadline 10 seconds and cancellation/join contract. Use a
  resource-limited worker (initial 128 MiB heap target) or bounded cooperative
  chunking; measure actual peak RSS separately because heap is not total memory.
  A synchronous full-document parser/string-building loop in Electron main
  cannot be described as responsive merely because output size is capped.
- Per rich block: 128 KiB, depth 32 and 4,096 parsed nodes. Above this, render the
  original as escaped preserved data; never pretend the entire rich block was
  faithfully styled. Global traversal/output limits still apply.
- Reuse current PNG/JPEG checks: at most 2 MiB decoded per image and 16 Mi pixels
  each. Add a finite aggregate rendered-image pixel budget (initial 32 Mi pixels)
  and aggregate decoded-byte budget bounded by document admission. If exceeded,
  refuse HTML rather than claiming all images rendered. JSON/Markdown raw data
  remains unexecuted. Validation is not proof an arbitrary external browser will
  decode a malformed image identically; no app-side image execution is required.

## Implementation and adverse-test sequence

1. Add pure archive/Markdown/HTML formatters with exact-data and active-content
   adversarial controls, then bounded formatter execution. Actual fixtures include
   every current block kind, unknown kinds/fields, malformed imported values,
   comments/releases, multiple precise source refs and valid/invalid images.
2. Add Docs-only export service and guarded publisher lifecycle. Extend the
   existing Diagram publisher tests if mechanics are extracted; no Diagram API
   or receipt change is necessary. Verify genuine readonly reads, hash/content
   tokens, stale same-window/other-window changes, spoofed frames/roles, Lock
   during every await, rollback/resume monotonicity, busy budgets and cleanup.
3. Add finite preload/main route and compact theme-compatible UI with exact
   saved/draft wording, stale/error behavior and receipt-bound reveal. Extend
   renderer/build/identity/package allowlists coherently.
4. Run genuinely authored native Docs scenarios from actual UI in dev and then
   an isolated byte-verified portable copy. Use real PIN and owner operations:
   saved document vs dirty local copy, another window's saved replacement,
   actual output parse/decode/equality, Lock pending work, cancellation only if
   Save As is included, attached and detached shell/theme behavior. Retain first
   adverse outcomes; qualification/review belong to separate authors where used.

Existing test inventory to extend/reuse: `native-docs-reads.test.mjs`,
`native-docs-edits.test.mjs`, `native-docs-main.test.mjs`, `docs-draft.test.mjs`,
`docs-context-draft.test.mjs`, `docs-rich.test.mjs`, `docs-images.test.mjs`,
`docs-reader-guard.test.mjs`, `native-diagram-export.test.mjs`,
`legacy-export-access.test.mjs`, `home-backup-export.test.mjs`; native helpers and
scenarios in `tests/native/docs-edit.mjs`, `docs-context.mjs`, `docs-reader.mjs`,
`diagram-export.mjs` and `home-backup-export.mjs`.

Meaningful formatter tests must cover `</script>`, markup/event/URL/CSS injection,
Markdown fence/table/heading breakout, prototype keys/getters, BOM/Unicode/CRLF,
all rows rather than reader pagination, unknown fields, exact image bytes and
invalid-image notices, source-policy disclosure, output expansion and worker
timeout/abort. Publisher tests must preserve an existing destination/retained
export, prove cleanup failure prevents Lock confirmation, and verify refusal
never reports success or switches to metadata-only output.

## Identities and remaining limits

All 24 inspected input identities and byte sizes are retained at
`evidence/docs-single-export-analysis-2026-10-07/inputs.json`. Key identities:

| Source | SHA256 |
| --- | --- |
| Frozen `baseline/R78.html` | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |
| `src/main.mjs` | `4e7d6a8a11562780af28275211b7d4b9c944d3520e8549d6a5265cc3c7337315` |
| `src/windows/docs-reads.mjs` | `fb6fdba3f63e3338127d196691b9ce506f0c5e397a1e2ee3b7d997740e4aa764` |
| `src/windows/domain.mjs` | `720723ae51323c29aa07fe5262c40df8f6cdc8c8aa8b78a67f35951a17b8b0b1` |
| `src/windows/diagram-export.mjs` | `f9aef5b688a413cb9bd70b59c4e2aaf419bdc78bf3d300249ffdfb7226b03186` |
| `src/ui/windows/docs.js` | `6644b9ed6551540453f4474b21c3b321630b87dcf487fc20afacf41c52c452bc` |

No code or tests were implemented/run here. The proposed budgets, output
fidelity, worker packaging and actual UI/readonly/Lock/monitor behavior need
measurement. This analysis does not close native PDF/Word/PowerPoint/Excel,
document re-import, linked-diagram reproduction, source-inclusive document
packages, full Office fidelity, full decorative parity or any release gate.
