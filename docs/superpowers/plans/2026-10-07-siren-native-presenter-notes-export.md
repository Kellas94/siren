# Native Presenter: deliver captured speaker notes

Next bounded functional-parity batch under the approved desktop workspace plan. Source analysis by actual author `/root/disk_inventory`: `desktop/reviews/2026-10-07-native-presenter-notes-export-parity-analysis.md`, SHA256 `2f09973f1a3778339bf68750f6ea9be9fac242af1687ef0cead5c33181c45916`. Analysis only; implementation has not started. Qualify and synchronize current Docs export first.

## Contract

- Add **Export captured notes (.txt)** and **Show file** beside private Presenter notes. Preserve playback, Refresh, deck editing, theme and common navigation. Explain that it exports the captured presentation, which changes only on explicit Refresh.
- Main accepts only expected deck version, captures the genuine own Presenter grant/session/epoch and obtains the existing immutable `PresentationSession.getPresenter` projection. Audience and other roles receive no private notes authority; renderer supplies neither text, paths, project nor slide body.
- UTF-8 plain text preserves ordered slide IDs/titles and exact captured note strings, deck title/ID/version. No claim of PDF, PowerPoint, slide-image or full note-metadata parity: the current projection deliberately has only text, not owner/reference/duration/checkpoint. Do not fetch latest project fields into an older captured deck.
- Bound encoded output at8MiB before allocation, with at most2 pending jobs globally/1 per Presenter. No truncation or silent slide omission. Normal navigation may continue without invalidating the captured deck; Refresh/session replacement/Lock/retirement must revoke stale publication.
- Publish unique main-generated `presentation-notes-UUID.txt` in the actual project's owned exports directory, exclusive stage/write/sync/rename/exact readback. Return finite identity/hash/version receipt, no note body/path. Reveal only same live window's retained receipt after rehash.
- Integrate pause/abort/drain/quiescence/rollback/retirement alongside current exporters. Unretained publication is cleaned before drain; uncertainty permanently fences further exports and refuses quiescence. Keep original existing exports. Do not refactor unrelated Diagram publisher while its historical hosted timeout cause is open.

## Implementation and evidence

1. Meaningful failing formatter tests: Unicode, embedded newlines, blank notes, exact order/IDs, overview/600 slides and byte limit. Implement finite serialization without another library.
2. Real registry/session/store/filesystem publisher tests: exact captured version despite newer saved data, current frame/role/hash/extras refusal, concurrent jobs, Lock/Refresh before and after rename, cleanup uncertainty, changed-file/foreign receipt refusal. Explicitly qualify readonly behavior before advertising it.
3. Finite preload/main/UI integration and actual dirty/lifecycle boundaries; verify Audience receives no notes fields or export capability. Preserve existing private/public split and theme/CSP admission.
4. Genuinely independent review with original findings retained, real RED/GREEN corrections and separate rechecks.
5. Freeze candidate, complete fullsuite/build plus exact ASAR/dependency/helper/runtime comparison. Execute actual native control, captured-old versus refreshed-new notes and common Lock cases in development and genuine copied package. Hosted verdict separate; no main merge, production release or installed replacement implied.

## Status

Source-supported missing route registered; no Presenter product/test changes or qualification claims. PDF/full metadata, physical multi-monitor and maximum scale remain separate work.
