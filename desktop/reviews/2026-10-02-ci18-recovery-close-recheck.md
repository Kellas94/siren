# Independent CI18 recovery and close recheck

Scope: actual native recovery regression and renderer close-boundary review. This report corrects the incomplete source attribution/recommendation in `2026-10-02-ci18-recovery-zoom-diagnosis.md`; the original adverse evidence and report remain preserved. It does not approve a release or establish remote CI success.

## Recovery cause correction and adverse repair evidence

The initial restore-currentZoom patch, generated renderer `9bc8705b9703c525c5c1a4a6b70fa3bb9332614174f39d0db603791006153fa0`, did not fix the exact CI18 prompt. First-start replay `reviewer-ci18-recovery-2026-10-02T16-10-43.227Z` retained the actual open prompt and live zoom100/draft31 mismatch.

A further first-start observational CDP trace (`reviewer-ci18-recovery-2026-10-02T16-12-20.489Z`) captured the precise sequence: load aliases31; restored currentZoom31; renderDiagram setZoom31; fitStructuralPreview → fitToWidth → setZoom100 during applyMultiPreviewMode under initialize; later initialize synchronizes the already changed zoom100. This is the first captured 100 mutation, caused by synchronous structural-preview auto-fit before recovery. The earlier hypothesis that alias synchronization alone caused the mismatch was incomplete. The successful first patch restores runtime zoom correctly, but auto-fit still mutates the live view before comparison.

Root's repair captures a cloned state immediately after applying loaded controls, before preview startup, and passes that state to the existing recovery comparison. The full signature, structural fit behavior, and recovery choice remain intact. Exact CI18 bag replay on renderer `bfd7d52557814c9e2272ee53c7eb0a7839d58f5b805bb7e5cf308b29b860053f` had equal lexical signatures and no prompt (`reviewer-ci18-recovery-2026-10-02T16-15-10.401Z`). A separately modified genuine Mermaid draft had unequal source and an actual undismissed recovery prompt (`reviewer-ci18-recovery-2026-10-02T16-15-36.530Z`).

## Checked-in native regression

Added `tests/native/recovery-zoom.mjs` and `tests/fixtures/recovery-zoom-state.json`. The complete normalized fixture derives from an owned native project, with synthetic source, zoom31, and no private user data. It has no dependency on CI logs or ignored evidence. Each case creates its own native project and recovery checkpoint, then observes the actual lexical comparison and confirmation without dismissing it.

All four cases passed on renderer `e0ab60a0d279ef1d7c135d7fbee1675c6e1af56b760bfd311b86078653a0b1b3`, evidence `desktop/evidence/recovery-zoom-2026-10-02T16-17-28.941Z`:

- Matching saved state and draft: comparison retains restored zoom31 and no recovery prompt.
- Genuine changed draft source: confirmation stays open; original source remains displayed.
- Genuine changed draft zoom45: confirmation stays open; comparison does not discard zoom differences.
- Genuine draft-only document: confirmation stays open and includes the draft document.

The test records actual comparison values, bootstrap bag, screenshots, and logs. Its native source SHA256 is `a0fd2710547bcf7167632a6a6e0bbd3b795a5900ac3e85f21c71db63dabba974`; fixture SHA256 `107ff1745b9b269fed5a3928b19c87906db09c29ca2f7dcfa41c3f9a0145668d`.

## Close queue review and discovered flush gap

Reviewed the root's serialized complete-save operation and two initial close tests. Those cover overlapping workspace saves while the first workspace receipt is pending, including rejecting the newest failed receipt. A separate exact-source VM probe with the real native storage adapter found a later boundary: close's workspace drain can finish, then its native flush waits for a private recovery write; a newer workspace save queued during that flush was not in the captured flush promise. On renderer bfd7, close returned success while this newer receipt was pending, then that receipt failed. Original `reviewer-close-late-private.mjs`/`.json` preserve this failure. This was a renderer-level synthetic IPC timing reproduction, not actual Electron data loss; main's writes drain was outside its scope.

Root's repair repeats workspace drain and native flush until both captured promise identities remain current, then validates the latest workspace status and flush result. Independent probe `reviewer-close-late-private-recheck.mjs`/`.json` against renderer e0ab showed close remained pending until the late receipt, then rejected `Save not acknowledged: failed`; the original adverse probe was not overwritten. All four current `tests/close-drain.test.mjs` tests also passed independently, including late-private-flush success/failure.

No further integrity defect was established in this scoped review. These checks do not prove native unload write durability or cover every main-process exit timing. The previously observed clean-exit flag `no` after actual normal exit remains a separate recorded limitation. Remote CI18 failures are retained; a new authenticated CI run must qualify the repaired source.

Builder SHA256 at recheck: `6d9dd4fac75d491e41765a7527a9091d1f7c482041851b92f1a97f0eb66bf717`. Root owns product patches; reviewer additions are the native regression/fixture, own probes, and this report.
