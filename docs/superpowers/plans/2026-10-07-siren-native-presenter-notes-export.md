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

Implementation in progress locally: pure bounded notes formatter, own Presenter publisher, finite Presenter-only preload/main barrier/retirement routes, captured-notes action/Show file, themed private notes header and package admission. Focused actual service/main tests10 pass, including global2 budget and Refresh/session replacement after actual rename; formatter3/controller4/preload/package and mounted UI tests pass in scoped runs. No full-suite/native/copied/hosted qualification yet. PDF/full metadata, physical multi-monitor and maximum scale remain separate work.

## Rulings and execution ledger

Ruling: unchanged deck Refresh retains captured version semantics; a changed captured version or session invalidates export/reveal — normal navigation also retains version — no latest saved fields are mixed into old captured notes. Expected cost if wrong: change the session projection contract and qualify again.

Ruling: native pending Lock is not claimed from a synchronous formatter or an invented test-only main delay — deterministic pending/after-rename revocation is qualified by actual registry/session/store/filesystem tests and real main barrier tests; native ordinary common Lock is a separate observation — a true native pending-export Lock case remains an explicit unqualified scope.

Task1 formatter: watched missing-function RED, then3 GREEN; UTF-8 byte-count-before-final-allocation and600-slide retention. Task2 publisher: watched missing-service RED, then real service7 GREEN after adding global pending2 and actual post-rename Refresh/replacement cases. Task3 integration: watched finite preload/package/main missing-route RED and actual mounted UI missing-action RED, then scoped GREEN. Existing playback Space intercepted focused controls; genuine UI regression RED then interactive target guard GREEN, preserving native button/select/text defaults and canvas navigation.

Separate hosted Docs candidate f608 / run37546239582 original Windows unit failure is preserved. Root reproduced seven cleanup-hook failures from TEMP spelling aliases, corrected only fixture canonical parent equality, and added actual child regression. Its inherited NODE_TEST_CONTEXT harness setup failure is retained separately. See owner debugging report2026-10-07-docs-hosted-temp-alias-correction.md. This correction does not rewrite the previous hosted verdict.

## Frozen candidate verification checkpoint

Final working-tree suite result `desktop/evidence/workspace-surface/presenter-notes-final-suite-2026-10-06T23-41-06.566Z/result.json`: COMPLETE, identity3 + units1314, zero failures/skips/cancellations, all captured inputs unchanged. Actual development Presenter6 COMPLETE and current Docs7 COMPLETE are separate native observations. Root personally inspected Presenter themed controls; genuine independent review original and corrected recheck are retained separately.

Final-delivery correction: publication accepted before Lock/changed Refresh may leave its accepted file on disk, but after awaited cleanup the service now refuses stale success/reveal receipt. Deterministic production-class phase regressions watched RED then GREEN for both exporters. This does not claim a native pending-Lock observation.

Copied-package build, exact ASAR comparison, native copied tests and a new hosted run are still pending at this source checkpoint. Existing hosted Docs run37546239582 remains FINAL FAILURE; fixture TEMP canonical spelling correction is qualified locally, not a rewrite of that verdict. No production release, merge or installed replacement.
