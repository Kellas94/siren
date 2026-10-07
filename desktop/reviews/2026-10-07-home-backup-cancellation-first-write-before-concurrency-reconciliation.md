# Home backup cancellation: read-only cause analysis

Author: /root/catalogue_view. 2026-10-07T16:14:24.373Z. Source inspection and retained original hosted evidence only; no product/test/build/GUI execution or edits. Suggested tests below have **not** been run by this review.

The failing equality is stale relative to the composed Help DOM. However, a normal user cancellation receiving **Explain error** is also a small UX defect; simply relaxing the assertion would leave that defect visible. No original failure is reclassified as a pass.

## Causal chain supported by code and original receipt

1. `src/ui/workspace/home.js:42` starts saved-backup export. After the current-operation guard and success branch, line49 sends every non-success to the message plus shared Help. Unlike generic `perform` at line36, this route has no cancellation early return.
2. `src/ui/workspace/guide.js:3` supplies **Backup export cancelled.** The explicit mapping at `src/help/catalog.mjs:55` routes project/backup/CANCELLED to the backup-unavailable article. This confirms wiring, not a design approval to treat cancellation as an error.
3. `src/ui/shared/help-workspace.js:18` creates **Explain error**, and line19 appends it as a child of the same status element. `homeStatus.textContent` therefore concatenates message and button caption.
4. Original receipt `evidence/workspace-surface/ci37647458513/desktop-native-desktop-evidence-original/evidence/home-backup-export-native/2026-10-07T16-04-13.697Z/result.json` records {"url":"siren://app/home.html","mode":"normal","busy":"false","status":"Backup export cancelled.Explain error"}. The cancelled chooser call was delivered. The first exact saved-bundle export already passed; the next cancellation wait failed at `tests/native/home-backup-export.mjs:71`. No evidence here establishes lost content, a failed chooser cancellation or Home remaining busy.

Inputs and their current-vs-hosted hashes are in the JSON. Exact observed export implementation is captured there so a later owner edit cannot silently change this analysis.

## Minimal recommendation

Add a narrow result.code===CANCELLED branch in Home exportSavedBackup after the current operation/epoch guard and success handling: set the existing neutral cancellation message, then return before shared explain. Keep finally releasing busy. Do not alter exporter/chooser authorization or the public finite receipt. Leave the catalog entry searchable and preserve actual failure Help.

Retain exact neutral cancellation text and idle state; add an explicit absence check for .siren-help-error in homeStatus. Do not fix this only by weakening equality to startsWith: that would accept the misleading cancellation CTA.

Do not change generic Help offer wording or all cancellation mappings globally within this isolated fix. A general severity/status contract would need its own design review.

## Relevant verification to retain or add

- `tests/home-commands.test.mjs`: Load the real shared Help adapter/resolver alongside actual Home/guide in a VM fixture (or separately assert no explanation is requested). A cancelled export leaves exact neutral text, no error CTA, busy false, no navigation, one bridge call. Existing cancellation test only matches /cancel/i and has no Help adapter, so it misses this composition. Follow a real backup failure with cancellation and then success: previous error CTA must disappear; genuine BACKUP_BUDGET/BACKUP_UNAVAILABLE/BACKUP_WRITE_FAILED still offer scoped Help. Cover a pending operation, resume and settle the old cancellation/error: it must not repopulate private status or Help.
- `tests/help-view.test.mjs`: Preserve genuine scoped diagnosis, literal rendering, bounded offers and Lock/epoch retirement. Do not remove support for browsing the backup article.
- `tests/home-backup-export.test.mjs`: Preserve finite CANCELLED result, no publish success, and next-operation pending-slot release.
- `tests/home-backup-publication.test.mjs`: Preserve actual chooser cancellation producing no destination or staged file; retain atomic/publication and Lock revalidation tests.
- `tests/native/home-backup-export.mjs`: Keep exact cancellation plus busyfalse; assert no cancellation error CTA; retain source-bundle exact export, output directory equality, actual native shortcut, one chooser under concurrency, Lock/Unlock revocation, fresh export and byte identity. Run as new development/copy evidence only after owner repair.

## Evidence boundaries

- This report performs no new runtime or VM tests. Suggested tests are explicitly proposed, not passed.
- Original37647458513 remains FINAL FAILURE. No source edit or new successful result changes the original receipt, failed/skipped step order or authorship.
- Owner may repair and qualify new bytes separately. This review is not post-fix validation or release approval.
