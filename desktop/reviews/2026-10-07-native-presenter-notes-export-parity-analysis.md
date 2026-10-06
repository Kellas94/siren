# Native Presenter: concrete notes-delivery gap and next batch

Author: `/root/disk_inventory`. Read-only source analysis at local HEAD `42fc6c65aa44bf3baa10508f81a1d1ba5629296c`, captured `2026-10-06T23:05:11.0159151Z` through `2026-10-06T23:05:19.7643014Z`. This is the current Windows working tree, including uncommitted native Docs export/main integration. Exact working-file byte hashes are below; they are not claimed byte-identical to Git LF blobs. All sixteen captured inputs remained unchanged during this analysis. No product/test/build/workflow changes, GUI operation, build or test execution were performed. The original Home hosted report/receipt hashes are unchanged.

## Concrete finding

**Native Presenter has no way to export its captured private speaker notes.** This is a Desktop parity/delivery gap supported by source, not a reproduced runtime failure or a claim that the old HTML export is broken.

The legacy HTML exposes `presentExportNotesButton` labelled **Export notes** at `baseline/R78.html:23174`; its real click handler at line 26512 calls `exportSpeakerNotes` (line 84765). That function traverses the presentation deck/sequence, formats note text plus owner/reference/duration/checkpoint, constructs and validates a PDF and delivers `_speaker_notes.pdf`. The legacy Guide also explicitly advertises speaker-notes PDF at line 22619.

The native counterpart has no equivalent path:

| Boundary | Actual source observation |
| --- | --- |
| `build/presentation-windows.mjs:12–15` | Presenter controls are previous/next, Edit deck, Refresh saved deck, display selection, Open Audience, fullscreen and close. Notes are displayed in a private aside; no export action is built. |
| `src/ui/presentation/window.js:17–20,46–50` | The UI paints private notes and navigates/refreshes/opens Audience. There is no export handler, delivery receipt or Show file action. |
| `src/windows/presentation-preload.cjs:4–5` | The finite bridge exposes playback/display operations and Edit deck, with no export/reveal operation. |
| `src/windows/presentation-ipc.mjs:19–40` | The finite dispatcher permits Presenter playback and Audience frame/ACK/fullscreen operations. Unknown methods are refused; a missing button could not be fixed by merely calling an existing export method. |

The existing native slide list, previous/next, arrows/Space/PageUp/PageDown, Refresh, Edit deck and Audience routes are implemented in these sources. The next finite batch should add saved presentation delivery without displacing those controls. Their physical desktop behavior was not re-executed in this analysis.

## Smallest functional batch

Add **Export captured notes (.txt)** beside the private notes heading in Presenter, with an acknowledged saved-file receipt and **Show file**. Start with one truthful UTF-8 text format. This restores a useful delivery route while clearly describing its narrower scope than the legacy PDF: deck title/version, ordered slide number/ID/title and each exact captured note text. Do not display a PDF, PowerPoint, rendered-slide or full-metadata claim for this batch. No new library is needed for text serialization and the existing owned-file publication mechanics.

Main already has the necessary immutable private input: `PresentationSession.getPresenter(grant)` projects deck ID/version/title and ordered `{id,title,notes}` slides (`presentation.mjs:39,65`). An admitted deck remains captured until explicit Refresh (`presentation.mjs:103–121`). Saving a newer diagram/deck in another window must not silently change the notes being exported from the currently presenting version.

`presentation-deck.mjs:36–43` deliberately projects **text only** from each note. Owner/reference/duration/checkpoint metadata is neither in the current private projection nor needed for this minimal route. Fetching the latest project to add those fields would mix a new saved version with the currently captured deck. Full legacy metadata/PDF parity needs a separate deliberate captured-projection/rendering scope.

A bounded implementation can use a dedicated main-owned Presenter export service, a pure text formatter, a finite Presenter-only bridge and the small UI action:

1. Accept only `{deckVersion}` for text export and `{exportId}` for reveal. Derive project/window/role/content/path internally. Capture the genuine current Presenter sender and main frame, epoch, project, registry grant, session instance and expected captured version. Audience, Docs, Diagram, foreign windows, subframes and extra body/path/project fields receive refusal. Audience should not gain a notes export bridge or private result fields.
2. Copy only the current main-owned Presenter projection; no renderer-supplied note text, SVG, slide images or source. Use a checked maximum of 8 MiB encoded output, at most two pending jobs globally and one per Presenter. Count before allocation and fail explicitly on budget overflow; never truncate notes or silently reduce a 600-slide deck.
3. Publish separate ordinary `presentation-notes-<UUID>.txt` files under the actual project's owned exports directory using exclusive temporary creation, bounded writes, sync/close, rename and exact readback/hash. Return only export ID, filename, bytes/hash and captured deck ID/version; no note bodies or filesystem path in the receipt. Follow native Docs/Diagram publisher behavior without broadening their authority or refactoring delivered routes merely to share code.
4. Compare the same live session and captured deck version throughout publication. A normal slide navigation retains the deck version and should not cancel export; Refresh that changes it must revoke or refuse the stale operation. Integrate synchronous pause, abort, drain, quiescence, rollback resume and retirement next to the existing services in `main.mjs:559,576–581,610–612`. Lock, selection, view close and session replacement must prevent later publication; unretained temporary/published files are cleaned before success/Lock completion. Cleanup uncertainty fences subsequent exports. Retained user exports survive later cancellation.
5. Reveal only a genuine receipt owned by the same live Presenter, verify the emitted file hash again and never accept a renderer path. Explicitly test current normal and sealed-readonly admission behavior before advertising the latter; do not bypass access checks simply because the content was once visible.

