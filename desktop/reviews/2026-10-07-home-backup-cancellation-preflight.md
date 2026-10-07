# Home backup cancellation: original-cause readback

Author: /root/catalogue_view. Reconciled 2026-10-07T16:16:13.986Z. Read-only source/evidence inspection, **no new runtime or VM tests**. Suggested tests are recommendations, not passed checks.

The hosted equality was stale relative to the composed Help DOM. A normal user cancellation receiving **Explain error** was also a small UX defect; relaxing the assertion alone would leave that misleading control. Original37647458513 remains FINAL FAILURE.

## Exact original causal chain

The owner-preserved `evidence/workspace-surface/home-backup-neutral-cancel/home-original.js` is byte-identical to the hosted capture for `src/ui/workspace/home.js` (SHA256 bf4271ffd2956461882f9b2badea59116788441df5a95d9115bf84e5ae814db7). The original native fixture and Help-view test also match their hosted input hashes; all identities are in the JSON.

1. Original `home.js:41–51` starts saved-backup export, checks current operation/epoch, then handles every non-success through the message plus shared Help. It lacks the cancellation early return already present in generic `perform`.
2. `src/ui/workspace/guide.js:3` supplies **Backup export cancelled.** `src/help/catalog.mjs:55` explicitly maps project/backup/CANCELLED to backup-unavailable. This proves code wiring, not a design decision to label normal cancellation as an error.
3. `src/ui/shared/help-workspace.js:18–19` appends a child **Explain error** button to the supplied status host. Full `textContent` therefore includes both captions.
4. Original `evidence/workspace-surface/ci37647458513/desktop-native-desktop-evidence-original/evidence/home-backup-export-native/2026-10-07T16-04-13.697Z/result.json` observes {"url":"siren://app/home.html","mode":"normal","busy":"false","status":"Backup export cancelled.Explain error"}. The cancellation chooser was delivered, waiting/configured are false, and the first exact saved-bundle export passed. The later cancellation equality failed at native `home-backup-export.mjs:71`. Nothing here establishes corrupted content, failed chooser cancellation or permanent busy state.

## Recommended repair boundary

Add a narrow result.code===CANCELLED branch in Home exportSavedBackup after the current operation/epoch guard and success handling: set the existing neutral cancellation message, then return before shared explain. Keep finally releasing busy. Do not alter exporter/chooser authorization or the public finite receipt. Leave the catalog entry searchable and preserve actual failure Help.

Retain exact neutral cancellation text and idle state; add an explicit absence check for .siren-help-error in homeStatus. Do not fix this only by weakening equality to startsWith: that would accept the misleading cancellation CTA.

Do not change generic Help offer wording or all cancellation mappings globally within this isolated fix. A general severity/status contract would need its own design review.

## Relevant checks

- `tests/home-commands.test.mjs`: Load the real shared Help adapter/resolver alongside actual Home/guide in a VM fixture (or separately assert no explanation is requested). A cancelled export leaves exact neutral text, no error CTA, busy false, no navigation, one bridge call. Existing cancellation test only matches /cancel/i and has no Help adapter, so it misses this composition. Follow a real backup failure with cancellation and then success: previous error CTA must disappear; genuine BACKUP_BUDGET/BACKUP_UNAVAILABLE/BACKUP_WRITE_FAILED still offer scoped Help. Cover a pending operation, resume and settle the old cancellation/error: it must not repopulate private status or Help.
- `tests/help-view.test.mjs`: Preserve genuine scoped diagnosis, literal rendering, bounded offers and Lock/epoch retirement. Do not remove support for browsing the backup article.
- `tests/home-backup-export.test.mjs`: Preserve finite CANCELLED result, no publish success, and next-operation pending-slot release.
- `tests/home-backup-publication.test.mjs`: Preserve actual chooser cancellation producing no destination or staged file; retain atomic/publication and Lock revalidation tests.
- `tests/native/home-backup-export.mjs`: Keep exact cancellation plus busyfalse; assert no cancellation error CTA; retain source-bundle exact export, output directory equality, actual native shortcut, one chooser under concurrency, Lock/Unlock revocation, fresh export and byte identity. Run as new development/copy evidence only after owner repair.

## Concurrent owner work and evidence boundaries

The owner implemented the narrow early return during this readback. The first report write described the original omission but captured already-edited current Home bytes; both first-write files are preserved at `reviews/2026-10-07-home-backup-cancellation-first-write-before-concurrency-reconciliation.{md,json}`. This reconciled report uses hash-matched original source for the cause and separately records current owner-edited source. It neither claims the original defect persists in new bytes nor validates the new repair. A distinct independent fix review will cover that.

- Current owner repair exists during the reconciled capture. No independent repair verification is claimed here; proposed checks may already have owner evidence, which remains separately attributed.
- This report performs no new runtime or VM tests. Suggested tests are explicitly proposed, not passed.
- Original37647458513 remains FINAL FAILURE. No source edit or new successful result changes the original receipt, failed/skipped step order or authorship.
- Owner may repair and qualify new bytes separately. This review is not post-fix validation or release approval.
