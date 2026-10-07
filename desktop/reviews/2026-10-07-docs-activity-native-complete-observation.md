# Docs Activity development native observation and retained-file readback

Harness/controller author and this report's inspector: `/root/media_batch_review`. Actual native executor: `/root`. I inspected the retained receipt, relevant assertion source, synthetic saved files and dark screenshot; I did not execute or independently observe the live GUI. This is bounded development evidence, not independent native approval or release qualification.

## Actual final development receipt

`evidence/docs-activity-native/2026-10-07T03-45-49.878Z/result.json`, SHA-256 `efea24101b07aa8e8b6ba7c105db02017215f3de46f26700739ace398c9c93ae`, records **COMPLETE, eight cases**, ending at `2026-10-07T03:46:11.323Z`. All 609 captured before/after input paths match (`changedInputs: []`). Harness SHA-256 is `63f7fe40c7ad63fb5271c65e5cb9dc7c2a6c09e9b21b6b38054617be3e9a72f9`.

The fixture contains 60 blocks, 65 recorded comments, six recorded revisions, a 49,548-byte initial document and a 21,893-byte Python source. The eight completed assertions cover:

1. Readonly All/Open/Resolved filters and original-position paging, a jump beyond the initial forty rendered blocks without replacing the original reading card, and refusal of a dangling jump.
2. Inert recorded review/release/file provenance, exact saved and formatting/opaque-field comparisons, and readonly-working/oversized/ambiguous-ID refusals without false equality.
3. Rich DOM/selection and image-caption selection retention while opening Activity; explicit saved versus unsaved comparison; unapplied Context owner retained until genuine Escape cancellation.
4. Independent working-window Activity state, acknowledged Save preserving other data, and stale-peer Save refusal retaining exact local title/heading text.
5. Common Lock refusal/rollback with the fenced peer and retained unsaved content, followed by explicit confirmed reload and readonly Refresh adopting the real saved version.
6. Dark/light screenshots at emulated 944×575, no whole-page horizontal overflow, and attach/detach retaining editor/Activity/renderer identity.
7. Actual saved JSON export retaining the exact raw document and provenance/source pointers without foreign-document bytes.
8. Final common Lock reaching locked mode, clearing the bootstrap snapshot, retiring all private native window targets, and preserving the exact saved project/source/checkpoint.

The selected rich text `al>` and HTML `<p>Unsaved rich context Ș😀 &lt;literal&gt;</p>` match before/after Activity opening. The captured image-caption selection remains 0–3 with exact `Unsaved image caption Ș😀` text. These are bounded fixture assertions, not a general proof of every editor selection mode.

## My additional read-only file checks

I reread the retained current manifest, its revision 3, prior revision 2, exported archive and source blob. Exact comparisons confirmed:

- The 93,912-byte archive, SHA-256 `1ea23a7b52a4be3a4ff40fb55d70e99bd8d198e1754cb39e76e2b4cd9df214cc`, equals the entire saved raw document and its document digest. It excludes the other document's fixture token.
- Revision 3's workspace equals revision 2 with only the acknowledged rich HTML and image caption changes. Original owner, title and heading remain unchanged; the peer's unsaved title/heading were not published. All other activity, unknown fields, diagrams, source pointers and foreign-document data remain exact.
- The 21,893-byte source blob equals the deterministic 1,000-line BOM/CRLF/Unicode source byte-for-byte, SHA-256 `4af67f0ccee3f1b45092de64b8b83d1867c5d302bc5342dd28b7cb2de7b4807f`; saved source references equal the prior manifest.

Own readback receipt: `evidence/workspace-surface/docs-activity-native-prepared/complete8-readback.json`, SHA-256 `4d3df93f090a0c6814a8a7b4770ee04c68766f80f81c573b3e0ef20cc101c402`. This is post-execution inspection, not a second application execution.

The inspected dark screenshot is readable and uses the shared shell/theme with the compact Activity disclosure. It also clearly shows the nonmodal panel overlapping editor content; uncovered controls remain visible, but the underlying covered controls require closing the disclosure. This is not a physical multi-monitor UX check or a full visual audit. Dark screenshot SHA-256: `2d2932c0646b7cfbb5e6b5540022316f4382227b285848206176f415f16452d3`; retained light screenshot SHA-256: `865b58cfbd6a6b4845897f7c3643ce3153a978cbb1aee96b7e70e7cf41d76bc4`.

## Adverse history remains separate

The original 47a8 run remains ADVERSE3 at `2026-10-07T03-33-14.131Z` (receipt SHA-256 `18372586c2baff424c879a5dc956d8ec358a69851f8efb1cac96686517931bbd`). The e5ea second run remains ABORTED without a final receipt, verified case count or unchanged-input capture; owner record SHA-256 `25e2d6154e6945ffe083d78727b7d707e595f621d17f43ff2a145e68c1ed4d49`. Both original harness snapshots and separate analysis/amendment reports remain retained.

The final harness corrects genuine disclosure sequencing before covered title/heading/Reload controls and attaches immediate rejection handling to the dialog click promise. It preserves trusted input, hit tests, exact data oracles and deadlines. Later completion does not erase either adverse attempt or retroactively supply their missing evidence. No historical Save-to-Attach issue is closed here.

## Input boundaries and limitations

Fresh selected source readback matches the native receipt: controller `9411ea58bd12357364cd5a852d573e021cac7372e1a6a3133bffe82ecc125ca4`, window `0f27116fbb2e843b7586bae47939599c1e75794f43ebbcf196f68d34f444c652`, generated Docs `ec39d7c0a9b6ddd33f1607cca6e9c23e3a5a351b39572ff4bd3ab9949375e91d`, attach helper `9adda5678dc537c070fe9dc3c8911f7efa8ba37f81637f434c61fe7b8b3fb7bb`, pointer helper `a55d6f22b8fb1fbb781e4d3ac32710fab622e49b1153046ebcbea57dcf4ddd8d` and final harness63f7.

A fresh inspection of all 609 captured paths after execution found one current difference: `../.github/workflows/desktop-verify.yml`, consistent with root's subsequent CI wiring. That current workflow difference is distinct from the native receipt's unchanged during-run inputs; this report does not claim the later workflow was executed by the native run.

No copied-package, hosted, full-suite, release, maximum-size, physical monitor or write-review/release qualification is claimed. Root's full suite was still running when this report was authored. No source/build/script/test/workflow/generated edits, GUI, package or commit operations were performed for this readback.