The current native Docs exporter (`src/windows/docs-export.mjs`, uncommitted) and existing Diagram exporter (`diagram-export.mjs`) provide concrete exclusive-write/readback/receipt/reveal and pause/drain examples. This analysis has not approved the pending Docs implementation or substituted its tests for a Presenter route.

## Bounded verification required for that batch

Pure formatter tests should cover Unicode, exact embedded newlines, blank notes, note order/IDs, empty/fallback overview, 600 entries and explicit encoded-byte refusal. Authority/publication tests should cover wrong role/main-frame/project/session/version, extras/path/body refusal, busy jobs, readback/reveal tampering, write/cleanup errors, Lock/selection/close/Refresh at awaited publication stages and unchanged existing exports.

A focused native fixture should author/save known notes, open Presenter, export using the actual control, reopen the emitted text and compare all exact expected notes/IDs/order. Save a newer note elsewhere: export must retain the captured version until Refresh, then export the new saved text after Refresh. Exercise the real common Lock with pending publication and confirm no late output or private Audience data. Qualify development and an exact copied package separately; do not claim this route from source checks alone.

## Exact captured inputs

| Desktop-relative file | Bytes | SHA256 |
| --- | ---: | --- |
| `baseline/R78.html` | 13626609 | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |
| `build/presentation-windows.mjs` | 4746 | `c83f72d97bc11216d26fc0aa35d55db5923c0c960a1aed500756e1b82d38236d` |
| `src/ui/presentation/window.js` | 8667 | `6c83b60129f4670f17c546dcb0c760357b77121ba3fb2f711e1f756839bb0110` |
| `src/ui/diagram/presentation-view.js` | 9506 | `2488e1175265bad733e596de805c0f04e18e0eda7b14018f56b188805f993241` |
| `src/windows/presentation.mjs` | 13193 | `12ec79a34cdd253b0f9f68e00eecfb53ca6fcd19452f7b62cfe10a0d5967925e` |
| `src/windows/presentation-deck.mjs` | 6002 | `61c8550a23a7b8a74a9b4d7e01425b7a68e80f6b092ce689fb621df81f9fc51e` |
| `src/windows/presentation-preload.cjs` | 3831 | `3431061b9918ec36ffa280be24e0673f873f43d5f80f1e3aaeb9a5bc22ea7c7a` |
| `src/windows/presentation-ipc.mjs` | 3724 | `9141a114c6974978cbd020c61951de18fefab1bd432b731827590cb36f27af77` |
| `src/windows/deck-navigation.mjs` | 3617 | `5ce434e219dd64fe92f2e6f026ff1764277994cab84dfb05bb69cd245e38b175` |
| `src/windows/docs-export.mjs` | 7171 | `74bb26715bc82ee444d572e23434fdf3bc7b7f4a2363e938eda2fde7660ab850` |
| `src/windows/diagram-export.mjs` | 6761 | `f9aef5b688a413cb9bd70b59c4e2aaf419bdc78bf3d300249ffdfb7226b03186` |
| `src/main.mjs` | 101600 | `e3fe14b8ebbd86ce969268bac459779a20f8165745bc65dbb8e763576a8367b2` |
| `tests/presentation-ui.test.mjs` | 4186 | `e4796dfd743d4e2dd5b78d541a025e07d49b9b90469050b88f2e7cab7586c8bf` |
| `tests/presentation-ipc.test.mjs` | 4600 | `f4720ebd60095fad1006599380bfc0bd4dc4f9315fb1e5d0011c83e0ac74b8bf` |
| `reviews/2026-10-07-home-backup-hosted-evidence.md` | 8090 | `da89219c66397fdc428bb8160b99149d062070c92fa523f83963a59e75360f3b` |
| `reviews/2026-10-07-home-backup-hosted-evidence.json` | 325260 | `68c93128888e99a67ca16a3e1fe072f7f23644e9fdc86678591d42cb27824d00` |

[Structured analysis and input identities](C:/Claude/SIREN_WORK/portable/desktop/reviews/2026-10-07-native-presenter-notes-export-parity-analysis.json). The two Home hosted files in this table were hashed only to verify preservation; their prior outcomes are not new runtime evidence for the proposed Presenter exporter.

