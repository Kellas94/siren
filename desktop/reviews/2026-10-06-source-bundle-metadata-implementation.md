# Source-bundle metadata helper implementation

Author/implementer: `/root/native_menu_trace_review`, 2026-10-06. This is an implementation and verification record, **not independent approval of my own code**. The preceding read-only design report remains separate and unchanged. Root owns builder/main integration; `/root/media_batch_review` owns parser/copy. Final review must come from another author.

## Delivered scope

`build/source-bundle-metadata.mjs` exports `bundleMetadataHelper`, installing `window.sirenDesktopValidateBundleMetadata(text,fileName)` in the frozen validator's lexical scope. It supports the native desktop primary storage bag (metadata schema 1 or 2), portable `state`, and direct workspace forms. It retains original objects/opaque data and original primary storage serialization unless file-signoff stamping actually changes a document.

The helper creates finite detached projections for documents, current and archived blocks, agent/release snapshots, comments/review, Code files and presentation. Linked source payload placeholders exist only in these projections. Actual frozen `validatePortableProjectForImport`, `prepareProjectWorkpapers`, agent/release/governance/style sanitizers and presentation/HTML rules run on candidates. Candidate-bound frozen `state` gives reference checks the real imported roster; `finally` restores the old state. A private busy fence rejects concurrent invocation during Mermaid awaits. Explicit known fields, list lengths/order and identities must survive; absent defaults are permitted without being merged into originals. Unknown keys are excluded from finite semantic projections and preserved as original opaque data.

Code projection retains opaque metadata for the genuine frozen library budget while replacing verified linked content with empty text. Drafts are validated separately (IDs, generation, finite legacy association, source/base pointers, bounded name/language, no inline history). Original references are checked structurally here; manifest membership, complete reference metrics, actual source bytes and the unchanged pointer graph remain the native parser/copy boundaries' responsibility. This helper cannot admit a bundle independently of that preflight.

There are two deliberately narrow current-native presentation compatibility cases: inactive `headerRow` on an empty non-table title/text card, and the exact native `body`/escaped-HTML representation preserving authored whitespace. Only those values are omitted from the comparison after their contract is checked. Actual frozen HTML validation remains required; original values are returned. Native tables fit frozen table limits without a wider table exception.

After every gate succeeds, `stampWorkpaperFileSignoff` runs on original documents with original review. Existing claims survive through the established as-written history. No replacement workpapers, sanitizer defaults or projected content are saved. Frozen `digestHeld` still compares its original metadata-word digest; it does not attest to external source bytes or independent approval.

## Verification and retained adverse evidence

The initial TDD RED is retained as `evidence/source-bundle-metadata-red.log`: seven deliberate assertions failed because the helper did not exist. Current unit tests pass **9/9**, including pointer/opaque preservation, sparse documents, refused field/array loss, no persisted defaults, state restoration, inline collisions/drafts, history, prototype-named data and concurrent invocation. Unit dependencies are observable doubles, explicitly **not proof of frozen sanitizer semantics**.

The owned Electron probe at `evidence/source-bundle-metadata-native/2026-10-06T20-57-17.513Z/` returned **COMPLETE, exit 0**, with 13 cases and 13 closed/destroyed hidden sandboxed windows, no preload, and zero remaining windows. It builds an actual owned `ProjectStore`/`SourceRepository` source manifest and recovery checkpoint, exports through actual `exportSourceSnapshot`, verifies exported hashes, then sends **metadata only** through `validateImportedBundleMetadata` and the real hidden frozen engine.

The positive case preserves sparse Home Docs, Table/title/text cards including whitespace, linked Code/knowledge sources, archived source rows, a superseded release approval, original opaque provenance, a planned test row, two draft pointers and candidate-bound `dangling:false` references. It transforms only the expected file-signoff claims; the actual export file remains byte-identical. Twelve negative cases refuse unsafe Docs/presentation HTML, document truncation, an unknown block kind, empty test-evidence row dropping, a draft release's approval loss, seven archived revisions, 81 Code files, duplicate document identity, invalid Mermaid, inline source collision and draft inline history.

**Integration boundary:** this successful run records `ownedHelperInjection:true` in `prepared.json`. At that point root had not yet integrated the helper in `build/import-validation.mjs`. The probe's explicit `--allow-owned-helper-injection` development mode inserts the exact helper into its own generated entry, recomputes genuine script CSP hashes, and pins the resulting entry hash. Therefore it proves actual frozen semantics for these inputs, **not builder/main integration**. The default probe refuses a missing integrated helper and can be rerun after root injection for that separate evidence class. No shared generated application input was edited.

Three earlier native adverse runs are retained at `20-54-17.810Z`, `20-54-33.618Z` and `20-54-57.748Z`: the initial probe incorrectly appended the helper after CSP generation, so entry readiness was refused before the helper ran. Passive creation/validation diagnostics identified `IMPORT_ENTRY_REFUSED`. The harness was corrected; these outcomes are not product semantic defects and are not overwritten.

`node --check` passed for the helper and both native files; current `git diff --check` produced no diagnostics. No global full suite, hosted CI, packaged application import, main-route selection, maximum-size import or physical UI interaction was run by this author. The frozen nonempty-diagram, 80-Code-file and other established domain caps remain explicit refusals; a structurally valid schema-2 source-only synthetic manifest is not automatically a complete importable workspace.

## Exact implementation/evidence identities

```text
build/source-bundle-metadata.mjs 92e1af5c3e8abb5300935974629bf6faecea9ac8c89b482cf38f0f453985dbd9
tests/source-bundle-metadata.test.mjs 049f8de3cc98ffcfa2c3e57c49d0616a7ab35741b16d5f26e9a868bf3b423c6d
tests/native/source-bundle-metadata.mjs b1a20684b6476e111ffc6755ead2fa0256892a25c8a6a0cdb099fe9a2a5c4c5e
tests/native/source-bundle-metadata-app.mjs 41e6c86288aef8b009c6f684424f1f56c85b048ec359a3decbc1953b0cddff57
evidence/source-bundle-metadata-red.log 83cca8712068280a824d420a3d244b03ce4ee05650be3db0c67e77f21dcd73e4
successful result.json cd275a8cd9b5793ea650919e6605bd450f0851f1c0e109d37fd0a0b6846138e7
successful native-result.json 2e5e78ffe24e428a53526b9e1ed9ac90e1d517e7f2b93fe99c05921572d23946
actual-export.siren-backup eefeb059e9a811f53e238572477f45daf5a04a6921df67f4c2372054f2707b9f
```

The native receipt retains all source/build/transport input hashes and confirms they remained unchanged during the successful probe. The frozen baseline remains `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4`.
