# Independent limited review — legacy export access/cleanup correction

Author: `/root/media_batch_review`. Reviewed uncommitted `desktop/src/main.mjs` and the new `desktop/tests/legacy-export-access.test.mjs` relative to `518a3306404c031f3b6c48a92e567efbd7a95712`. I ran focused units and my own distinct Node probes. No product/root-test/generated changes or GUI launches were made. This is **CHANGES REQUESTED for one demonstrated integration defect**, not a global verdict or release/package/CI approval. The original schema-2 audit and its adverse reproduction remain unchanged.

## Exact reviewed identities

```text
src/main.mjs e1df2ca7e5c8ac80cb7c8fc3bb5eff4b09c1f043604bc3db0460df7e6ce4e371
tests/legacy-export-access.test.mjs caabce6f164bba649d17c5ea0b62d1f1f2b4c48c5a8da5b282b2ad3bacaa0d03
evidence/export-access-correction-review-2026-10-06/probe.mjs cc410b2a2a6e1c0758578f19287b565b0a43cb56bb0ed547f33441bb5f4eaabf
evidence/export-access-correction-review-2026-10-06/result.json dfd298e52457543c524fad5feba519a3ab9ba889830e4c251f36459e36132317
```

The root test file grew from the initially inspected 14 cases to 16 during this review; the hash above is the 16-case version I actually ran and read. Main remained at the hash above throughout the probes. Findings apply to these identities; subsequent corrections require separate verification.

## [P2] A correctly cancelled export makes actual Lock fail and leaves SIREN unlocked

Relevant source: `desktop/src/main.mjs:203–206` tracks the raw atomic-write promise; `:229` joins `writes` in `lockPin`; `:527` revokes export epochs during preparation.

The new helper correctly rejects an export when Lock invalidates authority before rename. However, it puts the raw rejecting `atomicWrite` promise in `writes`. The caller catches `ACCESS_REFUSED` and returns a normal refusal, while the concurrent Lock service independently awaits the raw rejection through `Promise.all([...writes])`. That rejection sends Lock into its save-failure rollback even when the cancelled export was cleaned successfully and no document save failed.

My own probe executes the **actual extracted** `captureLegacyExportAccess`, `exportBytes`, `prepareNativeWorkspace`, `rollbackNativePreparation`, `exportProject` and `lockPin` bodies in a VM, using small controlled Electron/owner/access facades and the actual filesystem writer. It pauses the writer at `before-rename`, starts the real extracted Lock service, waits for preparation to invalidate the epoch, then releases the writer. Results:

- Export returns `ACCESS_REFUSED`.
- Existing destination remains exactly `original destination`.
- Temporary file is removed and the tracked writes set becomes empty.
- **Lock returns `{ok:false,code:'SAVE_FAILED'}` and unlocked remains `true`.**

This is the fifth observation in the retained independent result. The final own probe intentionally exits 1 with `status:CHANGES_REQUESTED` for that remaining defect. It is not a claim to have driven production PIN cryptography, Electron's actual OS dialog or the full native-window roster. The integration failure follows from the actual service/drain bodies rather than a guessed native UI cause.

The necessary distinction is between a clean, expected export revocation and a genuine storage/cleanup failure. The latter must remain a failure. `atomicWrite`'s existing `cleanupPending:true` currently treats cleanup as best effort and suppresses deletion errors; I did not reproduce a deletion-refusal case in this review, and therefore do not assert that every cancelled staging file is guaranteed removed. A correction must not assume the original `ACCESS_REFUSED` alone proves cleanup succeeded.

## What the correction demonstrably improves

The captured capability binds actual main contents/frame/URL, selected generation/project/mode, unlocked/transition state and a monotonic export epoch. Preparation increments the epoch before awaited work, so rollback does not restore old authority. Capture begins before project/recovery/diagnostic reads, and the helper rechecks after the dialog. Atomic writes use export-specific temporary cleanup and remain tracked until readback. Already renamed publication is deliberately allowed to finish while Lock drains it.

My own retained probe exercises eight observations:

1. Project chooser stays revoked after actual extracted Lock completes and a controlled unlock follows.
2. Recovery chooser behaves likewise.
3. Refused preparation and actual extracted Lock rollback leave the old chooser revoked even though access is still unlocked.
4. An already-renamed export remains tracked while readback is held; Lock does not finish early. Releasing readback gives export success, then Lock success and locked access.
5. The before-rename cancellation/Lock failure above.
6. Read-only saved export remains available.
7. Dialog cancellation does not publish.
8. A directory collision at the selected filename refuses the output and leaves no staging file in the ordinary writable-parent case.

No large fixture was allocated. The prototype original schema-2 byte/provenance audit remains a separate evidence class; these correction probes focus on lifecycle and actual file cleanup with tiny bytes.

## Independently executed checks

From `desktop/`:

- `node --test tests/legacy-export-access.test.mjs`: **16/16 passed**, exit 0.
- `node evidence/export-access-correction-review-2026-10-06/probe.mjs`: **exit 1**, retained adverse observation above; seven other observations succeed.

The 16 root cases meaningfully cover chooser revocation, captured identity/mode/generation, project/recovery read invalidation, ordinary cleanup, cancellation, read-only and diagnostics behavior, and already-committed publication joining actual Lock. They do not cover actual Lock while an export is still at the pre-rename revocation boundary; the own probe supplies that missing interaction. Passing those units therefore does not negate the finding.

No native/package/hosted regression outcome is asserted. In particular, none of these checks explains or closes the earlier hosted Docs-select or Guided-menu failures.
